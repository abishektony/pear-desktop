import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class Textyl implements LyricProvider {
    public name = 'Textyl';
    public baseUrl = 'https://api.textyl.co';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async search(_songInfo: SearchSongInfo): Promise<LyricResult | null> {
        // Disabled due to invalid SSL certificate on the API server.
        // This prevents security warnings and potential data leakage.
        return null;
    }
}
