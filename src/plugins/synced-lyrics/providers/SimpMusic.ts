import { LRC } from '../parsers/lrc';
import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

interface SimpLyricsData {
  id?: string;
  videoId?: string;
  songTitle?: string;
  artistName?: string;
  albumName?: string;
  durationSeconds?: number;
  syncedLyrics?: string;
  plainLyric?: string;
  richSyncLyrics?: string;
  vote?: number;
}

interface SimpApiResponse {
  type?: string;
  data?: SimpLyricsData[];
}

export class SimpMusic implements LyricProvider {
  name = 'SimpMusic';
  baseUrl = 'https://api-lyrics.simpmusic.org/v1';

  async search({
    videoId,
    title,
    artist,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    if (!videoId) return null;

    try {
      const url = `${this.baseUrl}/${videoId}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SimpMusicLyrics/1.0',
        },
      });

      if (!res.ok) return null;

      const body = (await res.json()) as SimpApiResponse;
      if (body.type !== 'success' || !Array.isArray(body.data) || body.data.length === 0) {
        return null;
      }

      // Filter by duration tolerance (10 seconds)
      const validTracks = songDuration > 0
        ? body.data.filter(
            (t) =>
              typeof t.durationSeconds !== 'number' ||
              Math.abs(t.durationSeconds - songDuration) <= 10,
          )
        : body.data;

      if (validTracks.length === 0) return null;

      // Find best matching track
      const bestTrack = songDuration > 0 && validTracks.length > 1
        ? validTracks.reduce((prev, curr) => {
            const prevDiff = Math.abs((prev.durationSeconds || 0) - songDuration);
            const currDiff = Math.abs((curr.durationSeconds || 0) - songDuration);
            return currDiff < prevDiff ? curr : prev;
          })
        : validTracks[0];

      // Prioritize richSyncLyrics, then syncedLyrics, then plainLyric
      const lrcString =
        bestTrack.richSyncLyrics ||
        bestTrack.syncedLyrics ||
        null;

      if (lrcString && lrcString.trim()) {
        const parsed = LRC.parse(lrcString);
        if (parsed.lines && parsed.lines.length > 0) {
          return {
            title,
            artists: [artist],
            lines: parsed.lines.map((l) => ({
              time: l.time,
              timeInMs: l.timeInMs,
              duration: l.duration,
              text: l.text,
              status: 'upcoming',
              words: l.words,
            })),
          };
        }
      }

      if (bestTrack.plainLyric && bestTrack.plainLyric.trim()) {
        return {
          title,
          artists: [artist],
          lyrics: bestTrack.plainLyric.trim(),
        };
      }

      return null;
    } catch (err) {
      console.warn('[SimpMusic] Search error:', err);
      return null;
    }
  }
}

