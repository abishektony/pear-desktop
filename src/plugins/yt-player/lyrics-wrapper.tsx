import { render } from 'solid-js/web';
import { LyricsRenderer, setIsVisible } from '../synced-lyrics/renderer/renderer';
import { CompactLyricsRenderer, getCurrentLyricText, currentLyricData } from '../synced-lyrics/renderer/compact-renderer';

let dispose: (() => void) | null = null;
let compactDispose: (() => void) | null = null;

// Mount the compact renderer immediately (it doesn't render UI, just tracks current lyric)
// This ensures lyrics data is always available, even before the lyrics panel is opened
function ensureCompactRendererMounted() {
    if (!compactDispose) {
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.display = 'none';
        document.body.appendChild(hiddenContainer);
        compactDispose = render(() => <CompactLyricsRenderer />, hiddenContainer);
    }
}

// Mount compact renderer on module load
ensureCompactRendererMounted();

export function mountLyrics(container: HTMLElement) {
    if (dispose) dispose();

    setIsVisible(true);
    dispose = render(() => <LyricsRenderer container={container} />, container);

    // Ensure compact renderer is mounted
    ensureCompactRendererMounted();
}

export function unmountLyrics() {
    if (dispose) {
        dispose();
        dispose = null;
    }
    // Don't unmount the compact renderer - keep it running for continuous lyric tracking
    setIsVisible(false);
}

// Ensure compact renderer is mounted
ensureCompactRendererMounted();

// Export the current lyric data for external use
export { getCurrentLyricText, currentLyricData };
import { currentLyrics } from '../synced-lyrics/renderer/store';
import { canonicalize, romanize, simplifyUnicode } from '../synced-lyrics/renderer/utils';

export function getAllLyrics() {
    const state = currentLyrics();
    if (state && state.state === 'done' && state.data && state.data.lines) {
        return state.data.lines;
    }
    return [];
}

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
