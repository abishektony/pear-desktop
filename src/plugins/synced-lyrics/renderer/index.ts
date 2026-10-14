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

export const getSavedLyricsOffset = (songKey: string): number => {
  if (!songKey) return 0;
  try {
    const raw = localStorage.getItem(LYRICS_OFFSETS_STORAGE_KEY);
    if (!raw) return 0;
    const offsets = JSON.parse(raw);
    const val = offsets[songKey];
    return typeof val === 'number' ? val : 0;
  } catch (_) {
    return 0;
  }
};

export const saveLyricsOffset = (songKey: string, offset: number): void => {
  if (!songKey) return;
  try {
    const raw = localStorage.getItem(LYRICS_OFFSETS_STORAGE_KEY);
    const offsets = raw ? JSON.parse(raw) : {};
    if (offset === 0) {
      delete offsets[songKey];
    } else {
      offsets[songKey] = offset;
    }
    localStorage.setItem(LYRICS_OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
  } catch (_) {}
};

export const getSongLyricsKey = (info?: Partial<SongInfo> | null): string => {
  if (info?.videoId) return info.videoId;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const v = urlParams.get('v');
    if (v) return v;
  } catch (_) {}
  if (info?.title) {
    return `${info.title.trim().toLowerCase()}:::${(info.artist || '').trim().toLowerCase()}`;
  }
  const titleEl = document.querySelector('.title.ytmusic-player-bar');
  const artistEl = document.querySelector('.byline.ytmusic-player-bar');
  const t = titleEl?.textContent?.trim().toLowerCase() || '';
  const a = artistEl?.textContent?.trim().toLowerCase() || '';
  if (t) return `${t}:::${a}`;
  return '';
};

// Expose on window for miniplayer and other components
(window as any).getPearSongLyricsKey = getSongLyricsKey;
(window as any).getPearSavedLyricsOffset = getSavedLyricsOffset;
(window as any).savePearLyricsOffset = saveLyricsOffset;

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

    await this.videoDataChange();
  },
  async videoDataChange() {
    // Restore per-song lyric delay if available
    const songKey = getSongLyricsKey((window as any).pearCurrentSongInfo);
    // @ts-ignore
    window.pearLyricsOffset = songKey ? getSavedLyricsOffset(songKey) : 0;

    if (!this.updateTimestampInterval) {
      this.updateTimestampInterval = setInterval(() => {
        const baseTime = (_ytAPI?.getCurrentTime() ?? 0) * 1000;
        // @ts-ignore
        const offset = window.pearLyricsOffset || 0;
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
      // @ts-ignore
      window.pearLyricsOffset = songKey ? getSavedLyricsOffset(songKey) : 0;
      fetchLyrics(info);
    });
  },
});
