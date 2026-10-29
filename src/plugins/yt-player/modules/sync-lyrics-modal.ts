import { DomManager } from './dom-manager';

export class SyncLyricsModal {
    private dom: DomManager;
    private currentSec: number = 0;
    private initialOffsetMs: number = 0;

    constructor(dom: DomManager) {
        this.dom = dom;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenSyncBtn.addEventListener('click', () => {
            this.openModal();
        });

        this.dom.moreItemSync.addEventListener('click', () => {
            this.openModal();
        });

        this.dom.syncLyricsCloseBtn.addEventListener('click', () => {
            this.closeAndRevert();
        });

        this.dom.syncLyricsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.syncLyricsModal) {
                this.closeAndRevert();
            }
        });

        // Slider
        this.dom.syncLyricsSlider.addEventListener('input', () => {
            const sec = parseFloat(this.dom.syncLyricsSlider.value || '0');
            this.updateSyncUI(sec, true, false);
        });

        // Custom direct input
        this.dom.syncLyricsCustomInput.addEventListener('input', () => {
            const raw = this.dom.syncLyricsCustomInput.value.trim();
            if (raw === '' || raw === '-') return;
            const sec = parseFloat(raw);
            if (!isNaN(sec)) {
                this.updateSyncUI(sec, false, true);
            }
        });

        // Nudge buttons
        this.dom.syncLyricsNudgeBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const nudge = parseFloat(btn.getAttribute('data-nudge') || '0');
                this.updateSyncUI(this.currentSec + nudge, true, true);
            });
        });

        // Preset options
        this.dom.syncLyricsOptions.forEach((option) => {
            option.addEventListener('click', () => {
                const sec = parseFloat(option.getAttribute('data-seconds') || '0');
                this.updateSyncUI(sec, true, true);
            });
        });

        // Apply
        this.dom.syncLyricsApplyBtn.addEventListener('click', () => {
            this.applyAndSave();
        });

        // Auto-restore saved per-song delay on song update
        document.addEventListener('peard:update-song-info', (e: any) => {
            const info = e.detail;
            const titleArtist = info?.title
                ? `track:${info.title.trim().toLowerCase()}:::${(info.artist || '').trim().toLowerCase()}`
                : undefined;
            const saved = (window as any).getPearSavedLyricsOffset
                ? (window as any).getPearSavedLyricsOffset(info?.videoId, titleArtist)
                : this.getSavedOffset(info?.videoId || titleArtist);
            (window as any).pearLyricsOffset = saved;
            window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: saved }));
        });
    }

    public openModal(): void {
        if (this.dom.syncLyricsModal.parentElement !== document.body) {
            document.body.appendChild(this.dom.syncLyricsModal);
        }
        document.body.classList.add('pear-modal-open');
        const songKey = this.getSongKey();
        const currentOffset = this.getSavedOffset(songKey);
        this.initialOffsetMs = currentOffset;
        this.updateSyncUI(currentOffset / 1000, true, true);
        this.dom.syncLyricsModal.classList.add('active');
    }

    private closeAndRevert(): void {
        document.body.classList.remove('pear-modal-open');
        this.dom.syncLyricsModal.classList.remove('active');
        (window as any).pearLyricsOffset = this.initialOffsetMs;
        window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: this.initialOffsetMs }));
    }

    private applyAndSave(): void {
        document.body.classList.remove('pear-modal-open');
        const finalMs = Math.round(this.currentSec * 1000);
        (window as any).pearLyricsOffset = finalMs;
        const songKey = this.getSongKey();
        this.saveOffset(songKey, finalMs);
        this.initialOffsetMs = finalMs;
        window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: finalMs }));
        this.dom.syncLyricsModal.classList.remove('active');
    }

    private updateSyncUI(sec: number, updateInput = true, updateSlider = true): void {
        this.currentSec = Math.round(sec * 100) / 100;
        const currentMs = Math.round(this.currentSec * 1000);

        (window as any).pearLyricsOffset = currentMs;
        window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: currentMs }));

        if (updateSlider && this.dom.syncLyricsSlider) {
            const clamped = Math.max(-10, Math.min(10, this.currentSec));
            this.dom.syncLyricsSlider.value = String(clamped);
        }

        if (updateInput && this.dom.syncLyricsCustomInput) {
            this.dom.syncLyricsCustomInput.value = this.currentSec === 0 ? '0' : String(this.currentSec);
        }

        if (this.dom.syncLyricsDisplay) {
            if (this.currentSec > 0) {
                this.dom.syncLyricsDisplay.textContent = `+${this.currentSec.toFixed(2)}s`;
                this.dom.syncLyricsDisplay.className = 'pear-sync-lyrics-badge offset-positive';
            } else if (this.currentSec < 0) {
                this.dom.syncLyricsDisplay.textContent = `${this.currentSec.toFixed(2)}s`;
                this.dom.syncLyricsDisplay.className = 'pear-sync-lyrics-badge offset-negative';
            } else {
                this.dom.syncLyricsDisplay.textContent = '0.0s';
                this.dom.syncLyricsDisplay.className = 'pear-sync-lyrics-badge';
            }
        }

        if (this.dom.syncLyricsHint) {
            if (this.currentSec > 0) {
                this.dom.syncLyricsHint.textContent = `Lyrics delayed by ${this.currentSec.toFixed(2)}s`;
            } else if (this.currentSec < 0) {
                this.dom.syncLyricsHint.textContent = `Lyrics advanced by ${Math.abs(this.currentSec).toFixed(2)}s`;
            } else {
                this.dom.syncLyricsHint.textContent = 'In sync (0.0s)';
            }
        }

        this.dom.syncLyricsOptions.forEach((option) => {
            const optSec = parseFloat(option.getAttribute('data-seconds') || '0');
            if (Math.abs(optSec - this.currentSec) < 0.04) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }

    private getSongKey(): string {
        const currentInfo = (window as any).pearCurrentSongInfo;
        if ((window as any).getPearSongLyricsKey) {
            const k = (window as any).getPearSongLyricsKey(currentInfo);
            if (k) return k;
        }
        if (currentInfo?.videoId) return currentInfo.videoId;
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const v = urlParams.get('v');
            if (v) return v;
        } catch (_) {}
        const titleEl = document.querySelector('.title.ytmusic-player-bar');
        const artistEl = document.querySelector('.byline.ytmusic-player-bar');
        const t = titleEl?.textContent?.trim().toLowerCase() || '';
        const a = artistEl?.textContent?.trim().toLowerCase() || '';
        return t ? `track:${t}:::${a}` : '';
    }

    private getSavedOffset(key?: string): number {
        const currentInfo = (window as any).pearCurrentSongInfo;
        const altKey = (window as any).getCleanTrackKey
            ? (window as any).getCleanTrackKey(currentInfo?.title, currentInfo?.artist)
            : undefined;
        if ((window as any).getPearSavedLyricsOffset) {
            return (window as any).getPearSavedLyricsOffset(key, altKey);
        }
        try {
            const raw = localStorage.getItem('pear-lyrics-offsets');
            if (!raw) return 0;
            const offsets = JSON.parse(raw) as Record<string, number>;
            if (key && typeof offsets[key] === 'number') return offsets[key];
            if (altKey && typeof offsets[altKey] === 'number') return offsets[altKey];
            return 0;
        } catch (_) {
            return 0;
        }
    }

    private saveOffset(key: string, offset: number): void {
        const currentInfo = (window as any).pearCurrentSongInfo;
        const altKey = (window as any).getCleanTrackKey
            ? (window as any).getCleanTrackKey(currentInfo?.title, currentInfo?.artist)
            : undefined;
        if ((window as any).savePearLyricsOffset) {
            (window as any).savePearLyricsOffset(key, offset, altKey);
            return;
        }
        try {
            const raw = localStorage.getItem('pear-lyrics-offsets');
            const offsets = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
            const keys = [key, altKey].filter(Boolean) as string[];
            const titleEl = document.querySelector('.title.ytmusic-player-bar');
            const artistEl = document.querySelector('.byline.ytmusic-player-bar');
            const t = titleEl?.textContent?.trim().toLowerCase() || '';
            const a = artistEl?.textContent?.trim().toLowerCase() || '';
            const domKey = t ? `track:${t}:::${a}` : '';
            if (domKey && !keys.includes(domKey)) keys.push(domKey);

            for (const k of keys) {
                if (offset === 0) {
                    delete offsets[k];
                } else {
                    offsets[k] = offset;
                }
            }
            localStorage.setItem('pear-lyrics-offsets', JSON.stringify(offsets));
        } catch (_) {}
    }
}
