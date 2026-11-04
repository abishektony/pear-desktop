import type { LineLyrics, LyricProvider, LyricResult, SearchSongInfo } from '../types';

interface LyricsPlusLine {
  time: number;
  duration?: number;
  text: string;
}

interface LyricsPlusResponse {
  type?: string;
  lyrics?: LyricsPlusLine[];
}

export class LyricsPlus implements LyricProvider {
  name = 'LyricsPlus';
  baseUrl = 'https://lyricsplus.binimum.org';

  private mirrorUrls = [
    'https://lyricsplus.binimum.org',
    'https://lyricsplus.atomix.one',
    'https://lyricsplus-seven.vercel.app',
  ];

  async search({
    title,
    artist,
    album,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    if (!title || !artist) return null;

    const durationSec = songDuration > 0 ? Math.round(songDuration) : -1;

    for (const base of this.mirrorUrls) {
      try {
        const query = new URLSearchParams({
          title,
          artist,
          duration: durationSec.toString(),
          source: 'apple,lyricsplus,musixmatch,spotify,musixmatch-word',
        });
        if (album && album !== 'undefined') {
          query.set('album', album);
        }

        const url = `${base}/v2/lyrics/get?${query.toString()}`;
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!res.ok) continue;

        const data = (await res.json()) as LyricsPlusResponse;
        if (!data?.lyrics || data.lyrics.length === 0) continue;

        const lines: LineLyrics[] = [];
        for (let i = 0; i < data.lyrics.length; i++) {
          const item = data.lyrics[i];
          if (!item.text || !item.text.trim()) continue;

          const timeInMs = Math.round(item.time);
          let duration = item.duration ? Math.round(item.duration) : 0;
          if (!duration || duration <= 0) {
            if (i < data.lyrics.length - 1) {
              duration = Math.max(500, Math.round(data.lyrics[i + 1].time) - timeInMs);
            } else {
              duration = 3000;
            }
          }

          const minutes = Math.floor(timeInMs / 60000);
          const seconds = Math.floor((timeInMs % 60000) / 1000);
          const centis = Math.floor((timeInMs % 1000) / 10);
          const time = `${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;

          lines.push({
            time,
            timeInMs,
            duration,
            text: item.text.trim(),
            status: 'upcoming',
          });
        }

        if (lines.length === 0) continue;

        const first = lines.at(0);
        if (first && first.timeInMs > 300) {
          lines.unshift({
            time: '00:00.00',
            timeInMs: 0,
            duration: first.timeInMs,
            text: '',
            status: 'upcoming',
          });
        }

        return {
          title,
          artists: [artist],
          lines,
        };
      } catch (err) {
        console.warn(`[LyricsPlus] Failed from mirror ${base}:`, err);
      }
    }

    return null;
  }
}

