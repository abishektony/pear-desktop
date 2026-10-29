import { DomManager } from './dom-manager';
import { ActionAnimator } from './action-animator';

export class PlayerControls {
    private dom: DomManager;
    private animator: ActionAnimator;
    private getPlayerApi: () => any;
    private savedVolume: number = 1.0;
    private syncInterval: number | null = null;

    constructor(
        dom: DomManager,
        animator: ActionAnimator,
        getPlayerApi: () => any
    ) {
        this.dom = dom;
        this.animator = animator;
        this.getPlayerApi = getPlayerApi;

        const savedVol = localStorage.getItem('pear-player-volume');
        if (savedVol) {
            this.savedVolume = parseFloat(savedVol);
        }

        this.init();
    }

    private init(): void {
        // Miniplayer Play/Pause
        this.dom.miniplayerPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });

        // Miniplayer Prev
        this.dom.miniplayerPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            this.previousTrack();
        });

        // Miniplayer Next
        this.dom.miniplayerNext.addEventListener('click', (e) => {
            e.stopPropagation();
            this.nextTrack();
        });

        // Fullscreen Play/Pause
        this.dom.fullscreenPlay.addEventListener('click', () => {
            this.togglePlayPause(true);
        });

        // Fullscreen Prev
        this.dom.fullscreenPrev.addEventListener('click', () => {
            this.previousTrack(true);
        });

        // Fullscreen Next
        this.dom.fullscreenNext.addEventListener('click', () => {
            this.nextTrack(true);
        });

        // Fullscreen Like
        this.dom.fullscreenLike.addEventListener('click', () => {
            this.toggleLike();
        });

        // Fullscreen Repeat
        this.dom.fullscreenRepeat.addEventListener('click', () => {
            this.toggleRepeat();
        });

        // Volume Mute Button
        this.dom.fullscreenVolumeBtn.addEventListener('click', () => {
            this.toggleMute();
        });

        // Volume Slider
        this.dom.fullscreenVolumeSlider.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.setVolume(val / 100);
        });

        // Start periodic sync of like/repeat when active
        this.syncInterval = window.setInterval(() => {
            if (!document.hidden && this.dom.fullscreenPlayer.classList.contains('active')) {
                this.updateLikeButtonState();
                this.updateRepeatButtonState();
            }
        }, 1500);

        this.updateVolumeIcons();
    }

    public togglePlayPause(fromFullscreen: boolean = false): void {
        const video = document.querySelector('video');
        const isPaused = video ? video.paused : true;

        if (fromFullscreen) {
            if (isPaused) {
                this.animator.trigger(
                    `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
                    '#ffffff',
                    'pop'
                );
            } else {
                this.animator.trigger(
                    `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
                    '#ffffff',
                    'pop'
                );
            }
        }

        const api = this.getPlayerApi();
        if (api) {
            if (isPaused) {
                api.playVideo();
            } else {
                api.pauseVideo();
            }
        } else {
            const playPauseBtn = document.querySelector<HTMLElement>('#play-pause-button');
            if (playPauseBtn) {
                playPauseBtn.click();
            } else if (video) {
                if (isPaused) video.play().catch(() => {});
                else video.pause();
            }
        }

        this.updatePlayPauseButtons(!isPaused);
    }

    public previousTrack(fromFullscreen: boolean = false): void {
        if (fromFullscreen) {
            this.animator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>`,
                '#ffffff',
                'slide-left'
            );
        }

        const api = this.getPlayerApi();
        if (api && api.previousVideo) {
            api.previousVideo();
        } else {
            const prevBtn = document.querySelector<HTMLElement>('.previous-button.ytmusic-player-bar, .previous-button');
            prevBtn?.click();
        }
    }

    public nextTrack(fromFullscreen: boolean = false): void {
        if (fromFullscreen) {
            this.animator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
                '#ffffff',
                'slide-right'
            );
        }

        const api = this.getPlayerApi();
        if (api && api.nextVideo) {
            api.nextVideo();
        } else {
            const nextBtn = document.querySelector<HTMLElement>('.next-button.ytmusic-player-bar, .next-button');
            nextBtn?.click();
        }
    }

    public toggleLike(): void {
        const isLiked = this.dom.fullscreenLike.classList.contains('active');
        if (isLiked) {
            this.animator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
                '#ffffff',
                'sad'
            );
        } else {
            this.animator.trigger(
                `<svg width="60" height="60" viewBox="0 0 24 24" fill="#ff2a5f" stroke="#ff2a5f" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
                '#ff2a5f',
                'pulse'
            );
        }

        const likeBtn =
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer yt-button-shape.like button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer tp-yt-paper-icon-button.like') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar #button-shape-like button') ||
            document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');

        if (likeBtn) {
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            likeBtn.dispatchEvent(clickEvent);
            setTimeout(() => this.updateLikeButtonState(), 100);
        }
    }

    public toggleRepeat(): void {
        const repeatBtn =
            document.querySelector<HTMLElement>('yt-icon-button.repeat button') ||
            document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar button') ||
            document.querySelector<HTMLElement>('ytmusic-player-bar tp-yt-paper-icon-button.repeat');

        if (repeatBtn) {
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            repeatBtn.dispatchEvent(clickEvent);
            setTimeout(() => this.updateRepeatButtonState(), 100);
        }
    }

    public toggleMute(): void {
        const video = document.querySelector('video');
        if (video) {
            video.muted = !video.muted;
            this.updateVolumeIcons();
        }
    }

    public setVolume(volume: number): void {
        const video = document.querySelector('video');
        if (video) {
            video.volume = Math.max(0, Math.min(1, volume));
            video.muted = false;
            this.savedVolume = video.volume;
            localStorage.setItem('pear-player-volume', String(this.savedVolume));
            this.updateVolumeIcons();
        }
    }

    public updatePlayPauseButtons(isPaused: boolean): void {
        if (this.dom.miniplayerPlay) {
            this.dom.miniplayerPlay.textContent = isPaused ? '▶' : '⏸';
        }
        if (this.dom.fullscreenPlay) {
            if (isPaused) {
                this.dom.fullscreenPlay.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                `;
            } else {
                this.dom.fullscreenPlay.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                `;
            }
        }
    }

    public updateLikeButtonState(): void {
        let isLiked = false;
        const likeRenderer =
            document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer') ||
            document.querySelector('ytmusic-like-button-renderer');

        if (likeRenderer && likeRenderer.hasAttribute('like-status')) {
            isLiked = likeRenderer.getAttribute('like-status') === 'LIKE';
        } else {
            const ytLikeButton =
                document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer .like button') ||
                document.querySelector<HTMLElement>('ytmusic-player-bar ytmusic-like-button-renderer tp-yt-paper-icon-button.like') ||
                document.querySelector<HTMLElement>('ytmusic-player-bar #button-shape-like button') ||
                document.querySelector<HTMLElement>('ytmusic-like-button-renderer .like button');
            if (ytLikeButton) {
                isLiked = ytLikeButton.getAttribute('aria-pressed') === 'true';
            }
        }

        this.dom.fullscreenLike.classList.toggle('active', isLiked);
        this.dom.moreItemLike.classList.toggle('active', isLiked);
        this.dom.moreLikeStatus.textContent = isLiked ? 'Liked' : 'Like song';
    }

    public updateRepeatButtonState(): void {
        const ytRepeatBtn =
            document.querySelector<HTMLElement>('yt-icon-button.repeat') ||
            document.querySelector<HTMLElement>('.repeat.ytmusic-player-bar');

        if (ytRepeatBtn) {
            const title = ytRepeatBtn.getAttribute('title') || '';
            const label = ytRepeatBtn.getAttribute('label') || '';
            const ariaLabel = ytRepeatBtn.querySelector('button')?.getAttribute('aria-label') || '';
            const stateText = (title + label + ariaLabel).toLowerCase();
            const isRepeatActive = !stateText.includes('repeat off');

            this.dom.fullscreenRepeat.classList.toggle('active', isRepeatActive);
            this.dom.moreItemRepeat.classList.toggle('active', isRepeatActive);
            this.dom.moreRepeatStatus.textContent = isRepeatActive ? 'Repeating' : 'Toggle repeat';
        }
    }

    public updateVolumeIcons(): void {
        const video = document.querySelector('video');
        if (!video) return;

        const isMuted = video.muted || video.volume === 0;
        const volPercent = Math.round((isMuted ? 0 : video.volume) * 100);

        this.dom.fullscreenVolumeSlider.value = String(Math.round(video.volume * 100));
        this.dom.fullscreenVolumeValue.textContent = `${volPercent}%`;

        const volumeHigh1 = document.getElementById('volume-high-1');
        const volumeHigh2 = document.getElementById('volume-high-2');
        const volumeMute = document.getElementById('volume-mute');
        const volumeMute2 = document.getElementById('volume-mute-2');

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
    }

    public destroy(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
}
