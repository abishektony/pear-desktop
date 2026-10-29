export class CrossfadeManager {
    private isEnabled: () => boolean;
    private crossfadeDuration: number = 3000;
    private isCrossfading: boolean = false;
    private lastVideoId: string | null = null;
    private attachedVideo: HTMLVideoElement | null = null;

    constructor(isEnabled: () => boolean, durationMs: number = 3000) {
        this.isEnabled = isEnabled;
        this.crossfadeDuration = durationMs;
        this.attachListeners();
    }

    private attachListeners(): void {
        const video = document.querySelector('video');
        if (!video) {
            setTimeout(() => this.attachListeners(), 1000);
            return;
        }

        if (this.attachedVideo === video) return;
        this.attachedVideo = video;

        let storedVolume = video.volume || 1;

        video.addEventListener('loadstart', () => {
            if (!this.isEnabled() || this.isCrossfading) return;
            storedVolume = video.volume || 1;
            video.volume = 0;
        });

        video.addEventListener('canplay', () => {
            if (!this.isEnabled() || this.isCrossfading) return;

            if (video.volume === 0) {
                this.isCrossfading = true;
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
                    }
                };

                fadeIn();
            }
        });
    }

    public checkForSongChange(onSongChanged?: () => void): void {
        if (!this.isEnabled()) return;

        const currentVideoId = this.getCurrentVideoId();
        if (this.lastVideoId && currentVideoId && this.lastVideoId !== currentVideoId) {
            if (onSongChanged) onSongChanged();
            this.initiateFadeIn();
        }
        this.lastVideoId = currentVideoId;
    }

    public initiateFadeIn(): void {
        if (this.isCrossfading) return;
        const video = document.querySelector('video');
        if (!video) return;

        this.isCrossfading = true;
        const targetVolume = video.muted ? 1 : video.volume || 1;
        video.volume = 0;
        if (video.muted) video.muted = false;

        const steps = 20;
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
            }
        };

        setTimeout(fadeIn, 100);
    }

    private getCurrentVideoId(): string | null {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('v');
        } catch (_) {
            return null;
        }
    }
}
