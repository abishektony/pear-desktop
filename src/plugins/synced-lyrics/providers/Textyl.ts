import { jaroWinkler } from '@skyra/jaro-winkler';

import { LRC } from '../parsers/lrc';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class Textyl implements LyricProvider {
    public name = 'Textyl';
    public baseUrl = 'https://api.textyl.co';

    async search({ title, artist, songDuration }: SearchSongInfo): Promise<LyricResult | null> {
        const query = new URLSearchParams({
            q: `${artist} ${title}`,
        });

        try {
            const response = await fetch(`${this.baseUrl}/api/lyrics?${query}`, {
                signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) {
                throw new Error(`bad HTTPStatus(${response.statusText})`);
            }

            const data = await response.json() as TextylResponse;

            // Check if we got valid results
            if (!data || !Array.isArray(data) || data.length === 0) {
                return null;
            }

            // Filter results by artist and title similarity
            const filteredResults = data.filter((item) => {
                const titleSimilarity = jaroWinkler(
                    title.toLowerCase(),
                    item.title.toLowerCase()
                );
                const artistSimilarity = jaroWinkler(
                    artist.toLowerCase(),
                    item.artist.toLowerCase()
                );

                // Require at least 0.8 similarity for both title and artist
                return titleSimilarity >= 0.8 && artistSimilarity >= 0.8;
            });

            if (filteredResults.length === 0) {
                return null;
            }

            // Sort by duration similarity
            filteredResults.sort((a, b) => {
                const durationA = a.duration || songDuration;
                const durationB = b.duration || songDuration;
                const diffA = Math.abs(durationA - songDuration);
                const diffB = Math.abs(durationB - songDuration);
                return diffA - diffB;
            });

            const closestResult = filteredResults[0];

            // Check if duration is within acceptable range (15 seconds)
            if (closestResult.duration && Math.abs(closestResult.duration - songDuration) > 15) {
                return null;
            }

            // Check if we have synced lyrics
            if (!closestResult.lyrics) {
                return null;
            }

            // Parse the LRC format lyrics
            const lyrics = LRC.parse(closestResult.lyrics);

            return {
                title: closestResult.title,
                artists: [closestResult.artist],
                lines: lyrics.lines.map((l) => ({ ...l, status: 'upcoming' })),
            };
        } catch (error) {
            // If Textyl is offline or has issues, fail gracefully
            if (error instanceof Error) {
                console.warn(`Textyl API error: ${error.message}`);
            }
            // Return null instead of throwing to allow other providers to try
            return null;
        }
    }
}

interface TextylResponse extends Array<TextylLyric> { }

interface TextylLyric {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    lyrics: string; // LRC format
}
