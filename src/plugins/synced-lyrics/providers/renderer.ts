import { ProviderNames } from './index';
import { BetterLyrics } from './BetterLyrics';
import { SimpMusic } from './SimpMusic';
import { KuGou } from './KuGou';
import { LyricsPlus } from './LyricsPlus';
import { YouTubeSubtitle } from './YouTubeSubtitle';
import { YTMusic } from './YTMusic';
import { LRCLib } from './LRCLib';
import { MusixMatch } from './MusixMatch';
import { LyricsGenius } from './LyricsGenius';
import { Megalobiz } from './Megalobiz';
import { Textyl } from './Textyl';
import { Spotify } from './Spotify';

export const providers = {
  [ProviderNames.BetterLyrics]: new BetterLyrics(),
  [ProviderNames.SimpMusic]: new SimpMusic(),
  [ProviderNames.KuGou]: new KuGou(),
  [ProviderNames.LyricsPlus]: new LyricsPlus(),
  [ProviderNames.YouTubeSubtitle]: new YouTubeSubtitle(),
  [ProviderNames.YTMusic]: new YTMusic(),
  [ProviderNames.LRCLib]: new LRCLib(),
  [ProviderNames.MusixMatch]: new MusixMatch(),
  [ProviderNames.LyricsGenius]: new LyricsGenius(),
  [ProviderNames.Megalobiz]: new Megalobiz(),
  [ProviderNames.Textyl]: new Textyl(),
  [ProviderNames.Spotify]: new Spotify(),
} as const;
