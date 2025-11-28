import { ElementFromHtml } from '@/plugins/utils/renderer';
const miniplayerHTML = `
<div class="pear-player-container">
  <div class="pear-miniplayer" id="pear-miniplayer">
    <div class="pear-miniplayer-main" id="pear-miniplayer-clickable">
      <div class="pear-miniplayer-thumbnail" id="pear-miniplayer-thumb" style="overflow: hidden;">
        <canvas id="pear-miniplayer-canvas" style="width: 100%; height: 100%; display: none;"></canvas>
      </div>
      <div class="pear-miniplayer-info">
        <div class="pear-miniplayer-title" id="pear-miniplayer-title">No song playing</div>
        <div class="pear-miniplayer-artist" id="pear-miniplayer-artist">-</div>
      </div>
      <div class="pear-miniplayer-controls">
        <button class="pear-miniplayer-btn" id="pear-miniplayer-prev" title="Previous">⏮</button>
        <button class="pear-miniplayer-btn play" id="pear-miniplayer-play" title="Play/Pause">▶</button>
        <button class="pear-miniplayer-btn" id="pear-miniplayer-next" title="Next">⏭</button>
      </div>
    </div>
    
    <div class="pear-miniplayer-seek" id="pear-miniplayer-seek">
      <div class="pear-miniplayer-seek-progress" id="pear-miniplayer-seek-progress" style="width: 0%"></div>
    </div>
  </div>

  <div class="pear-fullscreen-player" id="pear-fullscreen-player">
    <div class="pear-fullscreen-content">
      <div class="pear-fullscreen-media">
        <canvas class="pear-fullscreen-visualizer-bg" id="pear-fullscreen-visualizer-bg"></canvas>
        <div class="pear-fullscreen-thumbnail" id="pear-fullscreen-thumb" style="overflow: hidden;">
          <canvas id="pear-fullscreen-canvas" style="width: 100%; height: 100%; display: none;"></canvas>
        </div>
      </div>
      
      <div class="pear-fullscreen-info">
        <div class="pear-fullscreen-title" id="pear-fullscreen-title">No song playing</div>
        <div class="pear-fullscreen-artist" id="pear-fullscreen-artist">-</div>
      </div>
      
      <div class="pear-fullscreen-seek" id="pear-fullscreen-seek">
        <div class="pear-fullscreen-seek-progress" id="pear-fullscreen-seek-progress" style="width: 0%"></div>
      </div>
      
      <div class="pear-fullscreen-controls">
        <button class="pear-fullscreen-btn" id="pear-fullscreen-shuffle" title="Shuffle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-prev" title="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn play" id="pear-fullscreen-play" title="Play/Pause">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-next" title="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <button class="pear-fullscreen-btn" id="pear-fullscreen-repeat" title="Repeat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
            </div>
    
    <!-- Compact current lyric display for bottom mode -->
    <div class="pear-fullscreen-current-lyric" id="pear-fullscreen-current-lyric">
        <div class="pear-fullscreen-current-lyric-text" id="pear-fullscreen-current-lyric-text"></div>
    </div>
    
    <div class="pear-fullscreen-bottom-controls">
        <div class="pear-fullscreen-volume">
    </div>
    <div class="pear-fullscreen-bottom-controls">
        <div class="pear-fullscreen-volume">
        <button class="pear-fullscreen-btn volume-btn" id="pear-fullscreen-volume-btn" title="Mute/Unmute">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
        </button>
        <input type="range" class="pear-fullscreen-volume-slider" id="pear-fullscreen-volume-slider" min="0" max="100" value="100" title="Volume">
        <span class="pear-fullscreen-volume-value" id="pear-fullscreen-volume-value">100%</span>
        </div>
        <button class="pear-fullscreen-btn lyrics-btn" id="pear-fullscreen-lyrics-btn" title="Toggle Lyrics">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
        </svg>
        </button>
        <button class="pear-fullscreen-close" id="pear-fullscreen-close" title="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        </button>
    </div>
      
    <div class="pear-fullscreen-lyrics-panel" id="pear-fullscreen-lyrics-panel">
        <div class="pear-fullscreen-lyrics-content" id="pear-fullscreen-lyrics-content"></div>
    </div>
  </div>
</div>
`;


export class Miniplayer {
    private element: HTMLElement;
    private titleElement: HTMLElement | null = null;
    private artistElement: HTMLElement | null = null;
    private playButton: HTMLButtonElement | null = null;
    private prevButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private seekBar: HTMLElement | null = null;
    private seekProgress: HTMLElement | null = null;
    private thumbnailElement: HTMLElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isActive = false;
    private config: any = {
        visualizerEnabled: true,
        visualizerStyle: 'bars',
        videoEnabled: true,
        clickToSwitch: true
    };
    private preferredMode: 'visualizer' | 'video' | 'thumbnail' = 'visualizer';

    // Fullscreen player elements
    private fullscreenLyricsButton: HTMLButtonElement | null = null;
    private fullscreenLyricsPanel: HTMLElement | null = null;
    private fullscreenLyricsContent: HTMLElement | null = null;
    private fullscreenCurrentLyric: HTMLElement | null = null;
    private fullscreenCurrentLyricText: HTMLElement | null = null;
    private isLyricsOpen = false;
    private currentLyricUpdateInterval: number | null = null;
    private fullscreenPlayer: HTMLElement | null = null;
    private fullscreenTitleElement: HTMLElement | null = null;
    private fullscreenArtistElement: HTMLElement | null = null;
    private fullscreenPlayButton: HTMLButtonElement | null = null;
    private fullscreenPrevButton: HTMLButtonElement | null = null;
    private fullscreenNextButton: HTMLButtonElement | null = null;
    private fullscreenShuffleButton: HTMLButtonElement | null = null;
    private fullscreenRepeatButton: HTMLButtonElement | null = null;
    private fullscreenSeekBar: HTMLElement | null = null;
    private fullscreenSeekProgress: HTMLElement | null = null;
    private fullscreenThumbnailElement: HTMLElement | null = null;
    private fullscreenCanvas: HTMLCanvasElement | null = null;
    private fullscreenVisualizerBgCanvas: HTMLCanvasElement | null = null;
    private fullscreenCloseButton: HTMLButtonElement | null = null;
    private fullscreenVolumeButton: HTMLButtonElement | null = null;
    private fullscreenVolumeSlider: HTMLInputElement | null = null;
    private isFullscreenOpen = false;

    private boundHandleAudioCanPlay: (e: Event) => void;

    constructor(config?: any) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
        this.element = ElementFromHtml(miniplayerHTML);
        this.initElements();
        this.setupEventListeners();

        this.boundHandleAudioCanPlay = this.handleAudioCanPlay.bind(this);
        document.addEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);

        // Initial check
        this.checkWindowSize();
    }

    private handleAudioCanPlay(e: Event) {
        const event = e as CustomEvent;
        this.audioContext = event.detail.audioContext;
        const source = event.detail.audioSource;

        if (this.audioContext && source) {
            try {
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 32;
                source.connect(this.analyser);

                const bufferLength = this.analyser.frequencyBinCount;
                this.dataArray = new Uint8Array(bufferLength);
            } catch (err) {
                console.error('[Miniplayer] Failed to connect audio source:', err);
            }
        }
    }

    setConfig(config: any) {
        this.config = { ...this.config, ...config };
        // Update FFT size based on style if needed
        if (this.analyser) {
            if (this.config.visualizerStyle === 'wave') {
                this.analyser.fftSize = 128; // More bins for wave
            } else {
                this.analyser.fftSize = 32; // Fewer bins for bars
            }
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
    }

    private initElements() {
        console.log('[Miniplayer] this.element:', this.element);
        console.log('[Miniplayer] this.element.innerHTML:', this.element.innerHTML.substring(0, 200));

        this.titleElement = this.element.querySelector('#pear-miniplayer-title');
        this.artistElement = this.element.querySelector('#pear-miniplayer-artist');
        this.playButton = this.element.querySelector('#pear-miniplayer-play');
        this.prevButton = this.element.querySelector('#pear-miniplayer-prev');
        this.nextButton = this.element.querySelector('#pear-miniplayer-next');
        this.seekBar = this.element.querySelector('#pear-miniplayer-seek');
        this.seekProgress = this.element.querySelector('#pear-miniplayer-seek-progress');
        this.thumbnailElement = this.element.querySelector('#pear-miniplayer-thumb');
        this.canvas = this.element.querySelector('#pear-miniplayer-canvas');

        // Fullscreen elements
        this.fullscreenPlayer = this.element.querySelector('#pear-fullscreen-player');
        console.log('[Miniplayer] Queried for #pear-fullscreen-player, result:', this.fullscreenPlayer);

        this.fullscreenLyricsButton = this.element.querySelector('#pear-fullscreen-lyrics-btn');
        this.fullscreenLyricsPanel = this.element.querySelector('#pear-fullscreen-lyrics-panel');
        this.fullscreenLyricsContent = this.element.querySelector('#pear-fullscreen-lyrics-content');
        this.fullscreenCurrentLyric = this.element.querySelector('#pear-fullscreen-current-lyric');
        this.fullscreenCurrentLyricText = this.element.querySelector('#pear-fullscreen-current-lyric-text');
        this.fullscreenTitleElement = this.element.querySelector('#pear-fullscreen-title');
        this.fullscreenArtistElement = this.element.querySelector('#pear-fullscreen-artist');
        this.fullscreenPlayButton = this.element.querySelector('#pear-fullscreen-play');
        this.fullscreenPrevButton = this.element.querySelector('#pear-fullscreen-prev');
        this.fullscreenNextButton = this.element.querySelector('#pear-fullscreen-next');
        this.fullscreenShuffleButton = this.element.querySelector('#pear-fullscreen-shuffle');
        this.fullscreenRepeatButton = this.element.querySelector('#pear-fullscreen-repeat');
        this.fullscreenSeekBar = this.element.querySelector('#pear-fullscreen-seek');
        this.fullscreenSeekProgress = this.element.querySelector('#pear-fullscreen-seek-progress');
        this.fullscreenThumbnailElement = this.element.querySelector('#pear-fullscreen-thumb');
        this.fullscreenCanvas = this.element.querySelector('#pear-fullscreen-canvas');
        this.fullscreenVisualizerBgCanvas = this.element.querySelector('#pear-fullscreen-visualizer-bg');
        this.fullscreenCloseButton = this.element.querySelector('#pear-fullscreen-close');
        this.fullscreenVolumeButton = this.element.querySelector('#pear-fullscreen-volume-btn');
        this.fullscreenVolumeSlider = this.element.querySelector('#pear-fullscreen-volume-slider');
    }

    private setupEventListeners() {
        this.playButton?.addEventListener('click', () => {
            const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
            playPauseButton?.click();
        });

        this.prevButton?.addEventListener('click', () => {
            const prevButton = document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar');
            prevButton?.click();
        });

        this.nextButton?.addEventListener('click', () => {
            const nextButton = document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar');
            nextButton?.click();
        });

        this.seekBar?.addEventListener('click', (e) => {
            const rect = this.seekBar!.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const video = document.querySelector('video');
            if (video && video.duration) {
                video.currentTime = percent * video.duration;
            }
        });

        if (this.thumbnailElement) {
            this.thumbnailElement.addEventListener('click', () => {
                if (!this.config.clickToSwitch) return;
                this.cycleMode();
            });
        }

        // Open fullscreen when clicking on miniplayer (but not on thumbnail)
        const clickableArea = this.element.querySelector('#pear-miniplayer-clickable');
        clickableArea?.addEventListener('click', (e) => {
            console.log('[Miniplayer] Click detected on:', e.target);
            // Don't open if clicking on thumbnail or controls
            const target = e.target as HTMLElement;
            if (target.closest('#pear-miniplayer-thumb') ||
                target.closest('.pear-miniplayer-controls')) {
                console.log('[Miniplayer] Click ignored - on thumbnail or controls');
                return;
            }
            console.log('[Miniplayer] Opening fullscreen');
            this.openFullscreen();
        });
        // Fullscreen player event listeners
        this.fullscreenPlayButton?.addEventListener('click', () => {
            const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
            playPauseButton?.click();
        });

        this.fullscreenPrevButton?.addEventListener('click', () => {
            const prevButton = document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar');
            prevButton?.click();
        });

        this.fullscreenNextButton?.addEventListener('click', () => {
            const nextButton = document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar');
            nextButton?.click();
        });

        this.fullscreenShuffleButton?.addEventListener('click', () => {
            const shuffleButton = document.querySelector<HTMLElement>('ytmusic-player-bar tp-yt-paper-icon-button.shuffle');
            shuffleButton?.click();
        });

        this.fullscreenRepeatButton?.addEventListener('click', () => {
            const repeatButton = document.querySelector<HTMLElement>('ytmusic-player-bar tp-yt-paper-icon-button.repeat');
            repeatButton?.click();
        });

        this.fullscreenSeekBar?.addEventListener('click', (e) => {
            const rect = this.fullscreenSeekBar!.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const video = document.querySelector('video');
            if (video && video.duration) {
                video.currentTime = percent * video.duration;
            }
        });

        this.fullscreenCloseButton?.addEventListener('click', () => {
            this.closeFullscreen();
        });

        this.fullscreenCloseButton?.addEventListener('click', () => {
            this.closeFullscreen();
        });

        // Auto-close fullscreen on very small screens
        // window.addEventListener('resize', () => {
        //     if (this.isFullscreenOpen) {
        //         const width = window.innerWidth;
        //         const height = window.innerHeight;

        //         // Close fullscreen if screen is too small
        //         if (width <= 390 || height <= 560) {
        //             this.closeFullscreen();
        //         }
        //     }
        // });

        this.fullscreenVolumeButton?.addEventListener('click', () => {
            const video = document.querySelector('video');
            if (video) {
                video.muted = !video.muted;
                this.updateVolumeIcon();
            }
        });

        this.fullscreenVolumeSlider?.addEventListener('input', (e) => {
            const video = document.querySelector('video');
            if (video) {
                const value = parseInt((e.target as HTMLInputElement).value);
                video.volume = value / 100;
                video.muted = false;
                this.updateVolumeIcon();
            }
        });

        if (this.fullscreenThumbnailElement) {
            this.fullscreenThumbnailElement.addEventListener('click', () => {
                if (!this.config.clickToSwitch) return;
                this.cycleMode();
            });
        }
        this.fullscreenLyricsButton?.addEventListener('click', () => {
            this.toggleLyrics();
        });

        window.addEventListener('resize', () => {
            this.updateLyricsButtonVisibility();
            this.updateFullscreenVisibility();
        });
    }

    private cycleMode() {
        const modes: ('visualizer' | 'video' | 'thumbnail')[] = ['thumbnail'];
        if (this.config.videoEnabled) modes.unshift('video');
        if (this.config.visualizerEnabled) modes.unshift('visualizer');

        const currentIndex = modes.indexOf(this.preferredMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const oldMode = this.preferredMode;
        this.preferredMode = modes[nextIndex];
        console.log(`[Miniplayer] Mode cycled from ${oldMode} to ${this.preferredMode}. Available modes:`, modes);
    }

    private checkWindowSize() {
        const shouldBeActive = window.innerWidth <= 1080;

        if (shouldBeActive !== this.isActive) {
            this.isActive = shouldBeActive;

            const miniplayerDiv = this.element.querySelector('#pear-miniplayer');
            if (shouldBeActive) {
                miniplayerDiv?.classList.add('active');
                this.hideYouTubeMiniplayer();
                this.startTracking();
            } else {
                miniplayerDiv?.classList.remove('active');
                this.showYouTubeMiniplayer();
                this.stopTracking();
            }
        }

        this.updateSize();
    }

    private trackingInterval: number | null = null;
    private animationFrameId: number | null = null;

    private startTracking() {
        if (this.trackingInterval) return;

        this.trackingInterval = window.setInterval(() => {
            this.updatePlayerState();
        }, 500);

        const loop = () => {
            this.renderFrame();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    private stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private renderFrame() {
        const video = document.querySelector('video');

        // Determine what to show based on preferredMode and availability
        let modeToShow = this.preferredMode;

        // Fallback logic
        if (modeToShow === 'visualizer') {
            if (!this.config.visualizerEnabled || !this.analyser) {
                modeToShow = 'video';
            }
        }

        if (modeToShow === 'video') {
            if (!this.config.videoEnabled || !video || video.videoWidth === 0) {
                modeToShow = 'thumbnail';
            }
        }

        // Render based on determined mode
        if (modeToShow === 'visualizer' && this.analyser) {
            if (this.config.visualizerStyle === 'wave') {
                this.drawWaveVisualizer();
                if (this.isFullscreenOpen) {
                    this.drawWaveVisualizerFullscreen();
                    this.drawVisualizerBackground();
                }
            } else {
                this.drawSelfVisualizer();
                if (this.isFullscreenOpen) {
                    this.drawSelfVisualizerFullscreen();
                    this.drawVisualizerBackground();
                }
            }
        } else if (modeToShow === 'video' && video) {
            this.drawToCanvas(video);
            if (this.isFullscreenOpen) {
                this.drawToCanvasFullscreen(video);
                if (this.analyser) this.drawVisualizerBackground();
            }
        } else {
            this.clearCanvas();
            if (this.isFullscreenOpen) {
                this.clearCanvasFullscreen();
                if (this.analyser) this.drawVisualizerBackground();
            }
        }
    }

    private drawWaveVisualizer() {
        if (!this.canvas || !this.analyser || !this.dataArray || !this.thumbnailElement) return;

        this.canvas.style.display = 'block';
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const width = this.thumbnailElement.clientWidth;
        const height = this.thumbnailElement.clientHeight;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        this.analyser.getByteFrequencyData(this.dataArray as any);

        ctx.clearRect(0, 0, width, height);

        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;

        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e90ff';
        ctx.lineWidth = 2;

        // Draw concentric circles based on frequency data
        const circleCount = 5;
        // Use lower frequencies which are usually more active (bass)
        // We skip the very first bin (DC offset) and take a few steps
        const step = Math.floor((this.dataArray.length / 2) / circleCount);

        for (let i = 0; i < circleCount; i++) {
            // Get average of a small range for smoother movement
            let sum = 0;
            const start = i * step;
            const count = 3;
            for (let j = 0; j < count; j++) {
                sum += this.dataArray[start + j] || 0;
            }
            const value = sum / count;
            const intensity = value / 255;

            // Base radius increases with index
            // Dynamic component based on intensity
            const radius = ((i + 1) * (maxRadius / (circleCount + 1))) + (intensity * 8);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

            // Blue color with opacity based on intensity
            ctx.strokeStyle = `rgba(77, 166, 255, ${0.3 + intensity * 0.7})`;
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    private drawSelfVisualizer() {
        if (!this.canvas || !this.analyser || !this.dataArray || !this.thumbnailElement) return;

        this.canvas.style.display = 'block';
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const width = this.thumbnailElement.clientWidth;
        const height = this.thumbnailElement.clientHeight;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        this.analyser.getByteFrequencyData(this.dataArray as any);

        ctx.clearRect(0, 0, width, height);

        // Darken background for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        // Draw bars
        const barWidth = (width / this.dataArray.length);
        let barHeight;
        let x = 0;

        // Glow effect
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e8fff9b';
        ctx.fillStyle = '#4da6ff9b';

        for (let i = 0; i < this.dataArray.length; i++) {
            barHeight = (this.dataArray[i] / 255) * height;

            // Draw rounded bars if possible, else rects
            const w = Math.max(1, barWidth - 0.5);
            ctx.fillRect(x, height - barHeight, w, barHeight);

            x += barWidth;
        }

        // Reset shadow
        ctx.shadowBlur = 0;
    }

    private drawToCanvas(source: CanvasImageSource) {
        if (!this.canvas || !this.thumbnailElement) return;

        this.canvas.style.display = 'block';
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            // Match the size of the thumbnail container
            const width = this.thumbnailElement.clientWidth;
            const height = this.thumbnailElement.clientHeight;

            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
            }

            ctx.drawImage(source, 0, 0, width, height);
        }
    }

    private clearCanvas() {
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
    }

    // Fullscreen drawing methods
    private drawWaveVisualizerFullscreen() {
        if (!this.fullscreenCanvas || !this.analyser || !this.dataArray || !this.fullscreenThumbnailElement) return;

        this.fullscreenCanvas.style.display = 'block';
        const ctx = this.fullscreenCanvas.getContext('2d');
        if (!ctx) return;

        const width = this.fullscreenThumbnailElement.clientWidth;
        const height = this.fullscreenThumbnailElement.clientHeight;

        if (this.fullscreenCanvas.width !== width || this.fullscreenCanvas.height !== height) {
            this.fullscreenCanvas.width = width;
            this.fullscreenCanvas.height = height;
        }

        this.analyser.getByteFrequencyData(this.dataArray as any);

        ctx.clearRect(0, 0, width, height);

        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;

        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e90ff';
        ctx.lineWidth = 2;

        const circleCount = 5;
        const step = Math.floor((this.dataArray.length / 2) / circleCount);

        for (let i = 0; i < circleCount; i++) {
            let sum = 0;
            const start = i * step;
            const count = 3;
            for (let j = 0; j < count; j++) {
                sum += this.dataArray[start + j] || 0;
            }
            const value = sum / count;
            const intensity = value / 255;

            const radius = ((i + 1) * (maxRadius / (circleCount + 1))) + (intensity * 8);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

            ctx.strokeStyle = `rgba(77, 166, 255, ${0.3 + intensity * 0.7})`;
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    private drawSelfVisualizerFullscreen() {
        if (!this.fullscreenCanvas || !this.analyser || !this.dataArray || !this.fullscreenThumbnailElement) return;

        this.fullscreenCanvas.style.display = 'block';
        const ctx = this.fullscreenCanvas.getContext('2d');
        if (!ctx) return;

        const width = this.fullscreenThumbnailElement.clientWidth;
        const height = this.fullscreenThumbnailElement.clientHeight;

        if (this.fullscreenCanvas.width !== width || this.fullscreenCanvas.height !== height) {
            this.fullscreenCanvas.width = width;
            this.fullscreenCanvas.height = height;
        }

        this.analyser.getByteFrequencyData(this.dataArray as any);

        ctx.clearRect(0, 0, width, height);

        // Darken background for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        // Draw bars
        const barWidth = (width / this.dataArray.length);
        let barHeight;
        let x = 0;

        // Glow effect
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e8fff9b';
        ctx.fillStyle = '#4da6ff9b';

        for (let i = 0; i < this.dataArray.length; i++) {
            barHeight = (this.dataArray[i] / 255) * height;

            const w = Math.max(1, barWidth - 0.5);
            ctx.fillRect(x, height - barHeight, w, barHeight);

            x += barWidth;
        }

        ctx.shadowBlur = 0;
    }

    private drawToCanvasFullscreen(source: CanvasImageSource) {
        if (!this.fullscreenCanvas || !this.fullscreenThumbnailElement) return;

        this.fullscreenCanvas.style.display = 'block';
        const ctx = this.fullscreenCanvas.getContext('2d');
        if (ctx) {
            const width = this.fullscreenThumbnailElement.clientWidth;
            const height = this.fullscreenThumbnailElement.clientHeight;

            if (this.fullscreenCanvas.width !== width || this.fullscreenCanvas.height !== height) {
                this.fullscreenCanvas.width = width;
                this.fullscreenCanvas.height = height;
            }

            ctx.drawImage(source, 0, 0, width, height);
        }
    }

    private clearCanvasFullscreen() {
        if (this.fullscreenCanvas) {
            this.fullscreenCanvas.style.display = 'none';
        }
    }
    // Draw cloud-like wave visualizer behind the image
    private drawVisualizerBackground() {
        if (!this.fullscreenVisualizerBgCanvas || !this.analyser || !this.dataArray) return;

        // console.log('[Visualizer] Drawing, canvas:', this.fullscreenVisualizerBgCanvas, 'analyser:', this.analyser, 'dataArray:', this.dataArray);
        const canvas = this.fullscreenVisualizerBgCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size - increased to 800 for larger waves
        if (canvas.width !== 800 || canvas.height !== 800) {
            canvas.width = 800;
            canvas.height = 800;
        }

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray as any);

        // Clear canvas
        ctx.clearRect(0, 0, 800, 800);

        const centerX = 400;
        const centerY = 400;
        const waveCount = 8; // Number of wave petals

        // Draw multiple wave layers with different colors
        for (let layer = 0; layer < 3; layer++) {
            for (let i = 0; i < waveCount; i++) {
                const angle = (i / waveCount) * Math.PI * 2;
                const freqIndex = Math.floor((i / waveCount) * this.dataArray.length);
                // Increased amplitude and base size to extend beyond thumbnail
                // Thumbnail is ~350px wide (175px radius), so we need > 250px to be clearly visible
                const amplitude = (this.dataArray[freqIndex] / 255) * 200 + 100;

                // Create gradient for each wave
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, amplitude + layer * 40
                );

                if (layer === 0) {
                    gradient.addColorStop(0, 'rgba(38, 95, 156, 0.1)');
                    gradient.addColorStop(0.5, 'rgba(52, 132, 236, 0.8)');
                    gradient.addColorStop(1, 'rgba(38, 95, 156, 0.1)');
                } else if (layer === 1) {
                    gradient.addColorStop(0, 'rgba(32, 81, 197, 0.1)');
                    gradient.addColorStop(0.5, 'rgba(13, 60, 146, 0.8)');
                    gradient.addColorStop(1, 'rgba(32, 57, 151, 0.1)');
                } else {
                    gradient.addColorStop(0, 'rgba(30, 144, 255, 0.1)');
                    gradient.addColorStop(0.5, 'rgba(30, 144, 255, 0.8)');
                    gradient.addColorStop(1, 'rgba(30, 144, 255, 0.1)');
                }

                ctx.fillStyle = gradient;
                ctx.filter = 'blur(30px)';

                // Draw wave petal
                ctx.beginPath();
                for (let j = 0; j <= 50; j++) {
                    const t = (j / 50) * Math.PI * 0.5;
                    const r = amplitude + layer * 40 + Math.sin(t * 4) * 30;
                    const x = centerX + Math.cos(angle + t) * r;
                    const y = centerY + Math.sin(angle + t) * r;

                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.filter = 'none';
    }


    private openFullscreen() {
        console.log('[Miniplayer] openFullscreen called, fullscreenPlayer:', this.fullscreenPlayer);
        if (!this.fullscreenPlayer) {
            console.error('[Miniplayer] fullscreenPlayer element not found!');
            return;
        }
        this.isFullscreenOpen = true;
        this.fullscreenPlayer.classList.add('active');
        console.log('[Miniplayer] Added active class to fullscreen player');

        // Set blurred background image and extract colors
        const thumbnailSrc = this.getThumbnailSrc();
        if (thumbnailSrc && this.fullscreenPlayer) {
            // Set CSS variable for the background
            this.fullscreenPlayer.style.setProperty('--bg-image', `url("${thumbnailSrc}")`);
        }

        // Sync current state to fullscreen player
        this.updateFullscreenPlayerState();
        this.updateLyricsButtonVisibility();
        this.updateFullscreenVisibility();
    }


    private closeFullscreen() {
        if (!this.fullscreenPlayer) return;
        this.isFullscreenOpen = false;
        this.fullscreenPlayer.classList.remove('active');
        if (this.isLyricsOpen) {
            this.toggleLyrics();
        }
    }

    private updateVolumeIcon() {
        if (!this.fullscreenVolumeButton) return;
        const video = document.querySelector('video');
        if (!video) return;

        const muteIcon = `
    < svg width = "24" height = "24" viewBox = "0 0 24 24" fill = "none" stroke = "currentColor" stroke - width="2" stroke - linecap="round" stroke - linejoin="round" >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1 = "9" x2 = "17" y2 = "15" />
                <line x1="17" y1 = "9" x2 = "23" y2 = "15" />
                    </svg>`;

        const lowVolumeIcon = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>`;

        const highVolumeIcon = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>`;

        if (video.muted || video.volume === 0) {
            this.fullscreenVolumeButton.innerHTML = muteIcon;
        } else if (video.volume < 0.5) {
            this.fullscreenVolumeButton.innerHTML = lowVolumeIcon;
        } else {
            this.fullscreenVolumeButton.innerHTML = highVolumeIcon;
        }
    }

    private updateFullscreenPlayerState() {
        try {
            const titleEl = document.querySelector('.title.ytmusic-player-bar');
            const artistEl = document.querySelector('.byline.ytmusic-player-bar');
            const thumbnailCandidate = this.getThumbnailSrc();
            const video = document.querySelector('video');

            if (this.fullscreenTitleElement && titleEl) {
                this.fullscreenTitleElement.textContent = titleEl.textContent || 'No song playing';
            }

            if (this.fullscreenArtistElement && artistEl) {
                this.fullscreenArtistElement.textContent = artistEl.textContent || '-';
            }

            if (this.fullscreenThumbnailElement) {
                if (thumbnailCandidate) {
                    this.verifyAndSetFullscreenImage(thumbnailCandidate);
                } else {
                    this.fullscreenThumbnailElement.style.backgroundImage = '';
                }
            }

            if (this.fullscreenPlayButton && video) {
                this.fullscreenPlayButton.textContent = video.paused ? '▶' : '⏸';
            }

            if (video && this.fullscreenSeekProgress) {
                const percent = (video.currentTime / video.duration) * 100 || 0;
                this.fullscreenSeekProgress.style.width = `${percent}%`;
            }

            if (video && this.fullscreenVolumeSlider) {
                this.fullscreenVolumeSlider.value = String(Math.round(video.volume * 100));
            }

            this.updateVolumeIcon();
        } catch (error) {
            console.error('[Miniplayer] Error updating fullscreen state:', error);
        }
    }


    private updatePlayerState() {
        try {
            // Get song info
            const titleEl = document.querySelector('.title.ytmusic-player-bar');
            const artistEl = document.querySelector('.byline.ytmusic-player-bar');
            const thumbnailCandidate = this.getThumbnailSrc();
            const video = document.querySelector('video');

            // Store the old title before updating
            const oldTitle = this.titleElement?.textContent;

            if (this.titleElement && titleEl) {
                this.titleElement.textContent = titleEl.textContent || 'No song playing';
            }

            if (this.artistElement && artistEl) {
                this.artistElement.textContent = artistEl.textContent || '-';
            }

            // Detect song change and refresh lyrics
            const newTitle = this.titleElement?.textContent;
            if (oldTitle && newTitle && oldTitle !== newTitle && this.isLyricsOpen) {
                this.refreshLyricsOnSongChange();
            }

            // Set or clear thumbnail; verify image asynchronously to avoid channel avatar/placeholder
            if (this.thumbnailElement) {
                if (thumbnailCandidate) {
                    // immediately set a loading placeholder (optional) then verify real image
                    this.verifyAndSetImage(thumbnailCandidate);
                } else {
                    this.thumbnailElement.style.backgroundImage = '';
                }
            }

            // Update play/pause icon using video element's paused property
            if (this.playButton && video) {
                this.playButton.textContent = video.paused ? '▶' : '⏸';
            }

            // Update seek bar
            if (video && this.seekProgress) {
                const percent = (video.currentTime / video.duration) * 100 || 0;
                this.seekProgress.style.width = `${percent}%`;
            }

            // Update fullscreen player if it's open
            if (this.isFullscreenOpen) {
                this.updateFullscreenPlayerState();
            }
        } catch (error) {
            console.error('[Miniplayer] Error updating state:', error);
        }
    }

    // Prefer Media Session artwork, else try to construct a YouTube thumbnail from video id,
    // else fall back to DOM/background/meta heuristics.
    private getThumbnailSrc(): string | null {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            s = s.trim();
            if (s === '') return true;
            // tiny data URI placeholder commonly used by YT
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        // 1) Media Session API (most reliable for external apps)
        try {
            const ms = (navigator as any).mediaSession;
            if (ms && ms.metadata && Array.isArray(ms.metadata.artwork)) {
                // pick largest non-placeholder
                const arts = ms.metadata.artwork.slice().reverse();
                for (const a of arts) {
                    if (a && a.src && !isPlaceholder(a.src)) return a.src;
                }
            }
        } catch (e) { /* ignore */ }

        // 2) Try to derive YouTube video id (watch?v= or link in player title)
        const tryVideoId = (): string | null => {
            try {
                const urlVid = new URL(window.location.href).searchParams.get('v');
                if (urlVid) return urlVid;
            } catch (e) { }

            // common anchor in title bar
            const titleLink = document.querySelector<HTMLAnchorElement>('.title.ytmusic-player-bar a[href*="watch?v="]');
            if (titleLink) {
                try {
                    const u = new URL(titleLink.href, window.location.href);
                    const v = u.searchParams.get('v');
                    if (v) return v;
                } catch (e) { }
            }

            // sometimes there is a data-video-id attr on player or wrappers
            const vidAttrEl = document.querySelector<HTMLElement>('[data-video-id], [video-id], [data-videoid]');
            if (vidAttrEl) {
                return (vidAttrEl.getAttribute('data-video-id') || vidAttrEl.getAttribute('video-id') || vidAttrEl.getAttribute('data-videoid')) || null;
            }

            return null;
        };

        const vid = tryVideoId();
        if (vid) {
            // return the best candidate immediately (will be verified async)
            return `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`;
        }

        // 3) DOM / background / meta heuristics (existing fallback)
        const imgSelectors = [
            'ytmusic-player-bar #song-image img',
            'ytmusic-player-bar yt-img-shadow img',
            '#song-image img',
            'yt-img-shadow img',
            '.image.ytmusic-player-bar img',
            '.thumbnail img',
            '#thumbnail img'
        ];
        for (const sel of imgSelectors) {
            const img = document.querySelector<HTMLImageElement>(sel);
            if (!img) continue;
            const src = (img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-thumb') || null);
            if (src && !isPlaceholder(src)) return src;
        }

        const bgEl = document.querySelector<HTMLElement>('#song-image, ytmusic-player_bar yt-img-shadow, .image.ytmusic-player-bar, .thumbnail');
        if (bgEl) {
            const bg = bgEl.style.backgroundImage || window.getComputedStyle(bgEl).backgroundImage;
            if (bg && bg !== 'none') {
                const m = bg.match(/url\(["']?(.*?)["']?\)/);
                if (m && m[1] && !isPlaceholder(m[1])) return m[1];
            }
        }

        const metaImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="og:image"]');
        if (metaImg && metaImg.content && !isPlaceholder(metaImg.content)) return metaImg.content;

        return null;
    }

    // Verify image URL by loading it; if load succeeds, set as background. Tries common YouTube fallbacks on failure.
    private verifyAndSetImage(candidate: string) {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        const setBg = (url: string | null) => {
            if (!this.thumbnailElement) return;
            if (!url) {
                this.thumbnailElement.style.backgroundImage = '';
                return;
            }
            this.thumbnailElement.style.backgroundImage = `url(${url})`;
            this.thumbnailElement.style.backgroundSize = 'cover';
            this.thumbnailElement.style.backgroundPosition = 'center';
        };

        if (!candidate || isPlaceholder(candidate)) {
            setBg(null);
            return;
        }

        const tryLoad = (url: string, onFail?: () => void) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setBg(url);
            img.onerror = () => { if (onFail) onFail(); else setBg(null); };
            img.src = url;
        };

        // If candidate is a YouTube maxres URL, try fallbacks on error
        const ytMatch = candidate.match(/\/vi\/([^/]+)\/([^/]+)\.jpg/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const fallbacks = [
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/default.jpg`
            ];
            let i = 0;
            const tryNext = () => {
                if (i >= fallbacks.length) return setBg(null);
                const url = fallbacks[i++];
                tryLoad(url, tryNext);
            };
            tryNext();
            return;
        }

        // otherwise just try to load the provided URL
        tryLoad(candidate);
    }

    // Verify image URL by loading it for fullscreen; if load succeeds, set as background and CSS variable. Tries common YouTube fallbacks on failure.
    private verifyAndSetFullscreenImage(candidate: string) {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        const setBg = (url: string | null) => {
            if (!this.fullscreenThumbnailElement) return;
            if (!url) {
                this.fullscreenThumbnailElement.style.backgroundImage = '';
                // Also clear the CSS variable for the blurred background
                if (this.fullscreenPlayer) {
                    this.fullscreenPlayer.style.setProperty('--bg-image', 'none');
                }
                return;
            }
            this.fullscreenThumbnailElement.style.backgroundImage = `url(${url})`;
            this.fullscreenThumbnailElement.style.backgroundSize = 'cover';
            this.fullscreenThumbnailElement.style.backgroundPosition = 'center';

            // Also update the CSS variable for the blurred background
            if (this.fullscreenPlayer) {
                this.fullscreenPlayer.style.setProperty('--bg-image', `url("${url}")`);
            }
        };

        if (!candidate || isPlaceholder(candidate)) {
            setBg(null);
            return;
        }

        const tryLoad = (url: string, onFail?: () => void) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setBg(url);
            img.onerror = () => { if (onFail) onFail(); else setBg(null); };
            img.src = url;
        };

        // If candidate is a YouTube maxres URL, try fallbacks on error
        const ytMatch = candidate.match(/\/vi\/([^/]+)\/([^/]+)\.jpg/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const fallbacks = [
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/default.jpg`
            ];
            let i = 0;
            const tryNext = () => {
                if (i >= fallbacks.length) return setBg(null);
                const url = fallbacks[i++];
                tryLoad(url, tryNext);
            };
            tryNext();
            return;
        }

        // otherwise just try to load the provided URL
        tryLoad(candidate);
    }

    private updateLyricsButtonVisibility() {
        // Always show lyrics button - compact mode will be used on small screens
        if (!this.fullscreenLyricsButton) return;
        this.fullscreenLyricsButton.style.display = '';
    }

    private updateFullscreenVisibility() {
        if (!this.fullscreenPlayer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Hide fullscreen player if window is too small (less than 400x570)
        if (height < 570) {
            this.fullscreenPlayer.style.display = 'none';
        } else {
            this.fullscreenPlayer.style.display = '';
        }
    }

    private async toggleLyrics() {
        if (!this.fullscreenLyricsPanel || !this.fullscreenLyricsContent || !this.fullscreenPlayer) return;

        this.isLyricsOpen = !this.isLyricsOpen;

        if (this.isLyricsOpen) {
            try {
                const { mountLyrics } = await import('./lyrics-wrapper');
                mountLyrics(this.fullscreenLyricsContent);

                this.fullscreenLyricsPanel.classList.add('active');
                this.fullscreenPlayer.classList.add('lyrics-open');
                this.fullscreenLyricsButton?.classList.add('active');

                // Start updating current lyric for bottom mode
                this.currentLyricUpdateInterval = window.setInterval(() => {
                    this.updateCurrentLyric();
                }, 100);
            } catch (error) {
                console.error('[Miniplayer] Failed to load lyrics:', error);
                this.isLyricsOpen = false;
            }
        } else {
            try {
                // Stop updating current lyric
                if (this.currentLyricUpdateInterval) {
                    clearInterval(this.currentLyricUpdateInterval);
                    this.currentLyricUpdateInterval = null;
                }

                const { unmountLyrics } = await import('./lyrics-wrapper');
                unmountLyrics();

                this.fullscreenLyricsPanel.classList.remove('active');
                this.fullscreenPlayer.classList.remove('lyrics-open');
                this.fullscreenLyricsButton?.classList.remove('active');

                // Clear and hide compact lyrics box
                if (this.fullscreenCurrentLyricText) {
                    this.fullscreenCurrentLyricText.innerHTML = '';
                }
                if (this.fullscreenCurrentLyric) {
                    this.fullscreenCurrentLyric.classList.remove('visible');
                }
                this.currentLyricText = '';
            } catch (error) {
                console.error('[Miniplayer] Failed to unmount lyrics:', error);
            }
        }
    }

    private currentLyricText: string = '';

    private updateCurrentLyric() {
        if (!this.fullscreenCurrentLyricText || !this.isLyricsOpen) return;

        // Check if we're in bottom mode (400-799px width)
        const isBottomMode = window.innerWidth >= 300 && window.innerWidth <= 799;
        if (!isBottomMode) {
            this.fullscreenCurrentLyricText.innerHTML = '';
            this.currentLyricText = '';
            if (this.fullscreenCurrentLyric) {
                this.fullscreenCurrentLyric.classList.remove('visible');
            }
            return;
        }

        // Get the current lyric from the compact renderer
        import('./lyrics-wrapper').then(({ getCurrentLyricText }) => {
            const lyricText = getCurrentLyricText();

            // Only update if the lyric has actually changed
            if (lyricText === this.currentLyricText) {
                return;
            }

            this.currentLyricText = lyricText;

            if (this.fullscreenCurrentLyricText) {
                // Clear previous content
                this.fullscreenCurrentLyricText.innerHTML = '';

                if (lyricText && lyricText.trim()) {
                    // Split by newlines to handle romanization
                    const lines = lyricText.split('\n');

                    lines.forEach((line, lineIndex) => {
                        if (lineIndex > 0) {
                            // Add line break between original and romanization
                            this.fullscreenCurrentLyricText!.appendChild(document.createElement('br'));
                        }

                        // Split line into words and wrap each in a span for wave animation
                        const words = line.split(' ');
                        const lineContainer = document.createElement('div');
                        lineContainer.className = lineIndex === 0 ? 'lyric-line-main' : 'lyric-line-romanization';

                        words.forEach((word, index) => {
                            if (word.trim()) {
                                const span = document.createElement('span');
                                span.className = 'lyric-word';
                                span.style.animationDelay = `${index * 0.05}s`;
                                span.textContent = word + ' ';
                                lineContainer.appendChild(span);
                            }
                        });

                        this.fullscreenCurrentLyricText!.appendChild(lineContainer);
                    });

                    // Add visible class
                    if (this.fullscreenCurrentLyric) {
                        this.fullscreenCurrentLyric.classList.add('visible');
                    }
                } else {
                    // Show music symbol when no lyrics are active
                    const musicSymbol = document.createElement('span');
                    musicSymbol.className = 'lyric-word music-symbol';
                    musicSymbol.textContent = '♪';
                    this.fullscreenCurrentLyricText!.appendChild(musicSymbol);

                    if (this.fullscreenCurrentLyric) {
                        this.fullscreenCurrentLyric.classList.add('visible');
                    }
                }
            }
        }).catch(err => {
            console.error('[Miniplayer] Failed to get current lyric:', err);
        });
    }

    private async refreshLyricsOnSongChange() {
        if (!this.isLyricsOpen || !this.fullscreenLyricsContent) return;

        try {
            // Unmount and remount lyrics to refresh
            const { unmountLyrics, mountLyrics } = await import('./lyrics-wrapper');
            unmountLyrics();

            // Small delay to ensure clean unmount
            setTimeout(() => {
                if (this.fullscreenLyricsContent) {
                    mountLyrics(this.fullscreenLyricsContent);
                }
            }, 100);
        } catch (error) {
            console.error('[Miniplayer] Failed to refresh lyrics:', error);
        }
    }

    private hideYouTubeMiniplayer() {
        // Hide YouTube Music's native miniplayer
        const ytMiniPlayer = document.querySelector<HTMLElement>('ytmusic-player-bar');
        if (ytMiniPlayer) {
            ytMiniPlayer.style.display = 'none';
        }
    }

    private showYouTubeMiniplayer() {
        // Show YouTube Music's native miniplayer
        const ytMiniPlayer = document.querySelector<HTMLElement>('ytmusic-player-bar');
        if (ytMiniPlayer) {
            ytMiniPlayer.style.display = '';
        }
    }

    private updateSize() {
        if (!this.isActive) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        if (width <= 310 && height <= 200) {
            this.element.style.width = '95vw';
            this.element.style.height = '100%';
        } else if (width <= 500 && width > 310) {
            this.element.style.width = '90%';
            this.element.style.height = '80px';
            this.element.style.borderRadius = '25px';
            this.element.style.padding = '8px 12px';
            // this.element.style.left = "50%";
            // this.element.style.transform = "translateX(-50%)";
        } else {
            this.element.style.width = '500px';
            this.element.style.height = '80px';
            this.element.style.borderRadius = '25px';
            this.element.style.padding = '8px 12px';
            // this.element.style.left = "50%";
            // this.element.style.transform = "translateX(-50%)";
        }
    }

    getElement(): HTMLElement {
        return this.element;
    }

    destroy() {
        this.stopTracking();
        if (this.currentLyricUpdateInterval) {
            clearInterval(this.currentLyricUpdateInterval);
            this.currentLyricUpdateInterval = null;
        }
        this.element.remove();
        this.showYouTubeMiniplayer();
        document.removeEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);
    }
}