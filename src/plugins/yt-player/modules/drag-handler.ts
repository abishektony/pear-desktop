import { PlayerPosition } from '../types';

export class DragHandler {
    private element: HTMLElement;
    private isDraggableEnabled: () => boolean;

    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private miniplayerStartX: number = 0;
    private miniplayerStartY: number = 0;
    public isDragging: boolean = false;
    private savedPosition: PlayerPosition | null = null;

    private boundHandleMouseMove: (e: MouseEvent) => void;
    private boundHandleMouseUp: (e: MouseEvent) => void;
    private boundHandleMouseDown: (e: MouseEvent) => void;

    constructor(element: HTMLElement, isDraggableEnabled: () => boolean) {
        this.element = element;
        this.isDraggableEnabled = isDraggableEnabled;

        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);

        this.init();
    }

    private init(): void {
        this.element.addEventListener('mousedown', this.boundHandleMouseDown);
        this.loadSavedPosition();
        this.applyPosition();
    }

    private handleMouseDown(e: MouseEvent): void {
        if (window.innerWidth <= 450 || !this.isDraggableEnabled()) return;

        const target = e.target as HTMLElement;
        if (
            target.closest('.pear-miniplayer-controls') ||
            target.closest('#pear-miniplayer-thumb') ||
            target.closest('.pear-miniplayer-seek')
        ) {
            return;
        }

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const rect = this.element.getBoundingClientRect();
        this.miniplayerStartX = rect.left;
        this.miniplayerStartY = rect.top;

        document.addEventListener('mousemove', this.boundHandleMouseMove);
        document.addEventListener('mouseup', this.boundHandleMouseUp);

        e.preventDefault();
        e.stopPropagation();
    }

    private handleMouseMove(e: MouseEvent): void {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        const dragThreshold = 5;
        const hasMoved = Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold;

        if (!this.isDragging && hasMoved) {
            this.isDragging = true;
            this.element.style.userSelect = 'none';
            this.element.classList.add('dragging');
        }

        if (!this.isDragging) return;

        const elementWidth = this.element.offsetWidth;
        const elementHeight = this.element.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const centerX = (windowWidth - elementWidth) / 2;
        const bottomY = windowHeight - elementHeight;
        const snapThreshold = 50;

        let finalX = this.miniplayerStartX + deltaX;
        let finalY = this.miniplayerStartY + deltaY;

        if (Math.abs(finalX - centerX) < snapThreshold && Math.abs(finalY - bottomY) < snapThreshold) {
            finalX = centerX;
            finalY = bottomY;
            this.element.classList.add('snapped');
        } else {
            this.element.classList.remove('snapped');
        }

        const percentX = (finalX / windowWidth) * 100;
        const percentY = (finalY / windowHeight) * 100;

        const maxX = 100 - (elementWidth / windowWidth) * 100;
        const maxY = 100 - (elementHeight / windowHeight) * 100;

        const constrainedX = Math.max(0, Math.min(percentX, maxX));
        const constrainedY = Math.max(0, Math.min(percentY, maxY));

        this.element.style.setProperty('left', `${constrainedX}%`, 'important');
        this.element.style.setProperty('top', `${constrainedY}%`, 'important');
        this.element.style.setProperty('bottom', 'auto', 'important');
        this.element.style.setProperty('transform', 'none', 'important');
    }

    private handleMouseUp(): void {
        const wasDragging = this.isDragging;
        this.isDragging = false;

        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);

        this.element.classList.remove('dragging');
        this.element.style.userSelect = '';

        if (wasDragging) {
            if (this.element.classList.contains('snapped')) {
                this.resetPosition();
                this.savedPosition = null;
                localStorage.removeItem('pear-miniplayer-position');
                this.element.classList.remove('snapped');
            } else {
                this.savePosition();
            }

            this.element.classList.add('just-dragged');
            setTimeout(() => {
                this.element.classList.remove('just-dragged');
            }, 500);
        }
    }

    public savePosition(): void {
        if (window.innerWidth <= 450) return;

        const rect = this.element.getBoundingClientRect();
        const percentX = (rect.left / window.innerWidth) * 100;
        const percentY = (rect.top / window.innerHeight) * 100;

        this.savedPosition = { x: percentX, y: percentY };

        try {
            localStorage.setItem('pear-miniplayer-position', JSON.stringify(this.savedPosition));
        } catch (e) {
            console.error('[Miniplayer] Failed to save position:', e);
        }
    }

    public loadSavedPosition(): void {
        if (window.innerWidth <= 450) return;

        try {
            const saved = localStorage.getItem('pear-miniplayer-position');
            if (saved) {
                this.savedPosition = JSON.parse(saved) as PlayerPosition | null;
            }
        } catch (e) {
            console.error('[Miniplayer] Failed to load position:', e);
        }
    }

    public applyPosition(): void {
        if (window.innerWidth <= 450 || !this.savedPosition) return;

        const elementWidth = this.element.offsetWidth || 475;
        const elementHeight = this.element.offsetHeight || 70;

        const maxX = 100 - (elementWidth / window.innerWidth) * 100;
        const maxY = 100 - (elementHeight / window.innerHeight) * 100;

        const constrainedX = Math.max(0, Math.min(this.savedPosition.x, maxX));
        const constrainedY = Math.max(0, Math.min(this.savedPosition.y, maxY));

        this.element.style.setProperty('left', `${constrainedX}%`, 'important');
        this.element.style.setProperty('top', `${constrainedY}%`, 'important');
        this.element.style.setProperty('bottom', 'auto', 'important');
        this.element.style.setProperty('transform', 'none', 'important');
        this.element.classList.add('dragging');
    }

    public resetPosition(): void {
        this.element.style.removeProperty('left');
        this.element.style.removeProperty('top');
        this.element.style.removeProperty('bottom');
        this.element.style.removeProperty('transform');
        this.element.classList.remove('dragging');
    }

    public onResize(): void {
        if (window.innerWidth <= 450) {
            this.resetPosition();
        } else if (this.savedPosition) {
            this.applyPosition();
        }
    }

    public destroy(): void {
        this.element.removeEventListener('mousedown', this.boundHandleMouseDown);
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }
}
