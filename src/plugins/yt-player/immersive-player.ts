import { getCurrentLyricText } from './lyrics-wrapper';

export class ImmersivePlayer {
    private isActive: boolean = false;
    private fullscreenPlayer: HTMLElement;
    private videoElement: HTMLVideoElement | null = null;
    private fallbackElement: HTMLElement;

    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;

    private immersiveContainer: HTMLElement | null = null;
    private movedElements: Map<HTMLElement, { parent: HTMLElement, sibling: Node | null }> = new Map();

    // Lyrics
    private immersiveLyricContainer: HTMLElement | null = null;
    private immersiveLyricText: HTMLElement | null = null;
    private lyricsInterval: number | null = null;
    private currentLyric: string = '';

    // Next Song
    private nextSongIndicator: HTMLElement | null = null;
    private nextSongCheckInterval: number | null = null;
    private nextSongTitle: string = '';
    private nextSongArtist: string = '';
    private nextSongImage: string = '';

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
            console.warn('[ImmersivePlayer] Failed to restore state:', e);
        }
    }

    private monitorVideo() {
        setInterval(() => {
            if (!this.isActive) return;

            const video = this.videoElement || document.querySelector('video');

            // Check if video exists AND has dimensions. 
            // Often audio-only streams have a video element with 0 height.
            if (!video || video.videoHeight === 0 || video.style.display === 'none') {
                this.showFallback();
                return;
            }

            if (video.classList.contains('pear-immersive-video')) {
                this.hideFallback();
            } else if (this.isActive) {
                video.classList.add('pear-immersive-video');
                this.hideFallback();
            }
        }, 1000);
    }

    private showFallback() {
        this.fullscreenPlayer.classList.add('show-fallback');

        // Robust thumbnail extraction similar to Miniplayer
        const getThumbnail = (): string | null => {
            // Check direct fullscreen elements first via CSS var (most reliable as Miniplayer sets it)
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
        };

        const src = getThumbnail();

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
                console.warn('[ImmersivePlayer] No fallback image found');
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
            console.warn('[ImmersivePlayer] No video element found');
        }

        this.isActive = true;
        this.fullscreenPlayer.classList.add('immersive-mode');

        if (this.videoElement) {
            this.moveVideoToPlayer();
            this.videoElement.classList.add('pear-immersive-video');
        }

        this.setupImmersiveUI();
        this.startLyricsLoop();
        this.startNextSongCheck();

        const btn = document.getElementById('pear-immersive-toggle');
        if (btn) btn.classList.add('active');

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
            console.warn('[ImmersivePlayer] Failed to restore video position:', e);
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
        this.immersiveLyricText = document.createElement('p');
        this.immersiveLyricContainer.appendChild(this.immersiveLyricText);
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
        }

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
                console.warn('[ImmersivePlayer] Failed to restore element:', el, e);
            }
        }
        this.movedElements.clear();

        if (this.immersiveContainer) {
            this.immersiveContainer.remove();
            this.immersiveContainer = null;
        }
        this.immersiveLyricContainer = null;
        this.immersiveLyricText = null;
        this.nextSongIndicator = null;
    }

    // --- Lyrics Logic ---
    private startLyricsLoop() {
        if (this.lyricsInterval) clearInterval(this.lyricsInterval);
        this.lyricsInterval = window.setInterval(() => {
            const text = getCurrentLyricText();
            if (this.immersiveLyricText && text && text !== this.currentLyric) {
                this.currentLyric = text;

                // Add changing class to trigger exit animation
                this.immersiveLyricText.classList.add('changing');

                // Wait for exit animation (200ms match CSS)
                setTimeout(() => {
                    if (this.immersiveLyricText) {
                        this.immersiveLyricText.innerText = text;
                        // Remove class to trigger enter animation
                        this.immersiveLyricText.classList.remove('changing');
                    }
                }, 200);
            } else if (!text && this.immersiveLyricText) {
                this.immersiveLyricText.innerText = '';
            }
        }, 300);
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

        // Show if less than 20 seconds left
        if (timeLeft <= 20 && timeLeft > 0) {
            const selectedItem = document.querySelector('ytmusic-player-queue-item[selected]');
            const nextItem = selectedItem?.nextElementSibling as HTMLElement;

            if (nextItem) {
                const title = nextItem.querySelector('.song-title, .title, #video-title')?.textContent?.trim() || '';
                const artist = nextItem.querySelector('.byline, .artist, #byline')?.textContent?.trim() || '';

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

                if (title && (title !== this.nextSongTitle || img !== this.nextSongImage)) {
                    this.nextSongTitle = title;
                    this.nextSongArtist = artist;
                    this.nextSongImage = img;
                    this.renderNextSong(true);
                } else if (this.nextSongTitle) {
                    // Update visuals if already consistent
                    if (!this.nextSongIndicator.classList.contains('visible')) {
                        this.renderNextSong(true);
                    }
                }
            }
        } else {
            if (this.nextSongIndicator.classList.contains('visible')) {
                this.nextSongIndicator.classList.remove('visible');
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
