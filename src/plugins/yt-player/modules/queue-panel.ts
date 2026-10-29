import { DomManager } from './dom-manager';

export class QueuePanel {
    private dom: DomManager;
    private getPlayerApi: () => any;
    public isOpen: boolean = false;

    constructor(dom: DomManager, getPlayerApi: () => any) {
        this.dom = dom;
        this.getPlayerApi = getPlayerApi;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenQueueBtn.addEventListener('click', () => {
            this.toggle();
        });

        const savedOpen = localStorage.getItem('pear-queue-open');
        if (savedOpen === 'true') {
            setTimeout(() => {
                if (!this.isOpen) this.toggle(true);
            }, 600);
        }
    }

    public toggle(open?: boolean, onLyricsCloseNeeded?: () => void): void {
        this.isOpen = open !== undefined ? open : !this.isOpen;

        if (this.isOpen) {
            if (onLyricsCloseNeeded && window.innerWidth < 1200) {
                onLyricsCloseNeeded();
            }

            this.dom.fullscreenQueuePanel.classList.add('active');
            this.dom.fullscreenPlayer.classList.add('queue-open');
            this.dom.fullscreenQueueBtn.classList.add('active');
            this.dom.moreItemQueue.classList.add('active');
            this.render();
        } else {
            this.dom.fullscreenQueuePanel.classList.remove('active');
            this.dom.fullscreenPlayer.classList.remove('queue-open');
            this.dom.fullscreenQueueBtn.classList.remove('active');
            this.dom.moreItemQueue.classList.remove('active');
        }

        localStorage.setItem('pear-queue-open', String(this.isOpen));
    }

    public render(): void {
        if (!this.dom.fullscreenQueueContent) return;
        this.dom.fullscreenQueueContent.innerHTML = '';

        const queueItems = document.querySelectorAll('ytmusic-player-queue-item');
        queueItems.forEach((item, index) => {
            const title = item.querySelector('.song-title')?.textContent?.trim() || 'Unknown';
            const artist = item.querySelector('.byline')?.textContent?.trim() || 'Unknown';
            const duration = item.querySelector('.duration')?.textContent?.trim() || '';
            const thumbImg = item.querySelector('img')?.src || '';
            const isPlaying = item.hasAttribute('selected');

            const div = document.createElement('div');
            div.className = `pear-queue-item ${isPlaying ? 'playing' : ''}`;

            div.innerHTML = `
                <img src="${thumbImg}" class="pear-queue-item-thumb" />
                <div class="pear-queue-item-info">
                    <div class="pear-queue-item-title">${title}</div>
                    <div class="pear-queue-item-artist">${artist}</div>
                </div>
                <div class="pear-queue-item-duration">${duration}</div>
            `;

            div.addEventListener('click', () => {
                const currentQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
                const currentItem = currentQueueItems[index] as HTMLElement;
                if (!currentItem) return;

                const playerApi = this.getPlayerApi();
                if (playerApi) {
                    const currentIndex = Array.from(currentQueueItems).findIndex(i => i.hasAttribute('selected'));
                    if (currentIndex !== -1) {
                        const relativeIndex = index - currentIndex;
                        if (relativeIndex === 0) {
                            playerApi.seekTo(0);
                            playerApi.playVideo();
                            return;
                        }
                        if (relativeIndex > 0) {
                            for (let i = 0; i < relativeIndex; i++) {
                                playerApi.nextVideo();
                            }
                            return;
                        }
                        if (relativeIndex < 0) {
                            for (let i = 0; i < Math.abs(relativeIndex); i++) {
                                playerApi.previousVideo();
                            }
                            return;
                        }
                    }
                }

                const playButton = currentItem.querySelector<HTMLElement>('ytmusic-play-button-renderer button');
                if (playButton) {
                    playButton.click();
                    return;
                }

                const clickTargets = ['.song-title', 'ytmusic-thumbnail-renderer', '.duration'];
                let clicked = false;
                for (const selector of clickTargets) {
                    const target = currentItem.querySelector<HTMLElement>(selector);
                    if (target) {
                        target.click();
                        clicked = true;
                        break;
                    }
                }

                if (!clicked) {
                    currentItem.click();
                    const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
                    currentItem.dispatchEvent(evt);
                }
            });

            this.dom.fullscreenQueueContent.appendChild(div);
        });
    }
}
