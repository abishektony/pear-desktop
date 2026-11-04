import { LRC } from '../parsers/lrc';
import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class KuGou implements LyricProvider {
  name = 'KuGou';
  baseUrl = 'https://lyrics.kugou.com';

  private normalizeTitle(title: string): string {
    return title
      .replace(/\(.*?\)/g, '')
      .replace(/（.*?）/g, '')
      .replace(/「.*?」/g, '')
      .replace(/『.*?』/g, '')
      .replace(/<.*?>/g, '')
      .replace(/《.*?》/g, '')
      .trim();
  }

  private normalizeArtist(artist: string): string {
    return artist
      .replace(/,\s*/g, '、')
      .replace(/\s*&\s*/g, '、')
      .replace(/\./g, '')
      .replace(/和/g, '、')
      .replace(/\(.*?\)/g, '')
      .replace(/（.*?）/g, '')
      .trim();
  }

  private cleanLrc(raw: string): string {
    const lines = raw.split(/\r?\n/);
    const timeRegex = /^\[\d{2}:\d{2}\.\d{2,3}\].*/;
    const infoRegex = /.+].+[:：].+/;

    const filtered = lines.filter((l) => timeRegex.test(l.trim()));
    if (filtered.length === 0) return raw;

    let headCut = 0;
    const limit = Math.min(30, filtered.length);
    for (let i = 0; i < limit; i++) {
      if (infoRegex.test(filtered[i])) {
        headCut = i + 1;
      }
    }

    return filtered.slice(headCut).join('\n');
  }

  async search({
    title,
    artist,
    album: _album,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    if (!title) return null;

    try {
      const cleanTitle = this.normalizeTitle(title);
      const cleanArtist = this.normalizeArtist(artist || '');
      const query = cleanArtist ? `${cleanTitle} - ${cleanArtist}` : cleanTitle;
      const durationMs = songDuration > 0 ? Math.round(songDuration * 1000) : 0;

      // 1. Try search lyrics by keyword directly
      let searchUrl = `${this.baseUrl}/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(query)}`;
      if (durationMs > 0) {
        searchUrl += `&duration=${durationMs}`;
      }

      let res = await fetch(searchUrl);
      let candidate: { id: number; accesskey: string } | null = null;

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.candidates && data.candidates.length > 0) {
          candidate = data.candidates[0];
        }
      }

      // 2. If no candidate, try searching songs first to get hash
      if (!candidate) {
        const songSearchUrl = `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=8&showtype=0&keyword=${encodeURIComponent(query)}`;
        const songRes = await fetch(songSearchUrl);
        if (songRes.ok) {
          const songData = (await songRes.json()) as any;
          const songs = songData?.data?.info;
          if (Array.isArray(songs) && songs.length > 0) {
            // Find best matching duration
            const bestSong: any = songs.find(
              (s: any) =>
                !durationMs ||
                Math.abs((s.duration || 0) * 1000 - durationMs) <= 8000,
            ) || songs[0];

            if (bestSong?.hash) {
              const hashRes = await fetch(
                `${this.baseUrl}/search?ver=1&man=yes&client=pc&hash=${bestSong.hash}`,
              );
              if (hashRes.ok) {
                const hashData = (await hashRes.json()) as any;
                if (hashData?.candidates && hashData.candidates.length > 0) {
                  candidate = hashData.candidates[0];
                }
              }
            }
          }
        }
      }

      if (!candidate) return null;

      // 3. Download lyric
      const downloadUrl = `${this.baseUrl}/download?fmt=lrc&charset=utf8&client=pc&ver=1&id=${candidate.id}&accesskey=${candidate.accesskey}`;
      const downRes = await fetch(downloadUrl);
      if (!downRes.ok) return null;

      const downData = (await downRes.json()) as any;
      if (!downData?.content) return null;

      // Base64 decode
      const decodedLrc = decodeURIComponent(
        escape(atob(downData.content)),
      );
      const cleaned = this.cleanLrc(decodedLrc);
      const parsed = LRC.parse(cleaned);

      if (!parsed.lines || parsed.lines.length === 0) return null;

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
    } catch (err) {
      console.error('[KuGou] Search error:', err);
      return null;
    }
  }
}

