import { ProviderNames } from './index';
import { YTMusic } from './YTMusic';
import { LRCLib } from './LRCLib';
import { MusixMatch } from './MusixMatch';
import { LyricsGenius } from './LyricsGenius';
import { Megalobiz } from './Megalobiz';
import { Textyl } from './Textyl';
import { Spotify } from './Spotify';

export const providers = {
  [ProviderNames.YTMusic]: new YTMusic(),
  [ProviderNames.LRCLib]: new LRCLib(),
  [ProviderNames.MusixMatch]: new MusixMatch(),
  [ProviderNames.LyricsGenius]: new LyricsGenius(),
  [ProviderNames.Megalobiz]: new Megalobiz(),
  [ProviderNames.Textyl]: new Textyl(),
  [ProviderNames.Spotify]: new Spotify(),
} as const;
