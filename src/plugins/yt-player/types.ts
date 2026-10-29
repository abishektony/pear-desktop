export interface MiniplayerConfig {
    enabled: boolean;
    visualizerEnabled: boolean;
    visualizerStyle: 'bars' | 'wave';
    videoEnabled: boolean;
    clickToSwitch: boolean;
    draggableEnabled: boolean;
    widescreenMode: boolean;
    crossfadeEnabled: boolean;
    autoOpenOnSongChange: boolean;
    backgroundVisualizer: 'none' | 'butterchurn' | 'sphere';
}

export type DisplayMode = 'visualizer' | 'video' | 'thumbnail';

export interface SongInfo {
    title: string;
    artist: string;
    thumbnail?: string;
    videoId?: string;
    isLiked?: boolean;
    repeatMode?: 'NONE' | 'ONE' | 'ALL';
    duration?: number;
    currentTime?: number;
}

export interface SpherePoint {
    x: number;
    y: number;
    z: number;
}

export interface PlayerPosition {
    x: number;
    y: number;
}
