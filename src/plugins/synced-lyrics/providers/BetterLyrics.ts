import { TTMLParser } from '../parsers/ttml';
import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class BetterLyrics implements LyricProvider {
  name = 'BetterLyrics';
  baseUrl = 'https://lyrics-api.boidu.dev';

  async search({
    title,
    artist,
    album,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    if (!title || !artist) return null;

    try {
      const query = new URLSearchParams({
        s: title,
        a: artist,
      });

      if (songDuration > 0) {
        query.set('d', Math.round(songDuration).toString());
      }
      if (album && album !== 'undefined') {
        query.set('al', album);
      }

      const url = `${this.baseUrl}/getLyrics?${query.toString()}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });

      if (!res.ok) {
        return null;
      }

      const json = (await res.json()) as { ttml?: string };
      if (!json || typeof json.ttml !== 'string') {
        return null;
      }

      const lines = TTMLParser.parse(json.ttml);
      if (!lines || lines.length === 0) {
        return null;
      }

      return {
        title,
        artists: [artist],
        lines,
      };
    } catch (err) {
      console.error('[BetterLyrics] Search error:', err);
      return null;
    }
  }
}

