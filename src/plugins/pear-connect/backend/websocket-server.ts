import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import type {
  RemoteClient,
  WebSocketMessage,
  MessageType,
  AuthRequest,
  PlaybackState,
  QueueItem,
} from '../types';
import type { PearConnectConfig } from '../config';

export class PearWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, { ws: WebSocket; client: RemoteClient }> = new Map();
  private config: PearConnectConfig;
  private pendingAuth: Map<string, { code: string; expiresAt: number }> = new Map();
  private currentPairingCode: { code: string; expiresAt: number } | null = null;
  private lastQueue: QueueItem[] = [];
  private onPlaybackControl?: (action: string) => void;
  private onVolumeControl?: (volume: number) => void;
  private onSeek?: (time: number) => void;
  private onPlayQueueItem?: (index: number) => void;

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
  }) {
    this.onPlaybackControl = callbacks.onPlaybackControl;
    this.onVolumeControl = callbacks.onVolumeControl;
    this.onSeek = callbacks.onSeek;
    this.onPlayQueueItem = callbacks.onPlayQueueItem;
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
      this.clients.forEach(({ ws }) => ws.close());
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }

  private handleMessage(clientId: string, ws: WebSocket, data: Buffer) {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const client = this.clients.get(clientId);

      // Handle authentication
      if (message.type === 'AUTH_REQUEST') {
        this.handleAuthRequest(clientId, ws, message.payload as AuthRequest);
        return;
      }

      // Check if client is authenticated
      if (this.config.requireAuth && (!client || !client.client.authenticated)) {
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

        case 'PING':
          this.sendMessage(ws, {
            type: 'PONG' as MessageType,
            timestamp: Date.now(),
            requestId: message.requestId,
          });
          break;

        default:
          // Unknown message type
          break;
      }
    } catch (error) {
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleAuthRequest(clientId: string, ws: WebSocket, authRequest: AuthRequest & { pairingCode?: string }) {
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
        
        // Regenerate code if it was the current one to ensure one-time use
        if (isCurrentCode) {
          this.generateNewPairingCode();
        }

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

  private authenticateClient(clientId: string, ws: WebSocket, authRequest: AuthRequest) {
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
  }

  private handlePlaybackControl(
    clientData: { ws: WebSocket; client: RemoteClient },
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
    clientData: { ws: WebSocket; client: RemoteClient },
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
    clientData: { ws: WebSocket; client: RemoteClient },
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

  private handleGetQueue(ws: WebSocket) {
    // Send the last known queue immediately
    this.sendMessage(ws, {
      type: 'QUEUE_UPDATE' as MessageType,
      payload: this.lastQueue,
      timestamp: Date.now(),
    });
  }

  private handleAddToQueue(
    clientData: { ws: WebSocket; client: RemoteClient },
    item: QueueItem
  ) {
    if (!clientData.client.permissions.queue) {
      this.sendError(clientData.ws, 'No queue permission');
      return;
    }
  }

  private handlePlayQueueItem(
    clientData: { ws: WebSocket; client: RemoteClient },
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

  broadcastState(state: PlaybackState) {
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

  private sendMessage(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
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
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.currentPairingCode = { code, expiresAt };
    
    // Auto-refresh after expiration
    setTimeout(() => {
      this.generateNewPairingCode();
    }, 10 * 60 * 1000);
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
      client.ws.close();
      this.clients.delete(clientId);
    }
  }
}
