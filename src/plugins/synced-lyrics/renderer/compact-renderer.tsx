import { createEffect, createSignal, onCleanup } from 'solid-js';
import { currentLyrics } from './store';
import { currentTime, config } from './renderer';
import { canonicalize, romanize, simplifyUnicode } from './utils';
import type { LineLyrics } from '../types';

export interface CompactLyricsData {
    text: string;
    romanization?: string;
    hasLyrics: boolean;
}

// Signal to expose current lyric data
export const [currentLyricData, setCurrentLyricData] = createSignal<CompactLyricsData>({
    text: '',
    romanization: undefined,
    hasLyrics: false,
});

/**
 * Compact Lyrics Renderer for Miniplayer
 * This doesn't render any UI, it just tracks the current active lyric
 * and exposes it via the currentLyricData signal
 */
export function CompactLyricsRenderer() {
    createEffect(() => {
        const lyricsState = currentLyrics();
        const time = currentTime();

        if (!lyricsState || lyricsState.state !== 'done' || !lyricsState.data?.lines) {
            setCurrentLyricData({
                text: '',
                romanization: undefined,
                hasLyrics: false,
            });
            return;
        }

        const lines = lyricsState.data.lines;

        // Find the current active lyric line based on time
        // Same logic as the main renderer (renderer.tsx lines 263-266)
        let activeLine: LineLyrics | null = null;

        for (const line of lines) {
            if (line.timeInMs >= time) {
                // This line hasn't started yet
                continue;
            }
            if (time - line.timeInMs >= line.duration) {
                // This line has finished
                continue;
            }
            // This line is currently playing
            activeLine = line;
            break;
        }

        if (activeLine) {
            const text = activeLine.text.trim();

            // Fetch romanization if enabled and text is non-Latin
            if (config()?.romanization && text) {
                const input = canonicalize(text);
                romanize(input).then((result) => {
                    const romanized = canonicalize(result);
                    // Only show romanization if it's different from the original
                    if (simplifyUnicode(text) !== simplifyUnicode(romanized)) {
                        setCurrentLyricData({
                            text: text,
                            romanization: romanized,
                            hasLyrics: true,
                        });
                    } else {
                        setCurrentLyricData({
                            text: text,
                            romanization: undefined,
                            hasLyrics: true,
                        });
                    }
                });
            } else {
                setCurrentLyricData({
                    text: text,
                    romanization: undefined,
                    hasLyrics: true,
                });
            }
        } else {
            setCurrentLyricData({
                text: '♪',
                romanization: undefined,
                hasLyrics: true, // We have lyrics, just not at this timestamp
            });
        }
    });

    onCleanup(() => {
        setCurrentLyricData({
            text: '',
            romanization: undefined,
            hasLyrics: false,
        });
    });

    // This component doesn't render anything
    return null;
}

/**
 * Get the current lyric text with optional romanization
 * @param includeRomanization - Whether to include romanization
 * @returns Current lyric text, optionally with romanization on a new line
 */
export function getCurrentLyricText(includeRomanization: boolean = true): string {
    const data = currentLyricData();

    if (!data.hasLyrics || !data.text) {
        return '';
    }

    if (includeRomanization && data.romanization) {
        return `${data.text}\n${data.romanization}`;
    }

    return data.text;
}
