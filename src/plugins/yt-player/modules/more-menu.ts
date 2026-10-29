import { DomManager } from './dom-manager';

export interface MoreMenuCallbacks {
    onToggleQueue: () => void;
    onToggleLyrics: () => void;
    onToggleImmersive: () => void;
    onOpenSleepTimer: () => void;
    onOpenSyncLyrics: () => void;
    onTogglePopout: () => void;
    onToggleLike: () => void;
    onToggleRepeat: () => void;
    onVolumeChange: (volume: number) => void;
    onMuteToggle: () => void;
}

export class MoreMenu {
    private dom: DomManager;
    private callbacks: MoreMenuCallbacks;
    public isOpen: boolean = false;

    constructor(dom: DomManager, callbacks: MoreMenuCallbacks) {
        this.dom = dom;
        this.callbacks = callbacks;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenMoreBtn.addEventListener('click', () => {
            this.toggle();
        });

        this.dom.moreMenuClose.addEventListener('click', () => {
            this.toggle(false);
        });

        this.dom.moreMenuBackdrop.addEventListener('click', () => {
            this.toggle(false);
        });

        this.dom.moreItemQueue.addEventListener('click', () => {
            this.callbacks.onToggleQueue();
        });

        this.dom.moreItemLyrics.addEventListener('click', () => {
            this.callbacks.onToggleLyrics();
        });

        this.dom.moreItemImmersive.addEventListener('click', () => {
            this.toggle(false);
            this.callbacks.onToggleImmersive();
        });

        this.dom.moreItemSleep.addEventListener('click', () => {
            this.toggle(false);
            this.callbacks.onOpenSleepTimer();
        });

        this.dom.moreItemSync.addEventListener('click', () => {
            this.toggle(false);
            this.callbacks.onOpenSyncLyrics();
        });

        this.dom.moreItemPopout.addEventListener('click', () => {
            this.toggle(false);
            this.callbacks.onTogglePopout();
        });

        this.dom.moreItemLike.addEventListener('click', () => {
            this.callbacks.onToggleLike();
        });

        this.dom.moreItemRepeat.addEventListener('click', () => {
            this.callbacks.onToggleRepeat();
        });

        this.dom.moreVolBtn.addEventListener('click', () => {
            this.callbacks.onMuteToggle();
        });

        this.dom.moreVolSlider.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            this.callbacks.onVolumeChange(val / 100);
        });
    }

    public toggle(open?: boolean): void {
        this.isOpen = open !== undefined ? open : !this.isOpen;

        if (this.isOpen) {
            this.dom.fullscreenMoreMenu.classList.add('active');
            this.dom.fullscreenMoreBtn.classList.add('active');
            this.syncStates();
        } else {
            this.dom.fullscreenMoreMenu.classList.remove('active');
            this.dom.fullscreenMoreBtn.classList.remove('active');
        }
    }

    public syncStates(): void {
        const video = document.querySelector('video');
        if (video) {
            const volPercent = Math.round((video.muted ? 0 : video.volume) * 100);
            this.dom.moreVolSlider.value = String(Math.round(video.volume * 100));
            this.dom.moreVolVal.textContent = `${volPercent}%`;

            const isMuted = video.muted || video.volume === 0;
            const wave1 = this.dom.root.querySelector<SVGPathElement>('.pear-more-menu-vol-btn .vol-wave-1');
            const wave2 = this.dom.root.querySelector<SVGPathElement>('.pear-more-menu-vol-btn .vol-wave-2');
            const mute1 = this.dom.root.querySelector<SVGLineElement>('.pear-more-menu-vol-btn .vol-mute-1');
            const mute2 = this.dom.root.querySelector<SVGLineElement>('.pear-more-menu-vol-btn .vol-mute-2');

            if (isMuted) {
                if (wave1) wave1.style.display = 'none';
                if (wave2) wave2.style.display = 'none';
                if (mute1) mute1.style.display = 'block';
                if (mute2) mute2.style.display = 'block';
            } else {
                if (wave1) wave1.style.display = 'block';
                if (wave2) wave2.style.display = video.volume > 0.5 ? 'block' : 'none';
                if (mute1) mute1.style.display = 'none';
                if (mute2) mute2.style.display = 'none';
            }
        }

        const isLiked = this.dom.fullscreenLike.classList.contains('active');
        this.dom.moreItemLike.classList.toggle('active', isLiked);
        this.dom.moreLikeStatus.textContent = isLiked ? 'Liked' : 'Like song';

        const isRepeat = this.dom.fullscreenRepeat.classList.contains('active');
        this.dom.moreItemRepeat.classList.toggle('active', isRepeat);
        this.dom.moreRepeatStatus.textContent = isRepeat ? 'Repeating' : 'Toggle repeat';
    }
}
