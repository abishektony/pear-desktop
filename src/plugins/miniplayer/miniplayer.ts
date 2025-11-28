import { ElementFromHtml } from '@/plugins/utils/renderer';
import { height } from 'happy-dom/lib/PropertySymbol';
import { he } from 'zod/v4/locales';

const miniplayerHTML = `
<div class="pear-miniplayer" id="pear-miniplayer">
  <div class="pear-miniplayer-main">
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
    private resizeHandler: () => void;
    private isActive = false;
    private config: any = {
        visualizerEnabled: true,
        visualizerStyle: 'bars',
        videoEnabled: true,
        clickToSwitch: true
    };
    private preferredMode: 'visualizer' | 'video' | 'thumbnail' = 'visualizer';

    constructor(config?: any) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
        this.element = ElementFromHtml(miniplayerHTML);
        this.initElements();
        this.setupEventListeners();

        this.resizeHandler = this.checkWindowSize.bind(this);
        window.addEventListener('resize', this.resizeHandler);

        document.addEventListener('peard:audio-can-play', this.handleAudioCanPlay.bind(this));

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
        this.titleElement = this.element.querySelector('#pear-miniplayer-title');
        this.artistElement = this.element.querySelector('#pear-miniplayer-artist');
        this.playButton = this.element.querySelector('#pear-miniplayer-play');
        this.prevButton = this.element.querySelector('#pear-miniplayer-prev');
        this.nextButton = this.element.querySelector('#pear-miniplayer-next');
        this.seekBar = this.element.querySelector('#pear-miniplayer-seek');
        this.seekProgress = this.element.querySelector('#pear-miniplayer-seek-progress');
        this.thumbnailElement = this.element.querySelector('#pear-miniplayer-thumb');
        this.canvas = this.element.querySelector('#pear-miniplayer-canvas');
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
    }

    private cycleMode() {
        const modes: ('visualizer' | 'video' | 'thumbnail')[] = ['thumbnail'];
        if (this.config.videoEnabled) modes.unshift('video');
        if (this.config.visualizerEnabled) modes.unshift('visualizer');

        const currentIndex = modes.indexOf(this.preferredMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.preferredMode = modes[nextIndex];
    }

    private checkWindowSize() {
        const shouldBeActive = window.innerWidth <= 480;

        if (shouldBeActive !== this.isActive) {
            this.isActive = shouldBeActive;

            if (shouldBeActive) {
                this.element.classList.add('active');
                this.hideYouTubeMiniplayer();
                this.startTracking();
            } else {
                this.element.classList.remove('active');
                this.showYouTubeMiniplayer();
                this.stopTracking();
            }
        }

        // Update size on resize
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
            } else {
                this.drawSelfVisualizer();
            }
        } else if (modeToShow === 'video' && video) {
            this.drawToCanvas(video);
        } else {
            this.clearCanvas();
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

    private updatePlayerState() {
        try {
            // Get song info
            const titleEl = document.querySelector('.title.ytmusic-player-bar');
            const artistEl = document.querySelector('.byline.ytmusic-player-bar');
            const thumbnailCandidate = this.getThumbnailSrc();
            const video = document.querySelector('video');

            if (this.titleElement && titleEl) {
                this.titleElement.textContent = titleEl.textContent || 'No song playing';
            }

            if (this.artistElement && artistEl) {
                this.artistElement.textContent = artistEl.textContent || '-';
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

        if (width <= 360 && height <= 200) {
            this.element.style.width = '95vw';
            this.element.style.height = '100%';
            this.element.style.borderRadius = '0';
            this.element.style.margin = '0';
        } else if (width <= 615) {
            this.element.style.width = '90%';
            this.element.style.height = '80px';
            this.element.style.borderRadius = '12px 12px 0 0';
            this.element.style.margin = '0 10px';
        }
    }

    getElement(): HTMLElement {
        return this.element;
    }

    destroy() {
        this.stopTracking();
        window.removeEventListener('resize', this.resizeHandler);
        this.showYouTubeMiniplayer();
        this.element.remove();
    }
}
