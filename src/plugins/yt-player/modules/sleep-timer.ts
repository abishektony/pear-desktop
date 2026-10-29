import { DomManager } from './dom-manager';

export class SleepTimer {
    private dom: DomManager;
    private selectedMinutes: number = 5;
    private waitUntilSongEnds: boolean = true;
    private timerId: number | null = null;
    private endTime: number | null = null;
    private badgeInterval: number | null = null;
    private songEndHandler: (() => void) | null = null;

    constructor(dom: DomManager) {
        this.dom = dom;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenSleepBtn.addEventListener('click', () => {
            this.openModal();
        });

        this.dom.moreItemSleep.addEventListener('click', () => {
            this.openModal();
        });

        this.dom.sleepTimerStartBtn.addEventListener('click', () => {
            this.startTimer();
        });

        this.dom.sleepTimerCancelBtn.addEventListener('click', () => {
            this.cancelTimer();
            this.closeModal();
        });

        this.dom.sleepTimerCloseBtn.addEventListener('click', () => {
            this.closeModal();
        });

        this.dom.sleepTimerModal.addEventListener('click', (e) => {
            if (e.target === this.dom.sleepTimerModal) {
                this.closeModal();
            }
        });

        // Option presets
        this.dom.sleepTimerOptions.forEach((option) => {
            option.addEventListener('click', () => {
                this.dom.sleepTimerOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                const minutes = parseInt(option.getAttribute('data-minutes') || '30', 10);
                this.selectedMinutes = minutes;
                this.dom.sleepTimerCustomInput.value = '';
            });
        });

        // Custom input
        this.dom.sleepTimerCustomInput.addEventListener('input', () => {
            this.dom.sleepTimerOptions.forEach(opt => opt.classList.remove('selected'));
            const value = parseInt(this.dom.sleepTimerCustomInput.value || '0', 10);
            if (value > 0) {
                this.selectedMinutes = value;
            }
        });
    }

    public openModal(): void {
        if (this.dom.sleepTimerModal.parentElement !== document.body) {
            document.body.appendChild(this.dom.sleepTimerModal);
        }
        document.body.classList.add('pear-modal-open');
        this.dom.sleepTimerModal.classList.add('active');

        if (this.timerId) {
            this.dom.sleepTimerStartBtn.style.display = 'none';
            this.dom.sleepTimerCancelBtn.style.display = 'block';
        } else {
            this.dom.sleepTimerStartBtn.style.display = 'block';
            this.dom.sleepTimerCancelBtn.style.display = 'none';
        }
    }

    public closeModal(): void {
        document.body.classList.remove('pear-modal-open');
        this.dom.sleepTimerModal.classList.remove('active');
    }

    public startTimer(): void {
        this.cancelTimer();

        const minutes = this.selectedMinutes;
        if (minutes <= 0) return;

        this.waitUntilSongEnds = this.dom.sleepTimerWaitCheckbox.checked ?? true;
        this.endTime = Date.now() + minutes * 60 * 1000;

        this.timerId = window.setTimeout(() => {
            if (this.waitUntilSongEnds) {
                const video = document.querySelector('video');
                if (video) {
                    this.dom.sleepTimerBadge.textContent = '♪';
                    if (this.dom.moreSleepBadge) {
                        this.dom.moreSleepBadge.textContent = '♪';
                    }

                    if (this.badgeInterval) {
                        clearInterval(this.badgeInterval);
                        this.badgeInterval = null;
                    }

                    const handleNextSongLoad = () => {
                        this.executePause();
                        video.removeEventListener('loadstart', handleNextSongLoad);
                        this.songEndHandler = null;
                    };
                    this.songEndHandler = handleNextSongLoad;
                    video.addEventListener('loadstart', handleNextSongLoad);
                } else {
                    this.executePause();
                }
            } else {
                this.executePause();
            }
        }, minutes * 60 * 1000);

        this.updateBadge();
        this.badgeInterval = window.setInterval(() => {
            this.updateBadge();
        }, 1000);

        this.dom.fullscreenSleepBtn.classList.add('active');
        this.dom.sleepTimerBadge.style.display = 'block';
        this.closeModal();
    }

    public cancelTimer(): void {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        if (this.badgeInterval) {
            clearInterval(this.badgeInterval);
            this.badgeInterval = null;
        }

        this.endTime = null;

        if (this.songEndHandler) {
            const video = document.querySelector('video');
            if (video) {
                video.removeEventListener('loadstart', this.songEndHandler);
            }
            this.songEndHandler = null;
        }

        this.dom.sleepTimerBadge.style.display = 'none';
        this.dom.moreSleepBadge.style.display = 'none';
        this.dom.moreSleepStatus.textContent = 'Off';
        this.dom.moreItemSleep.classList.remove('active');
        this.dom.fullscreenSleepBtn.classList.remove('active');

        this.dom.sleepTimerStartBtn.style.display = 'block';
        this.dom.sleepTimerCancelBtn.style.display = 'none';
    }

    private updateBadge(): void {
        if (!this.endTime) return;

        const remaining = Math.max(0, this.endTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        let timeStr = '0:00';
        if (remaining > 0) {
            if (minutes >= 60) {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                timeStr = `${hours}h${mins}m`;
            } else if (minutes > 0) {
                timeStr = `${minutes}m`;
            } else {
                timeStr = `${seconds}s`;
            }
        }

        this.dom.sleepTimerBadge.textContent = timeStr;
        this.dom.moreSleepBadge.textContent = timeStr;
        this.dom.moreSleepBadge.style.display = 'flex';
        this.dom.moreSleepStatus.textContent = timeStr;
        this.dom.moreItemSleep.classList.add('active');
    }

    private executePause(): void {
        const video = document.querySelector('video');
        if (video) {
            video.pause();
        }

        const playPauseButton = document.querySelector<HTMLElement>('#play-pause-button');
        if (playPauseButton) {
            const isPlaying = document.querySelector('ytmusic-player-bar')?.getAttribute('playing') !== null;
            if (isPlaying) {
                playPauseButton.click();
            }
        }

        this.cancelTimer();
    }

    public destroy(): void {
        this.cancelTimer();
    }
}
