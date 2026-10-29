import { DomManager } from './dom-manager';
import {
    mountLyrics,
    unmountLyrics,
    getCurrentLyricText
} from '../lyrics-wrapper';

export class LyricsPanel {
    private dom: DomManager;
    public isOpen: boolean = false;
    private currentLyricUpdateInterval: number | null = null;
    private currentLyricText: string = '';

    constructor(dom: DomManager) {
        this.dom = dom;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenLyricsBtn.addEventListener('click', () => {
            this.toggle();
        });

        const savedOpen = localStorage.getItem('pear-lyrics-open');
        if (savedOpen === 'true') {
            setTimeout(() => {
                if (!this.isOpen) this.toggle(true);
            }, 500);
        }
    }

    public async toggle(open?: boolean, onQueueCloseNeeded?: () => void): Promise<void> {
        this.isOpen = open !== undefined ? open : !this.isOpen;

        if (this.isOpen) {
            try {
                if (this.dom.fullscreenLyricsContent) {
                    mountLyrics(this.dom.fullscreenLyricsContent);
                }

                this.dom.fullscreenLyricsPanel.classList.add('active');
                this.dom.fullscreenPlayer.classList.add('lyrics-open');
                this.dom.fullscreenLyricsBtn.classList.add('active');
                this.dom.moreItemLyrics.classList.add('active');

                if (onQueueCloseNeeded && window.innerWidth < 1200) {
                    onQueueCloseNeeded();
                }

                if (this.currentLyricUpdateInterval) {
                    clearInterval(this.currentLyricUpdateInterval);
                }
                this.currentLyricUpdateInterval = window.setInterval(() => {
                    this.updateCurrentLyric();
                }, 100);

                localStorage.setItem('pear-lyrics-open', 'true');
            } catch (error) {
                console.error('[LyricsPanel] Failed to load lyrics:', error);
                this.isOpen = false;
            }
        } else {
            try {
                if (this.currentLyricUpdateInterval) {
                    clearInterval(this.currentLyricUpdateInterval);
                    this.currentLyricUpdateInterval = null;
                }

                if (this.dom.fullscreenLyricsContent) {
                    unmountLyrics(this.dom.fullscreenLyricsContent);
                }

                this.dom.fullscreenLyricsPanel.classList.remove('active');
                this.dom.fullscreenPlayer.classList.remove('lyrics-open');
                this.dom.fullscreenLyricsBtn.classList.remove('active');
                this.dom.moreItemLyrics.classList.remove('active');

                this.dom.fullscreenCurrentLyricText.innerHTML = '';
                this.dom.fullscreenCurrentLyric.classList.remove('visible');
                this.currentLyricText = '';

                localStorage.setItem('pear-lyrics-open', 'false');
            } catch (error) {
                console.error('[LyricsPanel] Failed to unmount lyrics:', error);
            }
        }
    }

    private updateCurrentLyric(): void {
        if (!this.dom.fullscreenCurrentLyricText || !this.isOpen) return;

        const isBottomMode = window.innerWidth >= 300 && window.innerWidth <= 799;
        if (!isBottomMode) {
            this.dom.fullscreenCurrentLyricText.innerHTML = '';
            this.currentLyricText = '';
            this.dom.fullscreenCurrentLyric.classList.remove('visible');
            return;
        }

        const lyricText = getCurrentLyricText();
        if (lyricText === this.currentLyricText) {
            return;
        }
        this.currentLyricText = lyricText;

        this.dom.fullscreenCurrentLyricText.innerHTML = '';

        if (lyricText && lyricText.trim()) {
            const lines = lyricText.split('\n');
            lines.forEach((line, lineIndex) => {
                const words = line.split(' ');
                const lineContainer = document.createElement('div');
                lineContainer.className = lineIndex === 0 ? 'lyric-line-main' : 'lyric-line-romanization';

                words.forEach((word, index) => {
                    if (word.trim()) {
                        const span = document.createElement('span');
                        span.className = 'lyric-word';
                        span.style.animationDelay = `${index * 0.05}s`;
                        span.textContent = word + ' ';
                        lineContainer.appendChild(span);
                    }
                });

                this.dom.fullscreenCurrentLyricText.appendChild(lineContainer);
            });

            this.dom.fullscreenCurrentLyric.classList.add('visible');
        } else {
            const musicSymbol = document.createElement('span');
            musicSymbol.className = 'lyric-word music-symbol';
            musicSymbol.textContent = '♪';
            this.dom.fullscreenCurrentLyricText.appendChild(musicSymbol);
            this.dom.fullscreenCurrentLyric.classList.add('visible');
        }
    }

    public destroy(): void {
        if (this.currentLyricUpdateInterval) {
            clearInterval(this.currentLyricUpdateInterval);
            this.currentLyricUpdateInterval = null;
        }
        if (this.dom.fullscreenLyricsContent) {
            unmountLyrics(this.dom.fullscreenLyricsContent);
        }
    }
}
