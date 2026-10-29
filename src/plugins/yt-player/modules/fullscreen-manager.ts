import { DomManager } from './dom-manager';

export interface FullscreenManagerCallbacks {
    onOpen: () => void;
    onClose: () => void;
    onSavePosition: () => void;
    onApplyPosition: () => void;
    onTogglePopout: () => void;
}

export class FullscreenManager {
    private dom: DomManager;
    private callbacks: FullscreenManagerCallbacks;
    public isOpen: boolean = false;

    constructor(dom: DomManager, callbacks: FullscreenManagerCallbacks) {
        this.dom = dom;
        this.callbacks = callbacks;
        this.init();
    }

    private init(): void {
        this.dom.fullscreenClose.addEventListener('click', () => {
            this.close();
        });

        this.dom.fullscreenPopoutBtn.addEventListener('click', () => {
            this.callbacks.onTogglePopout();
        });

        // Click outside on miniplayer clickable area opens fullscreen
        this.dom.miniplayerClickable.addEventListener('click', (e) => {
            if (this.dom.miniplayer.classList.contains('just-dragged')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const target = e.target as HTMLElement;
            if (target.closest('#pear-miniplayer-thumb') || target.closest('.pear-miniplayer-controls')) {
                return;
            }
            this.open();
        });

        // Global shortcuts: Escape closes menus/fullscreen, Ctrl+Shift+P toggles popout
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                // If more menu is open, that should handle its own Escape first
                const moreMenu = this.dom.fullscreenMoreMenu;
                if (moreMenu.classList.contains('active')) {
                    return;
                }
            }
        });
    }

    public isImmersivePreferred(): boolean {
        try {
            const playerType = localStorage.getItem('pear-player-type');
            if (playerType === 'immersive') return true;
            if (playerType === 'normal') return false;
            return localStorage.getItem('pear-immersive-mode') === 'true';
        } catch {
            return false;
        }
    }

    public open(): void {
        window.dispatchEvent(new CustomEvent('peard:close-popout-player'));
        this.callbacks.onSavePosition();

        this.isOpen = true;
        localStorage.setItem('pear-fullscreen-open', 'true');
        this.dom.fullscreenPlayer.classList.add('active');

        this.updateLayoutSize();
        this.callbacks.onOpen();
    }

    public close(saveState: boolean = true): void {
        this.isOpen = false;
        if (saveState) {
            localStorage.setItem('pear-fullscreen-open', 'false');
        }

        this.dom.fullscreenPlayer.classList.remove('active');
        this.callbacks.onClose();
        this.callbacks.onApplyPosition();
    }

    public updateLayoutSize(): void {
        const height = window.innerHeight;
        const width = window.innerWidth;

        if (height < 570) {
            this.dom.fullscreenPlayer.style.display = 'none';
        } else {
            this.dom.fullscreenPlayer.style.display = '';
        }

        const isCompact = width < 620 || height < 700;
        this.dom.fullscreenPlayer.classList.toggle('compact-controls', isCompact);
    }
}
