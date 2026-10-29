import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { screen } from 'electron';

import { createPlugin } from '@/utils';
import { registerCallback, type SongInfo } from '@/providers/song-info';

function getDisplaysInfo() {
  try {
    const all = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    return {
      count: all.length,
      primaryId: primary?.id,
      displays: all.map((d) => ({
        id: d.id,
        bounds: d.bounds,
        isPrimary: d.id === primary?.id,
      })),
    };
  } catch (_) {
    return { count: 1, displays: [] };
  }
}

export interface WallpaperSyncConfig {
  enabled: boolean;
  port: number;
  fps: number;
}

export const defaultWallpaperSyncConfig: WallpaperSyncConfig = {
  enabled: true,
  port: 26540,
  fps: 24,
};

export default createPlugin<
  {
    server: http.Server | null;
    wss: WebSocketServer | null;
    clients: Set<WebSocket>;
    currentSong: SongInfo | null;
    hasVideo: boolean;
    startServer(port: number, ctx: any): void;
    stopServer(): void;
    broadcast(data: unknown): void;
    broadcastBinary(buf: ArrayBuffer): void;
  },
  unknown,
  {
    ipc: any;
    videoElement: HTMLVideoElement | null;
    offscreenCanvas: HTMLCanvasElement | null;
    offscreenCtx: CanvasRenderingContext2D | null;
    captureTimer: number | null;
    isVideoActive: boolean;
    currentSongInfo: SongInfo | null;
    initCapture(): void;
    startLoop(): void;
    stopLoop(): void;
    checkVideoState(): void;
  },
  WallpaperSyncConfig
>({
  name: () => 'Lively Wallpaper TV',
  description: () =>
    'Streams now-playing video and artwork to Lively Wallpaper Living Room TV',
  restartNeeded: false,
  config: defaultWallpaperSyncConfig,

  backend: {
    server: null,
    wss: null,
    clients: new Set(),
    currentSong: null,
    hasVideo: false,

    async start(ctx) {
      if (ctx.window?.webContents) {
        try {
          ctx.window.webContents.setBackgroundThrottling(false);
        } catch (_) {}
      }

      registerCallback((songInfo) => {
        this.currentSong = songInfo;
        this.broadcast({
          type: 'TRACK_INFO',
          title: songInfo.title,
          artist: songInfo.artist,
          album: songInfo.album,
          thumbnail: songInfo.imageSrc,
          isPaused: songInfo.isPaused ?? false,
          hasVideo: this.hasVideo,
        });
      });

      ctx.ipc.on('wallpaper-sync:video-state', ({ hasVideo }: { hasVideo: boolean }) => {
        this.hasVideo = hasVideo;
        this.broadcast({
          type: 'VIDEO_STATE',
          hasVideo,
        });
      });

      ctx.ipc.on('wallpaper-sync:frame-bin', (buf: ArrayBuffer) => {
        this.broadcastBinary(buf);
      });

      ctx.ipc.on('wallpaper-sync:light', (color: { r: number; g: number; b: number }) => {
        this.broadcast({
          type: 'LIGHT',
          ...color,
        });
      });

      const onDisplayChange = () => {
        this.broadcast({
          type: 'DISPLAYS_INFO',
          displays: getDisplaysInfo(),
        });
      };
      try {
        screen.on('display-added', onDisplayChange);
        screen.on('display-removed', onDisplayChange);
        screen.on('display-metrics-changed', onDisplayChange);
      } catch (_) {}

      const cfg = await ctx.getConfig();
      this.startServer(cfg.port || 26540, ctx);
    },

    stop() {
      this.stopServer();
    },

    startServer(port: number) {
      this.stopServer();

      try {
        this.server = http.createServer((_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(
            JSON.stringify({
              app: 'Pear Desktop',
              hasVideo: this.hasVideo,
              displays: getDisplaysInfo(),
              song: this.currentSong
                ? {
                    title: this.currentSong.title,
                    artist: this.currentSong.artist,
                    isPaused: this.currentSong.isPaused,
                  }
                : null,
            }),
          );
        });

        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket) => {
          this.clients.add(ws);

          // Send current display setup and song state immediately
          ws.send(
            JSON.stringify({
              type: 'INIT',
              hasVideo: this.hasVideo,
              displays: getDisplaysInfo(),
              song: this.currentSong
                ? {
                    title: this.currentSong.title,
                    artist: this.currentSong.artist,
                    album: this.currentSong.album,
                    thumbnail: this.currentSong.imageSrc,
                    isPaused: this.currentSong.isPaused ?? false,
                  }
                : null,
            }),
          );

          ws.on('close', () => {
            this.clients.delete(ws);
          });

          ws.on('error', () => {
            this.clients.delete(ws);
          });
        });

        this.server.listen(port, '127.0.0.1');
      } catch (err) {
        console.error('[WallpaperSync] Server start error:', err);
      }
    },

    stopServer() {
      if (this.wss) {
        for (const client of this.clients) {
          try {
            client.close();
          } catch (_) {}
        }
        this.clients.clear();
        this.wss.close();
        this.wss = null;
      }
      if (this.server) {
        this.server.close();
        this.server = null;
      }
    },

    broadcast(data: unknown) {
      if (!this.wss || this.clients.size === 0) return;
      const msg = typeof data === 'string' ? data : JSON.stringify(data);
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    },

    broadcastBinary(buf: ArrayBuffer) {
      if (!this.wss || this.clients.size === 0) return;
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(buf, { binary: true });
        }
      }
    },
  },

  renderer: {
    ipc: null,
    videoElement: null,
    offscreenCanvas: null,
    offscreenCtx: null,
    captureTimer: null,
    isVideoActive: false,
    currentSongInfo: null,

    start(ctx) {
      this.ipc = ctx.ipc;

      // Keep the video element in the viewport and visible to Chromium's compositor
      // when the player panel is minimized, and restore full layout when open.
      if (!document.getElementById('wallpaper-sync-video-keepalive')) {
        const style = document.createElement('style');
        style.id = 'wallpaper-sync-video-keepalive';
        style.textContent = `
          /* When minimized: keep video decoding active offscreen */
          ytmusic-app-layout:not([player-page-open]) #song-video,
          ytmusic-app-layout:not([player-page-open]) .html5-video-container {
            display: block !important;
            visibility: visible !important;
          }
          ytmusic-app-layout:not([player-page-open]) .html5-video-container video {
            display: block !important;
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 20px !important;
            height: 20px !important;
            opacity: 0.001 !important;
            z-index: -99999 !important;
            pointer-events: none !important;
          }

          /* When open: restore full video display, sizing and opacity */
          ytmusic-app-layout[player-page-open] #song-video,
          ytmusic-app-layout[player-page-open] .html5-video-container {
            display: block !important;
            visibility: visible !important;
          }
          ytmusic-app-layout[player-page-open] .html5-video-container video {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            width: 100% !important;
            height: 100% !important;
            opacity: 1 !important;
            z-index: auto !important;
            pointer-events: auto !important;
            visibility: visible !important;
          }
        `;
        document.head.appendChild(style);
      }

      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 640;
      this.offscreenCanvas.height = 360;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
        willReadFrequently: false,
      });

      ctx.ipc.on('peard:update-song-info', (songInfo: SongInfo) => {
        this.currentSongInfo = songInfo;
        this.checkVideoState();
      });

      this.initCapture();
    },

    stop() {
      this.stopLoop();
      document.getElementById('wallpaper-sync-video-keepalive')?.remove();
    },

    initCapture() {
      const checkVideo = () => {
        const video =
          document.querySelector<HTMLVideoElement>('.html5-video-container > video') ||
          document.querySelector<HTMLVideoElement>('video');

        if (video && video !== this.videoElement) {
          if (this.videoElement) {
            this.stopLoop();
          }
          this.videoElement = video;
          this.isVideoActive = false;

          video.addEventListener('play', () => this.checkVideoState());
          video.addEventListener('pause', () => this.checkVideoState());
          video.addEventListener('loadeddata', () => this.checkVideoState());
          video.addEventListener('loadedmetadata', () => this.checkVideoState());
          video.addEventListener('resize', () => this.checkVideoState());
          video.addEventListener('playing', () => this.checkVideoState());
          video.addEventListener('timeupdate', () => this.checkVideoState());
          video.addEventListener('canplay', () => this.checkVideoState());
          video.addEventListener('seeked', () => this.checkVideoState());
        }
        this.checkVideoState();
      };

      checkVideo();
      setInterval(checkVideo, 250);

      // Mutation observer to detect when user toggles video / song mode or minimizes/maximizes player
      const observer = new MutationObserver(() => this.checkVideoState());
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: [
          'playback-mode',
          'video-mode',
          'player-page-open',
          'player-ui-state',
        ],
      });
    },

    checkVideoState() {
      // Direct hardware/media check: video element exists, is actively playing, and has decoded video dimensions
      const hasFrames = Boolean(
        this.videoElement &&
          !this.videoElement.paused &&
          this.videoElement.readyState >= 2 &&
          this.videoElement.videoWidth > 0 &&
          this.videoElement.videoHeight > 0,
      );

      if (this.isVideoActive !== hasFrames || (hasFrames && !this.captureTimer)) {
        this.isVideoActive = hasFrames;
        this.ipc?.send('wallpaper-sync:video-state', { hasVideo: hasFrames });

        if (hasFrames) {
          this.startLoop();
        } else {
          this.stopLoop();
        }
      }
    },

    startLoop() {
      this.stopLoop();

      let frameSeq = 0;
      let isCapturing = true;
      let isEncoding = false;
      let frameCount = 0;
      let lastFrameTime = 0;
      const targetInterval = 1000 / 30; // 30 FPS target
      let rVfcId: number | null = null;
      let watchdogTimer: NodeJS.Timeout | null = null;
      this.captureTimer = 1;

      const processFrame = () => {
        if (!isCapturing || isEncoding) return;

        if (
          this.videoElement &&
          !this.videoElement.paused &&
          this.videoElement.videoWidth > 0 &&
          this.offscreenCtx &&
          this.offscreenCanvas
        ) {
          const now = performance.now();
          if (now - lastFrameTime < targetInterval - 4) return;
          lastFrameTime = now;
          isEncoding = true;

          try {
            this.offscreenCtx.drawImage(
              this.videoElement,
              0,
              0,
              this.offscreenCanvas.width,
              this.offscreenCanvas.height,
            );

            // Sample light color once every 6 frames from offscreen canvas
            frameCount++;
            if (frameCount % 6 === 0) {
              try {
                const pixel = this.offscreenCtx.getImageData(320, 180, 1, 1).data;
                this.ipc?.send('wallpaper-sync:light', {
                  r: pixel[0],
                  g: pixel[1],
                  b: pixel[2],
                });
              } catch (_) {}
            }

            const currentSeq = ++frameSeq;

            // Export binary blob with strictly serialized transfer and sequence header
            this.offscreenCanvas.toBlob(
              (blob) => {
                if (!blob || !isCapturing) {
                  isEncoding = false;
                  return;
                }

                blob
                  .arrayBuffer()
                  .then((buf) => {
                    if (!isCapturing) return;
                    // Prepend 8-byte header: 0x5649444F ('VIDO') + uint32 sequence number
                    const headerBuf = new ArrayBuffer(8 + buf.byteLength);
                    const view = new DataView(headerBuf);
                    view.setUint32(0, 0x5649444F); // 'VIDO'
                    view.setUint32(4, currentSeq);
                    new Uint8Array(headerBuf, 8).set(new Uint8Array(buf));
                    this.ipc?.send('wallpaper-sync:frame-bin', headerBuf);
                  })
                  .catch(() => {})
                  .finally(() => {
                    isEncoding = false;
                  });
              },
              'image/jpeg',
              0.65,
            );
          } catch (_) {
            isEncoding = false;
          }
        }
      };

      // Watchdog ticker ensures frames continue if rVFC pauses
      const resetWatchdog = () => {
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
        }
        if (!isCapturing) return;
        watchdogTimer = setTimeout(() => {
          processFrame();
          resetWatchdog();
        }, 34);
      };

      // rVFC handler for exact decode-synced capture
      const onVfc = () => {
        if (!isCapturing) return;
        processFrame();
        resetWatchdog();
        if (this.videoElement && 'requestVideoFrameCallback' in this.videoElement) {
          rVfcId = (this.videoElement as any).requestVideoFrameCallback(onVfc);
        }
      };

      processFrame();
      if (this.videoElement && 'requestVideoFrameCallback' in this.videoElement) {
        rVfcId = (this.videoElement as any).requestVideoFrameCallback(onVfc);
      }
      resetWatchdog();

      this.stopLoop = () => {
        isCapturing = false;
        this.captureTimer = null;
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        if (
          rVfcId !== null &&
          this.videoElement &&
          'cancelVideoFrameCallback' in this.videoElement
        ) {
          try {
            (this.videoElement as any).cancelVideoFrameCallback(rVfcId);
          } catch (_) {}
          rVfcId = null;
        }
      };
    },

    stopLoop() {
      if (this.captureTimer) {
        this.captureTimer = null;
      }
    },
  },
});
