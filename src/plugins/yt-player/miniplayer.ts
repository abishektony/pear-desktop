import { ElementFromHtml } from '@/plugins/utils/renderer';
import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';
import { FastAverageColor } from 'fast-average-color';
import Color from 'color';
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
      <div class="pear-seek-preview" id="pear-miniplayer-seek-preview">0:00</div>
    </div>
  </div>

  <div class="pear-fullscreen-player" id="pear-fullscreen-player">
    <canvas class="pear-fullscreen-visualizer-bg" id="pear-fullscreen-visualizer-bg"></canvas>
    <div class="pear-visualizer-overlay" id="pear-visualizer-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(8px); background: rgba(0,0,0,0.2);"></div>
    <div class="pear-fullscreen-content" style="position: relative; z-index: 10;">
      <div class="pear-fullscreen-media">
        <!-- Two layers for crossfade dissolve effect -->
        <div class="pear-fullscreen-thumbnail pear-thumb-layer" id="pear-fullscreen-thumb-bottom" style="overflow: hidden;"></div>
        <div class="pear-fullscreen-thumbnail pear-thumb-layer" id="pear-fullscreen-thumb-top" style="overflow: hidden;">
          <canvas id="pear-fullscreen-canvas" style="width: 100%; height: 100%; display: none;"></canvas>
        </div>
      </div>
      
      <div class="pear-fullscreen-info">
        <div class="pear-fullscreen-title" id="pear-fullscreen-title">No song playing</div>
        <div class="pear-fullscreen-artist" id="pear-fullscreen-artist">-</div>
      </div>
      
      <div class="pear-fullscreen-seek" id="pear-fullscreen-seek">
        <div class="pear-fullscreen-seek-progress" id="pear-fullscreen-seek-progress" style="width: 0%"></div>
        <div class="pear-seek-preview" id="pear-fullscreen-seek-preview">0:00</div>
      </div>
      
      <div class="pear-fullscreen-controls">
        <button class="pear-fullscreen-btn" id="pear-fullscreen-like" title="Like">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
                <path id="volume-high-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path id="volume-high-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <line id="volume-mute" x1="23" y1="9" x2="17" y2="15" style="display: none;"/>
                <line id="volume-mute-2" x1="17" y1="9" x2="23" y2="15" style="display: none;"/>
            </svg>
        </button>
        <input type="range" class="pear-fullscreen-volume-slider" id="pear-fullscreen-volume-slider" min="0" max="100" value="100" title="Volume">
        <span class="pear-fullscreen-volume-value" id="pear-fullscreen-volume-value">100%</span>
        <button class="pear-fullscreen-btn sleep-timer-btn" id="pear-fullscreen-sleep-btn" title="Sleep Timer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="pear-sleep-timer-badge" id="pear-sleep-timer-badge" style="display: none;"></span>
        </button>
    </div>
        <button class="pear-fullscreen-btn queue-btn" id="pear-fullscreen-queue-btn" title="Toggle Queue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
        </button>
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
        <div class="pear-fullscreen-queue-header">
            <h3>Lyrics</h3>
        </div>
        <div class="pear-fullscreen-lyrics-content" id="pear-fullscreen-lyrics-content"></div>
    </div>

    <div class="pear-fullscreen-queue-panel" id="pear-fullscreen-queue-panel">
        <div class="pear-fullscreen-queue-header">
            <h3>Queue</h3>
        </div>
        <div class="pear-fullscreen-queue-content" id="pear-fullscreen-queue-content"></div>
    </div>
  </div>

  <!-- Sleep Timer Modal -->
  <div class="pear-sleep-timer-modal" id="pear-sleep-timer-modal">
    <div class="pear-sleep-timer-content">
      <div class="pear-sleep-timer-title">Sleep Timer</div>
      <div class="pear-sleep-timer-subtitle">Music will pause after the selected time</div>
      <div class="pear-sleep-timer-options">
        <button class="pear-sleep-timer-option selected" data-minutes="5">5 min</button>
        <button class="pear-sleep-timer-option" data-minutes="10">10 min</button>
        <button class="pear-sleep-timer-option" data-minutes="15">15 min</button>
        <button class="pear-sleep-timer-option" data-minutes="30">30 min</button>
        <button class="pear-sleep-timer-option" data-minutes="45">45 min</button>
        <button class="pear-sleep-timer-option" data-minutes="60">1 hr</button>
      </div>
      <div class="pear-sleep-timer-custom">
        <span>Or set custom:</span>
        <input type="number" id="pear-sleep-timer-custom-input" min="1" max="480" placeholder="30">
        <span>minutes</span>
      </div>
      <div class="pear-sleep-timer-wait-toggle">
        <label>
          <input type="checkbox" id="pear-sleep-timer-wait-end" checked>
          <span>Wait until current song ends</span>
        </label>
      </div>
      <div class="pear-sleep-timer-buttons">
        <button class="pear-sleep-timer-btn primary" id="pear-sleep-timer-start">Start Timer</button>
        <button class="pear-sleep-timer-btn cancel" id="pear-sleep-timer-cancel" style="display: none;">Cancel Timer</button>
        <button class="pear-sleep-timer-btn secondary" id="pear-sleep-timer-close">Close</button>
      </div>
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
    private config = {
        enabled: false,
        visualizerEnabled: true,
        visualizerStyle: 'bars',
        videoEnabled: true,
        clickToSwitch: true,
        draggableEnabled: true,
        widescreenMode: true,
        crossfadeEnabled: false,
        autoOpenOnSongChange: false,
        backgroundVisualizer: 'butterchurn' as 'none' | 'butterchurn' | 'sphere',
    };
    private preferredMode: 'visualizer' | 'video' | 'thumbnail' = 'visualizer';

    // Sphere Visualizer Properties
    // Sphere Visualizer Properties
    private spherePoints: { x: number, y: number, z: number }[] = [];
    private sphereRotation = 0;
    private playerApi: any = null;
    private butterchurnVisualizer: ReturnType<typeof Butterchurn.createVisualizer> | null = null;
    private visualizerPresetCycleInterval: number | null = null;

    // Fullscreen player elements
    private fullscreenQueueButton: HTMLButtonElement | null = null;
    private fullscreenQueuePanel: HTMLElement | null = null;
    private fullscreenQueueContent: HTMLElement | null = null;
    private isQueueOpen = false;
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
    private fullscreenLikeButton: HTMLButtonElement | null = null;
    private fullscreenRepeatButton: HTMLButtonElement | null = null;
    private fullscreenSeekBar: HTMLElement | null = null;
    private fullscreenSeekProgress: HTMLElement | null = null;
    private fullscreenThumbnailElement: HTMLElement | null = null;
    private fullscreenThumbTop: HTMLElement | null = null;
    private fullscreenThumbBottom: HTMLElement | null = null;
    private fullscreenCanvas: HTMLCanvasElement | null = null;
    private fullscreenVisualizerBgCanvas: HTMLCanvasElement | null = null;
    private fullscreenCloseButton: HTMLButtonElement | null = null;
    private fullscreenVolumeButton: HTMLButtonElement | null = null;
    private fullscreenVolumeSlider: HTMLInputElement | null = null;
    private fullscreenVolumeValue: HTMLElement | null = null;
    private isFullscreenOpen = false;

    // Sleep Timer properties
    private sleepTimerModal: HTMLElement | null = null;
    private sleepTimerButton: HTMLButtonElement | null = null;
    private sleepTimerBadge: HTMLElement | null = null;
    private sleepTimerStartBtn: HTMLButtonElement | null = null;
    private sleepTimerCancelBtn: HTMLButtonElement | null = null;
    private sleepTimerCloseBtn: HTMLButtonElement | null = null;
    private sleepTimerCustomInput: HTMLInputElement | null = null;
    private sleepTimerId: number | null = null;
    private sleepTimerEndTime: number | null = null;
    private sleepTimerBadgeInterval: number | null = null;
    private selectedSleepMinutes: number = 5;
    private waitUntilSongEnds: boolean = true;
    private sleepTimerWaitCheckbox: HTMLInputElement | null = null;

    // Crossfade properties
    private crossfadeDuration: number = 3000; // 3 seconds default
    private isCrossfading: boolean = false;
    private lastVideoId: string | null = null;
    private currentThumbnailUrl: string | null = null;

    // Seek bar preview properties
    private miniplayerSeekPreview: HTMLElement | null = null;
    private fullscreenSeekPreview: HTMLElement | null = null;

    // Volume persistence
    private savedVolume: number = 1.0; // Store volume level (0.0 to 1.0)

    private isInFallbackMode: boolean = false; // Track if we're in fallback due to no video
    private videoAvailabilityCheckInterval: number | null = null;

    // Dragging properties
    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private miniplayerStartX: number = 0;
    private miniplayerStartY: number = 0;
    private isDragging: boolean = false;
    private savedPosition: { x: number, y: number } | null = null;
    private miniplayerElement: HTMLElement | null = null;

    private fastAverageColor: FastAverageColor;
    private boundHandleAudioCanPlay: (e: Event) => void;
    private boundHandleResize: () => void;
    private boundHandleVideoPlay: (e: Event) => void;
    private boundHandleMouseDown: (e: MouseEvent) => void;
    private boundHandleMouseMove: (e: MouseEvent) => void;
    private boundHandleMouseUp: (e: MouseEvent) => void;

    constructor(config?: any) {
        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.fastAverageColor = new FastAverageColor();

        // Bind methods FIRST so they are available for event listeners
        this.boundHandleAudioCanPlay = this.handleAudioCanPlay.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundHandleVideoPlay = this.handleVideoPlay.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);

        this.element = ElementFromHtml(miniplayerHTML);
        this.initElements();
        this.setupEventListeners();

        document.addEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);

        // Bind and add resize listener
        window.addEventListener('resize', this.boundHandleResize);

        // Load saved position
        this.loadSavedPosition();

        // Load saved mode preference
        const savedMode = localStorage.getItem('pear-player-mode');
        if (savedMode && ['visualizer', 'video', 'thumbnail'].includes(savedMode)) {
            this.preferredMode = savedMode as 'visualizer' | 'video' | 'thumbnail';
        }

        // Load saved volume preference
        const savedVolume = localStorage.getItem('pear-player-volume');
        if (savedVolume) {
            this.savedVolume = parseFloat(savedVolume);
        }

        // Try to connect to existing audio context if available
        this.tryConnectExistingAudio();

        // Initial check
        this.checkWindowSize();

        // Setup crossfade video listener
        this.setupCrossfadeListener();

        // Setup video play listener for auto-open
        this.setupVideoPlayListener();

        // Start checking for video availability to restore preferred mode
        this.startVideoAvailabilityCheck();
    }

    private tryConnectExistingAudio() {
        // Try to get existing video element and connect to its audio
        const video = document.querySelector('video');
        if (!video) return;

        try {
            // Check if there's already an audio context
            const existingContext = (window as any).__pearAudioContext;
            const existingSource = (window as any).__pearAudioSource;

            if (existingContext && existingSource) {
                this.audioContext = existingContext;
                if (this.audioContext) {
                    this.analyser = this.audioContext.createAnalyser();
                    this.analyser.fftSize = 32;
                    existingSource.connect(this.analyser);

                    const bufferLength = this.analyser.frequencyBinCount;
                    this.dataArray = new Uint8Array(bufferLength);

                    // Initialize Background Visualizer with existing source
                    this.initBackgroundVisualizer(existingSource);

                    console.log('[Miniplayer] Connected to existing audio context');
                }
            }
        } catch (err) {
            console.error('[Miniplayer] Failed to connect to existing audio:', err);
        }
    }

    private handleAudioCanPlay(e: Event) {
        const event = e as CustomEvent;
        this.audioContext = event.detail.audioContext;
        const source = event.detail.audioSource;

        // Store globally so re-enabled plugin can access it
        (window as any).__pearAudioContext = this.audioContext;
        (window as any).__pearAudioSource = source;

        if (this.audioContext && source) {
            try {
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 32;
                source.connect(this.analyser);

                const bufferLength = this.analyser.frequencyBinCount;
                this.dataArray = new Uint8Array(bufferLength);

                // Initialize Background Visualizer
                this.initBackgroundVisualizer(source);
            } catch (err) {
                console.error('[Miniplayer] Failed to connect audio source:', err);
            }
        }
    }



    setConfig(config: any) {
        const oldBackgroundVisualizer = this.config.backgroundVisualizer;
        this.config = { ...this.config, ...config };

        // Handle visualizer switch
        if (this.config.backgroundVisualizer !== oldBackgroundVisualizer) {
            // Clear canvas first
            if (this.fullscreenVisualizerBgCanvas) {
                const ctx = this.fullscreenVisualizerBgCanvas.getContext('2d');
                ctx?.clearRect(0, 0, this.fullscreenVisualizerBgCanvas.width, this.fullscreenVisualizerBgCanvas.height);
            }

            // Cleanup previous visualizer
            this.cleanupVisualizers();

            // Re-init visualizer
            const source = (window as any).__pearAudioSource;
            if (source) {
                this.initBackgroundVisualizer(source);
            }
        }

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


    setPlayerApi(api: any) {
        this.playerApi = api;
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
        this.fullscreenQueueButton = this.element.querySelector('#pear-fullscreen-queue-btn');
        this.fullscreenQueuePanel = this.element.querySelector('#pear-fullscreen-queue-panel');
        this.fullscreenQueueContent = this.element.querySelector('#pear-fullscreen-queue-content');
        this.miniplayerElement = this.element.querySelector('#pear-miniplayer');

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
        this.fullscreenLikeButton = this.element.querySelector('#pear-fullscreen-like');
        this.fullscreenRepeatButton = this.element.querySelector('#pear-fullscreen-repeat');
        this.fullscreenSeekBar = this.element.querySelector('#pear-fullscreen-seek');
        this.fullscreenSeekProgress = this.element.querySelector('#pear-fullscreen-seek-progress');
        this.fullscreenThumbTop = this.element.querySelector('#pear-fullscreen-thumb-top');
        this.fullscreenThumbBottom = this.element.querySelector('#pear-fullscreen-thumb-bottom');
        this.fullscreenThumbnailElement = this.fullscreenThumbTop; // Use top as primary for compatibility
        this.fullscreenCanvas = this.element.querySelector('#pear-fullscreen-canvas');
        this.fullscreenVisualizerBgCanvas = this.element.querySelector('#pear-fullscreen-visualizer-bg');
        this.fullscreenCloseButton = this.element.querySelector('#pear-fullscreen-close');
        this.fullscreenVolumeButton = this.element.querySelector('#pear-fullscreen-volume-btn');
        this.fullscreenVolumeSlider = this.element.querySelector('#pear-fullscreen-volume-slider');
        this.fullscreenVolumeValue = this.element.querySelector('#pear-fullscreen-volume-value');

        // Sleep timer elements
        this.sleepTimerModal = this.element.querySelector('#pear-sleep-timer-modal');
        this.sleepTimerButton = this.element.querySelector('#pear-fullscreen-sleep-btn');
        this.sleepTimerBadge = this.element.querySelector('#pear-sleep-timer-badge');
        this.sleepTimerStartBtn = this.element.querySelector('#pear-sleep-timer-start');
        this.sleepTimerCancelBtn = this.element.querySelector('#pear-sleep-timer-cancel');
        this.sleepTimerCloseBtn = this.element.querySelector('#pear-sleep-timer-close');
        this.sleepTimerCustomInput = this.element.querySelector('#pear-sleep-timer-custom-input');
        this.sleepTimerWaitCheckbox = this.element.querySelector('#pear-sleep-timer-wait-end');

        // Seek bar preview elements
        this.miniplayerSeekPreview = this.element.querySelector('#pear-miniplayer-seek-preview');
        this.fullscreenSeekPreview = this.element.querySelector('#pear-fullscreen-seek-preview');
    }

    /**
     * Helper method to setup button event handlers that work with both mouse and touch/stylus input.
     * This ensures buttons respond properly to touch events on tablets and stylus input.
     */
    private setupButtonHandler(button: HTMLElement | null, handler: () => void) {
        if (!button) return;

        let lastExecutionTime = 0;
        const debounceDelay = 300; // Prevent duplicate calls within 300ms

        const debouncedHandler = () => {
            const now = Date.now();
            if (now - lastExecutionTime > debounceDelay) {
                lastExecutionTime = now;
                handler();
            }
        };

        // Handle touch events (for touch screens and stylus)
        button.addEventListener('touchend', () => {
            debouncedHandler();
        }, { passive: true });

        // Handle mouse clicks (for desktop)
        button.addEventListener('click', () => {
            debouncedHandler();
        });
    }

    private setupEventListeners() {
        // Miniplayer controls with touch/stylus support
        this.setupButtonHandler(this.playButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                const video = document.querySelector('video');
                if (video?.paused) {
                    this.playerApi.playVideo();
                } else {
                    this.playerApi.pauseVideo();
                }
            } else {
                const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
                playPauseButton?.click();
            }
        });

        this.setupButtonHandler(this.fullscreenQueueButton, () => {
            this.toggleQueue();
        });

        this.setupButtonHandler(this.prevButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                this.playerApi.previousVideo();
            } else {
                const prevButton = document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar');
                prevButton?.click();
            }
        });

        this.setupButtonHandler(this.nextButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                this.playerApi.nextVideo();
            } else {
                const nextButton = document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar');
                nextButton?.click();
            }
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
        const clickableArea = this.element.querySelector('#pear-miniplayer-clickable');
        clickableArea?.addEventListener('mousedown', (e) => this.boundHandleMouseDown(e as MouseEvent));
        clickableArea?.addEventListener('click', (e) => {
            console.log('[Miniplayer] Click detected on:', e.target);

            // Don't open if we just finished dragging
            if (this.miniplayerElement?.classList.contains('just-dragged')) {
                console.log('[Miniplayer] Click ignored - just dragged');
                e.preventDefault();
                e.stopPropagation();
                return;
            }

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

        // Fullscreen player event listeners with touch/stylus support
        this.setupButtonHandler(this.fullscreenPlayButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                const video = document.querySelector('video');
                if (video?.paused) {
                    this.playerApi.playVideo();
                } else {
                    this.playerApi.pauseVideo();
                }
            } else {
                const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
                playPauseButton?.click();
            }
        });

        this.setupButtonHandler(this.fullscreenPrevButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                this.playerApi.previousVideo();
            } else {
                const prevButton = document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar');
                prevButton?.click();
            }
        });

        this.setupButtonHandler(this.fullscreenNextButton, () => {
            // Use playerApi if available, otherwise fall back to DOM click
            if (this.playerApi) {
                this.playerApi.nextVideo();
            } else {
                const nextButton = document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar');
                nextButton?.click();
            }
        });

        this.setupButtonHandler(this.fullscreenLikeButton, () => {
            // Try multiple selectors to find the like button
            const likeButton = document.querySelector<HTMLElement>('#button-shape-like button') ||
                document.querySelector<HTMLElement>('yt-button-shape.like button') ||
                document.querySelector<HTMLElement>('ytmusic-like-button-renderer button');

            if (likeButton) {
                // Dispatch a proper click event that works with touch
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                likeButton.dispatchEvent(clickEvent);

                // Update our button state after a short delay
                setTimeout(() => this.updateLikeButtonState(), 100);
            }
        });

        // Initial sync and periodic updates for like button state
        this.updateLikeButtonState();
        setInterval(() => this.updateLikeButtonState(), 1000); // Check every second

        this.setupButtonHandler(this.fullscreenRepeatButton, () => {
            // Try multiple selectors to find the repeat button
            const repeatButton = document.querySelector<HTMLElement>('yt-icon-button.repeat button') ||
                document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar button') ||
                document.querySelector<HTMLElement>('ytmusic-player-bar tp-yt-paper-icon-button.repeat');

            if (repeatButton) {
                // Dispatch a proper click event that works with touch
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                repeatButton.dispatchEvent(clickEvent);

                // Update our button state after a short delay
                setTimeout(() => this.updateRepeatButtonState(), 100);
            }
        });

        // Initial sync and periodic updates for repeat button state
        this.updateRepeatButtonState();
        setInterval(() => this.updateRepeatButtonState(), 1000); // Check every second

        this.fullscreenSeekBar?.addEventListener('click', (e) => {
            const rect = this.fullscreenSeekBar!.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const video = document.querySelector('video');
            if (video && video.duration) {
                video.currentTime = percent * video.duration;
            }
        });

        this.setupButtonHandler(this.fullscreenCloseButton, () => {
            this.closeFullscreen();
        });

        this.setupButtonHandler(this.fullscreenVolumeButton, () => {
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
                const volumeLevel = value / 100;
                video.volume = volumeLevel;
                video.muted = false;
                this.savedVolume = volumeLevel; // Save the volume preference
                localStorage.setItem('pear-player-volume', String(volumeLevel)); // Persist to localStorage
                this.updateVolumeIcon();
                this.updateVolumeValue();
            }
        });

        // Listen for video element changes to reapply volume when songs change
        const observer = new MutationObserver(() => {
            const video = document.querySelector('video');
            if (video && Math.abs(video.volume - this.savedVolume) > 0.01) {
                // Only update if the volume has changed significantly (song change reset it)
                video.volume = this.savedVolume;
                if (this.fullscreenVolumeSlider) {
                    this.fullscreenVolumeSlider.value = String(Math.round(this.savedVolume * 100));
                }
                this.updateVolumeValue();
            }
        });

        // Observe the video element for attribute changes
        const videoObserver = setInterval(() => {
            const video = document.querySelector('video');
            if (video) {
                observer.observe(video, { attributes: true, attributeFilter: ['src'] });
                // Also listen for the 'loadedmetadata' event which fires when a new song loads
                video.addEventListener('loadedmetadata', () => {
                    video.volume = this.savedVolume;
                    if (this.fullscreenVolumeSlider) {
                        this.fullscreenVolumeSlider.value = String(Math.round(this.savedVolume * 100));
                    }
                    this.updateVolumeValue();
                });
                clearInterval(videoObserver);
            }
        }, 100);

        if (this.fullscreenThumbnailElement) {
            this.fullscreenThumbnailElement.addEventListener('click', () => {
                if (!this.config.clickToSwitch) return;
                this.cycleMode();
            });
        }

        this.setupButtonHandler(this.fullscreenLyricsButton, () => {
            this.toggleLyrics();
        });

        // ===== Seek Bar Preview Event Listeners =====
        // Miniplayer seek bar hover for preview
        this.seekBar?.addEventListener('mousemove', (e) => {
            this.updateSeekPreview(e, this.seekBar!, this.miniplayerSeekPreview!);
        });
        this.seekBar?.addEventListener('mouseleave', () => {
            if (this.miniplayerSeekPreview) {
                this.miniplayerSeekPreview.style.opacity = '0';
            }
        });

        // Fullscreen seek bar hover for preview
        this.fullscreenSeekBar?.addEventListener('mousemove', (e) => {
            this.updateSeekPreview(e, this.fullscreenSeekBar!, this.fullscreenSeekPreview!);
        });
        this.fullscreenSeekBar?.addEventListener('mouseleave', () => {
            if (this.fullscreenSeekPreview) {
                this.fullscreenSeekPreview.style.opacity = '0';
            }
        });

        // ===== Sleep Timer Event Listeners =====
        this.setupButtonHandler(this.sleepTimerButton, () => {
            this.openSleepTimerModal();
        });

        this.setupButtonHandler(this.sleepTimerStartBtn, () => {
            this.startSleepTimer();
        });

        this.setupButtonHandler(this.sleepTimerCancelBtn, () => {
            this.cancelSleepTimer();
        });

        this.setupButtonHandler(this.sleepTimerCloseBtn, () => {
            this.closeSleepTimerModal();
        });

        // Sleep timer option buttons
        const sleepOptions = this.element.querySelectorAll('.pear-sleep-timer-option');
        sleepOptions.forEach((option) => {
            option.addEventListener('click', () => {
                // Remove selected from all
                sleepOptions.forEach(opt => opt.classList.remove('selected'));
                // Add selected to clicked
                option.classList.add('selected');
                // Update selected minutes
                const minutes = parseInt(option.getAttribute('data-minutes') || '30');
                this.selectedSleepMinutes = minutes;
                // Clear custom input
                if (this.sleepTimerCustomInput) {
                    this.sleepTimerCustomInput.value = '';
                }
            });
        });

        // Custom input override
        this.sleepTimerCustomInput?.addEventListener('input', () => {
            // Deselect preset options when typing custom
            sleepOptions.forEach(opt => opt.classList.remove('selected'));
            const value = parseInt(this.sleepTimerCustomInput?.value || '0');
            if (value > 0) {
                this.selectedSleepMinutes = value;
            }
        });

        // Close modal when clicking outside
        this.sleepTimerModal?.addEventListener('click', (e) => {
            if (e.target === this.sleepTimerModal) {
                this.closeSleepTimerModal();
            }
        });
    }

    private handleResize() {
        this.updateLyricsButtonVisibility();
        this.updateFullscreenVisibility();
        this.checkWindowSize();
    }

    private handleMouseDown(e: MouseEvent) {
        // Only allow dragging on screens > 450px and if enabled
        if (window.innerWidth <= 450 || !this.config.draggableEnabled) return;

        // Don't drag if clicking on controls or thumbnail
        const target = e.target as HTMLElement;
        if (target.closest('.pear-miniplayer-controls') ||
            target.closest('#pear-miniplayer-thumb')) {
            return;
        }

        // Store initial position but don't set isDragging yet
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        if (this.miniplayerElement) {
            const rect = this.miniplayerElement.getBoundingClientRect();
            this.miniplayerStartX = rect.left;
            this.miniplayerStartY = rect.top;
        }

        document.addEventListener('mousemove', this.boundHandleMouseMove);
        document.addEventListener('mouseup', this.boundHandleMouseUp);

        // Prevent default to stop text selection
        e.preventDefault();
        e.stopPropagation();
    }

    private handleMouseMove(e: MouseEvent) {
        if (!this.miniplayerElement) return;

        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        // Only start dragging if moved more than 5 pixels (drag threshold)
        const dragThreshold = 5;
        const hasMoved = Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold;

        if (!this.isDragging && hasMoved) {
            // User has moved enough to be considered dragging
            this.isDragging = true;
            this.miniplayerElement.style.userSelect = 'none';
            this.miniplayerElement.classList.add('dragging');
        }

        if (!this.isDragging) return;

        // Snap logic
        const elementWidth = this.miniplayerElement.offsetWidth;
        const elementHeight = this.miniplayerElement.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Calculate center-bottom position (default)
        const centerX = (windowWidth - elementWidth) / 2;
        const bottomY = windowHeight - elementHeight;

        const snapThreshold = 50; // 50px snap zone

        let finalX = this.miniplayerStartX + deltaX;
        let finalY = this.miniplayerStartY + deltaY;

        // Check if within snap zone
        if (Math.abs(finalX - centerX) < snapThreshold && Math.abs(finalY - bottomY) < snapThreshold) {
            finalX = centerX;
            finalY = bottomY;
            this.miniplayerElement.classList.add('snapped');
        } else {
            this.miniplayerElement.classList.remove('snapped');
        }

        // Convert to percentages for responsive positioning
        const percentX = (finalX / windowWidth) * 100;
        const percentY = (finalY / windowHeight) * 100;

        // Constrain to window bounds
        const maxX = 100 - (elementWidth / windowWidth) * 100;
        const maxY = 100 - (elementHeight / windowHeight) * 100;

        const constrainedX = Math.max(0, Math.min(percentX, maxX));
        const constrainedY = Math.max(0, Math.min(percentY, maxY));

        this.miniplayerElement.style.setProperty('left', `${constrainedX}%`, 'important');
        this.miniplayerElement.style.setProperty('top', `${constrainedY}%`, 'important');
        this.miniplayerElement.style.setProperty('bottom', 'auto', 'important');
        this.miniplayerElement.style.setProperty('transform', 'none', 'important');
    }

    private handleMouseUp() {
        const wasDragging = this.isDragging;

        this.isDragging = false;
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);

        if (this.miniplayerElement) {
            this.miniplayerElement.classList.remove('dragging');
            // Restore text selection
            this.miniplayerElement.style.userSelect = '';

            if (wasDragging) {
                // Check if we dropped in the snap zone
                if (this.miniplayerElement.classList.contains('snapped')) {
                    this.resetPosition();
                    this.savedPosition = null;
                    localStorage.removeItem('pear-miniplayer-position');
                    this.miniplayerElement.classList.remove('snapped');
                } else {
                    this.savePosition();
                }

                // User was dragging, save position and prevent click
                this.miniplayerElement.classList.add('just-dragged');
                // Use longer timeout (500ms) to ensure click event is blocked
                setTimeout(() => {
                    this.miniplayerElement?.classList.remove('just-dragged');
                }, 500);
            }
        }
    }

    private savePosition() {
        if (!this.miniplayerElement || window.innerWidth <= 450) return;

        const rect = this.miniplayerElement.getBoundingClientRect();
        const percentX = (rect.left / window.innerWidth) * 100;
        const percentY = (rect.top / window.innerHeight) * 100;

        this.savedPosition = { x: percentX, y: percentY };

        try {
            localStorage.setItem('pear-miniplayer-position', JSON.stringify(this.savedPosition));
        } catch (e) {
            console.error('[Miniplayer] Failed to save position:', e);
        }
    }

    private loadSavedPosition() {
        if (window.innerWidth <= 450) return;

        try {
            const saved = localStorage.getItem('pear-miniplayer-position');
            if (saved) {
                this.savedPosition = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[Miniplayer] Failed to load position:', e);
        }
    }

    private applyPosition() {
        if (!this.miniplayerElement || window.innerWidth <= 450 || !this.savedPosition) return;

        // Recalculate constraints based on current window size
        const elementWidth = this.miniplayerElement.offsetWidth || 475; // Fallback width
        const elementHeight = this.miniplayerElement.offsetHeight || 70; // Fallback height

        const maxX = 100 - (elementWidth / window.innerWidth) * 100;
        const maxY = 100 - (elementHeight / window.innerHeight) * 100;

        // Constrain the saved position
        const constrainedX = Math.max(0, Math.min(this.savedPosition.x, maxX));
        const constrainedY = Math.max(0, Math.min(this.savedPosition.y, maxY));

        this.miniplayerElement.style.setProperty('left', `${constrainedX}%`, 'important');
        this.miniplayerElement.style.setProperty('top', `${constrainedY}%`, 'important');
        this.miniplayerElement.style.setProperty('bottom', 'auto', 'important');
        this.miniplayerElement.style.setProperty('transform', 'none', 'important');
        this.miniplayerElement.classList.add('dragging');
    }

    private resetPosition() {
        if (!this.miniplayerElement) return;

        this.miniplayerElement.style.removeProperty('left');
        this.miniplayerElement.style.removeProperty('top');
        this.miniplayerElement.style.removeProperty('bottom');
        this.miniplayerElement.style.removeProperty('transform');
        this.miniplayerElement.classList.remove('dragging');
    }

    private cycleMode() {
        const modes: ('visualizer' | 'video' | 'thumbnail')[] = ['thumbnail'];
        if (this.config.videoEnabled) modes.unshift('video');
        if (this.config.visualizerEnabled) modes.unshift('visualizer');

        const currentIndex = modes.indexOf(this.preferredMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const oldMode = this.preferredMode;
        this.preferredMode = modes[nextIndex];

        // Save the new mode preference
        localStorage.setItem('pear-player-mode', this.preferredMode);

        console.log(`[Miniplayer] Mode cycled from ${oldMode} to ${this.preferredMode}.Available modes: `, modes);
    }

    private checkWindowSize() {
        const shouldBeActive = window.innerWidth <= 2160;

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
        if (window.innerWidth > 450 && this.config.draggableEnabled) {
            this.applyPosition();
        } else {
            this.resetPosition();
        }

        this.updateSize();
    }

    private toggleQueue() {
        if (!this.fullscreenQueuePanel || !this.fullscreenPlayer) return;

        this.isQueueOpen = !this.isQueueOpen;

        if (this.isQueueOpen) {
            // ADD THIS BLOCK:
            // If window is too small for both, close lyrics
            if (window.innerWidth < 1200 && this.isLyricsOpen) {
                this.toggleLyrics();
            }
            // END ADDITION

            this.fullscreenQueuePanel.classList.add('active');
            this.fullscreenPlayer.classList.add('queue-open');
            this.fullscreenQueueButton?.classList.add('active');
            this.renderQueue();
        } else {
            this.fullscreenQueuePanel.classList.remove('active');
            this.fullscreenPlayer.classList.remove('queue-open');
            this.fullscreenQueueButton?.classList.remove('active');
        }
    }

    private renderQueue() {
        if (!this.fullscreenQueueContent) return;
        this.fullscreenQueueContent.innerHTML = '';

        const queueItems = document.querySelectorAll('ytmusic-player-queue-item');
        queueItems.forEach((item, index) => {
            const title = item.querySelector('.song-title')?.textContent?.trim() || 'Unknown';
            const artist = item.querySelector('.byline')?.textContent?.trim() || 'Unknown';
            const duration = item.querySelector('.duration')?.textContent?.trim() || '';
            const thumbImg = item.querySelector('img')?.src || '';
            const isPlaying = item.hasAttribute('selected');

            const div = document.createElement('div');
            div.className = `pear-queue-item ${isPlaying ? 'playing' : ''}`;

            div.innerHTML = `
                <img src="${thumbImg}" class="pear-queue-item-thumb" />
                <div class="pear-queue-item-info">
                    <div class="pear-queue-item-title">${title}</div>
                    <div class="pear-queue-item-artist">${artist}</div>
                </div>
                <div class="pear-queue-item-duration">${duration}</div>
            `;

            div.addEventListener('click', () => {
                const currentQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
                const currentItem = currentQueueItems[index] as HTMLElement;

                if (!currentItem) return;

                if (this.playerApi) {
                    const currentIndex = Array.from(currentQueueItems).findIndex(i => i.hasAttribute('selected'));
                    if (currentIndex !== -1) {
                        const relativeIndex = index - currentIndex;
                        if (relativeIndex === 0) {
                            this.playerApi.seekTo(0);
                            this.playerApi.playVideo();
                            return;
                        }
                        if (relativeIndex > 0) {
                            for (let i = 0; i < relativeIndex; i++) {
                                this.playerApi.nextVideo();
                            }
                            return;
                        }
                        if (relativeIndex < 0) {
                            for (let i = 0; i < Math.abs(relativeIndex); i++) {
                                this.playerApi.previousVideo();
                            }
                            return;
                        }
                    }
                }

                const playButton = currentItem.querySelector<HTMLElement>('ytmusic-play-button-renderer button');
                if (playButton) {
                    playButton.click();
                    return;
                }

                const clickTargets = [
                    '.song-title',
                    'ytmusic-thumbnail-renderer',
                    '.duration'
                ];

                let clicked = false;
                for (const selector of clickTargets) {
                    const target = currentItem.querySelector<HTMLElement>(selector);
                    if (target) {
                        target.click();
                        clicked = true;
                        break;
                    }
                }

                if (!clicked) {
                    currentItem.click();
                    const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
                    currentItem.dispatchEvent(evt);
                }
            });

            this.fullscreenQueueContent!.appendChild(div);
        });
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
        let modeToShow = this.preferredMode;

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

        if (modeToShow === 'visualizer' && this.analyser) {
            if (this.config.visualizerStyle === 'wave') {
                this.drawWaveVisualizer();
                if (this.isFullscreenOpen) {
                    this.drawWaveVisualizerFullscreen();
                    this.renderButterchurn();
                }
            } else {
                this.drawSelfVisualizer();
                if (this.isFullscreenOpen) {
                    this.drawSelfVisualizerFullscreen();
                    this.renderBackgroundVisualizer();
                }
            }
        } else if (modeToShow === 'video' && video) {
            this.drawToCanvas(video);
            if (this.isFullscreenOpen) {
                this.drawToCanvasFullscreen(video);
                // Still render butterchurn if audio is available, for background ambiance
                if (this.analyser) this.renderBackgroundVisualizer();
            }
        } else {
            this.clearCanvas();
            if (this.isFullscreenOpen) {
                this.clearCanvasFullscreen();
                if (this.analyser) this.renderBackgroundVisualizer();
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

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        const barWidth = (width / this.dataArray.length);
        let barHeight;
        let x = 0;

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

    private drawToCanvas(source: CanvasImageSource) {
        if (!this.canvas || !this.thumbnailElement) return;

        this.canvas.style.display = 'block';
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
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
        const container = this.fullscreenThumbnailElement.parentElement;
        if (container) {
            container.classList.remove('video-mode');
            if (this.config.widescreenMode) {
                container.classList.add('visualizer-mode');
            } else {
                container.classList.remove('visualizer-mode');
            }
        }

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
        const container = this.fullscreenThumbnailElement.parentElement;
        if (container) {
            container.classList.remove('video-mode');
            if (this.config.widescreenMode) {
                container.classList.add('visualizer-mode');
            } else {
                container.classList.remove('visualizer-mode');
            }
        }

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
            const container = this.fullscreenThumbnailElement.parentElement;
            if (container) {
                if (this.config.widescreenMode) {
                    container.classList.add('video-mode');
                } else {
                    container.classList.remove('video-mode');
                }
                container.classList.remove('visualizer-mode');
            }

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
            const container = this.fullscreenCanvas.parentElement?.parentElement;
            if (container) {
                container.classList.remove('video-mode');
                container.classList.remove('visualizer-mode');
                if (this.config.widescreenMode) {
                    container.classList.add('thumbnail-mode');
                } else {
                    container.classList.remove('thumbnail-mode');
                }
            }
        }
    }

    // Dispatch background visualizer
    private renderBackgroundVisualizer() {
        if (!this.config.backgroundVisualizer || this.config.backgroundVisualizer === 'none') return;

        if (this.config.backgroundVisualizer === 'butterchurn') {
            this.renderButterchurn();
        } else if (this.config.backgroundVisualizer === 'sphere') {
            this.renderSphereVisualizer();
        }
    }

    // Draw Butterchurn visualizer
    private renderButterchurn() {
        if (this.config.backgroundVisualizer !== 'butterchurn' || !this.butterchurnVisualizer || !this.fullscreenVisualizerBgCanvas) return;

        // Ensure canvas size is correct
        const width = this.fullscreenVisualizerBgCanvas.clientWidth || 800;
        const height = this.fullscreenVisualizerBgCanvas.clientHeight || 800;

        if (this.fullscreenVisualizerBgCanvas.width !== width || this.fullscreenVisualizerBgCanvas.height !== height) {
            this.fullscreenVisualizerBgCanvas.width = width;
            this.fullscreenVisualizerBgCanvas.height = height;
            this.butterchurnVisualizer.setRendererSize(width, height);
        }

        this.butterchurnVisualizer.render();
    }

    private initBackgroundVisualizer(source: any) {
        if (!this.config.backgroundVisualizer || this.config.backgroundVisualizer === 'none') return;

        if (this.config.backgroundVisualizer === 'butterchurn') {
            this.initButterchurnWithSource(source);
        } else if (this.config.backgroundVisualizer === 'sphere') {
            this.initSphereVisualizer();
        }
    }

    private initButterchurnWithSource(source: any) {
        if (this.config.backgroundVisualizer !== 'butterchurn' || !this.audioContext || !this.fullscreenVisualizerBgCanvas) return;

        // Prevent double init
        if (this.butterchurnVisualizer) return;

        // Apply filters directly to canvas - REVERTED, using overlay
        if (this.fullscreenVisualizerBgCanvas) {
            this.fullscreenVisualizerBgCanvas.style.opacity = '1';
            this.fullscreenVisualizerBgCanvas.style.filter = 'none';
            this.fullscreenVisualizerBgCanvas.style.transform = 'none';
        }

        try {
            this.butterchurnVisualizer = Butterchurn.createVisualizer(this.audioContext, this.fullscreenVisualizerBgCanvas, {
                width: this.fullscreenVisualizerBgCanvas.width,
                height: this.fullscreenVisualizerBgCanvas.height,
                pixelRatio: window.devicePixelRatio || 1,
                textureRatio: 1,
            } as any);

            this.butterchurnVisualizer.connectAudio(source);

            // Load a preset
            const presets = ButterchurnPresets;
            const presetKeys = Object.keys(presets);
            if (presetKeys.length > 0) {
                // Pick a random start preset
                const randomPreset = presetKeys[Math.floor(Math.random() * presetKeys.length)];
                this.butterchurnVisualizer.loadPreset(presets[randomPreset], 0);

                // Cycle presets every 15 seconds
                if (this.visualizerPresetCycleInterval) clearInterval(this.visualizerPresetCycleInterval);
                this.visualizerPresetCycleInterval = window.setInterval(() => {
                    const nextPreset = presetKeys[Math.floor(Math.random() * presetKeys.length)];
                    this.butterchurnVisualizer?.loadPreset(presets[nextPreset], 2.0); // 2s blend
                }, 15000); // 15 seconds
            }

            console.log('[Miniplayer] Butterchurn initialized');
        } catch (e) {
            console.error('[Miniplayer] Failed to initialize Butterchurn:', e);
        }
    }

    private cleanupVisualizers() {
        // Cleanup Butterchurn
        if (this.butterchurnVisualizer) {
            // There isn't a destroy method in butterchurn docs easily accessible, but we can stop rendering loops
            // and set to null. 
            // Ideally calling connectAudio(null) if supported or just dropping reference.
            this.butterchurnVisualizer = null;
        }

        if (this.visualizerPresetCycleInterval) {
            clearInterval(this.visualizerPresetCycleInterval);
            this.visualizerPresetCycleInterval = null;
        }

        // Reset overlay
        // if (this.visualizerOverlay) ... removed
    }

    private initSphereVisualizer() {
        // Apply filters to sphere as well - REVERTED, using overlay
        if (this.fullscreenVisualizerBgCanvas) {
            this.fullscreenVisualizerBgCanvas.style.opacity = '1';
            this.fullscreenVisualizerBgCanvas.style.filter = 'none';
            this.fullscreenVisualizerBgCanvas.style.transform = 'none';
        }

        // Generate points on a sphere
        this.spherePoints = [];
        const numPoints = 800; // Dotted
        for (let i = 0; i < numPoints; i++) {
            const theta = Math.acos(-1 + (2 * i) / numPoints);
            const phi = Math.sqrt(numPoints * Math.PI) * theta;
            this.spherePoints.push({
                x: Math.cos(phi) * Math.sin(theta),
                y: Math.sin(phi) * Math.sin(theta),
                z: Math.cos(theta)
            });
        }
    }

    private renderSphereVisualizer() {
        if (!this.fullscreenVisualizerBgCanvas || !this.analyser || !this.dataArray) return;
        const ctx = this.fullscreenVisualizerBgCanvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas size
        const width = this.fullscreenVisualizerBgCanvas.clientWidth || 800;
        const height = this.fullscreenVisualizerBgCanvas.clientHeight || 800;
        if (this.fullscreenVisualizerBgCanvas.width !== width || this.fullscreenVisualizerBgCanvas.height !== height) {
            this.fullscreenVisualizerBgCanvas.width = width;
            this.fullscreenVisualizerBgCanvas.height = height;
        }

        // Get audio data for "expanding" effect
        // Get audio data for "expanding" effect
        let scale = 1;
        if (this.dataArray) {
            this.analyser.getByteFrequencyData(this.dataArray as any);
            // Calculate bass energy (low frequencies)
            let bass = 0;
            for (let i = 0; i < 10; i++) {
                bass += this.dataArray[i];
            }
            bass = bass / 10;
            scale = 1 + (bass / 255) * 0.5; // Scale from 1.0 to 1.5
        }

        ctx.clearRect(0, 0, width, height);

        // Save context state because we modify filter externally for color, 
        // but drawing logic assumes standard composite operations usually.
        // The external filter (sepia/hue-rotate) applies to the canvas element, not the context drawing directly.

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // White dots, colorized by CSS filter

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 1 * scale;

        // Calculate dynamic rotation speed based on bass
        // Base speed = 0.002, Max added speed = 0.02
        let rotationSpeed = 0.002;
        if (this.dataArray) {
            let bass = 0;
            for (let i = 0; i < 10; i++) {
                bass += this.dataArray[i];
            }
            bass = bass / 10;
            rotationSpeed += (bass / 255) * 0.012;
        }

        this.sphereRotation += rotationSpeed;

        this.spherePoints.forEach(p => {
            // Rotate Y
            const x1 = p.x * Math.cos(this.sphereRotation) - p.z * Math.sin(this.sphereRotation);
            const z1 = p.z * Math.cos(this.sphereRotation) + p.x * Math.sin(this.sphereRotation);
            const y1 = p.y;

            // Rotate X (tilted)
            const tilt = 0.5;
            const y2 = y1 * Math.cos(tilt) - z1 * Math.sin(tilt);
            const z2 = z1 * Math.cos(tilt) + y1 * Math.sin(tilt);
            const x2 = x1;

            // Project 3D to 2D
            // Simple perspective projection
            const zOffset = 2;
            const perspective = 1 / (zOffset + z2);

            const x2d = centerX + x2 * radius * perspective;
            const y2d = centerY + y2 * radius * perspective;

            // Draw dot
            // Size depends on Z (closer = bigger)
            const size = Math.max(2, 5 * perspective);

            ctx.beginPath();
            ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    private async extractAndApplyColor(imageUrl: string) {
        if (!imageUrl || !this.fullscreenVisualizerBgCanvas) return;

        try {
            const color = await this.fastAverageColor.getColorAsync(imageUrl);
            if (color) {
                const c = Color(color.hex);

                // Get a vibrant/light version for text/accent
                // Ensure it's not too dark for the black background
                let accent = c.lighten(0.3).saturate(0.5);
                if (accent.isDark()) {
                    accent = accent.lighten(0.5);
                }
                const accentHex = accent.hex();

                // Apply to fullscreen player CSS variable
                if (this.fullscreenPlayer) {
                    this.fullscreenPlayer.style.setProperty('--pear-fullscreen-accent', accentHex);
                    // Also consistent track color for specific elements if needed
                }

                // Calculate hue rotation relative to sepia(1) which is approx hue 50
                // We want to shift from ~50deg to the target hue
                const hue = c.hue();
                const rotate = hue - 40; // 40-50 is sepia base

                // Apply filter to visualizer (if using canvas filter approach)
                // But currently we use CSS filter on canvas directly in init loop
                // We can update the canvas filter here dynamically if we really want strict color matching?
                // The current hardcoded filter in initSphereVisualizer is 'blur(5px) brightness(0.6)'
                // The previous code had sepia/hue-rotate logic here.
                // If we want the Sphere/Butterchurn to be TINTED by the song color, we should keep the hue-rotate logic
                // But apply it alongside the blur.

                // Construct the filter string with dynamic color + static blur/brightness
                // The user asked for "darker image color" for text.
                // Text is handled by --pear-fullscreen-accent.

                // For the visualizer itself, do we want to tint it?
                // The current code in initSphereVisualizer sets: 
                // filter: 'blur(5px) brightness(0.6)'
                // That overrides any sepia/hue-rotate set here.
                // To support both, we should update the filter here to include the color shift

                // For Sphere (white dots), tinting helps.
                // For Butterchurn (colorful), tinting might be weird but okay.
                // Let's adding sepia/hue-rotate BEFORE blur/brightness

                this.fullscreenVisualizerBgCanvas.style.filter = `blur(5px) brightness(0.6) sepia(1) hue-rotate(${rotate}deg) saturate(3)`;
                this.fullscreenVisualizerBgCanvas.style.mixBlendMode = 'screen';
            }
        } catch (e) {
            console.error('[Miniplayer] Failed to extract color:', e);
            // Fallback
            if (this.fullscreenPlayer) {
                this.fullscreenPlayer.style.setProperty('--pear-fullscreen-accent', '#1e90ff');
            }
            if (this.fullscreenVisualizerBgCanvas) {
                this.fullscreenVisualizerBgCanvas.style.filter = 'blur(5px) brightness(0.6)';
                this.fullscreenVisualizerBgCanvas.style.mixBlendMode = 'normal';
            }
        }
    }


    private openFullscreen() {
        console.log('[Miniplayer] openFullscreen called, fullscreenPlayer:', this.fullscreenPlayer);
        if (!this.fullscreenPlayer) {
            console.error('[Miniplayer] fullscreenPlayer element not found!');
            return;
        }
        if (window.innerWidth > 450 && this.miniplayerElement && this.config.draggableEnabled) {
            this.savePosition();
        }
        this.isFullscreenOpen = true;
        this.fullscreenPlayer.classList.add('active');
        console.log('[Miniplayer] Added active class to fullscreen player');

        // Set blurred background image and extract colors
        const thumbnailSrc = this.getThumbnailSrc();
        if (thumbnailSrc && this.fullscreenPlayer) {
            // Set CSS variable for the background
            this.fullscreenPlayer.style.setProperty('--bg-image', `url("${thumbnailSrc}")`);

            // Extract and apply color
            this.extractAndApplyColor(thumbnailSrc);
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
        if (window.innerWidth > 450 && this.config.draggableEnabled) {
            setTimeout(() => this.applyPosition(), 100);
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
                    this.fullscreenPlayer?.style.setProperty('--bg-image', `url("${thumbnailCandidate}")`);
                    this.extractAndApplyColor(thumbnailCandidate);
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
            this.updateVolumeValue();
        } catch (error) {
            console.error('[Miniplayer] Error updating fullscreen state:', error);
        }
    }

    private updateVolumeValue() {
        if (!this.fullscreenVolumeValue) return;
        const video = document.querySelector('video');
        if (!video) return;

        const volumePercent = Math.round(video.volume * 100);
        this.fullscreenVolumeValue.textContent = `${volumePercent}%`;
    }

    private updateVolumeIcon() {
        const video = document.querySelector('video');
        if (!video) return;

        const isMuted = video.muted || video.volume === 0;

        // Toggle volume wave paths
        const volumeHigh1 = document.getElementById('volume-high-1');
        const volumeHigh2 = document.getElementById('volume-high-2');
        const volumeMute = document.getElementById('volume-mute');
        const volumeMute2 = document.getElementById('volume-mute-2');

        if (isMuted) {
            // Show mute X, hide volume waves
            if (volumeHigh1) volumeHigh1.style.display = 'none';
            if (volumeHigh2) volumeHigh2.style.display = 'none';
            if (volumeMute) volumeMute.style.display = 'block';
            if (volumeMute2) volumeMute2.style.display = 'block';
        } else {
            // Show volume waves, hide mute X
            if (volumeHigh1) volumeHigh1.style.display = 'block';
            if (volumeHigh2) volumeHigh2.style.display = 'block';
            if (volumeMute) volumeMute.style.display = 'none';
            if (volumeMute2) volumeMute2.style.display = 'none';
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
            // const newTitle = this.titleElement?.textContent;
            // if (oldTitle && newTitle && oldTitle !== newTitle && this.isLyricsOpen) {
            //     this.refreshLyricsOnSongChange();
            // }

            // Refresh queue if open and song changed
            const newTitle = this.titleElement?.textContent;
            if (oldTitle && newTitle && oldTitle !== newTitle && this.isQueueOpen) {
                this.renderQueue();
            }

            // Check for song change (for crossfade)
            this.checkForSongChange();

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

            // Handle null URL
            if (!url) {
                this.fullscreenThumbnailElement.style.backgroundImage = '';
                this.currentThumbnailUrl = null;
                if (this.fullscreenPlayer) {
                    this.fullscreenPlayer.style.setProperty('--bg-image', 'none');
                }
                return;
            }

            // Skip if same image
            if (url === this.currentThumbnailUrl) return;

            // Use dual-layer crossfade for smooth dissolve effect
            const topLayer = this.fullscreenThumbTop;
            const bottomLayer = this.fullscreenThumbBottom;

            if (!topLayer || !bottomLayer) {
                // Fallback to single element if layers not available
                if (this.fullscreenThumbnailElement) {
                    this.fullscreenThumbnailElement.style.backgroundImage = `url(${url})`;
                    this.fullscreenThumbnailElement.style.backgroundSize = 'cover';
                    this.fullscreenThumbnailElement.style.backgroundPosition = 'center';
                }
                this.currentThumbnailUrl = url;
                if (this.fullscreenPlayer) {
                    this.fullscreenPlayer.style.setProperty('--bg-image', `url("${url}")`);
                }
                return;
            }

            // Step 1: Set new image on bottom layer (it's behind top layer)
            bottomLayer.style.backgroundImage = `url(${url})`;
            bottomLayer.style.backgroundSize = 'cover';
            bottomLayer.style.backgroundPosition = 'center';

            // Step 2: Fade out top layer to reveal bottom layer (dissolve effect)
            topLayer.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)';
            topLayer.style.opacity = '0';

            // Step 3: After fade completes, swap layers
            setTimeout(() => {
                // Copy new image to top layer
                topLayer.style.backgroundImage = `url(${url})`;
                topLayer.style.backgroundSize = 'cover';
                topLayer.style.backgroundPosition = 'center';

                // Reset opacity (instantly, no transition)
                topLayer.style.transition = 'none';
                topLayer.style.opacity = '1';

                // Re-enable transitions for next crossfade
                setTimeout(() => {
                    topLayer.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)';
                }, 50);

                this.currentThumbnailUrl = url;

                // Update background blur
                if (this.fullscreenPlayer) {
                    this.fullscreenPlayer.style.setProperty('--bg-image', `url("${url}")`);
                }
            }, 1000);
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
                if (window.innerWidth < 1200 && this.isQueueOpen) {
                    this.toggleQueue();
                }
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
            const { unmountLyrics, mountLyrics } = await import('./lyrics-wrapper');

            // --- TEARDOWN (Mimic toggleLyrics else block) ---

            // Stop updating current lyric
            if (this.currentLyricUpdateInterval) {
                clearInterval(this.currentLyricUpdateInterval);
                this.currentLyricUpdateInterval = null;
            }

            unmountLyrics();

            this.fullscreenLyricsPanel?.classList.remove('active');
            this.fullscreenPlayer?.classList.remove('lyrics-open');
            this.fullscreenLyricsButton?.classList.remove('active');

            // Clear and hide compact lyrics box
            if (this.fullscreenCurrentLyricText) {
                this.fullscreenCurrentLyricText.innerHTML = '';
            }
            if (this.fullscreenCurrentLyric) {
                this.fullscreenCurrentLyric.classList.remove('visible');
            }
            this.currentLyricText = '';

            // --- RE-INIT (Mimic toggleLyrics if block) ---

            // Small delay to ensure clean unmount and visual reset
            setTimeout(() => {
                // Check if still open (user might have clicked button during delay)
                if (this.isLyricsOpen && this.fullscreenLyricsContent) {
                    mountLyrics(this.fullscreenLyricsContent);

                    this.fullscreenLyricsPanel?.classList.add('active');
                    this.fullscreenPlayer?.classList.add('lyrics-open');
                    this.fullscreenLyricsButton?.classList.add('active');

                    // Start updating current lyric for bottom mode
                    this.currentLyricUpdateInterval = window.setInterval(() => {
                        this.updateCurrentLyric();
                    }, 100);
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

    private updateLikeButtonState() {
        // Check YouTube Music's like button state
        const ytLikeButton = document.querySelector<HTMLElement>('#button-shape-like button') ||
            document.querySelector<HTMLElement>('yt-button-shape.like button') ||
            document.querySelector<HTMLElement>('ytmusic-like-button-renderer button');

        if (ytLikeButton && this.fullscreenLikeButton) {
            const isLiked = ytLikeButton.getAttribute('aria-pressed') === 'true';

            // Update our button's appearance
            if (isLiked) {
                this.fullscreenLikeButton.classList.add('active');
            } else {
                this.fullscreenLikeButton.classList.remove('active');
            }
        }
    }

    private updateRepeatButtonState() {
        // Check YouTube Music's repeat button state
        const ytRepeatButton = document.querySelector<HTMLElement>('yt-icon-button.repeat') ||
            document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar');

        if (ytRepeatButton && this.fullscreenRepeatButton) {
            // Check title or aria-label to determine repeat state
            const title = ytRepeatButton.getAttribute('title') || '';
            const label = ytRepeatButton.getAttribute('label') || '';
            const ariaLabel = ytRepeatButton.querySelector('button')?.getAttribute('aria-label') || '';

            const stateText = (title + label + ariaLabel).toLowerCase();

            // Repeat is active if it's not "repeat off"
            const isRepeatActive = !stateText.includes('repeat off');

            // Update our button's appearance
            if (isRepeatActive) {
                this.fullscreenRepeatButton.classList.add('active');
            } else {
                this.fullscreenRepeatButton.classList.remove('active');
            }
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
        } else {
            this.element.style.width = '500px';
            this.element.style.height = '80px';
            this.element.style.borderRadius = '25px';
            this.element.style.padding = '8px 12px';
        }
    }

    // ===== SEEK BAR PREVIEW METHODS =====
    private updateSeekPreview(e: MouseEvent, seekBar: HTMLElement, previewElement: HTMLElement) {
        if (!previewElement) return;

        const video = document.querySelector('video');
        if (!video || !video.duration) {
            previewElement.style.opacity = '0';
            return;
        }

        const rect = seekBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const previewTime = percent * video.duration;

        // Format time
        const minutes = Math.floor(previewTime / 60);
        const seconds = Math.floor(previewTime % 60);
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Update preview text
        previewElement.textContent = formattedTime;

        // Position the preview tooltip
        const previewWidth = previewElement.offsetWidth || 50;
        let leftPosition = e.clientX - rect.left;

        // Constrain to stay within the seek bar bounds
        leftPosition = Math.max(previewWidth / 2, Math.min(leftPosition, rect.width - previewWidth / 2));

        previewElement.style.left = `${leftPosition}px`;
        previewElement.style.opacity = '1';
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ===== SLEEP TIMER METHODS =====
    private openSleepTimerModal() {
        if (!this.sleepTimerModal) return;

        this.sleepTimerModal.classList.add('active');

        // Update UI based on whether timer is active
        if (this.sleepTimerId) {
            // Timer is running - show cancel option
            if (this.sleepTimerStartBtn) this.sleepTimerStartBtn.style.display = 'none';
            if (this.sleepTimerCancelBtn) this.sleepTimerCancelBtn.style.display = 'block';
        } else {
            // No timer running - show start option
            if (this.sleepTimerStartBtn) this.sleepTimerStartBtn.style.display = 'block';
            if (this.sleepTimerCancelBtn) this.sleepTimerCancelBtn.style.display = 'none';
        }
    }

    private closeSleepTimerModal() {
        if (!this.sleepTimerModal) return;
        this.sleepTimerModal.classList.remove('active');
    }

    private startSleepTimer() {
        // Cancel any existing timer
        this.cancelSleepTimer();

        const minutes = this.selectedSleepMinutes;
        if (minutes <= 0) return;

        // Get the checkbox state
        this.waitUntilSongEnds = this.sleepTimerWaitCheckbox?.checked ?? true;

        console.log(`[Miniplayer] Starting sleep timer for ${minutes} minutes (wait for song end: ${this.waitUntilSongEnds})`);

        // Calculate end time
        this.sleepTimerEndTime = Date.now() + (minutes * 60 * 1000);

        // Set the main timeout
        this.sleepTimerId = window.setTimeout(() => {
            if (this.waitUntilSongEnds) {
                // Wait for current song to end before pausing
                console.log('[Miniplayer] Timer expired - waiting for song to end');

                const video = document.querySelector('video');
                if (video) {
                    // Update badge to show we're waiting
                    if (this.sleepTimerBadge) {
                        this.sleepTimerBadge.textContent = '♪';
                    }

                    // Stop the countdown interval
                    if (this.sleepTimerBadgeInterval) {
                        clearInterval(this.sleepTimerBadgeInterval);
                        this.sleepTimerBadgeInterval = null;
                    }

                    // Listen for when NEXT song starts loading - pause immediately
                    const handleNextSongLoad = () => {
                        console.log('[Miniplayer] Next song loading - pausing now');
                        this.executeSleepTimer();
                        video.removeEventListener('loadstart', handleNextSongLoad);
                    };
                    video.addEventListener('loadstart', handleNextSongLoad);

                    // Store the handler so we can remove it if timer is cancelled
                    (this as any).songEndHandler = handleNextSongLoad;
                    (this as any).songEndEventType = 'loadstart';
                } else {
                    // No video found, just pause
                    this.executeSleepTimer();
                }
            } else {
                // Pause immediately
                this.executeSleepTimer();
            }
        }, minutes * 60 * 1000);

        // Start badge update interval
        this.updateSleepTimerBadge();
        this.sleepTimerBadgeInterval = window.setInterval(() => {
            this.updateSleepTimerBadge();
        }, 1000);

        // Update button states
        if (this.sleepTimerButton) {
            this.sleepTimerButton.classList.add('active');
        }

        // Show badge
        if (this.sleepTimerBadge) {
            this.sleepTimerBadge.style.display = 'block';
        }

        this.closeSleepTimerModal();
    }

    private cancelSleepTimer() {
        if (this.sleepTimerId) {
            clearTimeout(this.sleepTimerId);
            this.sleepTimerId = null;
        }

        if (this.sleepTimerBadgeInterval) {
            clearInterval(this.sleepTimerBadgeInterval);
            this.sleepTimerBadgeInterval = null;
        }

        this.sleepTimerEndTime = null;

        // Remove song end event listener if it exists
        if ((this as any).songEndHandler) {
            const video = document.querySelector('video');
            if (video) {
                const eventType = (this as any).songEndEventType || 'loadstart';
                video.removeEventListener(eventType, (this as any).songEndHandler);
            }
            delete (this as any).songEndHandler;
            delete (this as any).songEndEventType;
        }

        // Hide badge
        if (this.sleepTimerBadge) {
            this.sleepTimerBadge.style.display = 'none';
        }

        // Update button states
        if (this.sleepTimerButton) {
            this.sleepTimerButton.classList.remove('active');
        }

        // Update modal UI
        if (this.sleepTimerStartBtn) this.sleepTimerStartBtn.style.display = 'block';
        if (this.sleepTimerCancelBtn) this.sleepTimerCancelBtn.style.display = 'none';

        console.log('[Miniplayer] Sleep timer cancelled');
    }

    private updateSleepTimerBadge() {
        if (!this.sleepTimerBadge || !this.sleepTimerEndTime) return;

        const remaining = Math.max(0, this.sleepTimerEndTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        if (remaining <= 0) {
            this.sleepTimerBadge.textContent = '0:00';
            return;
        }

        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            this.sleepTimerBadge.textContent = `${hours}h${mins}m`;
        } else if (minutes > 0) {
            this.sleepTimerBadge.textContent = `${minutes}m`;
        } else {
            this.sleepTimerBadge.textContent = `${seconds}s`;
        }
    }

    private executeSleepTimer() {
        console.log('[Miniplayer] Sleep timer triggered - pausing playback');

        // Pause the video
        const video = document.querySelector('video');
        if (video) {
            video.pause();
        }

        // Also try the YouTube Music play/pause button
        const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
        if (playPauseButton) {
            const isPlaying = document.querySelector('ytmusic-player-bar')?.getAttribute('playing') !== null;
            if (isPlaying) {
                playPauseButton.click();
            }
        }

        // Clean up timer state
        this.cancelSleepTimer();
    }

    // ===== CROSSFADE METHODS =====
    private setupCrossfadeListener() {
        // Find video and attach listeners for song changes
        const attachListeners = () => {
            const video = document.querySelector('video');
            if (!video) {
                // Retry after a short delay if video not found
                setTimeout(attachListeners, 1000);
                return;
            }

            // Store original volume for restoration
            let storedVolume = video.volume || 1;

            // Listen for when new media starts loading
            video.addEventListener('loadstart', () => {
                if (!this.config.crossfadeEnabled) return;
                if (this.isCrossfading) return;

                // Store current volume before muting
                storedVolume = video.volume || 1;

                // Immediately mute to prevent loud transition
                video.volume = 0;
                console.log('[Miniplayer] Crossfade: New song loading - muted');
            });

            // Listen for when new media is ready to play
            video.addEventListener('canplay', () => {
                if (!this.config.crossfadeEnabled) return;
                if (this.isCrossfading) return;

                // Only fade if volume is currently 0 (we muted it in loadstart)
                if (video.volume === 0) {
                    this.isCrossfading = true;
                    console.log('[Miniplayer] Crossfade: Song ready - fading in');

                    const targetVolume = storedVolume;
                    const steps = 25;
                    const stepDuration = this.crossfadeDuration / steps;
                    let currentStep = 0;

                    const fadeIn = () => {
                        currentStep++;
                        if (currentStep <= steps) {
                            const progress = currentStep / steps;
                            const easedProgress = 1 - Math.pow(1 - progress, 2);
                            video.volume = targetVolume * easedProgress;
                            setTimeout(fadeIn, stepDuration);
                        } else {
                            video.volume = targetVolume;
                            this.isCrossfading = false;
                            console.log('[Miniplayer] Crossfade: Fade complete');
                        }
                    };

                    fadeIn();
                }
            });

            console.log('[Miniplayer] Crossfade listener attached to video');
        };

        // Start trying to attach listeners
        attachListeners();
    }

    private checkForSongChange() {
        // Use config.crossfadeEnabled from plugin settings
        if (!this.config.crossfadeEnabled) return;

        // Get current video ID
        const currentVideoId = this.getCurrentVideoId();

        if (this.lastVideoId && currentVideoId && this.lastVideoId !== currentVideoId) {
            // Song changed - initiate crossfade
            this.initiateCrossfade();
        }

        this.lastVideoId = currentVideoId;
    }

    private getCurrentVideoId(): string | null {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('v');
        } catch (e) {
            return null;
        }
    }

    private initiateCrossfade() {
        if (this.isCrossfading) return;

        const video = document.querySelector('video');
        if (!video) return;

        this.isCrossfading = true;

        // Store the target volume (current volume or 1 if muted)
        const targetVolume = video.muted ? 1 : video.volume || 1;

        // Start at zero volume for smooth fade-in
        video.volume = 0;
        if (video.muted) video.muted = false;

        console.log('[Miniplayer] Initiating crossfade - fading in new song');

        const steps = 20; // Number of fade steps
        const stepDuration = this.crossfadeDuration / steps;
        let currentStep = 0;

        // Fade in the new song
        const fadeIn = () => {
            currentStep++;
            if (currentStep <= steps) {
                // Ease-out curve for smoother fade
                const progress = currentStep / steps;
                const easedProgress = 1 - Math.pow(1 - progress, 2);
                video.volume = targetVolume * easedProgress;
                setTimeout(fadeIn, stepDuration);
            } else {
                // Ensure final volume is exactly the target
                video.volume = targetVolume;
                this.isCrossfading = false;
                console.log('[Miniplayer] Crossfade complete');
            }
        };

        // Small delay to let the new song buffer/start
        setTimeout(fadeIn, 100);
    }

    getElement(): HTMLElement {
        return this.element;
    }

    async destroy() {
        // Stop all tracking and intervals
        this.stopTracking();
        if (this.currentLyricUpdateInterval) {
            clearInterval(this.currentLyricUpdateInterval);
            this.currentLyricUpdateInterval = null;
        }

        // Close fullscreen if open
        if (this.isFullscreenOpen) {
            this.closeFullscreen();
        }

        // Cancel sleep timer if active
        this.cancelSleepTimer();

        // Unmount lyrics if they're open
        if (this.isLyricsOpen && this.fullscreenLyricsContent) {
            try {
                const { unmountLyrics } = await import('./lyrics-wrapper');
                unmountLyrics();
            } catch (error) {
                console.error('[Miniplayer] Failed to unmount lyrics on destroy:', error);
            }
        }

        // Disconnect audio analyser
        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (error) {
                console.error('[Miniplayer] Failed to disconnect analyser:', error);
            }
            this.analyser = null;
        }

        // Clear audio context reference (don't close it as it's shared)
        this.audioContext = null;
        this.dataArray = null;

        // Remove event listeners
        document.removeEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);
        window.removeEventListener('resize', this.boundHandleResize);

        // Remove play button click listener
        document.removeEventListener('click', this.boundHandleVideoPlay, true);

        // Clear video availability check interval
        if (this.videoAvailabilityCheckInterval) {
            clearInterval(this.videoAvailabilityCheckInterval);
            this.videoAvailabilityCheckInterval = null;
        }

        // Remove element from DOM
        this.element.remove();

        // Show YouTube miniplayer
        this.showYouTubeMiniplayer();
    }

    private setupVideoPlayListener() {
        // Use event delegation to listen for clicks on play buttons
        // This works for dynamically added content (home, search results, etc.)
        document.addEventListener('click', this.boundHandleVideoPlay, true);
    }

    private handleVideoPlay(event: Event) {
        // Only auto-open if the feature is enabled and fullscreen isn't already open
        if (!this.config.autoOpenOnSongChange || this.isFullscreenOpen) {
            return;
        }

        const target = event.target as HTMLElement;

        // Check if the click was on an element with id="content" that has the specific class
        const contentElement = target.closest('#content.style-scope.ytmusic-item-thumbnail-overlay-renderer');
        if (contentElement) {
            // Clicked on content area with the specific class, open fullscreen
            setTimeout(() => {
                if (!this.isFullscreenOpen) {
                    this.openFullscreen();
                }
            }, 300);
            return;
        }

        // Check if the click was on a play button or its child elements
        const playButton = target.closest('ytmusic-play-button-renderer');
        if (!playButton) {
            return;
        }

        // Make sure it's a play button on a song card (not the main player)
        const songCard = playButton.closest('ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer');
        if (!songCard) {
            return;
        }

        // Small delay to let the song start loading
        setTimeout(() => {
            if (!this.isFullscreenOpen) {
                this.openFullscreen();
            }
        }, 300);
    }

    private startVideoAvailabilityCheck() {
        // Check every 3 seconds if video becomes available
        this.videoAvailabilityCheckInterval = window.setInterval(() => {
            this.checkAndRestorePreferredMode();
        }, 3000);
    }

    private checkAndRestorePreferredMode() {
        // Only restore if we're in fallback mode
        if (!this.isInFallbackMode) {
            return;
        }

        // Check if video is now available
        const video = document.querySelector('video');
        if (!video) {
            return;
        }

        // Check if video has actual content (not just the element existing)
        // readyState > 0 means video has metadata or is loading
        if (video.readyState > 0 && video.videoWidth > 0) {
            // Video is now available! Restore preferred mode
            console.log('[Miniplayer] Video became available, restoring preferred mode:', this.preferredMode);

            // Clear fallback state
            this.isInFallbackMode = false;

            // Restore the preferred mode
            // This would trigger the mode switch logic
            // For now, just log it - the actual mode switching would need to be implemented
            // based on how your existing code handles mode changes

            // TODO: Call the method that actually switches the display mode
            // For example: this.switchToMode(this.preferredMode);
        }
    }
}
