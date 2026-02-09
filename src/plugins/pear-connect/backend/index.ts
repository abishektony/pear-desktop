import http from 'node:http';
import os from 'node:os';
import { ipcMain, type BrowserWindow, type WebContents } from 'electron';

import type { PearConnectConfig } from '../config';
import { PearWebSocketServer } from './websocket-server';
import { MDNSDiscovery } from './mdns-discovery';
import type { PlaybackState, QueueItem, RemoteClient, PlaybackTarget } from '../types';

export class PearConnectBackend {
  private config: PearConnectConfig;
  private httpServer: http.Server | null = null;
  private wsServer: PearWebSocketServer | null = null;
  private mdns: MDNSDiscovery | null = null;
  private webContents: WebContents | null = null;
  private ipcHandlersRegistered = false;
  private lastCommand: { action: string; timestamp: number } = { action: '', timestamp: 0 };
  private playbackTarget: PlaybackTarget = 'laptop';

  constructor(config: PearConnectConfig, win: BrowserWindow | { webContents: WebContents }) {
    this.config = config;
    // Extract webContents whether win is a BrowserWindow or an object with webContents
    this.webContents = (win as any).webContents;
  }

  start() {
    // Set up IPC handlers once
    if (!this.ipcHandlersRegistered) {
      this.setupIPC();
      this.ipcHandlersRegistered = true;
    }

    // TEMPORARY: Force enable and apply defaults for testing
    if (!this.config.enabled || !this.config.port) {
      this.config = {
        ...this.config, // Keep any existing config values first
        enabled: true,
        port: 8888,
        discoveryEnabled: true,
        serviceName: 'Pear Desktop',
        requireAuth: true,
        jwtSecret: this.config.jwtSecret || 'temp-secret-' + Date.now(),
        maxConnections: 5,
        autoSync: true,
        allowVolumeControl: true,
        allowPlaybackControl: true,
        allowPlaylistBrowsing: true,
      };
    }

    // Stop existing servers if running
    if (this.httpServer) {
      this.httpServer.close();
    }

    // Create HTTP server to serve web client
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Try to listen on the configured port, with fallback
    this.startServerWithFallback(this.config.port);
  }

  private startServerWithFallback(preferredPort: number) {
    const maxAttempts = 10;
    let currentPort = preferredPort;
    let attempts = 0;

    const tryListen = () => {
      if (!this.httpServer) return;

      this.httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempts < maxAttempts) {
          attempts++;
          currentPort++;
          tryListen();
        }
      });

      this.httpServer.listen(currentPort, '0.0.0.0', () => {
        // Update config with the actual port being used
        if (currentPort !== this.config.port) {
          this.config.port = currentPort;
        }

        // Start WebSocket server after HTTP server is ready
        this.startWebSocketServer();
      });
    };

    tryListen();
  }

  private startWebSocketServer() {
    if (!this.httpServer) return;

    // Start WebSocket server
    this.wsServer = new PearWebSocketServer(this.config);
    this.wsServer.setCallbacks({
      onPlaybackControl: (action) => {
        // Throttle duplicate commands within 300ms
        const now = Date.now();
        if (this.lastCommand.action === action && now - this.lastCommand.timestamp < 300) {
          return;
        }
        this.lastCommand = { action, timestamp: now };

        // Send the correct IPC events that the app expects
        switch (action) {
          case 'PLAY':
            this.webContents?.send('peard:play');
            break;
          case 'PAUSE':
            this.webContents?.send('peard:pause');
            break;
          case 'NEXT':
            this.webContents?.send('peard:next-video');
            break;
          case 'PREVIOUS':
            this.webContents?.send('peard:previous-video');
            break;
        }
      },
      onVolumeControl: (volume) => {
        this.webContents?.send('peard:update-volume', volume);
      },
      onSeek: (time) => {
        this.webContents?.send('peard:seek-to', time);
      },
      onPlayQueueItem: (index) => {
        this.webContents?.send('pear-connect:play-queue-item', index);
      },
      // WebRTC Signaling - Forward to renderer
      onRTCOffer: (clientId, offer) => {
        this.webContents?.send('pear-connect:rtc-offer', { clientId, offer });
      },
      onRTCAnswer: (clientId, answer) => {
        // Forward answer from renderer to phone client
        this.wsServer?.sendRTCAnswer(clientId, answer);
      },
      onRTCIceCandidate: (clientId, candidate) => {
        this.webContents?.send('pear-connect:rtc-ice-candidate', { clientId, candidate });
      },
      onGetLyrics: (clientId) => {
        this.webContents?.send('pear-connect:get-lyrics');
      },
    });
    this.wsServer.start(this.httpServer);

    // Start mDNS discovery
    this.mdns = new MDNSDiscovery(this.config);
    this.mdns.start();
  }

  stop() {
    if (this.wsServer) {
      this.wsServer.stop();
      this.wsServer = null;
    }

    if (this.mdns) {
      this.mdns.stop();
      this.mdns = null;
    }

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const reqUrl = req.url || '/';
    // Handle query parameters by extracting just the pathname
    const pathname = reqUrl.split('?')[0];

    try {
      if (pathname === '/' || pathname === '/index.html') {
        // Serve HTML inline to avoid file path issues
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Pear Connect</title>
    <style>${this.getCSS()}</style>
</head>
<body>
    ${this.getHTML()}
    <script>${this.getJS()}</script>
</body>
</html>`;
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        });
        res.end(html);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error: ' + (error as Error).message);
    }
  }

  private getCSS(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      :root {
        --primary: #1e90ff;
        --primary-light: #4da6ff;
        --primary-dark: #0066cc;
        --bg-dark: #000;
        --bg-card: rgba(10, 10, 20, 0.85);
        --text-primary: #ffffff;
        --text-secondary: rgba(77, 166, 255, 0.7);
        --glow: rgba(30, 144, 255, 0.4);
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: var(--bg-dark);
        min-height: 100vh;
        min-height: -webkit-fill-available;
        color: var(--text-primary);
        overflow-x: hidden;
        position: relative;
      }
      
      /* Animated gradient background */
      .bg-gradient {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(ellipse at 50% 0%, rgba(30, 144, 255, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 80%, rgba(30, 144, 255, 0.1) 0%, transparent 40%),
                    radial-gradient(ellipse at 20% 90%, rgba(0, 102, 204, 0.1) 0%, transparent 40%);
        pointer-events: none;
        z-index: 0;
      }
      
      /* Visualizer canvas */
      #visualizer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 350px;
        pointer-events: none;
        z-index: 5;
        opacity: 1;
      }
      
      .container { 
        max-width: 440px; 
        margin: 0 auto; 
        padding: 20px;
        position: relative;
        z-index: 10;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: transparent;
      }
      
      .header { 
        text-align: center; 
        padding: 20px 0 30px;
      }
      
      .header h1 { 
        font-size: 28px; 
        font-weight: 700; 
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 12px;
        letter-spacing: -0.5px;
      }
      
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(30, 144, 255, 0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid rgba(30, 144, 255, 0.3);
      }
      
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff4444;
        box-shadow: 0 0 8px #ff4444;
      }
      
      .status-dot.connected { 
        background: #00ff88; 
        box-shadow: 0 0 8px #00ff88;
        animation: glow 2s ease-in-out infinite;
      }
      
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 8px #00ff88; }
        50% { box-shadow: 0 0 16px #00ff88, 0 0 24px #00ff88; }
      }
      
      /* Cards */
      .auth-card, .player-card {
        background: rgba(5, 5, 15, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(30, 144, 255, 0.2);
        border-radius: 24px;
        padding: 32px 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                    0 0 60px rgba(30, 144, 255, 0.1);
      }
      
      .auth-card { text-align: center; }
      
      .auth-card h2 { 
        font-size: 22px; 
        font-weight: 600;
        margin-bottom: 24px; 
        color: var(--text-primary);
      }
      
      .auth-input-group { margin-bottom: 20px; }
      
      .auth-input-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 14px;
        text-align: left;
        color: var(--text-secondary);
      }
      
      .auth-input {
        width: 100%;
        padding: 14px 18px;
        border: 1px solid rgba(30, 144, 255, 0.3);
        border-radius: 12px;
        font-size: 16px;
        font-family: inherit;
        transition: all 0.3s;
        background: rgba(0, 0, 0, 0.4);
        color: var(--text-primary);
      }
      
      .auth-input:focus { 
        outline: none; 
        border-color: var(--primary);
        background: rgba(30, 144, 255, 0.05);
        box-shadow: 0 0 20px rgba(30, 144, 255, 0.2);
      }
      
      .auth-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
      
      .btn {
        width: 100%;
        padding: 16px;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.3s;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        color: #000;
        box-shadow: 0 4px 20px rgba(30, 144, 255, 0.4);
      }
      
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 30px rgba(30, 144, 255, 0.5);
      }
      
      .btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }
      
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      
      /* Player Card */
      .player-card { 
        display: none;
        flex: 1;
      }
      .player-card.active { 
        display: flex;
        flex-direction: column;
      }
      
      /* Album Art with Glow */
      .track-info { 
        text-align: center; 
        margin-bottom: 24px;
        flex-shrink: 0;
      }
      
      .thumbnail-container {
        position: relative;
        width: 280px;
        height: 280px;
        margin: 0 auto 24px;
      }
      
      .thumbnail-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        background: var(--primary);
        filter: blur(60px);
        opacity: 0.3;
        border-radius: 50%;
        animation: breathe 4s ease-in-out infinite;
      }
      
      @keyframes breathe {
        0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.2; }
        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.4; }
      }
      
      .track-thumbnail {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 16px;
        object-fit: cover;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        z-index: 1;
      }
      
      .track-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--text-primary);
        letter-spacing: -0.3px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .track-artist { 
        font-size: 16px; 
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      /* Progress */
      .progress-section { 
        margin-bottom: 32px;
        flex-shrink: 0;
      }
      
      .progress-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        cursor: pointer;
        margin-bottom: 8px;
        position: relative;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
        border-radius: 2px;
        transition: width 0.1s linear;
        position: relative;
      }
      
      .progress-fill::after {
        content: '';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 12px;
        background: var(--text-primary);
        border-radius: 50%;
        box-shadow: 0 0 10px var(--primary);
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .progress-bar:hover .progress-fill::after {
        opacity: 1;
      }
      
      .progress-time {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
      }
      
      /* Controls */
      .controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        margin-bottom: 32px;
        flex-shrink: 0;
      }
      
      .control-btn {
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .control-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.05);
      }
      
      .control-btn:active {
        transform: scale(0.95);
      }
      
      .control-btn.play-pause {
        width: 72px;
        height: 72px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        box-shadow: 0 4px 24px rgba(30, 144, 255, 0.4);
      }
      
      .control-btn.play-pause:hover {
        box-shadow: 0 6px 32px rgba(30, 144, 255, 0.6);
      }
      
      .control-btn svg { 
        width: 24px; 
        height: 24px; 
        fill: rgba(255, 255, 255, 0.8);
      }
      
      .control-btn.play-pause svg { 
        fill: #000; 
        width: 28px; 
        height: 28px;
      }
      
      /* Volume */
      .volume-section { 
        display: flex; 
        align-items: center; 
        gap: 12px;
        margin-bottom: 24px;
        flex-shrink: 0;
      }
      
      .volume-icon { 
        width: 20px; 
        height: 20px; 
        fill: var(--text-secondary);
        flex-shrink: 0;
      }
      
      .volume-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.1);
        outline: none;
      }
      
      .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--text-primary);
        cursor: pointer;
        box-shadow: 0 0 8px var(--glow);
      }
      
      .volume-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--text-primary);
        cursor: pointer;
        border: none;
      }
      
      .volume-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        min-width: 36px;
        text-align: right;
      }
      
      /* Error */
      .error-message {
        background: rgba(255, 68, 68, 0.2);
        border: 1px solid rgba(255, 68, 68, 0.4);
        color: #ff6b6b;
        padding: 12px 16px;
        border-radius: 12px;
        margin-bottom: 16px;
        display: none;
        font-size: 14px;
      }
      .error-message.show { display: block; }
      
      /* Queue */
      .queue-section { 
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      
      .queue-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .queue-title { 
        font-size: 16px; 
        font-weight: 600; 
        color: var(--text-primary);
      }
      
      .queue-list { 
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      
      .queue-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
      }
      
      .queue-item:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(30, 144, 255, 0.2);
      }
      
      .queue-item:active {
        transform: scale(0.98);
      }
      
      .queue-item.current {
        background: rgba(30, 144, 255, 0.15);
        border-color: rgba(30, 144, 255, 0.3);
      }
      
      .queue-item-thumb {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
      }
      
      .queue-item-info { 
        flex: 1; 
        min-width: 0;
      }
      
      .queue-item-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 2px;
      }
      
      .queue-item.current .queue-item-title {
        color: var(--primary-light);
      }
      
      .queue-item-artist {
        font-size: 12px;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .queue-item-duration { 
        font-size: 12px; 
        color: var(--text-secondary); 
        flex-shrink: 0;
        font-weight: 500;
      }
      
      .queue-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      
      /* Playback target indicator */
      .playback-target-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        margin-bottom: 16px;
      }
      
      .playback-target-indicator svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      
      /* Mobile optimizations */
      @media (max-width: 400px) {
        .container { padding: 16px; }
        .thumbnail-container { width: 220px; height: 220px; }
        .track-title { font-size: 20px; }
        .controls { gap: 16px; }
        .control-btn { width: 48px; height: 48px; }
        .control-btn.play-pause { width: 64px; height: 64px; }
      }
      
      /* Safe area for notched phones */
      @supports (padding-top: env(safe-area-inset-top)) {
        .container {
          padding-top: calc(20px + env(safe-area-inset-top));
          padding-bottom: calc(20px + env(safe-area-inset-bottom));
        }
      }

      /* Lyrics Panel */
      .lyrics-section {
        margin-bottom: 24px;
        padding: 16px;
        background: rgba(30, 144, 255, 0.08);
        border-radius: 16px;
        border: 1px solid rgba(30, 144, 255, 0.15);
        min-height: 80px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .lyrics-current {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
        line-height: 1.4;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .lyrics-next {
        font-size: 14px;
        color: var(--text-secondary);
        opacity: 0.7;
        line-height: 1.3;
      }

      .lyrics-empty {
        font-size: 14px;
        color: var(--text-secondary);
        font-style: italic;
      }

      .lyrics-icon {
        font-size: 24px;
        margin-bottom: 8px;
        opacity: 0.5;
      }
    `;
  }

  private getHTML(): string {
    return `
      <div class="bg-gradient"></div>
      <canvas id="visualizer"></canvas>
      <div class="container">
        <div class="header">
          <h1>Pear Connect</h1>
          <div class="status">
            <div class="status-dot" id="statusDot"></div>
            <span id="statusText">Disconnected</span>
          </div>
        </div>
        <div id="errorMessage" class="error-message"></div>
        <div id="authCard" class="auth-card">
          <h2>Connect to Pear Desktop</h2>
          <div class="auth-input-group">
            <label for="deviceName">Device Name</label>
            <input type="text" id="deviceName" class="auth-input" placeholder="My Phone" value="">
          </div>
          <div class="auth-input-group">
            <label for="pairingCode">Pairing Code (from desktop)</label>
            <input type="text" id="pairingCode" class="auth-input" placeholder="000000" maxlength="6" pattern="\\d{6}" inputmode="numeric">
          </div>
          <button id="connectBtn" class="btn btn-primary">Connect</button>
        </div>
        <div id="playerCard" class="player-card">
          <div class="track-info">
            <div class="thumbnail-container">
              <div class="thumbnail-glow" id="thumbnailGlow"></div>
              <img id="trackThumbnail" class="track-thumbnail" src="" alt="Album Art" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27280%27 height=%27280%27 viewBox=%270 0 280 280%27%3E%3Crect fill=%27%230a0a14%27 width=%27280%27 height=%27280%27 rx=%2716%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 dominant-baseline=%27middle%27 text-anchor=%27middle%27 font-size=%2780%27 fill=%27%231e90ff%27%3E♪%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="track-title" id="trackTitle">No track playing</div>
            <div class="track-artist" id="trackArtist">—</div>
          </div>
          <div class="lyrics-section" id="lyricsSection">
            <div class="lyrics-icon">🎵</div>
            <div class="lyrics-current" id="lyricsCurrent"></div>
            <div class="lyrics-next" id="lyricsNext"></div>
            <div class="lyrics-empty" id="lyricsEmpty">Lyrics will appear here</div>
          </div>
          <div class="progress-section">
            <div class="progress-bar" id="progressBar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-time">
              <span id="currentTime">0:00</span>
              <span id="duration">0:00</span>
            </div>
          </div>
          <div class="controls">
            <button class="control-btn" id="prevBtn" aria-label="Previous">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button class="control-btn play-pause" id="playPauseBtn" aria-label="Play/Pause">
              <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <svg id="pauseIcon" viewBox="0 0 24 24" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="control-btn" id="nextBtn" aria-label="Next">
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
          <div class="volume-section">
            <svg class="volume-icon" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="100">
            <span class="volume-value" id="volumeValue">100%</span>
          </div>
          <div class="queue-section">
            <div class="queue-header">
              <h3 class="queue-title">Up Next</h3>
            </div>
            <div id="queueList" class="queue-list">
              <div class="queue-empty">No tracks in queue</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getJS(): string {
    // Embedded client.js to avoid file path issues
    return `
// Pear Connect Web Client
class PearConnectClient {
    constructor() {
        this.ws = null;
        this.token = localStorage.getItem('pear-token');
        this.deviceName = localStorage.getItem('pear-device-name') || '';
        this.isPlaying = false;
        this.currentState = null;
        this.lastQueue = null;
        this.audioElement = null;
        
        // WebRTC Audio Streaming
        this.peerConnection = null;
        this.remoteAudioStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        
        // Lyrics
        this.currentLyrics = null;
        this.lyricsElement = null;
        
        this.initElements();
        this.initEventListeners();
        this.loadDeviceName();
        this.initMediaSession();
        this.initVisualizer();
        
        // Check for pairing code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            this.pairingCodeInput.value = code;
            // Remove code from URL to prevent re-use/sharing
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Add global click listener to ensure audio context is started (for background play)
        document.addEventListener('click', () => {
            this.activateMediaSession();
            this.resumeAudioContext();
        }, { once: true });

        // Auto-connect if token exists or code is present
        if (this.token) {
            this.connect();
        } else if (code) {
            // Allow time for device name to load
            setTimeout(() => this.handleConnect(), 100);
        }
    }

    initElements() {
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.errorMessage = document.getElementById('errorMessage');
        this.authCard = document.getElementById('authCard');
        this.playerCard = document.getElementById('playerCard');
        
        // Auth elements
        this.deviceNameInput = document.getElementById('deviceName');
        this.pairingCodeInput = document.getElementById('pairingCode');
        this.connectBtn = document.getElementById('connectBtn');
        
        // Player elements
        this.trackThumbnail = document.getElementById('trackThumbnail');
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTime = document.getElementById('currentTime');
        this.duration = document.getElementById('duration');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.queueList = document.getElementById('queueList');
        this.visualizerCanvas = document.getElementById('visualizer');
        
        // Lyrics elements
        this.lyricsSection = document.getElementById('lyricsSection');
        this.lyricsCurrent = document.getElementById('lyricsCurrent');
        this.lyricsNext = document.getElementById('lyricsNext');
        this.lyricsEmpty = document.getElementById('lyricsEmpty');
    }

    initEventListeners() {
        this.connectBtn.addEventListener('click', () => this.handleConnect());
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.previous());
        this.nextBtn.addEventListener('click', () => this.next());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.progressBar.addEventListener('click', (e) => this.handleSeek(e));
        
        // Allow Enter key to connect
        this.pairingCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });
    }

    loadDeviceName() {
        if (this.deviceName) {
            this.deviceNameInput.value = this.deviceName;
        } else {
            // Generate a default name
            const userAgent = navigator.userAgent;
            let defaultName = 'Mobile Device';
            
            if (/iPhone/.test(userAgent)) defaultName = 'iPhone';
            else if (/iPad/.test(userAgent)) defaultName = 'iPad';
            else if (/Android/.test(userAgent)) defaultName = 'Android Device';
            
            this.deviceNameInput.value = defaultName;
        }
    }

    initMediaSession() {
        if (!('mediaSession' in navigator)) {
            console.log('[Pear Connect] MediaSession API not supported');
            return;
        }

        // Set up media session action handlers
        navigator.mediaSession.setActionHandler('play', () => {
            console.log('[Pear Connect] MediaSession: play');
            this.togglePlayPause();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            console.log('[Pear Connect] MediaSession: pause');
            this.togglePlayPause();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            console.log('[Pear Connect] MediaSession: previous');
            this.previous();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            console.log('[Pear Connect] MediaSession: next');
            this.next();
        });

        navigator.mediaSession.setActionHandler('seekbackward', () => {
            console.log('[Pear Connect] MediaSession: seek backward');
            if (this.currentState && this.currentState.currentTime > 10) {
                this.sendMessage({ 
                    type: 'SEEK', 
                    payload: this.currentState.currentTime - 10,
                    timestamp: Date.now() 
                });
            }
        });

        navigator.mediaSession.setActionHandler('seekforward', () => {
            console.log('[Pear Connect] MediaSession: seek forward');
            if (this.currentState && this.currentState.currentTime + 10 < this.currentState.duration) {
                this.sendMessage({ 
                    type: 'SEEK', 
                    payload: this.currentState.currentTime + 10,
                    timestamp: Date.now() 
                });
            }
        });

        // Try to set seekto handler (not supported on all browsers)
        try {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                console.log('[Pear Connect] MediaSession: seek to', details.seekTime);
                if (details.seekTime !== null && details.seekTime !== undefined) {
                    this.sendMessage({ 
                        type: 'SEEK', 
                        payload: details.seekTime,
                        timestamp: Date.now() 
                    });
                }
            });
        } catch (e) {
            console.log('[Pear Connect] seekto action not supported');
        }

        console.log('[Pear Connect] MediaSession initialized');
    }

    updateMediaSession(state) {
        if (!('mediaSession' in navigator) || !state || !state.trackInfo) {
            return;
        }

        // Sync silent audio element to ensure native controls show correct Play/Pause state
        if (this.audioElement) {
            if (state.isPlaying) {
                if (this.audioElement.paused) {
                    this.audioElement.play().catch(e => console.error('[Pear Connect] Audio resume failed', e));
                }
            } else {
                if (!this.audioElement.paused) {
                    this.audioElement.pause();
                }
            }
        }

        // Update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: state.trackInfo.title || 'Unknown Track',
            artist: state.trackInfo.artist || 'Unknown Artist',
            album: state.trackInfo.album || '',
            artwork: state.trackInfo.thumbnail ? [
                { src: state.trackInfo.thumbnail, sizes: '512x512', type: 'image/jpeg' }
            ] : []
        });

        // Update playback state
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

        // Update position state
        if (state.duration > 0) {
            navigator.mediaSession.setPositionState({
                duration: state.duration,
                playbackRate: 1.0,
                position: Math.min(state.currentTime, state.duration)
            });
        }
    }

    async handleConnect() {
        const deviceName = this.deviceNameInput.value.trim();
        const pairingCode = this.pairingCodeInput.value.trim();
        
        if (!deviceName) {
            this.showError('Please enter a device name');
            return;
        }

        // Activate media session IMMEDIATELY on user interaction
        this.activateMediaSession();
        
        this.deviceName = deviceName;
        localStorage.setItem('pear-device-name', deviceName);
        
        this.connectBtn.disabled = true;
        this.connectBtn.textContent = 'Connecting...';
        
        try {
            await this.connect(pairingCode || undefined);
        } catch (error) {
            this.showError('Connection failed: ' + error.message);
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect';
        }
    }

    async connect(pairingCode) {
        return new Promise((resolve, reject) => {
            // Get WebSocket URL from current location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateStatus('connected', 'Connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message, pairingCode, resolve, reject);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('disconnected', 'Connection Error');
                reject(new Error('WebSocket connection failed'));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.updateStatus('disconnected', 'Disconnected');
                this.showAuthCard();
                setTimeout(() => {
                    if (this.token) {
                        this.connect();
                    }
                }, 5000);
            };
        });
    }

    handleMessage(message, pairingCode, resolve, reject) {
        console.log('[Pear Connect Client] Received:', message.type, message.payload ? '(with payload)' : '(no payload)');
        
        switch (message.type) {
            case 'DEVICE_INFO':
                // Send auth request
                this.sendMessage({
                    type: 'AUTH_REQUEST',
                    payload: {
                        deviceName: this.deviceName,
                        deviceType: this.getDeviceType(),
                        token: this.token,
                        pairingCode: pairingCode
                    },
                    timestamp: Date.now()
                });
                break;
                
            case 'AUTH_SUCCESS':
                this.token = message.payload.token;
                localStorage.setItem('pear-token', this.token);
                this.showPlayerCard();
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                this.hideError();
                
                // Request initial queue after successful auth
                console.log('[Pear Connect Client] Auth successful, requesting initial queue...');
                setTimeout(() => {
                    this.sendMessage({ type: 'GET_QUEUE', timestamp: Date.now() });
                }, 500);
                
                if (resolve) resolve();
                break;
                
            case 'AUTH_FAILED':
                this.token = null;
                localStorage.removeItem('pear-token');
                this.showError('Authentication failed: ' + (message.payload.reason || 'Unknown error'));
                this.showAuthCard();
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                if (reject) reject(new Error(message.payload.reason));
                break;
                
            case 'AUTH_RESPONSE':
                // Show pairing code if needed
                this.showError('Please enter the pairing code: ' + message.payload.pairingCode);
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                break;
                
            case 'STATE_UPDATE':
                this.updatePlayerState(message.payload);
                break;
                
            case 'QUEUE_UPDATE':
                this.updateQueue(message.payload);
                break;
                
            case 'ERROR':
                this.showError(message.payload.error);
                break;
                
            case 'PONG':
                // Handle pong
                break;

            // WebRTC Signaling
            case 'RTC_ANSWER':
                this.handleRTCAnswer(message.payload);
                break;
                
            case 'RTC_ICE_CANDIDATE':
                this.handleRTCIceCandidate(message.payload);
                break;

            // Lyrics
            case 'LYRICS_UPDATE':
                this.updateLyrics(message.payload);
                break;

            // Playback Target
            case 'SET_PLAYBACK_TARGET':
                this.handlePlaybackTargetChange(message.payload);
                break;
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    updatePlayerState(state) {
        const oldVideoId = this.currentState?.trackInfo?.videoId;
        const newVideoId = state.trackInfo?.videoId;
        
        this.currentState = state;
        this.isPlaying = state.isPlaying;
        
        // Update play/pause button
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
        
        // Update track info
        if (state.trackInfo) {
            this.trackTitle.textContent = state.trackInfo.title || 'Unknown';
            this.trackArtist.textContent = state.trackInfo.artist || 'Unknown';
            if (state.trackInfo.thumbnail) {
                this.trackThumbnail.src = state.trackInfo.thumbnail;
            }
        }
        
        // Update progress
        const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
        this.progressFill.style.width = progress + '%';
        this.currentTime.textContent = this.formatTime(state.currentTime);
        this.duration.textContent = this.formatTime(state.duration);
        
        // Update volume
        this.volumeSlider.value = state.volume;
        if (this.volumeValue) {
            this.volumeValue.textContent = Math.round(state.volume) + '%';
        }
        
        // Update MediaSession
        this.updateMediaSession(state);
        
        // Update lyrics display based on current time
        if (this.currentLyrics && this.currentLyrics.length > 0) {
            this.displayCurrentLyric();
        }
        
        // If the video changed, update queue highlighting
        if (oldVideoId && newVideoId && oldVideoId !== newVideoId) {
            console.log('[Pear Connect Client] Track changed from', oldVideoId, 'to', newVideoId, '- updating queue highlighting');
            // Update highlighting immediately
            this.updateQueueHighlighting();
            // Also re-render queue to ensure sync
            if (this.lastQueue && this.lastQueue.length > 0) {
                setTimeout(() => {
                    if (this.lastQueue) {
                        console.log('[Pear Connect Client] Re-rendering queue with new current track');
                        this.updateQueue(this.lastQueue);
                    }
                }, 100);
            }
            
            // Request lyrics for new track
            this.sendMessage({ type: 'GET_LYRICS', timestamp: Date.now() });
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.sendMessage({ type: 'PAUSE', timestamp: Date.now() });
        } else {
            this.sendMessage({ type: 'PLAY', timestamp: Date.now() });
        }
    }

    previous() {
        this.sendMessage({ type: 'PREVIOUS', timestamp: Date.now() });
    }

    next() {
        this.sendMessage({ type: 'NEXT', timestamp: Date.now() });
    }

    setVolume(volume) {
        if (this.volumeValue) {
            this.volumeValue.textContent = Math.round(volume) + '%';
        }
        this.sendMessage({ 
            type: 'SET_VOLUME', 
            payload: parseInt(volume),
            timestamp: Date.now() 
        });
    }

    handleSeek(event) {
        if (!this.currentState || !this.currentState.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = x / rect.width;
        const seekTime = this.currentState.duration * percentage;
        
        this.sendMessage({ 
            type: 'SEEK', 
            payload: seekTime,
            timestamp: Date.now() 
        });
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
    }

    updateQueue(queue) {
        console.log('[Pear Connect Client] ========== QUEUE UPDATE START ==========');
        
        if (!queue || queue.length === 0) {
            this.queueList.innerHTML = '<div class="queue-empty">No tracks in queue</div>';
            this.lastQueue = null;
            return;
        }

        // Store queue for re-highlighting
        this.lastQueue = queue;
        
        this.queueList.innerHTML = '';
        
        let currentItemElement = null;
        let currentIndex = -1;
        
        // First pass: find the current playing index
        queue.forEach((item, index) => {
            if (item.isPlaying === true) {
                currentIndex = index;
            }
        });
        
        queue.forEach((item, index) => {
            const queueItem = document.createElement('div');
            queueItem.className = 'queue-item';
            queueItem.dataset.videoId = item.videoId;
            queueItem.dataset.index = index;
            
            // Use isPlaying flag from server to determine current song
            const isCurrent = item.isPlaying === true;
            if (isCurrent) {
                queueItem.classList.add('current');
                currentItemElement = queueItem;
            }
            
            // Add position badge relative to current position
            let positionBadge = '';
            if (currentIndex >= 0) {
                const relativePos = index - currentIndex;
                if (relativePos === 0) {
                    positionBadge = '<span class="queue-item-badge now-playing">0 (Now Playing)</span>';
                } else if (relativePos === 1) {
                    positionBadge = '<span class="queue-item-badge up-next">+1 (Up Next)</span>';
                } else if (relativePos > 1) {
                    positionBadge = \`<span class="queue-item-badge position">+\${relativePos}</span>\`;
                } else if (relativePos < 0) {
                    positionBadge = \`<span class="queue-item-badge played">\${relativePos}</span>\`;
                }
            } else {
                positionBadge = \`<span class="queue-item-badge position">#\${index + 1}</span>\`;
            }

            queueItem.innerHTML = \`
                <div class="queue-item-info">
                    <div class="queue-item-title">\${item.title}</div>
                    <div class="queue-item-artist">\${item.artist}</div>
                </div>
                \${positionBadge}
                <div class="queue-item-duration">\${this.formatTime(item.duration)}</div>
            \`;

            queueItem.addEventListener('click', () => {
                this.playQueueItem(index);
            });

            this.queueList.appendChild(queueItem);
        });
        
        // Scroll to current item after rendering
        if (currentItemElement) {
            setTimeout(() => {
                currentItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 100);
        }
    }

    updateQueueHighlighting() {
        if (!this.lastQueue) {
            return;
        }
        
        // Remove current class from all items
        const allItems = this.queueList.querySelectorAll('.queue-item');
        allItems.forEach(item => item.classList.remove('current'));
        
        // Find the item marked as playing in the queue data
        let currentItemElement = null;
        const currentIndex = this.lastQueue.findIndex(item => item.isPlaying === true);
        
        if (currentIndex >= 0 && allItems[currentIndex]) {
            allItems[currentIndex].classList.add('current');
            currentItemElement = allItems[currentIndex];
        }
        
        // Scroll to current item
        if (currentItemElement) {
            setTimeout(() => {
                currentItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 100);
        }
    }

    playQueueItem(index) {
        // Calculate relative index if we have a current index
        let payload = index;
        const currentIndex = this.lastQueue ? this.lastQueue.findIndex(item => item.isPlaying === true) : -1;
        
        // If we have a current index, send relative index (optional, depending on backend)
        // But backend seems to expect absolute index for 'pear-connect:play-queue-item'
        // Let's stick to absolute index as per backend implementation
        
        this.sendMessage({ 
            type: 'PLAY_QUEUE_ITEM', 
            payload: index,
            timestamp: Date.now() 
        });
    }

    getDeviceType() {
        const ua = navigator.userAgent;
        if (/iPad/.test(ua)) return 'tablet';
        if (/Mobile|Android|iPhone/.test(ua)) return 'mobile';
        return 'desktop';
    }

    updateStatus(status, text) {
        this.statusText.textContent = text;
        if (status === 'connected') {
            this.statusDot.classList.add('connected');
        } else {
            this.statusDot.classList.remove('connected');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.errorMessage.classList.remove('show');
    }

    showAuthCard() {
        this.authCard.style.display = 'block';
        this.playerCard.classList.remove('active');
    }

    showPlayerCard() {
        this.authCard.style.display = 'none';
        this.playerCard.classList.add('active');
        
        // Request audio focus to activate MediaSession
        this.activateMediaSession();
    }

    activateMediaSession() {
        // Create a silent audio element to gain audio focus and activate MediaSession
        if ('mediaSession' in navigator) {
            if (!this.audioElement) {
                this.audioElement = document.createElement('audio');
                this.audioElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
                this.audioElement.loop = true;
                this.audioElement.volume = 0.01; // Non-zero volume helps with iOS
                this.audioElement.playsInline = true; // Important for iOS
                this.audioElement.style.display = 'none';
                document.body.appendChild(this.audioElement);
            }
            
            // Play silent audio to activate media session
            this.audioElement.play().then(() => {
                console.log('[Pear Connect] MediaSession activated');
                if (navigator.mediaSession) {
                    navigator.mediaSession.playbackState = 'playing';
                }
            }).catch(err => {
                console.log('[Pear Connect] Failed to activate MediaSession:', err);
            });
        }
    }

    // ============ WebRTC Audio Streaming ============
    
    initWebRTCAudio() {
        // Request audio stream from desktop
        this.sendMessage({
            type: 'RTC_OFFER',
            payload: null, // We'll request desktop to initiate
            timestamp: Date.now()
        });
    }

    async handleRTCAnswer(answer) {
        try {
            if (this.peerConnection && answer) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('[Pear Connect] RTC Answer received and set');
            }
        } catch (error) {
            console.error('[Pear Connect] Error handling RTC answer:', error);
        }
    }

    async handleRTCIceCandidate(candidate) {
        try {
            if (this.peerConnection && candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('[Pear Connect] Error handling ICE candidate:', error);
        }
    }

    handlePlaybackTargetChange(target) {
        console.log('[Pear Connect] Playback target changed to:', target);
        // If target is phone or both, request audio stream
        if (target === 'phone' || target === 'both') {
            this.requestAudioStream();
        } else {
            // Stop audio stream if target is laptop only
            this.stopAudioStream();
        }
    }

    async requestAudioStream() {
        try {
            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Handle incoming audio track
            this.peerConnection.ontrack = (event) => {
                console.log('[Pear Connect] Received audio track');
                this.remoteAudioStream = event.streams[0];
                this.playAudioStream();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendMessage({
                        type: 'RTC_ICE_CANDIDATE',
                        payload: event.candidate.toJSON(),
                        timestamp: Date.now()
                    });
                }
            };

            // Create offer (phone initiates)
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to desktop
            this.sendMessage({
                type: 'RTC_OFFER',
                payload: offer,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[Pear Connect] Error requesting audio stream:', error);
        }
    }

    playAudioStream() {
        if (!this.remoteAudioStream) return;

        // Create audio element for playback
        let audioEl = document.getElementById('remoteAudio');
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'remoteAudio';
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            document.body.appendChild(audioEl);
        }
        audioEl.srcObject = this.remoteAudioStream;
        audioEl.play().catch(e => console.error('[Pear Connect] Audio play error:', e));

        // Setup visualizer with remote audio
        this.setupVisualizerWithStream(this.remoteAudioStream);
    }

    stopAudioStream() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        const audioEl = document.getElementById('remoteAudio');
        if (audioEl) {
            audioEl.srcObject = null;
        }
        this.remoteAudioStream = null;
    }

    // ============ Visualizer ============
    
    initVisualizer() {
        if (!this.visualizerCanvas) return;
        
        this.visualizerCtx = this.visualizerCanvas.getContext('2d');
        this.resizeVisualizer();
        window.addEventListener('resize', () => this.resizeVisualizer());
        
        // Start animation loop (will show idle animation until audio is connected)
        this.drawVisualizer();
    }

    resizeVisualizer() {
        if (!this.visualizerCanvas) return;
        this.visualizerCanvas.width = window.innerWidth;
        this.visualizerCanvas.height = 200;
    }

    setupVisualizerWithStream(stream) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            console.log('[Pear Connect] Visualizer connected to audio stream');
        } catch (error) {
            console.error('[Pear Connect] Visualizer setup error:', error);
        }
    }

    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    drawVisualizer() {
        if (!this.visualizerCanvas || !this.visualizerCtx) {
            this.animationId = requestAnimationFrame(() => this.drawVisualizer());
            return;
        }

        const ctx = this.visualizerCtx;
        const width = this.visualizerCanvas.width;
        const height = this.visualizerCanvas.height;
        
        ctx.clearRect(0, 0, width, height);

        if (this.analyser && this.dataArray) {
            // Real audio data
            this.analyser.getByteFrequencyData(this.dataArray);
        }

        // Draw wave bars
        const barCount = 64;
        const barWidth = width / barCount;
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(30, 144, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(77, 166, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(100, 180, 255, 0.3)');
        
        ctx.fillStyle = gradient;
        
        for (let i = 0; i < barCount; i++) {
            let barHeight;
            
            if (this.dataArray && this.analyser) {
                // Map bar to frequency data
                const dataIndex = Math.floor(i * (this.dataArray.length / barCount));
                barHeight = (this.dataArray[dataIndex] / 255) * height * 0.8;
            } else {
                // Idle animation when no audio
                const time = Date.now() / 1000;
                barHeight = (Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5) * height * 0.3;
            }
            
            const x = i * barWidth;
            const y = height - barHeight;
            
            // Draw rounded bar
            ctx.beginPath();
            ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 3);
            ctx.fill();
        }

        this.animationId = requestAnimationFrame(() => this.drawVisualizer());
    }

    // ============ Lyrics ============
    
    updateLyrics(lyrics) {
        this.currentLyrics = lyrics;
        console.log('[Pear Connect] Lyrics updated:', lyrics ? lyrics.length + ' lines' : 'none');
        
        if (!lyrics || lyrics.length === 0) {
            // No lyrics available
            if (this.lyricsEmpty) this.lyricsEmpty.style.display = 'block';
            if (this.lyricsCurrent) this.lyricsCurrent.style.display = 'none';
            if (this.lyricsNext) this.lyricsNext.style.display = 'none';
            return;
        }
        
        // Hide empty message, show lyrics
        if (this.lyricsEmpty) this.lyricsEmpty.style.display = 'none';
        if (this.lyricsCurrent) this.lyricsCurrent.style.display = 'block';
        if (this.lyricsNext) this.lyricsNext.style.display = 'block';
        
        // Display first lyric line
        this.displayCurrentLyric();
    }

    displayCurrentLyric() {
        if (!this.currentLyrics || !this.currentState) return;
        
        const currentTime = this.currentState.currentTime || 0;
        let currentIndex = -1;
        
        // Find the current lyric line based on time
        for (let i = 0; i < this.currentLyrics.length; i++) {
            if (this.currentLyrics[i].time <= currentTime) {
                currentIndex = i;
            } else {
                break;
            }
        }
        
        if (currentIndex >= 0 && this.lyricsCurrent) {
            const current = this.currentLyrics[currentIndex];
            this.lyricsCurrent.textContent = current.text || '';
            
            // Show translation if available
            if (current.translation) {
                this.lyricsCurrent.textContent += '\\n' + current.translation;
            }
        }
        
        // Show next line
        if (currentIndex + 1 < this.currentLyrics.length && this.lyricsNext) {
            this.lyricsNext.textContent = this.currentLyrics[currentIndex + 1].text || '';
        } else if (this.lyricsNext) {
            this.lyricsNext.textContent = '';
        }
    }
}

// Initialize client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PearConnectClient();
});
    `;
  }

  private setupIPC() {
    // Remove existing handlers first to avoid "second handler" error
    try {
      ipcMain.removeHandler('pear-connect:get-clients');
      ipcMain.removeHandler('pear-connect:get-pending-pairings');
      ipcMain.removeHandler('pear-connect:confirm-pairing');
      ipcMain.removeHandler('pear-connect:disconnect-client');
      ipcMain.removeHandler('pear-connect:get-server-info');
      ipcMain.removeHandler('pear-connect:get-playback-target');
      ipcMain.removeHandler('pear-connect:set-playback-target');
    } catch (e) {
      // Ignore errors if handlers don't exist
    }

    // Get server info (port and local IP)
    ipcMain.handle('pear-connect:get-server-info', () => {
      return {
        port: this.config.port,
        ip: this.getLocalIP()
      };
    });

    // Get connected clients
    ipcMain.handle('pear-connect:get-clients', () => {
      return this.wsServer?.getConnectedClients() ?? [];
    });

    // Get pending pairings
    ipcMain.handle('pear-connect:get-pending-pairings', () => {
      return this.wsServer?.getPendingPairings() ?? [];
    });

    // Confirm pairing
    ipcMain.handle('pear-connect:confirm-pairing', (_, clientId: string, deviceInfo) => {
      return this.wsServer?.confirmPairing(clientId, deviceInfo);
    });

    // Disconnect client
    ipcMain.handle('pear-connect:disconnect-client', (_, clientId: string) => {
      this.wsServer?.disconnectClient(clientId);
    });

    // Get playback target
    ipcMain.handle('pear-connect:get-playback-target', () => {
      return this.playbackTarget;
    });

    // Set playback target
    ipcMain.handle('pear-connect:set-playback-target', (_, target: PlaybackTarget) => {
      this.playbackTarget = target;
      // Broadcast target change to all connected clients
      this.wsServer?.broadcastPlaybackTarget(target);
      // Also notify renderer to mute/unmute based on target
      this.webContents?.send('pear-connect:playback-target-changed', target);
      return target;
    });

    // Broadcast state update
    ipcMain.on('pear-connect:state-update', (_, state: PlaybackState) => {
      this.wsServer?.broadcastState(state);
    });

    // Broadcast queue update (instant, no delay)
    ipcMain.on('pear-connect:queue-update', (_, queue: QueueItem[]) => {
      // Use setImmediate for zero-delay async broadcast
      setImmediate(() => {
        this.wsServer?.broadcastQueue(queue);
      });
    });

    // Playback control from client
    ipcMain.on('pear-connect:playback-control', (_, action: string) => {
      this.webContents?.send('pear-connect:playback-control', action);
    });

    // Volume control from client
    ipcMain.on('pear-connect:volume-control', (_, volume: number) => {
      this.webContents?.send('pear-connect:volume-control', volume);
    });

    // Seek from client
    ipcMain.on('pear-connect:seek', (_, time: number) => {
      this.webContents?.send('pear-connect:seek', time);
    });

    // Get queue from client
    ipcMain.on('pear-connect:get-queue', () => {
      this.webContents?.send('pear-connect:get-queue');
    });

    // Add to queue from client
    ipcMain.on('pear-connect:add-to-queue', (_, item: QueueItem) => {
      this.webContents?.send('pear-connect:add-to-queue', item);
    });

    // WebRTC Signaling - Forward RTC answer from renderer to phone client
    ipcMain.on('pear-connect:rtc-answer', (_, data: { clientId: string; answer: unknown }) => {
      this.wsServer?.sendRTCAnswer(data.clientId, data.answer);
    });

    // WebRTC Signaling - Forward ICE candidate from renderer to phone client
    ipcMain.on('pear-connect:rtc-ice-candidate', (_, data: { clientId: string; candidate: unknown }) => {
      this.wsServer?.sendRTCIceCandidate(data.clientId, data.candidate);
    });

    // Lyrics update from renderer
    ipcMain.on('pear-connect:lyrics-update', (_, lyrics: unknown) => {
      this.wsServer?.broadcastLyrics(lyrics);
    });
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    let bestAddress = '127.0.0.1';
    let maxPriority = -100;

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const addr of iface) {
        // Skip internal addresses and IPv6
        if (addr.family === 'IPv4' && !addr.internal) {
          let priority = 0;
          const lowerName = name.toLowerCase();

          // High priority for physical interfaces
          if (lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('ethernet') || lowerName.includes('en0')) {
            priority += 20;
          }

          // Medium priority for standard private ranges
          if (addr.address.startsWith('192.168.')) {
            priority += 10;
          } else if (addr.address.startsWith('10.')) {
            priority += 5;
          }

          // Low priority for virtual interfaces
          if (lowerName.includes('virtual') || lowerName.includes('wsl') || lowerName.includes('docker') || lowerName.includes('vethernet') || lowerName.includes('vmware')) {
            priority -= 20;
          }

          if (priority > maxPriority) {
            maxPriority = priority;
            bestAddress = addr.address;
          }
        }
      }
    }

    return bestAddress;
  }

  onConfigChange(newConfig: PearConnectConfig) {
    const needsRestart =
      newConfig.port !== this.config.port ||
      newConfig.serviceName !== this.config.serviceName ||
      newConfig.discoveryEnabled !== this.config.discoveryEnabled;

    this.config = newConfig;

    if (needsRestart && this.config.enabled) {
      this.stop();
      this.start();
    } else if (!this.config.enabled) {
      this.stop();
    } else if (this.config.enabled && !this.httpServer) {
      this.start();
    }
  }

  getConnectedClients(): RemoteClient[] {
    return this.wsServer?.getConnectedClients() ?? [];
  }
}
