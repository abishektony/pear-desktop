import { render } from 'solid-js/web';
import { LyricsRenderer, setIsVisible } from '../synced-lyrics/renderer/renderer';
import { CompactLyricsRenderer, getCurrentLyricText, currentLyricData, resetCompactLyricData } from '../synced-lyrics/renderer/compact-renderer';
import { currentLyrics, fetchLyrics } from '../synced-lyrics/renderer/store';
import { canonicalize, romanize, simplifyUnicode } from '../synced-lyrics/renderer/utils';
import { getSongInfo } from '@/providers/song-info-front';

let currentMountedContainer: HTMLElement | null = null;
let dispose: (() => void) | null = null;
let compactDispose: (() => void) | null = null;

// Mount the compact renderer immediately (it doesn't render UI, just tracks current lyric)
// This ensures lyrics data is always available, even before the lyrics panel is opened
export function ensureCompactRendererMounted() {
    if (!compactDispose) {
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.display = 'none';
        document.body.appendChild(hiddenContainer);
        compactDispose = render(() => <CompactLyricsRenderer />, hiddenContainer);
    }
}

// Mount compact renderer on module load
ensureCompactRendererMounted();

/**
 * Ensures lyrics are loaded for the current track.
 * Safely callable from anywhere (player switch, fullscreen open, song change).
 */
export function ensureLyricsLoaded() {
    const state = currentLyrics();
    if (state && state.state === 'done' && state.data && (state.data.lines || state.data.lyrics)) {
        return;
    }

    const info = (window as any).pearCurrentSongInfo || getSongInfo();
    if (info && (info.videoId || info.title)) {
        fetchLyrics(info);
    }
}

/**
 * Mounts the full interactive SolidJS lyrics component into the specified container.
 * If already mounted in this container, preserves it and sets visibility.
 */
export function mountLyrics(container: HTMLElement) {
    if (!container) return;

    if (currentMountedContainer === container && dispose) {
        setIsVisible(true);
        ensureLyricsLoaded();
        return;
    }

    if (dispose) {
        dispose();
        dispose = null;
    }

    currentMountedContainer = container;
    setIsVisible(true);
    dispose = render(() => <LyricsRenderer container={container} />, container);

    ensureCompactRendererMounted();
    ensureLyricsLoaded();
}

/**
 * Safely unmounts the lyrics renderer.
 * If container is provided, only unmounts if that container is currently mounted.
 */
export function unmountLyrics(container?: HTMLElement) {
    if (container && currentMountedContainer !== container) {
        return;
    }

    if (dispose) {
        dispose();
        dispose = null;
    }
    currentMountedContainer = null;
    setIsVisible(false);
}

/**
 * Returns whether lyrics are currently mounted in the specified container (or any container).
 */
export function isLyricsMounted(container?: HTMLElement): boolean {
    if (container) {
        return currentMountedContainer === container && dispose !== null;
    }
    return dispose !== null;
}

/**
 * Resets compact lyrics state on song change so old track lines do not linger.
 */
export function clearLyricsState() {
    resetCompactLyricData();
}

/**
 * Standard function to get all lyrics lines for current track from the store.
 */
export function getAllLyrics() {
    const state = currentLyrics();
    if (state && state.state === 'done' && state.data && state.data.lines) {
        return state.data.lines;
    }
    return [];
}

/**
 * Romanize a lyric string if needed.
 */
export async function getRomanizedLyric(text: string): Promise<string | null> {
    if (!text) return null;
    const input = canonicalize(text);
    const result = await romanize(input);
    const romanized = canonicalize(result);

    if (simplifyUnicode(text) !== simplifyUnicode(romanized)) {
        return romanized;
    }
    return null;
}

// Export the current lyric text and data functions
export { getCurrentLyricText, currentLyricData, resetCompactLyricData };
