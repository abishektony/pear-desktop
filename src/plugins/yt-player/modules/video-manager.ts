import { DomManager } from './dom-manager';
import { DisplayMode, MiniplayerConfig } from '../types';

export class VideoManager {
    private dom: DomManager;
    private getConfig: () => MiniplayerConfig;
    private isFullscreenOpen: () => boolean;
    private isImmersiveActive: () => boolean;

    private cachedVideo: HTMLVideoElement | null = null;
    private normalVideoElement: HTMLVideoElement | null = null;
    private normalVideoOriginalParent: HTMLElement | null = null;
    private normalVideoOriginalNextSibling: Node | null = null;

    private preferredMode: DisplayMode = 'visualizer';
    private availabilityInterval: number | null = null;

    constructor(
        dom: DomManager,
        getConfig: () => MiniplayerConfig,
        isFullscreenOpen: () => boolean,
        isImmersiveActive: () => boolean
    ) {
        this.dom = dom;
        this.getConfig = getConfig;
        this.isFullscreenOpen = isFullscreenOpen;
        this.isImmersiveActive = isImmersiveActive;

        const savedMode = localStorage.getItem('pear-player-mode');
        if (savedMode && ['visualizer', 'video', 'thumbnail'].includes(savedMode)) {
            this.preferredMode = savedMode as DisplayMode;
        }

        this.startVideoAvailabilityCheck();
    }

    public getVideo(): HTMLVideoElement | null {
        if (this.cachedVideo && this.cachedVideo.isConnected) {
            return this.cachedVideo;
        }
        this.cachedVideo = document.querySelector('video');
        return this.cachedVideo;
    }

    public getPreferredMode(): DisplayMode {
        return this.preferredMode;
    }

    public setPreferredMode(mode: DisplayMode): void {
        this.preferredMode = mode;
        localStorage.setItem('pear-player-mode', mode);
    }

    public cycleMode(onModeChanged?: (mode: DisplayMode) => void): DisplayMode {
        const config = this.getConfig();
        const modes: DisplayMode[] = ['thumbnail'];
        if (config.videoEnabled) modes.unshift('video');
        if (config.visualizerEnabled) modes.unshift('visualizer');

        const currentIndex = modes.indexOf(this.preferredMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.preferredMode = modes[nextIndex];

        localStorage.setItem('pear-player-mode', this.preferredMode);

        if (this.isFullscreenOpen()) {
            if (this.preferredMode === 'video' && !this.isImmersiveActive()) {
                this.attachVideoToNormalPlayer();
            } else if (this.normalVideoElement) {
                this.syncNormalVideoDisplay(this.normalVideoElement);
            }
        }

        if (onModeChanged) {
            onModeChanged(this.preferredMode);
        }

        return this.preferredMode;
    }

    public attachVideoListeners(onPlay: () => void, onPause: () => void): void {
        const video = this.getVideo();
        if (video && !video.hasAttribute('data-peard-gpu-monitored')) {
            video.setAttribute('data-peard-gpu-monitored', 'true');
            video.addEventListener('play', onPlay);
            video.addEventListener('playing', onPlay);
            video.addEventListener('pause', onPause);
            video.addEventListener('ended', onPause);

            video.addEventListener('loadedmetadata', () => {
                if (this.isFullscreenOpen() && this.preferredMode === 'video') {
                    this.syncNormalVideoDisplay(video);
                }
            });

            video.addEventListener('resize', () => {
                if (this.isFullscreenOpen() && this.preferredMode === 'video') {
                    this.syncNormalVideoDisplay(video);
                }
            });
        }
    }

    public attachVideoToNormalPlayer(): void {
        if (this.isImmersiveActive()) return;
        if (!this.isFullscreenOpen() || this.preferredMode !== 'video') return;

        const video = this.getVideo();
        if (!video || !this.dom.fullscreenThumbTop) return;

        if (video.parentElement === this.dom.fullscreenThumbTop) {
            this.syncNormalVideoDisplay(video);
            return;
        }

        if (
            video.parentElement &&
            video.parentElement !== this.dom.fullscreenThumbTop &&
            video.parentElement !== this.dom.fullscreenPlayer
        ) {
            this.normalVideoOriginalParent = video.parentElement;
            this.normalVideoOriginalNextSibling = video.nextSibling;
        }

        this.normalVideoElement = video;
        video.classList.add('pear-normal-video');
        const wasPaused = video.paused;

        this.dom.fullscreenThumbTop.appendChild(video);
        if (!wasPaused) {
            video.play().catch(() => {});
        }

        this.syncNormalVideoDisplay(video);
    }

    public syncNormalVideoDisplay(video: HTMLVideoElement): void {
        if (!this.dom.fullscreenThumbTop) return;
        const container = this.dom.fullscreenThumbTop.parentElement;

        const isVideoActive = this.isFullscreenOpen() && this.preferredMode === 'video' && !this.isImmersiveActive();
        const hasVideoTrack = video.videoWidth > 0 && video.videoHeight > 0;

        if (isVideoActive) {
            if (container) {
                const config = this.getConfig();
                if (config.widescreenMode) {
                    if (!container.classList.contains('video-mode')) container.classList.add('video-mode');
                } else {
                    if (container.classList.contains('video-mode')) container.classList.remove('video-mode');
                }
                container.classList.remove('visualizer-mode');
                container.classList.remove('thumbnail-mode');
            }

            if (this.dom.fullscreenCanvas) {
                this.dom.fullscreenCanvas.style.display = 'none';
            }

            if (hasVideoTrack) {
                video.style.opacity = '1';
                video.style.visibility = 'visible';
            } else {
                video.style.opacity = '0';
                video.style.visibility = 'hidden';
            }
        } else {
            video.style.opacity = '0';
            video.style.visibility = 'hidden';
            if (container && container.classList.contains('video-mode')) {
                container.classList.remove('video-mode');
            }
        }
    }

    public detachVideoFromNormalPlayer(): void {
        const video = this.normalVideoElement || document.querySelector<HTMLVideoElement>('video.pear-normal-video');
        if (!video) return;

        video.classList.remove('pear-normal-video');
        video.style.removeProperty('opacity');
        video.style.removeProperty('visibility');

        const targetParent =
            this.normalVideoOriginalParent ||
            document.querySelector<HTMLElement>('#player-video-wrapper') ||
            document.querySelector<HTMLElement>('#player');

        if (targetParent && video.parentElement !== targetParent) {
            try {
                if (
                    this.normalVideoOriginalNextSibling &&
                    this.normalVideoOriginalNextSibling.parentNode === targetParent
                ) {
                    targetParent.insertBefore(video, this.normalVideoOriginalNextSibling);
                } else {
                    targetParent.appendChild(video);
                }
            } catch (_) {
                targetParent.appendChild(video);
            }
        }

        this.normalVideoElement = null;
        this.normalVideoOriginalParent = null;
        this.normalVideoOriginalNextSibling = null;
    }

    private startVideoAvailabilityCheck(): void {
        if (this.availabilityInterval) return;

        this.availabilityInterval = window.setInterval(() => {
            const video = this.getVideo();
            if (video && video.readyState > 0 && video.videoWidth > 0) {
                if (this.isFullscreenOpen() && this.preferredMode === 'video' && !this.normalVideoElement) {
                    this.attachVideoToNormalPlayer();
                }
            }
        }, 1500);
    }

    public destroy(): void {
        if (this.availabilityInterval) {
            clearInterval(this.availabilityInterval);
            this.availabilityInterval = null;
        }
        this.detachVideoFromNormalPlayer();
    }
}
