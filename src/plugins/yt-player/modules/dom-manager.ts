import { ElementFromHtml } from '@/plugins/utils/renderer';
import { miniplayerHTML } from '../template';

export class DomManager {
    public readonly root: HTMLElement;

    // Miniplayer Elements
    public readonly miniplayer: HTMLElement;
    public readonly miniplayerClickable: HTMLElement;
    public readonly miniplayerThumb: HTMLElement;
    public readonly miniplayerCanvas: HTMLCanvasElement;
    public readonly miniplayerTitle: HTMLElement;
    public readonly miniplayerArtist: HTMLElement;
    public readonly miniplayerPlay: HTMLButtonElement;
    public readonly miniplayerPrev: HTMLButtonElement;
    public readonly miniplayerNext: HTMLButtonElement;
    public readonly miniplayerSeek: HTMLElement;
    public readonly miniplayerSeekProgress: HTMLElement;
    public readonly miniplayerSeekPreview: HTMLElement;

    // Fullscreen Player Elements
    public readonly fullscreenPlayer: HTMLElement;
    public readonly actionAnimator: HTMLElement;
    public readonly fullscreenVisualizerBgCanvas: HTMLCanvasElement;
    public readonly visualizerOverlay: HTMLElement | null;
    public readonly fullscreenThumbTop: HTMLElement;
    public readonly fullscreenThumbBottom: HTMLElement;
    public readonly fullscreenCanvas: HTMLCanvasElement;
    public readonly fullscreenTitle: HTMLElement;
    public readonly fullscreenArtist: HTMLElement;
    public readonly fullscreenSeek: HTMLElement;
    public readonly fullscreenSeekProgress: HTMLElement;
    public readonly fullscreenSeekPreview: HTMLElement;
    public readonly fullscreenLike: HTMLButtonElement;
    public readonly fullscreenPrev: HTMLButtonElement;
    public readonly fullscreenPlay: HTMLButtonElement;
    public readonly fullscreenNext: HTMLButtonElement;
    public readonly fullscreenRepeat: HTMLButtonElement;
    public readonly fullscreenCurrentLyric: HTMLElement;
    public readonly fullscreenCurrentLyricText: HTMLElement;
    public readonly fullscreenVolumeBtn: HTMLButtonElement;
    public readonly fullscreenVolumeSlider: HTMLInputElement;
    public readonly fullscreenVolumeValue: HTMLElement;
    public readonly fullscreenSleepBtn: HTMLButtonElement;
    public readonly sleepTimerBadge: HTMLElement;
    public readonly fullscreenSyncBtn: HTMLButtonElement;
    public readonly fullscreenQueueBtn: HTMLButtonElement;
    public readonly fullscreenImmersiveToggle: HTMLButtonElement;
    public readonly fullscreenLyricsBtn: HTMLButtonElement;
    public readonly fullscreenPopoutBtn: HTMLButtonElement;
    public readonly fullscreenMoreBtn: HTMLButtonElement;
    public readonly fullscreenClose: HTMLButtonElement;

    // More Menu Elements
    public readonly fullscreenMoreMenu: HTMLElement;
    public readonly moreMenuBackdrop: HTMLElement;
    public readonly moreMenuClose: HTMLButtonElement;
    public readonly moreVolBtn: HTMLButtonElement;
    public readonly moreVolSlider: HTMLInputElement;
    public readonly moreVolVal: HTMLElement;
    public readonly moreItemQueue: HTMLElement;
    public readonly moreItemLyrics: HTMLElement;
    public readonly moreItemImmersive: HTMLElement;
    public readonly moreItemSleep: HTMLElement;
    public readonly moreItemSync: HTMLElement;
    public readonly moreItemPopout: HTMLElement;
    public readonly moreItemLike: HTMLElement;
    public readonly moreItemRepeat: HTMLElement;
    public readonly moreSleepBadge: HTMLElement;
    public readonly moreSleepStatus: HTMLElement;
    public readonly moreLikeStatus: HTMLElement;
    public readonly moreRepeatStatus: HTMLElement;

    // Panels
    public readonly fullscreenLyricsPanel: HTMLElement;
    public readonly fullscreenLyricsContent: HTMLElement;
    public readonly fullscreenQueuePanel: HTMLElement;
    public readonly fullscreenQueueContent: HTMLElement;

    // Sleep Timer Elements
    public readonly sleepTimerModal: HTMLElement;
    public readonly sleepTimerCustomInput: HTMLInputElement;
    public readonly sleepTimerWaitCheckbox: HTMLInputElement;
    public readonly sleepTimerStartBtn: HTMLButtonElement;
    public readonly sleepTimerCancelBtn: HTMLButtonElement;
    public readonly sleepTimerCloseBtn: HTMLButtonElement;
    public readonly sleepTimerOptions: NodeListOf<HTMLButtonElement>;

    // Sync Lyrics Elements
    public readonly syncLyricsModal: HTMLElement;
    public readonly syncLyricsDisplay: HTMLElement;
    public readonly syncLyricsHint: HTMLElement;
    public readonly syncLyricsSlider: HTMLInputElement;
    public readonly syncLyricsCustomInput: HTMLInputElement;
    public readonly syncLyricsNudgeBtns: NodeListOf<HTMLButtonElement>;
    public readonly syncLyricsOptions: NodeListOf<HTMLButtonElement>;
    public readonly syncLyricsApplyBtn: HTMLButtonElement;
    public readonly syncLyricsCloseBtn: HTMLButtonElement;

    constructor() {
        this.root = ElementFromHtml(miniplayerHTML);

        // Miniplayer
        this.miniplayer = this.require('#pear-miniplayer');
        this.miniplayerClickable = this.require('#pear-miniplayer-clickable');
        this.miniplayerThumb = this.require('#pear-miniplayer-thumb');
        this.miniplayerCanvas = this.require('#pear-miniplayer-canvas');
        this.miniplayerTitle = this.require('#pear-miniplayer-title');
        this.miniplayerArtist = this.require('#pear-miniplayer-artist');
        this.miniplayerPlay = this.require('#pear-miniplayer-play');
        this.miniplayerPrev = this.require('#pear-miniplayer-prev');
        this.miniplayerNext = this.require('#pear-miniplayer-next');
        this.miniplayerSeek = this.require('#pear-miniplayer-seek');
        this.miniplayerSeekProgress = this.require('#pear-miniplayer-seek-progress');
        this.miniplayerSeekPreview = this.require('#pear-miniplayer-seek-preview');

        // Fullscreen
        this.fullscreenPlayer = this.require('#pear-fullscreen-player');
        this.actionAnimator = this.require('#pear-action-animator');
        this.fullscreenVisualizerBgCanvas = this.require('#pear-fullscreen-visualizer-bg');
        this.visualizerOverlay = this.query('#pear-visualizer-overlay');
        this.fullscreenThumbTop = this.require('#pear-fullscreen-thumb-top');
        this.fullscreenThumbBottom = this.require('#pear-fullscreen-thumb-bottom');
        this.fullscreenCanvas = this.require('#pear-fullscreen-canvas');
        this.fullscreenTitle = this.require('#pear-fullscreen-title');
        this.fullscreenArtist = this.require('#pear-fullscreen-artist');
        this.fullscreenSeek = this.require('#pear-fullscreen-seek');
        this.fullscreenSeekProgress = this.require('#pear-fullscreen-seek-progress');
        this.fullscreenSeekPreview = this.require('#pear-fullscreen-seek-preview');
        this.fullscreenLike = this.require('#pear-fullscreen-like');
        this.fullscreenPrev = this.require('#pear-fullscreen-prev');
        this.fullscreenPlay = this.require('#pear-fullscreen-play');
        this.fullscreenNext = this.require('#pear-fullscreen-next');
        this.fullscreenRepeat = this.require('#pear-fullscreen-repeat');
        this.fullscreenCurrentLyric = this.require('#pear-fullscreen-current-lyric');
        this.fullscreenCurrentLyricText = this.require('#pear-fullscreen-current-lyric-text');
        this.fullscreenVolumeBtn = this.require('#pear-fullscreen-volume-btn');
        this.fullscreenVolumeSlider = this.require('#pear-fullscreen-volume-slider');
        this.fullscreenVolumeValue = this.require('#pear-fullscreen-volume-value');
        this.fullscreenSleepBtn = this.require('#pear-fullscreen-sleep-btn');
        this.sleepTimerBadge = this.require('#pear-sleep-timer-badge');
        this.fullscreenSyncBtn = this.require('#pear-fullscreen-sync-btn');
        this.fullscreenQueueBtn = this.require('#pear-fullscreen-queue-btn');
        this.fullscreenImmersiveToggle = this.require('#pear-immersive-toggle');
        this.fullscreenLyricsBtn = this.require('#pear-fullscreen-lyrics-btn');
        this.fullscreenPopoutBtn = this.require('#pear-fullscreen-popout-btn');
        this.fullscreenMoreBtn = this.require('#pear-fullscreen-more-btn');
        this.fullscreenClose = this.require('#pear-fullscreen-close');

        // More Menu
        this.fullscreenMoreMenu = this.require('#pear-fullscreen-more-menu');
        this.moreMenuBackdrop = this.require('#pear-more-menu-backdrop');
        this.moreMenuClose = this.require('#pear-more-menu-close');
        this.moreVolBtn = this.require('#pear-more-vol-btn');
        this.moreVolSlider = this.require('#pear-more-vol-slider');
        this.moreVolVal = this.require('#pear-more-vol-val');
        this.moreItemQueue = this.require('#pear-more-item-queue');
        this.moreItemLyrics = this.require('#pear-more-item-lyrics');
        this.moreItemImmersive = this.require('#pear-more-item-immersive');
        this.moreItemSleep = this.require('#pear-more-item-sleep');
        this.moreItemSync = this.require('#pear-more-item-sync');
        this.moreItemPopout = this.require('#pear-more-item-popout');
        this.moreItemLike = this.require('#pear-more-item-like');
        this.moreItemRepeat = this.require('#pear-more-item-repeat');
        this.moreSleepBadge = this.require('#pear-more-sleep-badge');
        this.moreSleepStatus = this.require('#pear-more-sleep-status');
        this.moreLikeStatus = this.require('#pear-more-like-status');
        this.moreRepeatStatus = this.require('#pear-more-repeat-status');

        // Panels
        this.fullscreenLyricsPanel = this.require('#pear-fullscreen-lyrics-panel');
        this.fullscreenLyricsContent = this.require('#pear-fullscreen-lyrics-content');
        this.fullscreenQueuePanel = this.require('#pear-fullscreen-queue-panel');
        this.fullscreenQueueContent = this.require('#pear-fullscreen-queue-content');

        // Sleep Timer
        this.sleepTimerModal = this.require('#pear-sleep-timer-modal');
        this.sleepTimerCustomInput = this.require('#pear-sleep-timer-custom-input');
        this.sleepTimerWaitCheckbox = this.require('#pear-sleep-timer-wait-end');
        this.sleepTimerStartBtn = this.require('#pear-sleep-timer-start');
        this.sleepTimerCancelBtn = this.require('#pear-sleep-timer-cancel');
        this.sleepTimerCloseBtn = this.require('#pear-sleep-timer-close');
        this.sleepTimerOptions = this.root.querySelectorAll<HTMLButtonElement>('.pear-sleep-timer-options button');

        // Sync Lyrics
        this.syncLyricsModal = this.require('#pear-sync-lyrics-modal');
        this.syncLyricsDisplay = this.require('#pear-sync-lyrics-display');
        this.syncLyricsHint = this.require('#pear-sync-lyrics-hint');
        this.syncLyricsSlider = this.require('#pear-sync-lyrics-slider');
        this.syncLyricsCustomInput = this.require('#pear-sync-lyrics-custom-input');
        this.syncLyricsNudgeBtns = this.root.querySelectorAll<HTMLButtonElement>('#pear-sync-lyrics-modal .pear-sync-nudge-btn');
        this.syncLyricsOptions = this.root.querySelectorAll<HTMLButtonElement>('#pear-sync-lyrics-options .pear-sleep-timer-option');
        this.syncLyricsApplyBtn = this.require('#pear-sync-lyrics-apply');
        this.syncLyricsCloseBtn = this.require('#pear-sync-lyrics-close');

        // Mount modals directly to body so they are at root stacking context and never covered by lyrics or pages
        if (this.sleepTimerModal && this.sleepTimerModal.parentElement !== document.body) {
            document.body.appendChild(this.sleepTimerModal);
        }
        if (this.syncLyricsModal && this.syncLyricsModal.parentElement !== document.body) {
            document.body.appendChild(this.syncLyricsModal);
        }
    }

    public query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
        return this.root.querySelector<T>(selector);
    }

    public queryAll<T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T> {
        return this.root.querySelectorAll<T>(selector);
    }

    private require<T extends HTMLElement = HTMLElement>(selector: string): T {
        const el = this.root.querySelector<T>(selector);
        if (!el) {
            throw new Error(`[YT-Player] Required element not found: ${selector}`);
        }
        return el;
    }
}
