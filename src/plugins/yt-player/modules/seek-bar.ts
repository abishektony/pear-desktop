import { DomManager } from './dom-manager';

export class SeekBar {
    private dom: DomManager;
    private isScrubbingMini: boolean = false;
    private isScrubbingFull: boolean = false;

    constructor(dom: DomManager) {
        this.dom = dom;
        this.init();
    }

    private init(): void {
        this.initMiniplayerSeek();
        this.initFullscreenSeek();
    }

    private initMiniplayerSeek(): void {
        const bar = this.dom.miniplayerSeek;
        const progress = this.dom.miniplayerSeekProgress;
        const preview = this.dom.miniplayerSeekPreview;

        const doSeek = (clientX: number) => {
            const rect = bar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const video = document.querySelector('video');
            if (video && video.duration) {
                video.currentTime = percent * video.duration;
                progress.style.width = `${percent * 100}%`;
            }
        };

        bar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isScrubbingMini = true;
            bar.classList.add('scrubbing');
            doSeek(e.clientX);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isScrubbingMini) {
                doSeek(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isScrubbingMini) {
                this.isScrubbingMini = false;
                bar.classList.remove('scrubbing');
            }
        });

        // Touch
        bar.addEventListener(
            'touchstart',
            (e) => {
                e.preventDefault();
                this.isScrubbingMini = true;
                bar.classList.add('scrubbing');
                doSeek(e.touches[0].clientX);
            },
            { passive: false }
        );

        bar.addEventListener(
            'touchmove',
            (e) => {
                if (!this.isScrubbingMini) return;
                e.preventDefault();
                doSeek(e.touches[0].clientX);
            },
            { passive: false }
        );

        bar.addEventListener('touchend', () => {
            this.isScrubbingMini = false;
            bar.classList.remove('scrubbing');
        });

        // Hover tooltip
        bar.addEventListener('mousemove', (e) => {
            this.updatePreview(e, bar, preview);
        });

        bar.addEventListener('mouseleave', () => {
            preview.style.opacity = '0';
        });
    }

    private initFullscreenSeek(): void {
        const bar = this.dom.fullscreenSeek;
        const progress = this.dom.fullscreenSeekProgress;
        const preview = this.dom.fullscreenSeekPreview;

        const doSeek = (clientX: number) => {
            const rect = bar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const video = document.querySelector('video');
            if (video && video.duration) {
                video.currentTime = percent * video.duration;
                progress.style.width = `${percent * 100}%`;
            }
        };

        bar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isScrubbingFull = true;
            bar.classList.add('scrubbing');
            doSeek(e.clientX);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isScrubbingFull) {
                doSeek(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isScrubbingFull) {
                this.isScrubbingFull = false;
                bar.classList.remove('scrubbing');
            }
        });

        // Touch
        bar.addEventListener(
            'touchstart',
            (e) => {
                e.preventDefault();
                this.isScrubbingFull = true;
                bar.classList.add('scrubbing');
                doSeek(e.touches[0].clientX);
            },
            { passive: false }
        );

        bar.addEventListener(
            'touchmove',
            (e) => {
                if (!this.isScrubbingFull) return;
                e.preventDefault();
                doSeek(e.touches[0].clientX);
            },
            { passive: false }
        );

        bar.addEventListener('touchend', () => {
            this.isScrubbingFull = false;
            bar.classList.remove('scrubbing');
        });

        // Hover tooltip
        bar.addEventListener('mousemove', (e) => {
            this.updatePreview(e, bar, preview);
        });

        bar.addEventListener('mouseleave', () => {
            preview.style.opacity = '0';
        });
    }

    private updatePreview(e: MouseEvent, bar: HTMLElement, preview: HTMLElement): void {
        const video = document.querySelector('video');
        if (!video || !video.duration) {
            preview.style.opacity = '0';
            return;
        }

        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const previewTime = percent * video.duration;

        const minutes = Math.floor(previewTime / 60);
        const seconds = Math.floor(previewTime % 60);
        preview.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const previewWidth = preview.offsetWidth || 50;
        let leftPosition = e.clientX - rect.left;
        leftPosition = Math.max(previewWidth / 2, Math.min(leftPosition, rect.width - previewWidth / 2));

        preview.style.left = `${leftPosition}px`;
        preview.style.opacity = '1';
    }

    public updateProgress(percent: number): void {
        if (!this.isScrubbingMini) {
            this.dom.miniplayerSeekProgress.style.width = `${percent * 100}%`;
        }
        if (!this.isScrubbingFull) {
            this.dom.fullscreenSeekProgress.style.width = `${percent * 100}%`;
        }
    }
}
