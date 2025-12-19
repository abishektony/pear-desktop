import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class Spotify implements LyricProvider {
    public name = 'Spotify';
    public baseUrl = 'https://spotify-lyric-api-984e7b4face0.herokuapp.com';

    async search({ title, artist }: SearchSongInfo): Promise<LyricResult | null> {
        try {
            // Use the unofficial API's search endpoint
            const query = new URLSearchParams({
                trackName: title,
                artistName: artist,
            });

            const response = await fetch(`${this.baseUrl}/?${query}`, {
                signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) {
                // Lyrics might not be available for this track
                return null;
            }

            const data = await response.json() as SpotifyLyricsResponse;

            if (data.error || !data.lines || data.lines.length === 0) {
                return null;
            }

            // Convert Spotify's format to our format
            const lines = data.lines
                .filter((line) => line.words && line.words.trim() !== '')
                .map((line) => ({
                    time: this.millisToTime(parseInt(line.startTimeMs)),
                    timeInMs: parseInt(line.startTimeMs),
                    duration: line.endTimeMs
                        ? parseInt(line.endTimeMs) - parseInt(line.startTimeMs)
                        : 0,
                    text: line.words.trim(),
                    status: 'upcoming' as const,
                }));

            if (lines.length === 0) {
                return null;
            }

            return {
                title: title,
                artists: [artist],
                lines,
            };
        } catch (error) {
            // Fail gracefully if Spotify API is unavailable
            if (error instanceof Error) {
                console.warn(`Spotify API error: ${error.message}`);
            }
            // Return null instead of throwing to allow other providers to try
            return null;
        }
    }

    private millisToTime(millis: number): string {
        const minutes = Math.floor(millis / 60000);
        const seconds = Math.floor((millis - minutes * 60 * 1000) / 1000);
        const remaining = (millis - minutes * 60 * 1000 - seconds * 1000) / 10;
        return `${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}.${remaining.toString().padStart(2, '0')}`;
    }
}

interface SpotifyLyricsResponse {
    error?: boolean;
    syncType?: string;
    lines: {
        startTimeMs: string;
        endTimeMs?: string;
        words: string;
    }[];
}
