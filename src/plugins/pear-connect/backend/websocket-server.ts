import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

import type {
  RemoteClient,
  WebSocketMessage,
  MessageType,
  AuthRequest,
  PlaybackState,
  QueueItem,
  PlaybackTarget,
} from '../types';
import type { PearConnectConfig } from '../config';

const SUPABASE_URL = "https://yalwnibhsrmhomjifwdb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbHduaWJoc3JtaG9tamlmd2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzI3MzEsImV4cCI6MjA4ODIwODczMX0.i_IQn3H5vbAmA4JrWDBaBFrKHWWh-_5PCZOrkKP3djA";

export class PearWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, { ws: WebSocket | 'supabase'; client: RemoteClient }> = new Map();
  private config: PearConnectConfig;
  private pendingAuth: Map<string, { code: string; expiresAt: number }> = new Map();
  private currentPairingCode: { code: string; expiresAt: number } | null = null;
  private lastQueue: QueueItem[] = [];
  private lastState: PlaybackState | null = null;
  private onPlaybackControl?: (action: string) => void;
  private onVolumeControl?: (volume: number) => void;
  private onSeek?: (time: number) => void;
  private onPlayQueueItem?: (index: number) => void;
  private onPlayVideoId?: (videoId: string) => void;
  private onRTCOffer?: (clientId: string, offer: unknown) => void;
  private onRTCAnswer?: (clientId: string, answer: unknown) => void;
  private onRTCIceCandidate?: (clientId: string, candidate: unknown) => void;
  private onGetLyrics?: (clientId: string) => void;
  private onToggleImmersive?: () => void;

  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  private supabaseChannel: RealtimeChannel | null = null;

  constructor(config: PearConnectConfig) {
    this.config = config;
    // Generate initial pairing code
    this.generateNewPairingCode();
  }

  setCallbacks(callbacks: {
    onPlaybackControl?: (action: string) => void;
    onVolumeControl?: (volume: number) => void;
    onSeek?: (time: number) => void;
    onPlayQueueItem?: (index: number) => void;
    onPlayVideoId?: (videoId: string) => void;
    onRTCOffer?: (clientId: string, offer: unknown) => void;
    onRTCAnswer?: (clientId: string, answer: unknown) => void;
    onRTCIceCandidate?: (clientId: string, candidate: unknown) => void;
    onGetLyrics?: (clientId: string) => void;
    onToggleImmersive?: () => void;
  }) {
    this.onPlaybackControl = callbacks.onPlaybackControl;
    this.onVolumeControl = callbacks.onVolumeControl;
    this.onSeek = callbacks.onSeek;
    this.onPlayQueueItem = callbacks.onPlayQueueItem;
    this.onPlayVideoId = callbacks.onPlayVideoId;
    this.onRTCOffer = callbacks.onRTCOffer;
    this.onRTCAnswer = callbacks.onRTCAnswer;
    this.onRTCIceCandidate = callbacks.onRTCIceCandidate;
    this.onGetLyrics = callbacks.onGetLyrics;
    this.onToggleImmersive = callbacks.onToggleImmersive;
  }

  start(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();

      ws.on('message', (data: Buffer) => {
        this.handleMessage(clientId, ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', () => {
        // Silent error
      });

      // Send initial device info
      this.sendMessage(ws, {
        type: 'DEVICE_INFO' as MessageType,
        payload: {
          name: this.config.serviceName,
          version: '1.0.0',
          platform: process.platform,
          requiresAuth: this.config.requireAuth,
        },
        timestamp: Date.now(),
      });
    });
  }

  stop() {
    if (this.wss) {
      this.clients.forEach(({ ws }) => {
        if (ws !== 'supabase') ws.close()
      });
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
  }

  private initSupabaseChannel(pairingCode: string) {
    if (this.supabaseChannel) {
      console.log('[PearConnect Supabase] Unsubscribing from old channel');
      this.supabaseChannel.unsubscribe();
    }

    console.log('[PearConnect Supabase] Initializing channel for room:', pairingCode);
    this.supabaseChannel = this.supabase.channel(`room-${pairingCode}`, {
      config: {
        broadcast: { ack: false, self: true }
      }
    });

    this.supabaseChannel
      .on('broadcast', { event: 'remote-control' }, (payload) => {
        const msg = payload.payload as any;
        console.log('[PearConnect Supabase] Received remote-control:', JSON.stringify(msg));
        if (msg && msg.type) {
          // Process message
          this.handleMessage('supabase-client', 'supabase', Buffer.from(JSON.stringify(msg)));
        }
      })
      .subscribe((status) => {
        console.log('[PearConnect Supabase] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[PearConnect Supabase] Successfully joined room:', pairingCode);
        }
      });
  }

  private handleMessage(clientId: string, ws: WebSocket | 'supabase', data: Buffer) {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      let client = this.clients.get(clientId);

      // Handle authentication
      if (message.type === 'AUTH_REQUEST') {
        console.log(`[PearConnect] Auth request from ${clientId} (${ws})`);
        this.handleAuthRequest(clientId, ws, message.payload as AuthRequest);
        return;
      }

      // Special handling for supabase - if we got a message via the room, it's somewhat trusted
      // (as it requires the pairing code to join the room).
      // Let's lazily create a client if needed so commands don't get dropped.
      if (ws === 'supabase' && (!client || !client.client.authenticated)) {
        console.log(`[PearConnect Supabase] Lazily authenticating client ${clientId}`);
        this.authenticateClient(clientId, ws, {
          deviceName: 'Supabase Remote',
          deviceType: 'mobile',
        });
        client = this.clients.get(clientId);
      }

      // Check if client is authenticated
      if (this.config.requireAuth && (!client || !client.client.authenticated)) {
        console.warn(`[PearConnect] Unauthorized command ${message.type} from ${clientId}`);
        this.sendError(ws, 'Not authenticated');
        return;
      }

      // Update last activity
      if (client) {
        client.client.lastActivity = Date.now();
      }

      // Handle messages based on type
      switch (message.type) {
        case 'PLAY':
        case 'PAUSE':
        case 'NEXT':
        case 'PREVIOUS':
          this.handlePlaybackControl(client!, message.type);
          break;

        case 'SEEK':
          this.handleSeek(client!, message.payload as number);
          break;

        case 'SET_VOLUME':
          this.handleVolumeControl(client!, message.payload as number);
          break;

        case 'GET_QUEUE':
          this.handleGetQueue(ws);
          break;

        case 'ADD_TO_QUEUE':
          this.handleAddToQueue(client!, message.payload as QueueItem);
          break;

        case 'PLAY_QUEUE_ITEM':
          this.handlePlayQueueItem(client!, message.payload as number);
          break;

        case 'PLAY_VIDEO_ID':
          this.handlePlayVideoId(client!, message.payload as string);
          break;

        case 'GET_STATE':
          this.handleGetState(ws);
          break;

        case 'PING':
          this.sendMessage(ws, {
            type: 'PONG' as MessageType,
            timestamp: Date.now(),
            requestId: message.requestId,
          });
          break;

        // WebRTC Signaling
        case 'RTC_OFFER':
          this.handleRTCOffer(clientId, message.payload);
          break;

        case 'RTC_ANSWER':
          this.handleRTCAnswer(clientId, message.payload);
          break;

        case 'RTC_ICE_CANDIDATE':
          this.handleRTCIceCandidate(clientId, message.payload);
          break;

        case 'GET_LYRICS':
          this.handleGetLyrics(clientId);
          break;

        case 'TOGGLE_IMMERSIVE':
          if (this.onToggleImmersive) this.onToggleImmersive();
          break;

        case 'DISCONNECT':
          this.handleDisconnect(clientId);
          break;

        default:
          // Unknown message type
          break;
      }
    } catch (error) {
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleAuthRequest(clientId: string, ws: WebSocket | 'supabase', authRequest: AuthRequest & { pairingCode?: string }) {
    if (authRequest.token) {
      // Verify existing token
      try {
        jwt.verify(authRequest.token, this.config.jwtSecret) as {
          clientId: string;
          deviceName: string;
        };

        this.authenticateClient(clientId, ws, authRequest);
        this.sendMessage(ws, {
          type: 'AUTH_SUCCESS' as MessageType,
          payload: { token: authRequest.token },
          timestamp: Date.now(),
        });
      } catch (error) {
        this.sendMessage(ws, {
          type: 'AUTH_FAILED' as MessageType,
          payload: { reason: 'Invalid token' },
          timestamp: Date.now(),
        });
      }
    } else if (authRequest.pairingCode) {
      // Verify pairing code (check both current code and pending)
      const isCurrentCode = this.currentPairingCode &&
        this.currentPairingCode.code === authRequest.pairingCode &&
        this.currentPairingCode.expiresAt > Date.now();

      const pending = this.pendingAuth.get(clientId);
      const isPendingCode = pending &&
        pending.code === authRequest.pairingCode &&
        pending.expiresAt > Date.now();

      if (isCurrentCode || isPendingCode) {
        // Generate JWT token
        const token = jwt.sign(
          {
            clientId,
            deviceName: authRequest.deviceName,
            deviceType: authRequest.deviceType,
          },
          this.config.jwtSecret,
          { expiresIn: '365d' }
        );

        this.pendingAuth.delete(clientId);
        this.authenticateClient(clientId, ws, authRequest);

        // Don't regenerate code immediately for supabase as mobile depends on the same channel

        console.log('[PearConnect Supabase] Sending AUTH_SUCCESS to client: ' + clientId);
        this.sendMessage(ws, {
          type: 'AUTH_SUCCESS' as MessageType,
          payload: { token },
          timestamp: Date.now(),
        });
      } else {
        this.sendMessage(ws, {
          type: 'AUTH_FAILED' as MessageType,
          payload: { reason: 'Invalid or expired pairing code' },
          timestamp: Date.now(),
        });
      }
    } else {
      // Generate pairing code
      const pairingCode = this.generatePairingCode();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      this.pendingAuth.set(clientId, { code: pairingCode, expiresAt });

      // Generate QR code data
      const qrData = JSON.stringify({
        code: pairingCode,
        service: this.config.serviceName,
        clientId,
      });

      this.sendMessage(ws, {
        type: 'AUTH_RESPONSE' as MessageType,
        payload: {
          pairingCode,
          qrCode: qrData,
          expiresIn: 300,
        },
        timestamp: Date.now(),
      });

      // Clean up expired codes
      setTimeout(() => {
        this.pendingAuth.delete(clientId);
      }, 300000);
    }
  }

  confirmPairing(clientId: string, deviceInfo: AuthRequest): string | null {
    const pending = this.pendingAuth.get(clientId);
    if (!pending || pending.expiresAt < Date.now()) {
      return null;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        clientId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
      },
      this.config.jwtSecret,
      { expiresIn: '365d' }
    );

    this.pendingAuth.delete(clientId);
    return token;
  }

  private authenticateClient(clientId: string, ws: WebSocket | 'supabase', authRequest: AuthRequest) {
    const client: RemoteClient = {
      id: clientId,
      name: authRequest.deviceName,
      deviceType: authRequest.deviceType,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      authenticated: true,
      permissions: {
        playback: this.config.allowPlaybackControl,
        volume: this.config.allowVolumeControl,
        playlist: this.config.allowPlaylistBrowsing,
        queue: this.config.allowPlaylistBrowsing,
      },
    };

    this.clients.set(clientId, { ws, client });

    // Push current state immediately so the remote sees current song/seek/volume
    this.pushInitialStateToClient(ws, client);
  }

  private pushInitialStateToClient(ws: WebSocket | 'supabase', client: RemoteClient) {
    // Send current playback state if available
    if (this.lastState) {
      this.sendMessage(ws, {
        type: 'STATE_UPDATE' as MessageType,
        payload: this.lastState,
        timestamp: Date.now(),
      });
    }

    // Send current queue if available
    if (this.lastQueue.length > 0 && client.permissions.queue) {
      this.sendMessage(ws, {
        type: 'QUEUE_UPDATE' as MessageType,
        payload: this.lastQueue,
        timestamp: Date.now(),
      });
    }
  }

  private handlePlaybackControl(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    action: MessageType
  ) {
    if (!clientData.client.permissions.playback) {
      this.sendError(clientData.ws, 'No playback permission');
      return;
    }

    // Send to backend/renderer via callback
    if (this.onPlaybackControl) {
      this.onPlaybackControl(action);
    }
  }

  private handleSeek(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    time: number
  ) {
    if (!clientData.client.permissions.playback) {
      this.sendError(clientData.ws, 'No playback permission');
      return;
    }

    // Send to backend/renderer via callback
    if (this.onSeek) {
      this.onSeek(time);
    }
  }

  private handleVolumeControl(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    volume: number
  ) {
    if (!clientData.client.permissions.volume) {
      this.sendError(clientData.ws, 'No volume permission');
      return;
    }

    // Send to backend/renderer via callback
    if (this.onVolumeControl) {
      this.onVolumeControl(volume);
    }
  }

  private handleGetQueue(ws: WebSocket | 'supabase') {
    // Send the last known queue immediately
    this.sendMessage(ws, {
      type: 'QUEUE_UPDATE' as MessageType,
      payload: this.lastQueue,
      timestamp: Date.now(),
    });
  }

  private handleAddToQueue(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    _item: QueueItem
  ) {
    if (!clientData.client.permissions.queue) {
      this.sendError(clientData.ws, 'No queue permission');
      return;
    }
  }

  private handleGetState(ws: WebSocket | 'supabase') {
    // Send the last known state immediately
    if (this.lastState) {
      this.sendMessage(ws, {
        type: 'STATE_UPDATE' as MessageType,
        payload: this.lastState,
        timestamp: Date.now(),
      });
    }
  }

  private handlePlayVideoId(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    videoId: string
  ) {
    if (!clientData.client.permissions.playback) {
      this.sendError(clientData.ws, 'No playback permission');
      return;
    }
    if (this.onPlayVideoId) {
      this.onPlayVideoId(videoId);
    }
  }

  private handlePlayQueueItem(
    clientData: { ws: WebSocket | 'supabase'; client: RemoteClient },
    index: number
  ) {
    if (!clientData.client.permissions.playback) {
      this.sendError(clientData.ws, 'No playback permission');
      return;
    }

    if (this.onPlayQueueItem) {
      this.onPlayQueueItem(index);
    }
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
    }
    this.pendingAuth.delete(clientId);
  }

  // WebRTC Signaling Handlers
  private handleRTCOffer(clientId: string, offer: unknown) {
    if (this.onRTCOffer) {
      this.onRTCOffer(clientId, offer);
    }
  }

  private handleRTCAnswer(clientId: string, answer: unknown) {
    if (this.onRTCAnswer) {
      this.onRTCAnswer(clientId, answer);
    }
  }

  private handleRTCIceCandidate(clientId: string, candidate: unknown) {
    if (this.onRTCIceCandidate) {
      this.onRTCIceCandidate(clientId, candidate);
    }
  }

  private handleGetLyrics(clientId: string) {
    if (this.onGetLyrics) {
      this.onGetLyrics(clientId);
    }
  }

  // Send RTC answer to specific client
  sendRTCAnswer(clientId: string, answer: unknown) {
    const clientData = this.clients.get(clientId);
    if (clientData) {
      this.sendMessage(clientData.ws, {
        type: 'RTC_ANSWER' as MessageType,
        payload: answer,
        timestamp: Date.now(),
      });
    }
  }

  // Send ICE candidate to specific client
  sendRTCIceCandidate(clientId: string, candidate: unknown) {
    const clientData = this.clients.get(clientId);
    if (clientData) {
      this.sendMessage(clientData.ws, {
        type: 'RTC_ICE_CANDIDATE' as MessageType,
        payload: candidate,
        timestamp: Date.now(),
      });
    }
  }

  // Broadcast lyrics to all clients
  broadcastLyrics(lyrics: unknown) {
    this.clients.forEach(({ ws, client }) => {
      if (client.authenticated) {
        this.sendMessage(ws, {
          type: 'LYRICS_UPDATE' as MessageType,
          payload: lyrics,
          timestamp: Date.now(),
        });
      }
    });
  }


  broadcastQueue(queue: QueueItem[]) {
    // Store the queue for new clients
    this.lastQueue = queue;

    this.clients.forEach(({ ws, client }) => {
      if (client.authenticated && client.permissions.queue) {
        this.sendMessage(ws, {
          type: 'QUEUE_UPDATE' as MessageType,
          payload: queue,
          timestamp: Date.now(),
        });
      }
    });
  }

  broadcastState(state: PlaybackState) {
    // Cache it (already below, but update this override)
    this.lastState = state;

    if (!this.config.autoSync) return;

    this.clients.forEach(({ ws, client }) => {
      if (client.authenticated) {
        this.sendMessage(ws, {
          type: 'STATE_UPDATE' as MessageType,
          payload: state,
          timestamp: Date.now(),
        });
      }
    });
  }

  broadcastPlaybackTarget(target: PlaybackTarget) {
    this.clients.forEach(({ ws, client }) => {
      if (client.authenticated) {
        this.sendMessage(ws, {
          type: 'SET_PLAYBACK_TARGET' as MessageType,
          payload: target,
          timestamp: Date.now(),
        });
      }
    });
  }

  private sendMessage(ws: WebSocket | 'supabase', message: WebSocketMessage) {
    if (ws === 'supabase') {
      if (this.supabaseChannel) {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'desktop-state',
          payload: message,
        });
      }
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket | 'supabase', error: string) {
    this.sendMessage(ws, {
      type: 'ERROR' as MessageType,
      payload: { error },
      timestamp: Date.now(),
    });
  }

  private generateClientId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generatePairingCode(): string {
    // Generate 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateNewPairingCode() {
    const code = this.generatePairingCode();
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
    this.currentPairingCode = { code, expiresAt };

    // Subscribe to new Supabase Channel based on new code
    this.initSupabaseChannel(code);
  }

  getConnectedClients(): RemoteClient[] {
    return Array.from(this.clients.values()).map(({ client }) => client);
  }

  getPendingPairings(): Array<{ clientId: string; code: string; expiresAt: number }> {
    // Return current pairing code if active
    if (this.currentPairingCode && this.currentPairingCode.expiresAt > Date.now()) {
      const result = [{
        clientId: 'default',
        code: this.currentPairingCode.code,
        expiresAt: this.currentPairingCode.expiresAt,
      }];
      return result;
    }

    // Also return any pending auth codes
    const pending = Array.from(this.pendingAuth.entries()).map(([clientId, data]) => ({
      clientId,
      ...data,
    }));

    return pending;
  }

  disconnectClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.ws !== 'supabase') client.ws.close();
      this.clients.delete(clientId);
    }
  }
}
