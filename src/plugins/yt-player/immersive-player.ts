import { getAllLyrics, getRomanizedLyric, getCurrentLyricText, ensureLyricsLoaded, clearLyricsState } from './lyrics-wrapper';

export class ImmersivePlayer {
    public isActive: boolean = false;
    private fullscreenPlayer: HTMLElement;
    private videoElement: HTMLVideoElement | null = null;
    private fallbackElement: HTMLElement;

    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;

    private immersiveContainer: HTMLElement | null = null;
    private movedElements: Map<HTMLElement, { parent: HTMLElement, sibling: Node | null }> = new Map();

    private zenMode: boolean = false;
    private userPreferredZenMode: boolean = false;
    private zenModeTimeout: number | null = null;



    // Lyrics
    private isInteractiveLyrics: boolean = true;
    private showTranslation: boolean = false;
    private immersiveLyricContainer: HTMLElement | null = null;
    private lyricsScrollContainer: HTMLElement | null = null;
    private lyricsInterval: number | null = null;
    private currentLines: any[] = [];
    private lyricElements: HTMLElement[] = [];
    private lyricLines: HTMLElement[] = [];
    private currentLyric: string = '';
    private userScrollOffset: number = 0;
    private lastWheelTime: number = 0;
    private lastActiveLyricIndex: number = -1;
    private currentSongKey: string = '';
    private lastVideoTime: number = 0;
    private lastVideoSrc: string = '';

    // Next Song
    private nextSongIndicator: HTMLElement | null = null;
    private nextSongCheckInterval: number | null = null;
    private nextSongTitle: string = '';
    private nextSongArtist: string = '';
    private nextSongImage: string = '';

    // Mini album art & time display
    private miniThumbElement: HTMLElement | null = null;
    private timeCurrentElement: HTMLElement | null = null;
    private timeDurationElement: HTMLElement | null = null;
    private timeUpdateInterval: number | null = null;

    private boundResizeHandler: (() => void) | null = null;
    private boundActivityHandler: ((e?: Event) => void) | null = null;
    private boundMouseUpHandler: (() => void) | null = null;
    private boundMouseLeaveHandler: (() => void) | null = null;

    // Bottom Bar Proximity & Hover State
    private bottomBarElement: HTMLElement | null = null;
    private bottomBarHideTimeout: number | null = null;
    private isBottomBarHovered: boolean = false;
    private isMouseDownOnBottom: boolean = false;

    constructor(fullscreenPlayer: HTMLElement) {
        this.fullscreenPlayer = fullscreenPlayer;

        // Create fallback element
        this.fallbackElement = document.createElement('div');
        this.fallbackElement.className = 'pear-immersive-fallback';
        this.fullscreenPlayer.appendChild(this.fallbackElement);

        this.monitorVideo();

        // If popout player opens, disable immersive mode to free GPU without clearing user preference
        window.addEventListener('peard:popout-window-opened', () => {
            if (this.isActive) {
                this.disable(false);
            }
        });

        // When lyrical delay offset is changed, immediately re-sync lyrics
        window.addEventListener('peard:lyrics-offset-changed', () => {
            if (this.isActive) {
                this.lastActiveLyricIndex = -1;
                this.updateInteractiveLyrics();
                this.updateCompactLyrics();
            }
        });

        // Clear previous song lyrics when a new song starts
        const handleSongUpdate = (title?: string, artist?: string) => {
            const cleanTitle = (title || '').trim();
            const cleanArtist = (artist || '').trim();
            if (!cleanTitle || cleanTitle === 'No song playing') return;
            const newKey = `${cleanTitle}:::${cleanArtist}`;
            if (newKey !== this.currentSongKey) {
                this.currentSongKey = newKey;
                this.onSongChange();
            }
        };

        document.addEventListener('peard:update-song-info', (e: any) => {
            const info = e.detail;
            handleSongUpdate(info?.title, info?.artist);
        });

        document.addEventListener('videodatachange', (e: any) => {
            const videoData = e?.detail?.videoData;
            handleSongUpdate(videoData?.title, videoData?.author);
        });

        // Restore state if fullscreen player is active
        try {
            const savedState = localStorage.getItem('pear-immersive-mode');
            const savedType = localStorage.getItem('pear-player-type');
            const isImmersive = savedType === 'immersive' || savedState === 'true';
            if (isImmersive && this.fullscreenPlayer.classList.contains('active')) {
                setTimeout(() => {
                    if (this.fullscreenPlayer.classList.contains('active')) {
                        this.enable(false);
                    }
                }, 1000); // Delay to allow player init
            }
        } catch (e) {
            // Failed to restore state
        }
    }

    private getThumbnailUrl(): string | null {
        // Check direct fullscreen elements first via CSS var
        if (this.fullscreenPlayer) {
            const bg = this.fullscreenPlayer.style.getPropertyValue('--bg-image');
            if (bg && bg.includes('url')) {
                const match = bg.match(/url\(["']?(.*?)["']?\)/);
                if (match && match[1]) return match[1];
            }
        }

        // Check image elements
        const selectors = [
            '#pear-fullscreen-thumb-top img',
            '#pear-fullscreen-thumb-bottom img',
            'ytmusic-player-bar yt-img-shadow img',
            '.image.ytmusic-player-bar img',
            '#song-image img',
            '#thumbnail img'
        ];

        for (const sel of selectors) {
            const img = document.querySelector(sel) as HTMLImageElement;
            if (img) {
                const src = img.currentSrc || img.src || img.getAttribute('src');
                if (src && src.startsWith('http') && src !== location.href) {
                    return src;
                }
            }
        }

        // Check meta tags as backup
        const metaImg = document.querySelector('meta[property="og:image"]');
        if (metaImg) {
            const content = metaImg.getAttribute('content');
            if (content && content.startsWith('http')) return content;
        }
        return null;
    }


    private monitorVideo() {
        setInterval(() => {
            if (!this.isActive) return;

            if (!this.videoElement) {
                const foundVideo = document.querySelector('video');
                if (foundVideo) {
                    this.videoElement = foundVideo;
                    this.moveVideoToPlayer();
                }
            }

            const video = this.videoElement || document.querySelector('video');

            if (!video || video.videoHeight === 0 || video.style.display === 'none') {
                this.showFallback();
            } else {
                if (!video.classList.contains('pear-immersive-video') && this.isActive) {
                    video.classList.add('pear-immersive-video');
                }
                this.hideFallback();
            }



        }, 1000);
    }

    private showFallback() {
        this.fullscreenPlayer.classList.add('show-fallback');

        const src = this.getThumbnailUrl();

        if (src) {
            this.fallbackElement.style.backgroundImage = `url('${src}')`;
        } else {
            // Fallback to computed CSS var relative to document if direct extraction fails
            const bg = getComputedStyle(this.fullscreenPlayer).getPropertyValue('--bg-image');
            if (bg && bg !== 'none') {
                this.fallbackElement.style.backgroundImage = bg;
            } else {
                // No fallback image found
            }
        }
    }

    private hideFallback() {
        this.fullscreenPlayer.classList.remove('show-fallback');
        // Clear background if needed, but keeping it might be smoother for transitions
    }

    public toggle(savePreference: boolean = true) {
        if (this.isActive) {
            this.disable(savePreference);
        } else {
            this.enable(savePreference);
        }
        return this.isActive;
    }

    public enable(savePreference: boolean = true) {
        if (this.isActive) return;

        this.videoElement = document.querySelector('video');
        if (!this.videoElement) {
            // No video element found
        }

        this.isActive = true;
        this.fullscreenPlayer.classList.add('immersive-mode');

        // Close pop-out player if open, ensuring only one player uses GPU
        window.dispatchEvent(new CustomEvent('peard:close-popout-player'));

        if (this.videoElement) {
            this.moveVideoToPlayer();
            this.videoElement.classList.add('pear-immersive-video');

            // Force play as moving elements in DOM can pause them in Chrome/Electron
            this.videoElement.play().catch(e => {
                console.warn('[ImmersivePlayer] Failed to play video after move:', e);
            });
        }

        this.setupImmersiveUI();
        this.startLyricsLoop();
        this.startNextSongCheck();

        const btn = document.getElementById('pear-immersive-toggle');
        if (btn) btn.classList.add('active');

        // Pre-initialize current song key and video track from DOM to prevent false song-change triggers on player switch
        const titleEl = document.querySelector('#pear-fullscreen-title, .title.ytmusic-player-bar');
        const artistEl = document.querySelector('#pear-fullscreen-artist, .byline.ytmusic-player-bar');
        const domTitle = titleEl?.textContent?.trim() || '';
        const domArtist = artistEl?.textContent?.trim() || '';
        if (domTitle && domTitle !== 'No song playing') {
            this.currentSongKey = `${domTitle}:::${domArtist}`;
        }
        if (this.videoElement) {
            this.lastVideoSrc = this.videoElement.currentSrc || this.videoElement.src || '';
            this.lastVideoTime = this.videoElement.currentTime;
        }

        // Standard location: ensure lyrics are loaded in store for current track
        ensureLyricsLoaded();

        // Restore Zen Mode state
        const savedZen = localStorage.getItem('pear-immersive-zen');
        if (savedZen === 'true') {
            this.userPreferredZenMode = true;
            if (window.innerWidth >= 800) {
                // Apply Zen Mode immediately without animation if possible
                this.setZenMode(true);
            }
        } else {
            this.userPreferredZenMode = false;
        }

        // Restore Lyrics preference
        const savedLyricsPref = localStorage.getItem('pear-immersive-lyrics');
        if (savedLyricsPref === 'false') {
            this.isInteractiveLyrics = false;
        } else {
            this.isInteractiveLyrics = true;
        }
        if (this.immersiveLyricContainer) {
            this.immersiveLyricContainer.classList.toggle('interactive-mode', this.isInteractiveLyrics);
        }
        const lyricsBtn = document.querySelector('.lyrics-toggle') as HTMLElement;
        if (lyricsBtn) {
            lyricsBtn.classList.toggle('active', this.isInteractiveLyrics);
            lyricsBtn.style.opacity = this.isInteractiveLyrics ? '1' : '0.5';
        }

        // Restore Translation preference
        const savedTranslationPref = localStorage.getItem('pear-immersive-translation');
        if (savedTranslationPref === 'true') {
            this.showTranslation = true;
        } else {
            this.showTranslation = false;
        }
        const translationBtn = document.querySelector('.translation-toggle') as HTMLElement;
        if (translationBtn) {
            translationBtn.classList.toggle('active', this.showTranslation);
            translationBtn.style.opacity = this.showTranslation ? '1' : '0.5';
        }
        if (lyricsBtn) {
            lyricsBtn.classList.toggle('active', this.isInteractiveLyrics);
            lyricsBtn.style.opacity = this.isInteractiveLyrics ? '1' : '0.5';
        }

        // Attach resize handler
        this.boundResizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundResizeHandler!);
        // Initial check
        this.handleResize();

        if (savePreference) {
            localStorage.setItem('pear-immersive-mode', 'true');
            localStorage.setItem('pear-player-type', 'immersive');
        }
    }

    public disable(savePreference: boolean = true) {
        if (!this.isActive) return;

        this.isActive = false;
        this.fullscreenPlayer.classList.remove('immersive-mode');

        if (this.videoElement) {
            this.videoElement.classList.remove('pear-immersive-video');
            this.restoreVideo();
        }

        this.stopLyricsLoop();
        this.stopNextSongCheck();
        this.stopTimeUpdate();
        this.restoreElements();

        const btn = document.getElementById('pear-immersive-toggle');
        if (btn) btn.classList.remove('active');

        // Remove resize handler
        if (this.boundResizeHandler) {
            window.removeEventListener('resize', this.boundResizeHandler);
            this.boundResizeHandler = null;
        }

        // Remove activity handler
        if (this.boundActivityHandler) {
            this.fullscreenPlayer.removeEventListener('mousemove', this.boundActivityHandler);
            this.fullscreenPlayer.removeEventListener('touchstart', this.boundActivityHandler);
            this.boundActivityHandler = null;
        }

        if (this.boundMouseUpHandler) {
            window.removeEventListener('mouseup', this.boundMouseUpHandler);
            this.boundMouseUpHandler = null;
        }

        if (this.boundMouseLeaveHandler) {
            this.fullscreenPlayer.removeEventListener('mouseleave', this.boundMouseLeaveHandler);
            this.boundMouseLeaveHandler = null;
        }

        if (this.bottomBarHideTimeout) {
            clearTimeout(this.bottomBarHideTimeout);
            this.bottomBarHideTimeout = null;
        }

        this.isBottomBarHovered = false;
        this.isMouseDownOnBottom = false;

        if (savePreference) {
            localStorage.setItem('pear-immersive-mode', 'false');
            localStorage.setItem('pear-player-type', 'normal');
        }
    }

    // --- Video Moving Logic ---
    private moveVideoToPlayer() {
        if (!this.videoElement || !this.fullscreenPlayer) return;
        this.originalParent = this.videoElement.parentElement;
        this.originalNextSibling = this.videoElement.nextSibling;
        if (this.fullscreenPlayer.firstChild) {
            this.fullscreenPlayer.insertBefore(this.videoElement, this.fullscreenPlayer.firstChild);
        } else {
            this.fullscreenPlayer.appendChild(this.videoElement);
        }
    }

    private restoreVideo() {
        if (!this.videoElement || !this.originalParent) return;
        try {
            if (this.originalNextSibling) {
                this.originalParent.insertBefore(this.videoElement, this.originalNextSibling);
            } else {
                this.originalParent.appendChild(this.videoElement);
            }
        } catch (e) {
            // Failed to restore video position
            const playerContainer = document.querySelector('#player-video-wrapper') || document.querySelector('#player');
            if (playerContainer) {
                playerContainer.appendChild(this.videoElement);
            }
        }
        this.originalParent = null;
        this.originalNextSibling = null;
    }

    // --- UI Moving Logic ---

    private setupImmersiveUI() {
        // Create container
        this.immersiveContainer = document.createElement('div');
        this.immersiveContainer.className = 'pear-immersive-ui';

        // Lyrics Container (Above controls)
        this.immersiveLyricContainer = document.createElement('div');
        this.immersiveLyricContainer.className = 'pear-immersive-lyrics';

        // Scroll container for interactive lyrics
        this.lyricsScrollContainer = document.createElement('div');
        this.lyricsScrollContainer.className = 'lyrics-scroll-container';
        this.immersiveLyricContainer.appendChild(this.lyricsScrollContainer);

        // Handle User Scrolling
        this.immersiveLyricContainer.addEventListener('wheel', (e) => {
            this.userScrollOffset += e.deltaY;
            this.lastWheelTime = Date.now();
            e.preventDefault();
        }, { passive: false });

        this.immersiveContainer.appendChild(this.immersiveLyricContainer);


        // Next Song Indicator (Right Center)
        this.nextSongIndicator = document.createElement('div');
        this.nextSongIndicator.className = 'pear-immersive-next-song';
        this.immersiveContainer.appendChild(this.nextSongIndicator);

        // Structure for controls
        const bottomBar = document.createElement('div');
        bottomBar.className = 'pear-immersive-bottom-bar';
        this.bottomBarElement = bottomBar;

        bottomBar.addEventListener('mouseenter', () => {
            this.isBottomBarHovered = true;
            if (this.bottomBarHideTimeout) {
                clearTimeout(this.bottomBarHideTimeout);
                this.bottomBarHideTimeout = null;
            }
            this.immersiveContainer?.classList.add('bottom-active');
        });

        bottomBar.addEventListener('mouseleave', (e: MouseEvent) => {
            this.isBottomBarHovered = false;
            if (!this.isMouseDownOnBottom && e.clientY <= window.innerHeight - 180) {
                if (this.bottomBarHideTimeout) clearTimeout(this.bottomBarHideTimeout);
                this.bottomBarHideTimeout = window.setTimeout(() => {
                    if (!this.isBottomBarHovered && !this.isMouseDownOnBottom) {
                        this.immersiveContainer?.classList.remove('bottom-active');
                    }
                    this.bottomBarHideTimeout = null;
                }, 200);
            }
        });

        bottomBar.addEventListener('mousedown', () => {
            this.isMouseDownOnBottom = true;
        });

        // Time display row (below seek bar)
        const timeRow = document.createElement('div');
        timeRow.className = 'pear-immersive-time-row';
        this.timeCurrentElement = document.createElement('span');
        this.timeCurrentElement.className = 'pear-immersive-time';
        this.timeCurrentElement.textContent = '0:00';
        this.timeDurationElement = document.createElement('span');
        this.timeDurationElement.className = 'pear-immersive-time';
        this.timeDurationElement.textContent = '0:00';
        timeRow.appendChild(this.timeCurrentElement);
        timeRow.appendChild(this.timeDurationElement);

        const controlsRow = document.createElement('div');
        controlsRow.className = 'pear-immersive-controls-row';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'pear-immersive-group left';

        const centerGroup = document.createElement('div');
        centerGroup.className = 'pear-immersive-group center';

        const rightGroup = document.createElement('div');
        rightGroup.className = 'pear-immersive-group right';

        // Prevent pointer/click/touch events on sidebar from falling through to lyrics or dismiss handlers
        rightGroup.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        rightGroup.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        rightGroup.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            this.immersiveContainer?.classList.add('sidebar-active');
        }, { passive: true });

        controlsRow.appendChild(leftGroup);
        controlsRow.appendChild(centerGroup);
        controlsRow.appendChild(rightGroup);
        bottomBar.appendChild(timeRow);
        bottomBar.appendChild(controlsRow);
        this.immersiveContainer.appendChild(bottomBar);

        this.fullscreenPlayer.appendChild(this.immersiveContainer);

        // Mini album art thumbnail
        this.miniThumbElement = document.createElement('div');
        this.miniThumbElement.className = 'pear-immersive-mini-thumb';
        leftGroup.appendChild(this.miniThumbElement);

        // Move Elements
        // Create a wrapper for text so we can align like button next to it
        const textContainer = document.createElement('div');
        textContainer.className = 'pear-immersive-text-container';
        leftGroup.appendChild(textContainer);

        this.moveElement('#pear-fullscreen-title', textContainer);
        this.moveElement('#pear-fullscreen-artist', textContainer);

        // Add Like button next to text
        this.moveElement('#pear-fullscreen-like', leftGroup);

        this.moveElement('#pear-fullscreen-prev', centerGroup);
        this.moveElement('#pear-fullscreen-play', centerGroup);
        this.moveElement('#pear-fullscreen-next', centerGroup);

        this.fullscreenPlayer.querySelector('#pear-fullscreen-prev')?.addEventListener('click', () => {
            this.onSongChange();
        });
        this.fullscreenPlayer.querySelector('#pear-fullscreen-next')?.addEventListener('click', () => {
            this.onSongChange();
        });

        const volumeDiv = this.fullscreenPlayer.querySelector('.pear-fullscreen-volume') as HTMLElement;
        if (volumeDiv) {
            this.moveElementRef(volumeDiv, centerGroup);
        } else {
            // Create a custom volume slider if not found
            const customVolume = document.createElement('div');
            customVolume.className = 'pear-fullscreen-volume';
            customVolume.innerHTML = `
                <button class="pear-fullscreen-btn volume-btn" title="Mute/Unmute">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path class="volume-high-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path class="volume-high-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        <line class="volume-mute" x1="23" y1="9" x2="17" y2="15" style="display: none;"/>
                        <line class="volume-mute-2" x1="17" y1="9" x2="23" y2="15" style="display: none;"/>
                    </svg>
                </button>
                <div class="pear-fullscreen-volume-slider-container">
                    <input type="range" min="0" max="100" value="100" class="pear-fullscreen-volume-slider">
                </div>
            `;
            rightGroup.insertBefore(customVolume, rightGroup.firstChild);

            rightGroup.insertBefore(customVolume, rightGroup.firstChild);

            const video = document.querySelector('video');
            const slider = customVolume.querySelector('input') as HTMLInputElement;
            const muteBtn = customVolume.querySelector('.volume-btn') as HTMLButtonElement;
            const muteIcon1 = customVolume.querySelector('.volume-mute') as SVGLineElement;
            const muteIcon2 = customVolume.querySelector('.volume-mute-2') as SVGLineElement;
            const highIcon1 = customVolume.querySelector('.volume-high-1') as SVGPathElement;
            const highIcon2 = customVolume.querySelector('.volume-high-2') as SVGPathElement;

            // Initialize
            if (video) {
                slider.value = String(video.volume * 100);
            }

            const updateIcons = (vol: number, muted: boolean) => {
                if (vol === 0 || muted) {
                    muteIcon1.style.display = 'block';
                    muteIcon2.style.display = 'block';
                    highIcon1.style.display = 'none';
                    highIcon2.style.display = 'none';
                } else {
                    muteIcon1.style.display = 'none';
                    muteIcon2.style.display = 'none';
                    highIcon1.style.display = 'block';
                    highIcon2.style.display = vol > 0.5 ? 'block' : 'none';
                }
            };

            slider.addEventListener('input', () => {
                if (video) {
                    const vol = parseInt(slider.value) / 100;
                    video.volume = vol;
                    video.muted = false;
                    updateIcons(vol, false);
                }
            });

            muteBtn.addEventListener('click', () => {
                if (video) {
                    video.muted = !video.muted;
                    slider.value = video.muted ? '0' : String(video.volume * 100);
                    updateIcons(video.volume, video.muted);
                }
            });
        }

        // Zen Mode Toggle
        const zenToggle = document.createElement('button');
        zenToggle.className = 'pear-immersive-btn zen-toggle';
        zenToggle.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12h8"></path> <!-- A simple minus or eye-off symbol -->
            </svg>
        `;
        zenToggle.title = "Toggle Zen Mode";
        zenToggle.onclick = (e) => {
            e.stopPropagation();
            this.toggleZenMode();
        };
        rightGroup.appendChild(zenToggle);

        // Lyrics Toggle
        const lyricsToggle = document.createElement('button');
        lyricsToggle.className = 'pear-immersive-btn lyrics-toggle active';
        lyricsToggle.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        `;
        lyricsToggle.title = "Toggle Lyrics";
        lyricsToggle.onclick = (e) => {
            e.stopPropagation();
            this.toggleLyricsMode();
        };
        rightGroup.appendChild(lyricsToggle);

        // Translation Toggle
        const translationToggle = document.createElement('button');
        translationToggle.className = 'pear-immersive-btn translation-toggle';
        translationToggle.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 8l6 6"></path>
                <path d="M4 14l6-6 2-3"></path>
                <path d="M2 5h12"></path>
                <path d="M7 2h1"></path>
                <path d="M22 22l-5-10-5 10"></path>
                <path d="M14 18h6"></path>
            </svg>
        `;
        translationToggle.title = "Toggle Translation";
        translationToggle.onclick = (e) => {
            e.stopPropagation();
            this.toggleTranslationMode();
        };
        rightGroup.appendChild(translationToggle);

        // Activity listener to reveal controls (sidebar, zen mode, and bottom bar proximity)
        this.boundActivityHandler = (e?: Event) => {
            this.immersiveContainer?.classList.add('ui-active');
            
            // Sidebar logic: in phone mode (width <= 640), activate sidebar on user activity
            // or if touch/mouse is on the right side
            let isRightSide = false;
            let isBottomZone = false;
            if (e) {
                if (e instanceof MouseEvent) {
                    isRightSide = e.clientX > window.innerWidth * 0.55;
                    isBottomZone = e.clientY > window.innerHeight - 180;
                } else if (window.TouchEvent && e instanceof TouchEvent && e.touches.length > 0) {
                    isRightSide = e.touches[0].clientX > window.innerWidth * 0.55;
                    isBottomZone = e.touches[0].clientY > window.innerHeight - 180;
                }
            } else {
                // Default to right side and bottom if triggered programmatically
                isRightSide = true;
                isBottomZone = true;
            }

            if (window.innerWidth <= 640 || isRightSide) {
                this.immersiveContainer?.classList.add('sidebar-active');
            } else {
                this.immersiveContainer?.classList.remove('sidebar-active');
            }

            // Bottom bar proximity reveal: in phone mode (width <= 640), bottom bar is permanent unless in zenMode; on desktop, it auto-hides
            if (window.innerWidth <= 640 && !this.zenMode) {
                if (this.bottomBarHideTimeout) {
                    clearTimeout(this.bottomBarHideTimeout);
                    this.bottomBarHideTimeout = null;
                }
                this.immersiveContainer?.classList.add('bottom-active');
            } else {
                const isHovered = this.isBottomBarHovered || (this.bottomBarElement?.matches(':hover') ?? false);
                if (isBottomZone || isHovered || this.isMouseDownOnBottom) {
                    if (this.bottomBarHideTimeout) {
                        clearTimeout(this.bottomBarHideTimeout);
                        this.bottomBarHideTimeout = null;
                    }
                    this.immersiveContainer?.classList.add('bottom-active');
                    if (this.zenMode) {
                        this.immersiveContainer?.classList.add('zen-temp-show');
                    }
                } else {
                    // Cursor moved away from the bottom zone
                    if (!this.bottomBarHideTimeout && !isHovered && !this.isMouseDownOnBottom) {
                        this.bottomBarHideTimeout = window.setTimeout(() => {
                            const stillHovered = this.isBottomBarHovered || (this.bottomBarElement?.matches(':hover') ?? false);
                            if (!stillHovered && !this.isMouseDownOnBottom) {
                                this.immersiveContainer?.classList.remove('bottom-active');
                                if (this.zenMode) {
                                    this.immersiveContainer?.classList.remove('zen-temp-show');
                                }
                            }
                            this.bottomBarHideTimeout = null;
                        }, 250);
                    }
                }
            }
            
            if (this.zenModeTimeout) clearTimeout(this.zenModeTimeout);
            this.zenModeTimeout = window.setTimeout(() => {
                this.immersiveContainer?.classList.remove('ui-active');

                // Keep sidebar visible if it is currently hovered or focused
                const rightGroupEl = this.fullscreenPlayer.querySelector('.pear-immersive-group.right');
                const isSidebarHovered = rightGroupEl ? (rightGroupEl.matches(':hover') || rightGroupEl.matches(':focus-within')) : false;
                if (!isSidebarHovered) {
                    this.immersiveContainer?.classList.remove('sidebar-active');
                }

                this.immersiveContainer?.classList.remove('zen-temp-show');

                // In Zen mode, auto hide bottom bar when completely idle to reveal ONLY the slider
                if (this.zenMode) {
                    if (!this.isBottomBarHovered && !this.isMouseDownOnBottom) {
                        this.immersiveContainer?.classList.remove('bottom-active');
                    }
                } else if (window.innerWidth > 640 && !this.isBottomBarHovered && !this.isMouseDownOnBottom) {
                    this.immersiveContainer?.classList.remove('bottom-active');
                }
            }, 3000);
        };

        // Attach to fullscreenPlayer so it triggers across the whole window
        this.fullscreenPlayer.addEventListener('mousemove', this.boundActivityHandler);
        this.fullscreenPlayer.addEventListener('touchstart', this.boundActivityHandler, { passive: true });

        // Mouseup & mouseleave listeners to ensure drag state and exit behavior are tracked cleanly
        this.boundMouseUpHandler = () => {
            this.isMouseDownOnBottom = false;
        };
        window.addEventListener('mouseup', this.boundMouseUpHandler);

        this.boundMouseLeaveHandler = () => {
            if (window.innerWidth > 640 && !this.isMouseDownOnBottom) {
                this.isBottomBarHovered = false;
                this.immersiveContainer?.classList.remove('bottom-active');
            }
        };
        this.fullscreenPlayer.addEventListener('mouseleave', this.boundMouseLeaveHandler);

        // Initially show bottom bar briefly so user is aware of controls, then auto-hide if cursor is not at bottom (desktop only)
        this.immersiveContainer?.classList.add('bottom-active');
        if (this.bottomBarHideTimeout) clearTimeout(this.bottomBarHideTimeout);
        this.bottomBarHideTimeout = window.setTimeout(() => {
            if (window.innerWidth > 640 && !this.isBottomBarHovered && !this.isMouseDownOnBottom) {
                this.immersiveContainer?.classList.remove('bottom-active');
            }
            this.bottomBarHideTimeout = null;
        }, 2800);

        // Removed Queue and Lyrics buttons moving

        this.moveElement('#pear-fullscreen-sleep-btn', rightGroup);
        this.moveElement('#pear-fullscreen-sync-btn', rightGroup);
        this.moveElement('#pear-immersive-toggle', rightGroup);
        this.moveElement('#pear-fullscreen-close', rightGroup);

        this.moveElement('#pear-fullscreen-seek', bottomBar, true);

        // Start time update interval
        this.startTimeUpdate();
    }

    private moveElement(selector: string, target: HTMLElement, prepend: boolean = false) {
        const el = this.fullscreenPlayer.querySelector(selector) as HTMLElement;
        if (el) {
            this.moveElementRef(el, target, prepend);
        }
    }

    private moveElementRef(el: HTMLElement, target: HTMLElement, prepend: boolean = false) {
        this.movedElements.set(el, {
            parent: el.parentElement as HTMLElement,
            sibling: el.nextSibling
        });

        if (prepend && target.firstChild) {
            target.insertBefore(el, target.firstChild);
        } else {
            target.appendChild(el);
        }
    }

    private restoreElements() {
        for (const [el, original] of Array.from(this.movedElements.entries()).reverse()) {
            try {
                if (original.sibling) {
                    original.parent.insertBefore(el, original.sibling);
                } else {
                    original.parent.appendChild(el);
                }
            } catch (e) {
                // Failed to restore element
            }
        }
        this.movedElements.clear();

        if (this.immersiveContainer) {
            this.immersiveContainer.remove();
            this.immersiveContainer = null;
        }
        this.immersiveLyricContainer = null;
        this.lyricsScrollContainer = null;
        this.lyricElements = [];
        this.lyricLines = [];
        this.currentLines = [];
        this.userScrollOffset = 0;
        this.nextSongIndicator = null;
        this.bottomBarElement = null;
        this.miniThumbElement = null;
        this.timeCurrentElement = null;
        this.timeDurationElement = null;
    }

    // --- Lyrics Logic ---
    private startLyricsLoop() {
        if (this.lyricsInterval) clearInterval(this.lyricsInterval);

        // Reset state
        this.currentLines = [];
        if (this.lyricsScrollContainer) {
            this.lyricsScrollContainer.innerHTML = '';
        }
        this.lyricElements = [];
        this.lyricLines.forEach(l => l.remove());
        this.lyricLines = [];
        this.currentLyric = '';
        this.lastActiveLyricIndex = -1;

        this.lyricsInterval = window.setInterval(() => {
            if (document.hidden || !this.isActive) return;
            const video = document.querySelector('video');
            if (video && video.paused) return;

            // Detect new song via video src change or video track restart
            if (video) {
                const currentSrc = video.currentSrc || video.src || '';
                if (currentSrc && this.lastVideoSrc && currentSrc !== this.lastVideoSrc) {
                    this.lastVideoSrc = currentSrc;
                    this.onSongChange();
                } else if (currentSrc) {
                    this.lastVideoSrc = currentSrc;
                }

                if (this.lastVideoTime > 3 && video.currentTime < 1) {
                    this.onSongChange();
                }
                this.lastVideoTime = video.currentTime;
            }

            // Detect title change directly from DOM in case event was not caught
            const titleEl = document.querySelector('#pear-fullscreen-title, .title.ytmusic-player-bar');
            const artistEl = document.querySelector('#pear-fullscreen-artist, .byline.ytmusic-player-bar');
            const domTitle = titleEl?.textContent?.trim() || '';
            const domArtist = artistEl?.textContent?.trim() || '';
            if (domTitle && domTitle !== 'No song playing') {
                const domKey = `${domTitle}:::${domArtist}`;
                if (domKey !== this.currentSongKey) {
                    this.currentSongKey = domKey;
                    this.onSongChange();
                }
            }

            if (this.isInteractiveLyrics) {
                this.lyricLines.forEach(l => l.style.display = 'none');
                this.updateInteractiveLyrics();
            } else {
                this.lyricLines.forEach(l => l.style.display = 'block');
                this.updateCompactLyrics();
            }
        }, 100); // Run faster for smoother scrolling & tracking
    }

    public onSongChange() {
        this.clearCompactLyrics();
        this.currentLines = [];
        this.lastActiveLyricIndex = -1;
        this.userScrollOffset = 0;
        try {
            clearLyricsState();
        } catch (e) { }
        if (this.lyricsScrollContainer) {
            this.lyricsScrollContainer.innerHTML = '';
        }
        this.lyricElements = [];
        ensureLyricsLoaded();
    }

    public clearCompactLyrics() {
        this.currentLyric = '';
        if (this.lyricLines && this.lyricLines.length > 0) {
            this.lyricLines.forEach(l => l.remove());
            this.lyricLines = [];
        }
        if (this.immersiveLyricContainer) {
            const oldLines = this.immersiveLyricContainer.querySelectorAll('.lyric-line');
            oldLines.forEach(l => l.remove());
        }
    }

    private updateCompactLyrics() {
        // Pass false for fallbackToSymbol to avoid displaying symbols as lyrics or keeping stale lines
        const text = getCurrentLyricText(this.showTranslation, false);
        if (text && text !== this.currentLyric) {
            this.currentLyric = text;
            this.addLyricLine(text);
        } else if (!text && (this.lyricLines.length > 0 || this.currentLyric !== '')) {
            this.clearCompactLyrics();
        }
    }

    private addLyricLine(text: string) {
        if (!this.immersiveLyricContainer) return;

        // Create new line
        const p = document.createElement('p');
        p.className = 'lyric-line entering';
        p.innerText = text;
        this.immersiveLyricContainer.appendChild(p);

        // Smooth transition to active on next animation frame
        requestAnimationFrame(() => {
            p.className = 'lyric-line active';
        });

        // Add to tracking
        this.lyricLines.push(p);

        // Update previous lines smoothly
        for (let i = this.lyricLines.length - 2; i >= 0; i--) {
            const line = this.lyricLines[i];
            const age = this.lyricLines.length - 1 - i;

            if (age > 1) { // Only keep 1 previous line
                line.className = 'lyric-line prev-older';
                setTimeout(() => line.remove(), 450);
                this.lyricLines.splice(i, 1);
            } else {
                line.className = 'lyric-line prev-1';
            }
        }
    }

    private updateInteractiveLyrics() {
        if (!this.lyricsScrollContainer || !this.immersiveLyricContainer) return;

        const lines = getAllLyrics();
        const video = document.querySelector('video');
        if (!video) return;

        // If lyrics are not yet loaded into memory, request standard loader to fetch them
        if (lines.length === 0) {
            ensureLyricsLoaded();
            if (this.lyricsScrollContainer) {
                this.lyricsScrollContainer.style.transform = `translate3d(0, 0, 0)`;
            }
            return;
        }

        const offset = (window as any).pearLyricsOffset || 0;
        const time = (video.currentTime * 1000) + offset; // ms with lyrical delay applied

        // If lyrics changed or elements haven't been built yet, rebuild the DOM
        const needsRebuild = (lines !== this.currentLines) || (this.lyricElements.length === 0 && lines.length > 0);
        if (needsRebuild) {
            this.currentLines = lines;
            this.lyricsScrollContainer.innerHTML = '';
            this.lyricElements = [];
            this.lastActiveLyricIndex = -1;

            this.userScrollOffset = 0; // reset scroll

            this.currentLines.forEach((line: any) => {
                const p = document.createElement('p');
                p.className = 'lyric-line-interactive';
                p.innerText = line.text;

                if (this.showTranslation) {
                    getRomanizedLyric(line.text).then(romanized => {
                        if (romanized) {
                            const span = document.createElement('div');
                            span.className = 'lyric-romanized';
                            span.innerText = romanized;
                            p.appendChild(span);
                        }
                    });
                }

                // Click to seek accurately accounting for delay offset
                p.addEventListener('click', () => {
                    if (video) {
                        const curOffset = (window as any).pearLyricsOffset || 0;
                        video.currentTime = Math.max(0, (line.timeInMs - curOffset) / 1000);
                        this.userScrollOffset = 0; // SNAP back to center
                    }
                });

                this.lyricsScrollContainer!.appendChild(p);
                this.lyricElements.push(p);
            });
        }

        if (this.currentLines.length === 0) {
            this.lyricsScrollContainer.style.transform = `translate3d(0, 0, 0)`;
            return;
        }

        // Find active line index
        let activeIndex = 0;
        for (let i = 0; i < this.currentLines.length; i++) {
            if (time >= this.currentLines[i].timeInMs) {
                // Keep moving active index forward
                activeIndex = i;
            } else {
                break;
            }
        }

        // Apply classes only when active index has changed (avoids DOM thrashing & transition cancellations)
        if (activeIndex !== this.lastActiveLyricIndex) {
            this.lastActiveLyricIndex = activeIndex;
            for (let i = 0; i < this.lyricElements.length; i++) {
                const el = this.lyricElements[i];
                const diff = i - activeIndex;

                if (diff === 0) {
                    el.className = 'lyric-line-interactive active';
                } else if (diff < 0) {
                    el.className = 'lyric-line-interactive past';
                } else {
                    el.className = 'lyric-line-interactive next';
                }
            }
        }

        // Auto-center logic with user scroll offset
        const activeElement = this.lyricElements[activeIndex];
        if (activeElement) {
            const containerHeight = this.immersiveLyricContainer.offsetHeight;
            const elementOffsetFromScrollContainer = activeElement.offsetTop;
            const elementHeight = activeElement.offsetHeight;

            // In zen mode (idle), shift the active line lower by 36px to fill the space where controls were
            const isZenIdle = this.zenMode &&
                !this.immersiveContainer?.classList.contains('bottom-active') &&
                !this.immersiveContainer?.classList.contains('zen-temp-show');
            const zenShift = isZenIdle ? 36 : 0;

            // Target scroll so activeElement is centered (with zen shift applied)
            const targetScrollCenter = elementOffsetFromScrollContainer - (containerHeight / 2) + (elementHeight / 2) - zenShift;

            // Smoothly reduce userScrollOffset if no interaction for a bit -> "snap back"
            if (Date.now() - this.lastWheelTime > 3000 && Math.abs(this.userScrollOffset) > 1) {
                this.userScrollOffset -= this.userScrollOffset * 0.05;
            }

            const currentTranslation = Math.round(-(targetScrollCenter + this.userScrollOffset));
            this.lyricsScrollContainer.style.transform = `translate3d(0, ${currentTranslation}px, 0)`;
        }
    }

    private handleResize() {
        if (!this.isActive) return;
        const width = window.innerWidth;

        // Manage volume position
        const volumeDiv = this.fullscreenPlayer.querySelector('.pear-fullscreen-volume');
        const centerGroup = this.fullscreenPlayer.querySelector('.pear-immersive-group.center');
        const rightGroup = this.fullscreenPlayer.querySelector('.pear-immersive-group.right');
        
        if (volumeDiv && centerGroup && rightGroup) {
            if (width <= 640) {
                if (volumeDiv.parentElement !== rightGroup) {
                    rightGroup.insertBefore(volumeDiv, rightGroup.firstChild);
                }
            } else {
                if (volumeDiv.parentElement !== centerGroup) {
                    centerGroup.appendChild(volumeDiv);
                }
            }
        }

        if (width <= 640 && !this.zenMode) {
            this.immersiveContainer?.classList.add('bottom-active');
        }

        // Restore user preference across all screen sizes
        if (this.userPreferredZenMode && !this.zenMode) {
            this.setZenMode(true, false);
        }
    }

    private toggleZenMode() {
        this.setZenMode(!this.zenMode, true);
    }

    private setZenMode(enabled: boolean, updatePreference: boolean = true) {
        if (this.zenMode === enabled && this.immersiveContainer?.classList.contains('zen-mode') === enabled) return;

        if (updatePreference) {
            this.userPreferredZenMode = enabled;
            localStorage.setItem('pear-immersive-zen', String(enabled));
        }

        this.zenMode = enabled;
        if (this.immersiveContainer) {
            this.immersiveContainer.classList.toggle('zen-mode', this.zenMode);
            if (this.zenMode) {
                this.immersiveContainer.classList.remove('bottom-active');
                this.immersiveContainer.classList.remove('zen-temp-show');
            } else if (window.innerWidth <= 640) {
                this.immersiveContainer.classList.add('bottom-active');
            }
        }
        const btn = document.querySelector('.zen-toggle');
        if (btn) btn.classList.toggle('active', this.zenMode);

        // Force reflow/update for transitions
        if (this.zenMode) {
            // Ensure components that should be hidden are hidden
            this.checkNextSong();
        } else {
            // Reset visibility logic
            if (this.nextSongIndicator) {
                this.nextSongIndicator.style.opacity = '';
            }
            this.checkNextSong();
        }
    }

    private toggleLyricsMode() {
        this.isInteractiveLyrics = !this.isInteractiveLyrics;

        // Save preference
        localStorage.setItem('pear-immersive-lyrics', String(this.isInteractiveLyrics));

        if (this.immersiveLyricContainer) {
            this.immersiveLyricContainer.classList.toggle('interactive-mode', this.isInteractiveLyrics);
        }

        const btn = document.querySelector('.lyrics-toggle') as HTMLElement;
        if (btn) {
            btn.classList.toggle('active', this.isInteractiveLyrics);
            // Gray out the icon if disabled
            btn.style.opacity = this.isInteractiveLyrics ? '1' : '0.5';
        }
    }

    private toggleTranslationMode() {
        this.showTranslation = !this.showTranslation;
        localStorage.setItem('pear-immersive-translation', String(this.showTranslation));

        const btn = document.querySelector('.translation-toggle') as HTMLElement;
        if (btn) {
            btn.classList.toggle('active', this.showTranslation);
            btn.style.opacity = this.showTranslation ? '1' : '0.5';
        }

        // Re-render lyrics
        this.currentLines = [];
        if (this.lyricsScrollContainer) {
            this.lyricsScrollContainer.innerHTML = '';
        }
    }

    private stopLyricsLoop() {
        if (this.lyricsInterval) {
            clearInterval(this.lyricsInterval);
            this.lyricsInterval = null;
        }
    }

    // --- Time Display Logic ---
    private formatTime(seconds: number): string {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private startTimeUpdate() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = window.setInterval(() => {
            const video = document.querySelector('video');
            if (!video) return;

            // Update time labels
            if (this.timeCurrentElement) {
                this.timeCurrentElement.textContent = this.formatTime(video.currentTime);
            }
            if (this.timeDurationElement) {
                this.timeDurationElement.textContent = this.formatTime(video.duration);
            }

            // Update mini album art
            if (this.miniThumbElement) {
                const src = this.getThumbnailUrl();
                if (src) {
                    const currentBg = this.miniThumbElement.style.backgroundImage;
                    const newBg = `url('${src}')`;
                    if (currentBg !== newBg) {
                        this.miniThumbElement.style.backgroundImage = newBg;
                    }
                }
            }
        }, 500);
    }

    private stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }


    // --- Next Song Logic ---
    private startNextSongCheck() {
        if (this.nextSongCheckInterval) clearInterval(this.nextSongCheckInterval);
        this.nextSongCheckInterval = window.setInterval(() => {
            this.checkNextSong();
        }, 1000);
    }

    private stopNextSongCheck() {
        if (this.nextSongCheckInterval) {
            clearInterval(this.nextSongCheckInterval);
            this.nextSongCheckInterval = null;
        }
    }

    private checkNextSong() {
        const video = document.querySelector('video');
        if (!video || !this.nextSongIndicator) return;

        const timeLeft = video.duration - video.currentTime;
        let shouldShow = false;

        // Show if less than 20 seconds left
        if (timeLeft <= 20 && timeLeft > 0) {
            const selectedItem = document.querySelector('ytmusic-player-queue-item[selected]');
            const nextItem = selectedItem?.nextElementSibling as HTMLElement;

            if (nextItem) {
                const title = nextItem.querySelector('.song-title, .title, #video-title')?.textContent?.trim() || '';
                const artist = nextItem.querySelector('.byline, .artist, #byline')?.textContent?.trim() || '';

                if (title) { // Only show if we have a title
                    shouldShow = true; // We found a valid next song

                    // Robust image extraction
                    const imgElement = nextItem.querySelector('img') as HTMLImageElement;
                    let img = '';
                    if (imgElement) {
                        img = imgElement.currentSrc || imgElement.src || imgElement.getAttribute('src') || '';
                    }

                    // If it's a placeholder or broken URL, try to find a better one
                    if (!img || img.startsWith('data:') || img === location.href) {
                        const fallbackImg = nextItem.querySelector('yt-img-shadow img, ytmusic-thumbnail-renderer img, .thumbnail img') as HTMLImageElement;
                        if (fallbackImg) {
                            img = fallbackImg.currentSrc || fallbackImg.src || fallbackImg.getAttribute('src') || '';
                        }
                    }

                    if (title !== this.nextSongTitle || img !== this.nextSongImage) {
                        this.nextSongTitle = title;
                        this.nextSongArtist = artist;
                        this.nextSongImage = img;
                        this.renderNextSong(true);
                    } else if (this.nextSongTitle) {
                        // Ensure it's rendered if we have data
                        if (!this.nextSongIndicator.classList.contains('visible') && !this.zenMode) {
                            this.renderNextSong(true);
                        }
                    }
                }
            }
        }

        if (!shouldShow) {
            if (this.nextSongIndicator.classList.contains('visible')) {
                this.nextSongIndicator.classList.remove('visible');
                // Immediately ensure opacity 0 via inline style if needed, 
                // but relying on class is better if logic is sound.
                // Just force clear content after a bit

                const indicator = this.nextSongIndicator;
                setTimeout(() => {
                    if (indicator && !indicator.classList.contains('visible')) {
                        indicator.innerHTML = '';
                        indicator.style.visibility = 'hidden'; // Force hidden property
                    }
                }, 500);
            } else {
                // Ensure it's hidden if we think it should be
                if (this.nextSongIndicator.style.visibility !== 'hidden' && !this.zenMode) {
                    // Only force if we are sure? 
                    // Actually, if !visible class, CSS should handle it. 
                    // But let's be safe.
                }
            }
        } else {
            if (this.nextSongIndicator.style.visibility === 'hidden') {
                this.nextSongIndicator.style.visibility = ''; // Reset
            }
        }
    }

    private renderNextSong(visible: boolean) {
        if (!this.nextSongIndicator) return;

        if (visible) {
            const hasImage = this.nextSongImage && !this.nextSongImage.startsWith('data:') && this.nextSongImage !== location.href;
            const placeholderSvg = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" width="24" height="24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

            this.nextSongIndicator.innerHTML = `
                <div class="next-song-label">Up Next</div>
                <div class="next-song-content">
                    <div class="next-song-image-container">
                        ${hasImage ?
                    `<img src="${this.nextSongImage}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
                             <div class="next-song-placeholder" style="display:none">${placeholderSvg}</div>` :
                    `<div class="next-song-placeholder">${placeholderSvg}</div>`
                }
                    </div>
                    <div class="next-song-info">
                        <div class="next-song-title">${this.nextSongTitle}</div>
                        <div class="next-song-artist">${this.nextSongArtist}</div>
                    </div>
                </div>
            `;
            this.nextSongIndicator.classList.add('visible');
        }
    }
}
