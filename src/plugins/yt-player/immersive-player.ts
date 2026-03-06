import { mountLyrics, unmountLyrics, getAllLyrics, getRomanizedLyric, getCurrentLyricText } from './lyrics-wrapper';

export class ImmersivePlayer {
    private isActive: boolean = false;
    private fullscreenPlayer: HTMLElement;
    private videoElement: HTMLVideoElement | null = null;
    private fallbackElement: HTMLElement;

    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;

    private immersiveContainer: HTMLElement | null = null;
    private movedElements: Map<HTMLElement, { parent: HTMLElement, sibling: Node | null }> = new Map();
    private hiddenLyricsContainer: HTMLElement | null = null;

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

    // Next Song
    private nextSongIndicator: HTMLElement | null = null;
    private nextSongCheckInterval: number | null = null;
    private nextSongTitle: string = '';
    private nextSongArtist: string = '';
    private nextSongImage: string = '';

    private boundResizeHandler: (() => void) | null = null;

    constructor(fullscreenPlayer: HTMLElement) {
        this.fullscreenPlayer = fullscreenPlayer;

        // Create fallback element
        this.fallbackElement = document.createElement('div');
        this.fallbackElement.className = 'pear-immersive-fallback';
        this.fullscreenPlayer.appendChild(this.fallbackElement);

        this.monitorVideo();

        // Restore state
        try {
            const savedState = localStorage.getItem('pear-immersive-mode');
            if (savedState === 'true') {
                setTimeout(() => {
                    this.enable();
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
            this.fallbackElement.style.opacity = '1';
        } else {
            // Fallback to computed CSS var relative to document if direct extraction fails
            const bg = getComputedStyle(this.fullscreenPlayer).getPropertyValue('--bg-image');
            if (bg && bg !== 'none') {
                this.fallbackElement.style.backgroundImage = bg;
                this.fallbackElement.style.opacity = '1';
            } else {
                // No fallback image found
            }
        }
    }

    private hideFallback() {
        this.fullscreenPlayer.classList.remove('show-fallback');
        // Clear background if needed, but keeping it might be smoother for transitions
    }

    public toggle() {
        if (this.isActive) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isActive;
    }

    public enable() {
        this.videoElement = document.querySelector('video');
        if (!this.videoElement) {
            // No video element found
        }

        this.isActive = true;
        this.fullscreenPlayer.classList.add('immersive-mode');

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

        // Force mount lyrics to ensure data fetching (mimic opening lyrics panel)
        this.hiddenLyricsContainer = document.createElement('div');
        this.hiddenLyricsContainer.style.display = 'none';
        document.body.appendChild(this.hiddenLyricsContainer);
        mountLyrics(this.hiddenLyricsContainer);

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

        localStorage.setItem('pear-immersive-mode', 'true');
    }

    public disable() {
        this.isActive = false;
        this.fullscreenPlayer.classList.remove('immersive-mode');

        if (this.videoElement) {
            this.videoElement.classList.remove('pear-immersive-video');
            this.restoreVideo();
        }

        this.stopLyricsLoop();
        this.stopNextSongCheck();
        this.restoreElements();

        const btn = document.getElementById('pear-immersive-toggle');
        if (btn) btn.classList.remove('active');

        // Unmount lyrics
        if (this.hiddenLyricsContainer) {
            unmountLyrics();
            this.hiddenLyricsContainer.remove();
            this.hiddenLyricsContainer = null;
        }

        // Remove resize handler
        if (this.boundResizeHandler) {
            window.removeEventListener('resize', this.boundResizeHandler);
            this.boundResizeHandler = null;
        }

        localStorage.setItem('pear-immersive-mode', 'false');
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

        const controlsRow = document.createElement('div');
        controlsRow.className = 'pear-immersive-controls-row';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'pear-immersive-group left';

        const centerGroup = document.createElement('div');
        centerGroup.className = 'pear-immersive-group center';

        const rightGroup = document.createElement('div');
        rightGroup.className = 'pear-immersive-group right';

        controlsRow.appendChild(leftGroup);
        controlsRow.appendChild(centerGroup);
        controlsRow.appendChild(rightGroup);
        bottomBar.appendChild(controlsRow);
        this.immersiveContainer.appendChild(bottomBar);

        this.fullscreenPlayer.appendChild(this.immersiveContainer);

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

        const volumeDiv = this.fullscreenPlayer.querySelector('.pear-fullscreen-volume') as HTMLElement;
        if (volumeDiv) {
            this.moveElementRef(volumeDiv, rightGroup);
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
        zenToggle.onclick = () => this.toggleZenMode();
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
        lyricsToggle.onclick = () => this.toggleLyricsMode();
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
        translationToggle.onclick = () => this.toggleTranslationMode();
        rightGroup.appendChild(translationToggle);

        // Hover listener to reveal controls in Zen Mode
        this.immersiveContainer.addEventListener('mousemove', () => {
            if (this.zenMode) {
                this.immersiveContainer?.classList.add('zen-temp-show');
                if (this.zenModeTimeout) clearTimeout(this.zenModeTimeout);
                this.zenModeTimeout = window.setTimeout(() => {
                    this.immersiveContainer?.classList.remove('zen-temp-show');
                }, 3000);
            }
        });

        // Removed Queue and Lyrics buttons moving

        this.moveElement('#pear-immersive-toggle', rightGroup);
        this.moveElement('#pear-fullscreen-close', rightGroup);

        this.moveElement('#pear-fullscreen-seek', bottomBar, true);
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

        this.lyricsInterval = window.setInterval(() => {
            if (this.isInteractiveLyrics) {
                this.lyricLines.forEach(l => l.style.display = 'none');
                this.updateInteractiveLyrics();
            } else {
                this.lyricLines.forEach(l => l.style.display = 'block');
                this.updateCompactLyrics();
            }
        }, 100); // Run faster for smoother scrolling & tracking
    }

    private updateCompactLyrics() {
        const text = getCurrentLyricText(this.showTranslation);
        if (text && text !== this.currentLyric) {
            this.currentLyric = text;
            this.addLyricLine(text);
        } else if (!text && this.lyricLines.length > 0) {
            // Wait for new lyrics
        }
    }

    private addLyricLine(text: string) {
        if (!this.immersiveLyricContainer) return;

        // Create new line
        const p = document.createElement('p');
        p.className = 'lyric-line entering';
        p.innerText = text;
        this.immersiveLyricContainer.appendChild(p);

        // Force reflow
        p.offsetHeight;

        p.className = 'lyric-line active';

        // Add to tracking
        this.lyricLines.push(p);

        // We iterate backwards from the 2nd to last element
        for (let i = this.lyricLines.length - 2; i >= 0; i--) {
            const line = this.lyricLines[i];
            const age = this.lyricLines.length - 1 - i;

            if (age > 1) { // Only keep 1 previous line
                line.style.opacity = '0';
                line.style.transform = 'translateY(-60px) scale(0.6) rotateX(20deg)';
                setTimeout(() => line.remove(), 500);
                this.lyricLines.splice(i, 1);
            } else {
                let translateY = -50;
                const activeHeight = p.offsetHeight;

                if (activeHeight > 60) {
                    translateY = -80;
                }

                line.className = `lyric-line prev-${age}`;
                line.style.transform = `translateY(${translateY}px) scale(0.9) rotateX(10deg)`;
            }
        }
    }

    private updateInteractiveLyrics() {
        if (!this.lyricsScrollContainer || !this.immersiveLyricContainer) return;

        const lines = getAllLyrics();
        const video = document.querySelector('video');
        if (!video) return;

        const time = video.currentTime * 1000; // ms

        // If lyrics changed, rebuild the DOM
        if (lines !== this.currentLines) {
            this.currentLines = lines || [];
            this.lyricsScrollContainer.innerHTML = '';
            this.lyricElements = [];

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

                // Click to seek
                p.addEventListener('click', () => {
                    if (video) {
                        video.currentTime = line.timeInMs / 1000;
                        this.userScrollOffset = 0; // SNAP back to center
                    }
                });

                this.lyricsScrollContainer!.appendChild(p);
                this.lyricElements.push(p);
            });
        }

        if (this.currentLines.length === 0) {
            this.lyricsScrollContainer.style.transform = `translateY(0px)`;
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

        // Apply classes
        for (let i = 0; i < this.lyricElements.length; i++) {
            const el = this.lyricElements[i];
            const diff = i - activeIndex;

            el.className = 'lyric-line-interactive'; // base class

            if (diff === 0) {
                el.classList.add('active');
            } else if (diff < 0) {
                el.classList.add('past');
            } else {
                el.classList.add('next');
            }
        }

        // Auto-center logic with user scroll offset
        const activeElement = this.lyricElements[activeIndex];
        if (activeElement) {
            const containerHeight = this.immersiveLyricContainer.offsetHeight;
            const elementOffsetFromScrollContainer = activeElement.offsetTop;
            const elementHeight = activeElement.offsetHeight;

            // Target scroll so activeElement is centered
            const targetScrollCenter = elementOffsetFromScrollContainer - (containerHeight / 2) + (elementHeight / 2);

            // Smoothly reduce userScrollOffset if no interaction for a bit -> "snap back"
            if (Date.now() - this.lastWheelTime > 3000 && Math.abs(this.userScrollOffset) > 1) {
                this.userScrollOffset -= this.userScrollOffset * 0.05;
            }

            const currentTranslation = -(targetScrollCenter + this.userScrollOffset);
            this.lyricsScrollContainer.style.transform = `translateY(${currentTranslation}px)`;
        }
    }

    private handleResize() {
        if (window.innerWidth < 800) {
            // Force disable Zen Mode on small screens
            if (this.zenMode) {
                this.setZenMode(false, false); // false = don't update preference
            }
        } else {
            // Restore user preference on large screens
            if (this.userPreferredZenMode && !this.zenMode) {
                this.setZenMode(true, false);
            }
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
