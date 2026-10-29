import { DomManager } from './modules/dom-manager';
import { ActionAnimator } from './modules/action-animator';
import { ColorExtractor } from './modules/color-extractor';
import { DragHandler } from './modules/drag-handler';
import { SleepTimer } from './modules/sleep-timer';
import { SyncLyricsModal } from './modules/sync-lyrics-modal';
import { VideoManager } from './modules/video-manager';
import { ThumbnailManager } from './modules/thumbnail-manager';
import { SeekBar } from './modules/seek-bar';
import { QueuePanel } from './modules/queue-panel';
import { LyricsPanel } from './modules/lyrics-panel';
import { MoreMenu } from './modules/more-menu';
import { FullscreenManager } from './modules/fullscreen-manager';
import { VisualizerRenderer } from './modules/visualizer';
import { BackgroundVisualizer } from './modules/background-visualizer';
import { CrossfadeManager } from './modules/crossfade-manager';
import { ImmersivePlayer } from './immersive-player';
import { MiniplayerConfig } from './types';
import { ensureLyricsLoaded, mountLyrics } from './lyrics-wrapper';

export class Miniplayer {
    private dom: DomManager;
    private config: MiniplayerConfig = {
        enabled: false,
        visualizerEnabled: true,
        visualizerStyle: 'bars',
        videoEnabled: true,
        clickToSwitch: true,
        draggableEnabled: true,
        widescreenMode: true,
        crossfadeEnabled: false,
        autoOpenOnSongChange: false,
        backgroundVisualizer: 'butterchurn',
    };

    // Sub-modules
    private actionAnimator: ActionAnimator;
    private colorExtractor: ColorExtractor;
    private dragHandler: DragHandler;
    private sleepTimer: SleepTimer;
    private syncLyricsModal: SyncLyricsModal;
    private videoManager: VideoManager;
    private thumbnailManager: ThumbnailManager;
    private seekBar: SeekBar;
    private queuePanel: QueuePanel;
    private lyricsPanel: LyricsPanel;
    private moreMenu: MoreMenu;
    private fullscreenManager: FullscreenManager;
    private backgroundVisualizer: BackgroundVisualizer;
    private crossfadeManager: CrossfadeManager;
    private immersivePlayer: ImmersivePlayer | null = null;

    // Audio Context & Analyser
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private playerApi: any = null;

    // Runtime state
    private isActive: boolean = false;
    private isAnimationRunning: boolean = false;
    private isPopoutActive: boolean = false;
    private animationFrameId: number | null = null;
    private trackingInterval: number | null = null;
    private currentSongTitle: string = '';

    // Bound listeners for clean destruction
    private boundHandleAudioCanPlay: (e: Event) => void;
    private boundHandleResize: () => void;
    private boundHandleVideoPlay: (e: Event) => void;

    constructor(config?: Partial<MiniplayerConfig>) {
        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.dom = new DomManager();
        this.actionAnimator = new ActionAnimator(this.dom.actionAnimator);
        this.colorExtractor = new ColorExtractor();

        this.dragHandler = new DragHandler(this.dom.miniplayer, () => this.config.draggableEnabled);
        this.sleepTimer = new SleepTimer(this.dom);
        this.syncLyricsModal = new SyncLyricsModal(this.dom);

        this.videoManager = new VideoManager(
            this.dom,
            () => this.config,
            () => this.fullscreenManager.isOpen,
            () => this.immersivePlayer?.isActive ?? false
        );

        this.thumbnailManager = new ThumbnailManager(this.dom, this.colorExtractor);
        this.seekBar = new SeekBar(this.dom);

        this.queuePanel = new QueuePanel(this.dom, () => this.playerApi);
        this.lyricsPanel = new LyricsPanel(this.dom);

        this.moreMenu = new MoreMenu(this.dom, {
            onToggleQueue: () => this.queuePanel.toggle(undefined, () => this.lyricsPanel.toggle(false)),
            onToggleLyrics: () => this.lyricsPanel.toggle(undefined, () => this.queuePanel.toggle(false)),
            onToggleImmersive: () => this.toggleImmersive(),
            onOpenSleepTimer: () => this.sleepTimer.openModal(),
            onOpenSyncLyrics: () => this.syncLyricsModal.openModal(),
            onTogglePopout: () => this.togglePopoutPlayer(),
            onToggleLike: () => this.dom.fullscreenLike.click(),
            onToggleRepeat: () => this.dom.fullscreenRepeat.click(),
            onVolumeChange: (vol) => {
                const video = this.videoManager.getVideo();
                if (video) {
                    video.volume = vol;
                    video.muted = false;
                    localStorage.setItem('pear-player-volume', String(vol));
                    this.dom.fullscreenVolumeSlider.value = String(Math.round(vol * 100));
                    this.updateVolumeUI();
                }
            },
            onMuteToggle: () => {
                const video = this.videoManager.getVideo();
                if (video) {
                    video.muted = !video.muted;
                    this.updateVolumeUI();
                }
            },
        });

        this.fullscreenManager = new FullscreenManager(this.dom, {
            onOpen: () => this.onFullscreenOpened(),
            onClose: () => this.onFullscreenClosed(),
            onSavePosition: () => this.dragHandler.savePosition(),
            onApplyPosition: () => {
                if (window.innerWidth > 450 && this.config.draggableEnabled) {
                    setTimeout(() => this.dragHandler.applyPosition(), 100);
                }
            },
            onTogglePopout: () => this.togglePopoutPlayer(),
        });

        this.backgroundVisualizer = new BackgroundVisualizer(this.dom.fullscreenVisualizerBgCanvas);
        this.backgroundVisualizer.setType(this.config.backgroundVisualizer);

        this.crossfadeManager = new CrossfadeManager(() => this.config.crossfadeEnabled);

        // Immersive Player
        if (this.dom.fullscreenPlayer) {
            this.immersivePlayer = new ImmersivePlayer(this.dom.fullscreenPlayer);
        }

        // Bind lifecycle event handlers
        this.boundHandleAudioCanPlay = this.handleAudioCanPlay.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundHandleVideoPlay = this.handleVideoPlay.bind(this);

        this.setupEventListeners();
        this.tryConnectExistingAudio();
        this.checkWindowSize();

        // Restore saved fullscreen state
        const savedFullscreen = localStorage.getItem('pear-fullscreen-open');
        if (
            savedFullscreen === 'true' ||
            (savedFullscreen === null && localStorage.getItem('pear-immersive-mode') === 'true')
        ) {
            setTimeout(() => {
                if (!this.fullscreenManager.isOpen) {
                    this.fullscreenManager.open();
                }
            }, 700);
        }
    }

    private setupEventListeners(): void {
        document.addEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);
        window.addEventListener('resize', this.boundHandleResize);
        document.addEventListener('click', this.boundHandleVideoPlay, true);

        // Miniplayer thumbnail click cycles mode
        this.dom.miniplayerThumb.addEventListener('click', () => {
            if (!this.config.clickToSwitch) return;
            this.videoManager.cycleMode(() => {
                if (this.shouldAnimate()) {
                    this.startAnimationLoop();
                } else {
                    this.renderFrame();
                    this.stopAnimationLoop();
                }
            });
        });

        // Miniplayer Controls
        this.dom.miniplayerPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause(false);
        });
        this.dom.miniplayerPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            this.previousTrack(false);
        });
        this.dom.miniplayerNext.addEventListener('click', (e) => {
            e.stopPropagation();
            this.nextTrack(false);
        });

        // Fullscreen Controls
        this.dom.fullscreenPlay.addEventListener('click', () => this.togglePlayPause(true));
        this.dom.fullscreenPrev.addEventListener('click', () => this.previousTrack(true));
        this.dom.fullscreenNext.addEventListener('click', () => this.nextTrack(true));

        this.dom.fullscreenLike.addEventListener('click', () => this.toggleLike());
        this.dom.fullscreenRepeat.addEventListener('click', () => this.toggleRepeat());

        this.dom.fullscreenVolumeBtn.addEventListener('click', () => {
            const video = this.videoManager.getVideo();
            if (video) {
                video.muted = !video.muted;
                this.updateVolumeUI();
            }
        });

        this.dom.fullscreenVolumeSlider.addEventListener('input', (e) => {
            const video = this.videoManager.getVideo();
            if (video) {
                const vol = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                video.volume = vol;
                video.muted = false;
                localStorage.setItem('pear-player-volume', String(vol));
                this.updateVolumeUI();
            }
        });

        // Immersive Toggle
        this.dom.fullscreenImmersiveToggle.addEventListener('click', () => {
            if (this.immersivePlayer) {
                if (!this.immersivePlayer.isActive) {
                    this.videoManager.detachVideoFromNormalPlayer();
                }
                this.immersivePlayer.toggle(true);
            }
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.moreMenu.isOpen) {
                e.preventDefault();
                e.stopPropagation();
                this.moreMenu.toggle(false);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
                const activeTag = (document.activeElement?.tagName || '').toLowerCase();
                if (activeTag !== 'input' && activeTag !== 'textarea') {
                    e.preventDefault();
                    this.togglePopoutPlayer();
                }
            }
        });

        // Popout player toggle event
        window.addEventListener('peard:toggle-popout-player', () => {
            this.togglePopoutPlayer();
        });

        // GPU & state exclusivity with Popout Window
        window.addEventListener('peard:popout-window-opened', () => {
            this.isPopoutActive = true;
            if (this.fullscreenManager.isOpen) {
                this.fullscreenManager.close(false);
            }
            this.stopAnimationLoop();
            VisualizerRenderer.clear(this.dom.miniplayerCanvas);
            VisualizerRenderer.clear(this.dom.fullscreenCanvas);
        });

        window.addEventListener('peard:popout-window-closed', () => {
            this.isPopoutActive = false;
            if (this.fullscreenManager.isOpen) {
                if (this.fullscreenManager.isImmersivePreferred()) {
                    this.immersivePlayer?.enable(false);
                } else if (this.videoManager.getPreferredMode() === 'video') {
                    this.videoManager.attachVideoToNormalPlayer();
                }
            }
            this.startAnimationLoop();
        });
    }

    private togglePlayPause(fromFullscreen: boolean): void {
        const video = this.videoManager.getVideo();
        const isPaused = video ? video.paused : true;

        if (fromFullscreen) {
            if (isPaused) {
                this.actionAnimator.trigger(
                    `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
                    '#ffffff',
                    'pop'
                );
            } else {
                this.actionAnimator.trigger(
                    `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
                    '#ffffff',
                    'pop'
                );
            }
        }

        if (this.playerApi) {
            if (isPaused) this.playerApi.playVideo();
            else this.playerApi.pauseVideo();
        } else {
            const playBtn = document.querySelector<HTMLElement>('#play-pause-button');
            if (playBtn) playBtn.click();
            else if (video) {
                if (isPaused) video.play().catch(() => {});
                else video.pause();
            }
        }
    }

    private previousTrack(fromFullscreen: boolean): void {
        this.immersivePlayer?.onSongChange();
        if (fromFullscreen) {
            this.actionAnimator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>`,
                '#ffffff',
                'slide-left'
            );
        }
        if (this.playerApi?.previousVideo) {
            this.playerApi.previousVideo();
        } else {
            document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar, .previous-button')?.click();
        }
    }

    private nextTrack(fromFullscreen: boolean): void {
        this.immersivePlayer?.onSongChange();
        if (fromFullscreen) {
            this.actionAnimator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
                '#ffffff',
                'slide-right'
            );
        }
        if (this.playerApi?.nextVideo) {
            this.playerApi.nextVideo();
        } else {
            document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar, .next-button')?.click();
        }
    }

    private toggleLike(): void {
        const isLiked = this.dom.fullscreenLike.classList.contains('active');
        if (isLiked) {
            this.actionAnimator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
                '#ffffff',
                'sad'
            );
        } else {
            this.actionAnimator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="#ff2a5f" stroke="#ff2a5f" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
                '#ff2a5f',
                'pulse'
            );
        }

        const likeBtn =
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer yt-button-shape.like button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer tp-yt-paper-icon-button.like') ||
            document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');

        if (likeBtn) {
            likeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            setTimeout(() => this.updateLikeAndRepeatState(), 100);
        }
    }

    private toggleRepeat(): void {
        const repeatBtn =
            document.querySelector<HTMLElement>('yt-icon-button.repeat button') ||
            document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar tp-yt-paper-icon-button.repeat');

        if (repeatBtn) {
            repeatBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            setTimeout(() => this.updateLikeAndRepeatState(), 100);
        }
    }

    private async togglePopoutPlayer(): Promise<void> {
        try {
            const { togglePopoutPlayer, isPopoutOpen } = await import('@/plugins/picture-in-picture/popout-player');
            const opened = await togglePopoutPlayer();
            if (!opened && !isPopoutOpen() && (window as any).ipcRenderer) {
                (window as any).ipcRenderer.send('peard:toggle-popout-window');
            }
        } catch {
            if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.send('peard:toggle-popout-window');
            }
        }
    }

    private onFullscreenOpened(): void {
        const thumb = this.thumbnailManager.getThumbnailSrc();
        if (thumb) {
            this.dom.fullscreenPlayer.style.setProperty('--bg-image', `url("${thumb}")`);
            document.documentElement.style.setProperty('--bg-image', `url("${thumb}")`);
            this.colorExtractor.extractAndApply(thumb);
        }

        this.updatePlayerState();

        const isImmersive = this.fullscreenManager.isImmersivePreferred();
        if (isImmersive) {
            this.videoManager.detachVideoFromNormalPlayer();
            if (!this.immersivePlayer?.isActive) {
                this.immersivePlayer?.enable(false);
            }
        } else {
            if (this.immersivePlayer?.isActive) {
                this.immersivePlayer?.disable(false);
            }
            if (this.videoManager.getPreferredMode() === 'video') {
                this.videoManager.attachVideoToNormalPlayer();
            }
            if (this.lyricsPanel.isOpen && this.dom.fullscreenLyricsContent) {
                mountLyrics(this.dom.fullscreenLyricsContent);
            }
        }
        ensureLyricsLoaded();

        this.startAnimationLoop();
    }

    private onFullscreenClosed(): void {
        if (this.moreMenu.isOpen) {
            this.moreMenu.toggle(false);
        }
        if (this.immersivePlayer?.isActive) {
            this.immersivePlayer.disable(false);
        }
        this.videoManager.detachVideoFromNormalPlayer();
        VisualizerRenderer.clear(this.dom.fullscreenCanvas);

        if (!this.shouldAnimate()) {
            this.stopAnimationLoop();
        }
    }

    private tryConnectExistingAudio(): void {
        const existingContext = (window as any).__pearAudioContext;
        const existingSource = (window as any).__pearAudioSource;

        if (existingContext && existingSource) {
            try {
                this.audioContext = existingContext;
                if (this.audioContext) {
                    this.analyser = this.audioContext.createAnalyser();
                    this.analyser.fftSize = this.config.visualizerStyle === 'wave' ? 128 : 32;
                    existingSource.connect(this.analyser);
                    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                    this.backgroundVisualizer.init(existingSource, this.audioContext, this.analyser, this.dataArray);
                }
            } catch (_) {}
        }
    }

    private handleAudioCanPlay(e: Event): void {
        const event = e as CustomEvent;
        this.audioContext = event.detail.audioContext;
        const source = event.detail.audioSource;

        (window as any).__pearAudioContext = this.audioContext;
        (window as any).__pearAudioSource = source;

        if (this.audioContext && source) {
            try {
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = this.config.visualizerStyle === 'wave' ? 128 : 32;
                source.connect(this.analyser);
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                this.backgroundVisualizer.init(source, this.audioContext, this.analyser, this.dataArray);
            } catch (_) {}
        }
    }

    private handleResize(): void {
        this.checkWindowSize();
        this.dragHandler.onResize();
        this.fullscreenManager.updateLayoutSize();
    }

    private handleVideoPlay(event: Event): void {
        if (!this.config.autoOpenOnSongChange || this.fullscreenManager.isOpen) return;

        const target = event.target as HTMLElement;
        const contentEl = target.closest('#content.style-scope.ytmusic-item-thumbnail-overlay-renderer');
        if (contentEl) {
            setTimeout(() => {
                if (!this.fullscreenManager.isOpen) this.fullscreenManager.open();
            }, 300);
            return;
        }

        const playBtn = target.closest('ytmusic-play-button-renderer');
        if (!playBtn) return;
        const songCard = playBtn.closest('ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer');
        if (!songCard) return;

        setTimeout(() => {
            if (!this.fullscreenManager.isOpen) this.fullscreenManager.open();
        }, 300);
    }

    private checkWindowSize(): void {
        const shouldBeActive = window.innerWidth <= 2160;

        if (shouldBeActive !== this.isActive) {
            this.isActive = shouldBeActive;
            if (shouldBeActive) {
                this.dom.miniplayer.classList.add('active');
                this.hideYouTubeMiniplayer();
                this.startTracking();
            } else {
                this.dom.miniplayer.classList.remove('active');
                this.showYouTubeMiniplayer();
                this.stopTracking();
            }
        }

        this.updateSize();
    }

    private hideYouTubeMiniplayer(): void {
        const yt = document.querySelector<HTMLElement>('ytmusic-player[player-ui-state="MINIPLAYER"]');
        if (yt) yt.style.display = 'none';
    }

    private showYouTubeMiniplayer(): void {
        const yt = document.querySelector<HTMLElement>('ytmusic-player[player-ui-state="MINIPLAYER"]');
        if (yt) yt.style.display = '';
    }

    private updateSize(): void {
        if (!this.isActive) return;
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (width <= 310 && height <= 200) {
            this.dom.root.style.width = '95vw';
            this.dom.root.style.height = '100%';
        } else if (width <= 500 && width > 310) {
            this.dom.root.style.width = '90%';
            this.dom.root.style.height = '80px';
            this.dom.root.style.borderRadius = '25px';
            this.dom.root.style.padding = '8px 12px';
        } else {
            this.dom.root.style.width = '500px';
            this.dom.root.style.height = '80px';
            this.dom.root.style.borderRadius = '25px';
            this.dom.root.style.padding = '8px 12px';
        }
    }

    private startTracking(): void {
        if (this.trackingInterval) return;

        this.videoManager.attachVideoListeners(
            () => this.startAnimationLoop(),
            () => this.stopAnimationLoop()
        );

        this.trackingInterval = window.setInterval(() => {
            if (document.hidden || this.isPopoutActive) return;
            this.updatePlayerState();
        }, 500);

        this.startAnimationLoop();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAnimationLoop();
            } else if (!this.isPopoutActive && (this.isActive || this.fullscreenManager.isOpen)) {
                this.updatePlayerState();
                this.startAnimationLoop();
            }
        });
    }

    private stopTracking(): void {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        this.stopAnimationLoop();
    }

    private updatePlayerState(): void {
        try {
            const titleEl = document.querySelector('.title.ytmusic-player-bar');
            const artistEl = document.querySelector('.byline.ytmusic-player-bar');
            const video = this.videoManager.getVideo();

            const title = titleEl?.textContent?.trim() || 'No song playing';
            const artist = artistEl?.textContent?.trim() || '-';

            this.dom.miniplayerTitle.textContent = title;
            this.dom.miniplayerArtist.textContent = artist;
            this.dom.fullscreenTitle.textContent = title;
            this.dom.fullscreenArtist.textContent = artist;

            // Song changed?
            if (this.currentSongTitle && title !== this.currentSongTitle) {
                this.immersivePlayer?.onSongChange();
                if (this.queuePanel.isOpen) {
                    this.queuePanel.render();
                }
            }
            this.currentSongTitle = title;

            // Crossfade check
            this.crossfadeManager.checkForSongChange(() => {
                this.immersivePlayer?.onSongChange();
            });

            // Update Thumbnails
            const thumb = this.thumbnailManager.getThumbnailSrc();
            this.thumbnailManager.updateThumbnails(thumb, this.videoManager.getPreferredMode());

            // Play/Pause icon sync
            if (video) {
                const isPaused = video.paused;
                this.dom.miniplayerPlay.textContent = isPaused ? '▶' : '⏸';
                this.dom.fullscreenPlay.innerHTML = isPaused
                    ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

                // Progress update
                if (video.duration) {
                    this.seekBar.updateProgress(video.currentTime / video.duration);
                }
            }

            if (this.fullscreenManager.isOpen) {
                this.updateVolumeUI();
                this.updateLikeAndRepeatState();
            }
        } catch (err) {
            console.error('[Miniplayer] Error updating player state:', err);
        }
    }

    private updateVolumeUI(): void {
        const video = this.videoManager.getVideo();
        if (!video) return;

        const volPercent = Math.round((video.muted ? 0 : video.volume) * 100);
        this.dom.fullscreenVolumeSlider.value = String(Math.round(video.volume * 100));
        this.dom.fullscreenVolumeValue.textContent = `${volPercent}%`;

        const volumeHigh1 = document.getElementById('volume-high-1');
        const volumeHigh2 = document.getElementById('volume-high-2');
        const volumeMute = document.getElementById('volume-mute');
        const volumeMute2 = document.getElementById('volume-mute-2');

        const isMuted = video.muted || video.volume === 0;
        if (isMuted) {
            if (volumeHigh1) volumeHigh1.style.display = 'none';
            if (volumeHigh2) volumeHigh2.style.display = 'none';
            if (volumeMute) volumeMute.style.display = 'block';
            if (volumeMute2) volumeMute2.style.display = 'block';
        } else {
            if (volumeHigh1) volumeHigh1.style.display = 'block';
            if (volumeHigh2) volumeHigh2.style.display = video.volume > 0.5 ? 'block' : 'none';
            if (volumeMute) volumeMute.style.display = 'none';
            if (volumeMute2) volumeMute2.style.display = 'none';
        }

        this.moreMenu.syncStates();
    }

    private updateLikeAndRepeatState(): void {
        let isLiked = false;
        const likeRenderer =
            document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer') ||
            document.querySelector('ytmusic-like-button-renderer');

        if (likeRenderer && likeRenderer.hasAttribute('like-status')) {
            isLiked = likeRenderer.getAttribute('like-status') === 'LIKE';
        } else {
            const ytLike =
                document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
                document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');
            if (ytLike) {
                isLiked = ytLike.getAttribute('aria-pressed') === 'true';
            }
        }
        this.dom.fullscreenLike.classList.toggle('active', isLiked);

        const ytRepeat =
            document.querySelector<HTMLElement>('yt-icon-button.repeat') ||
            document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar');
        if (ytRepeat) {
            const title = (ytRepeat.getAttribute('title') || ytRepeat.getAttribute('label') || '').toLowerCase();
            const isRepeat = !title.includes('repeat off');
            this.dom.fullscreenRepeat.classList.toggle('active', isRepeat);
        }

        this.moreMenu.syncStates();
    }

    private shouldAnimate(): boolean {
        if (document.hidden || this.isPopoutActive) return false;
        if (!this.isActive && !this.fullscreenManager.isOpen) return false;

        const video = this.videoManager.getVideo();
        if (!video || video.paused || video.ended) return false;

        if (!this.fullscreenManager.isOpen) {
            let mode = this.videoManager.getPreferredMode();
            if (mode === 'visualizer' && (!this.config.visualizerEnabled || !this.analyser)) {
                mode = 'video';
            }
            if (mode === 'video' && (!this.config.videoEnabled || video.videoWidth === 0)) {
                mode = 'thumbnail';
            }
            if (mode === 'thumbnail') return false;
        }

        return true;
    }

    private startAnimationLoop(): void {
        if (this.isAnimationRunning) return;
        this.videoManager.attachVideoListeners(
            () => this.startAnimationLoop(),
            () => this.stopAnimationLoop()
        );

        if (!this.shouldAnimate()) {
            this.renderFrame();
            return;
        }

        this.isAnimationRunning = true;
        const loop = () => {
            if (!this.isAnimationRunning) return;
            if (!this.shouldAnimate()) {
                this.renderFrame();
                this.stopAnimationLoop();
                return;
            }
            this.renderFrame();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    private stopAnimationLoop(): void {
        this.isAnimationRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private renderFrame(): void {
        if (document.hidden || this.isPopoutActive) return;
        if (!this.isActive && !this.fullscreenManager.isOpen) return;

        const video = this.videoManager.getVideo();
        let mode = this.videoManager.getPreferredMode();

        if (mode === 'visualizer' && (!this.config.visualizerEnabled || !this.analyser)) {
            mode = 'video';
        }
        if (mode === 'video' && (!this.config.videoEnabled || !video || (!this.fullscreenManager.isOpen && video.videoWidth === 0))) {
            mode = 'thumbnail';
        }

        if (mode === 'visualizer' && this.analyser && this.dataArray) {
            // Render on miniplayer
            VisualizerRenderer.render(
                this.dom.miniplayerCanvas,
                this.dom.miniplayerThumb,
                this.analyser,
                this.dataArray,
                this.config.visualizerStyle,
                this.config.widescreenMode
            );

            // Render on fullscreen
            if (this.fullscreenManager.isOpen) {
                VisualizerRenderer.render(
                    this.dom.fullscreenCanvas,
                    this.dom.fullscreenThumbTop,
                    this.analyser,
                    this.dataArray,
                    this.config.visualizerStyle,
                    this.config.widescreenMode
                );
                this.backgroundVisualizer.render();
            }
        } else if (mode === 'video' && video) {
            if (this.isActive && !this.fullscreenManager.isOpen) {
                VisualizerRenderer.drawSourceToCanvas(this.dom.miniplayerCanvas, this.dom.miniplayerThumb, video);
            }
            if (this.fullscreenManager.isOpen) {
                this.videoManager.syncNormalVideoDisplay(video);
                if (this.analyser) {
                    this.backgroundVisualizer.render();
                }
            }
        } else {
            VisualizerRenderer.clear(this.dom.miniplayerCanvas);
            if (this.fullscreenManager.isOpen) {
                VisualizerRenderer.clear(this.dom.fullscreenCanvas);
                if (this.analyser) {
                    this.backgroundVisualizer.render();
                }
            }
        }
    }

    // Public API
    public getElement(): HTMLElement {
        return this.dom.root;
    }

    public setPlayerApi(api: any): void {
        this.playerApi = api;
    }

    public setConfig(config: any): void {
        const oldVisualizer = this.config.backgroundVisualizer;
        this.config = { ...this.config, ...config };

        if (this.config.backgroundVisualizer !== oldVisualizer) {
            this.backgroundVisualizer.setType(this.config.backgroundVisualizer);
        }

        if (this.analyser) {
            this.analyser.fftSize = this.config.visualizerStyle === 'wave' ? 128 : 32;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
    }

    public toggleImmersive(): void {
        if (!this.fullscreenManager.isOpen) {
            localStorage.setItem('pear-player-type', 'immersive');
            localStorage.setItem('pear-immersive-mode', 'true');
            this.fullscreenManager.open();
            return;
        }

        if (this.dom.fullscreenImmersiveToggle) {
            this.dom.fullscreenImmersiveToggle.click();
        } else if (this.immersivePlayer) {
            if (!this.immersivePlayer.isActive) {
                this.videoManager.detachVideoFromNormalPlayer();
            }
            this.immersivePlayer.toggle(true);
        }
    }

    public destroy(): void {
        this.stopTracking();

        if (this.fullscreenManager.isOpen) {
            this.fullscreenManager.close(false);
        } else {
            this.videoManager.detachVideoFromNormalPlayer();
        }

        this.sleepTimer.destroy();
        this.lyricsPanel.destroy();
        this.dragHandler.destroy();
        this.videoManager.destroy();
        this.colorExtractor.destroy();
        this.backgroundVisualizer.destroy();

        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (_) {}
            this.analyser = null;
        }

        this.audioContext = null;
        this.dataArray = null;

        document.removeEventListener('peard:audio-can-play', this.boundHandleAudioCanPlay);
        window.removeEventListener('resize', this.boundHandleResize);
        document.removeEventListener('click', this.boundHandleVideoPlay, true);

        this.dom.root.remove();
        this.showYouTubeMiniplayer();
    }
}
