import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { selectors, tabStates } from './utils';
import { setConfig, setCurrentTime } from './renderer';
import { fetchLyrics } from './store';

import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';
import type { SongInfo } from '@/providers/song-info';
import type { SyncedLyricsPluginConfig } from '../types';

export let _ytAPI: MusicPlayer | null = null;
export let netFetch: (
  url: string,
  init?: RequestInit,
) => Promise<[number, string, Record<string, string>]>;

const LYRICS_OFFSETS_STORAGE_KEY = 'pear-lyrics-offsets';

export const getCleanTrackKey = (title?: string, artist?: string): string => {
  const t = (title || '').trim().toLowerCase();
  const a = (artist || '').trim().toLowerCase();
  return t ? `track:${t}:::${a}` : '';
};

export const getSongLyricsKey = (info?: Partial<SongInfo> | null): string => {
  if (info?.videoId) return info.videoId;
  try {
    const playerApi = (document.querySelector('ytmusic-player-bar') as any)?.playerApi_;
    const apiVideoId = playerApi?.getVideoData?.()?.video_id;
    if (apiVideoId) return apiVideoId;
  } catch (_) {}
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const v = urlParams.get('v');
    if (v) return v;
  } catch (_) {}
  if (info?.title) {
    return getCleanTrackKey(info.title, info.artist);
  }
  const titleEl = document.querySelector('.title.ytmusic-player-bar');
  const artistEl = document.querySelector('.byline.ytmusic-player-bar');
  return getCleanTrackKey(titleEl?.textContent || '', artistEl?.textContent || '');
};

export const getSavedLyricsOffset = (songKey?: string, alternateKey?: string): number => {
  try {
    const raw = localStorage.getItem(LYRICS_OFFSETS_STORAGE_KEY);
    if (!raw) return 0;
    const offsets = JSON.parse(raw) as Record<string, number>;
    if (songKey && typeof offsets[songKey] === 'number') {
      return offsets[songKey];
    }
    if (alternateKey && typeof offsets[alternateKey] === 'number') {
      return offsets[alternateKey];
    }
    // Try current song from DOM if keys were not passed or matched
    const currentVideoId = getSongLyricsKey();
    if (currentVideoId && typeof offsets[currentVideoId] === 'number') {
      return offsets[currentVideoId];
    }
    const titleEl = document.querySelector('.title.ytmusic-player-bar');
    const artistEl = document.querySelector('.byline.ytmusic-player-bar');
    const trackKey = getCleanTrackKey(titleEl?.textContent || '', artistEl?.textContent || '');
    if (trackKey && typeof offsets[trackKey] === 'number') {
      return offsets[trackKey];
    }
    return 0;
  } catch (_) {
    return 0;
  }
};

export const saveLyricsOffset = (songKey: string, offset: number, alternateKey?: string): void => {
  try {
    const raw = localStorage.getItem(LYRICS_OFFSETS_STORAGE_KEY);
    const offsets = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
    const keys = [songKey, alternateKey].filter(Boolean) as string[];

    // Also associate current title:::artist representation for cross-session and cross-view reliability
    const titleEl = document.querySelector('.title.ytmusic-player-bar');
    const artistEl = document.querySelector('.byline.ytmusic-player-bar');
    const trackKey = getCleanTrackKey(titleEl?.textContent || '', artistEl?.textContent || '');
    if (trackKey && !keys.includes(trackKey)) {
      keys.push(trackKey);
    }

    for (const k of keys) {
      if (offset === 0) {
        delete offsets[k];
      } else {
        offsets[k] = offset;
      }
    }

    localStorage.setItem(LYRICS_OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
    (window as any).pearLyricsOffset = offset;
    window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: offset }));
  } catch (_) {}
};

// Expose on window for miniplayer and other components
(window as any).getPearSongLyricsKey = getSongLyricsKey;
(window as any).getPearSavedLyricsOffset = getSavedLyricsOffset;
(window as any).savePearLyricsOffset = saveLyricsOffset;
(window as any).getCleanTrackKey = getCleanTrackKey;

export const renderer = createRenderer<
  {
    observerCallback: MutationCallback;
    observer?: MutationObserver;
    videoDataChange: () => Promise<void>;
    updateTimestampInterval?: NodeJS.Timeout | string | number;
  },
  SyncedLyricsPluginConfig
>({
  onConfigChange(newConfig) {
    setConfig(newConfig);
  },

  observerCallback(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      const header = mutation.target as HTMLElement;

      switch (mutation.attributeName) {
        case 'disabled':
          header.removeAttribute('disabled');
          break;
        case 'aria-selected':
          tabStates[header.ariaSelected ?? 'false']();
          break;
      }
    }
  },

  async onPlayerApiReady(api: MusicPlayer) {
    _ytAPI = api;

    api.addEventListener('videodatachange', this.videoDataChange);

    // Listen for real-time lyrics offset changes to immediately update timestamps
    window.addEventListener('peard:lyrics-offset-changed', (e: any) => {
      const offset = typeof e.detail === 'number' ? e.detail : ((window as any).pearLyricsOffset || 0);
      const baseTime = (_ytAPI?.getCurrentTime() ?? document.querySelector('video')?.currentTime ?? 0) * 1000;
      setCurrentTime(baseTime + offset);
    });

    await this.videoDataChange();
  },
  async videoDataChange() {
    // Restore per-song lyric delay if available
    const info = (window as any).pearCurrentSongInfo;
    const songKey = getSongLyricsKey(info);
    const alternateKey = getCleanTrackKey(info?.title, info?.artist);
    const savedOffset = getSavedLyricsOffset(songKey, alternateKey);
    (window as any).pearLyricsOffset = savedOffset;
    window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: savedOffset }));

    if (!this.updateTimestampInterval) {
      this.updateTimestampInterval = setInterval(() => {
        const baseTime = (_ytAPI?.getCurrentTime() ?? document.querySelector('video')?.currentTime ?? 0) * 1000;
        const offset = (window as any).pearLyricsOffset || 0;
        setCurrentTime(baseTime + offset);
      }, 100);
    }

    // prettier-ignore
    this.observer ??= new MutationObserver(this.observerCallback);
    this.observer.disconnect();

    // Force the lyrics tab to be enabled at all times.
    const header = await waitForElement<HTMLElement>(selectors.head);
    {
      header.removeAttribute('disabled');
      tabStates[header.ariaSelected ?? 'false']();
    }

    this.observer.observe(header, { attributes: true });
    header.removeAttribute('disabled');
  },

  async start(ctx: RendererContext<SyncedLyricsPluginConfig>) {
    netFetch = ctx.ipc.invoke.bind(ctx.ipc, 'synced-lyrics:fetch');

    setConfig(await ctx.getConfig());

    ctx.ipc.on('peard:update-song-info', (info: SongInfo) => {
      (window as any).pearCurrentSongInfo = info;
      const songKey = getSongLyricsKey(info);
      const alternateKey = getCleanTrackKey(info?.title, info?.artist);
      const savedOffset = getSavedLyricsOffset(songKey, alternateKey);
      (window as any).pearLyricsOffset = savedOffset;
      window.dispatchEvent(new CustomEvent('peard:lyrics-offset-changed', { detail: savedOffset }));
      fetchLyrics(info);
    });
  },
});
