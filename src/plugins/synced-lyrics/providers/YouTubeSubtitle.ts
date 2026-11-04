import type { LineLyrics, LyricProvider, LyricResult, SearchSongInfo } from '../types';
import type { MusicPlayerAppElement } from '@/types/music-player-app-element';

export class YouTubeSubtitle implements LyricProvider {
  name = 'YouTubeSubtitle';
  baseUrl = 'https://music.youtube.com';

  async search({ videoId, title, artist }: SearchSongInfo): Promise<LyricResult | null> {
    if (!videoId) return null;

    try {
      const app = document.querySelector<MusicPlayerAppElement>('ytmusic-app');
      let transcriptData: any = null;

      if (app?.networkManager?.fetch) {
        try {
          transcriptData = await app.networkManager.fetch<any, any>(
            '/get_transcript?prettyPrint=false',
            {
              params: btoa(`\x0a\x0b${videoId}`), // Protobuf encoded videoId param or direct videoId
            },
          );
        } catch (_) {}

        if (!transcriptData) {
          try {
            transcriptData = await app.networkManager.fetch<any, any>(
              '/get_transcript?prettyPrint=false',
              { videoId },
            );
          } catch (_) {}
        }
      }

      // If networkManager fetch didn't yield cues, fallback to public youtubei API
      if (!transcriptData) {
        const url = 'https://music.youtube.com/youtubei/v1/get_transcript?prettyPrint=false';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB_REMIX',
                clientVersion: '1.20240101.01.00',
              },
            },
            params: btoa(`\x0a\x0b${videoId}`),
          }),
        });

        if (res.ok) {
          transcriptData = await res.json();
        }
      }

      const cueGroups =
        transcriptData?.actions?.[0]?.updateEngagementPanelAction?.content
          ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;

      if (!Array.isArray(cueGroups) || cueGroups.length === 0) {
        return null;
      }

      const lines: LineLyrics[] = [];

      for (let i = 0; i < cueGroups.length; i++) {
        const group = cueGroups[i] as any;
        const cueRenderer =
          group?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer;
        if (!cueRenderer) continue;

        const timeInMs = parseInt(cueRenderer.startOffsetMs || '0', 10);
        let rawText = cueRenderer.cue?.simpleText || '';
        // Clean musical note symbol and extra whitespace
        const text = rawText.replace(/^[♪♫\s]+|[♪♫\s]+$/g, '').trim();
        if (!text) continue;

        const duration = parseInt(cueRenderer.durationMs || '2500', 10);

        const minutes = Math.floor(timeInMs / 60000);
        const seconds = Math.floor((timeInMs % 60000) / 1000);
        const centis = Math.floor((timeInMs % 1000) / 10);
        const time = `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;

        lines.push({
          time,
          timeInMs,
          duration: Math.max(500, duration),
          text,
          status: 'upcoming',
        });
      }

      if (lines.length === 0) return null;

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
      console.warn('[YouTubeSubtitle] Error fetching transcript:', err);
      return null;
    }
  }
}

