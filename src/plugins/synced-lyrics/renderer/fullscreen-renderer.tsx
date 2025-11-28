import { createEffect, createSignal, For, Show } from 'solid-js';
import { currentLyrics } from './store';
import { currentTime, config } from './renderer';
import type { LineLyrics } from '../types';
import './fullscreen-renderer.css';

interface FullscreenLyricsRendererProps {
    container?: HTMLElement;
}

export const FullscreenLyricsRenderer = (props: FullscreenLyricsRendererProps) => {
    const [lines, setLines] = createSignal<LineLyrics[]>([]);
    const [currentIndex, setCurrentIndex] = createSignal(-1);

    createEffect(() => {
        const lyricsState = currentLyrics();
        if (!lyricsState || lyricsState.state !== 'done' || !lyricsState.data?.lines) {
            setLines([]);
            return;
        }
        setLines(lyricsState.data.lines);
    });

    createEffect(() => {
        const time = currentTime();
        const lyricLines = lines();

        if (lyricLines.length === 0) {
            setCurrentIndex(-1);
            return;
        }

        // Find the current active line
        let activeIdx = -1;
        for (let i = 0; i < lyricLines.length; i++) {
            const line = lyricLines[i];
            if (line.timeInMs >= time) continue;
            if (time - line.timeInMs >= line.duration) continue;
            activeIdx = i;
            break;
        }

        setCurrentIndex(activeIdx);
    });

    const getLineStatus = (index: number) => {
        const current = currentIndex();
        if (index === current) return 'current';
        if (index < current) return 'previous';
        return 'upcoming';
    };

    return (
        <div class="fullscreen-lyrics-container">
            <Show when={lines().length > 0} fallback={
                <div class="fullscreen-lyrics-empty">
                    <div class="music-note">♪</div>
                    <div class="empty-text">No lyrics available</div>
                </div>
            }>
                <div class="fullscreen-lyrics-scroll">
                    <For each={lines()}>
                        {(line, index) => (
                            <div
                                class={`fullscreen-lyric-line ${getLineStatus(index())}`}
                                data-index={index()}
                            >
                                <div class="lyric-text">{line.text}</div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};
