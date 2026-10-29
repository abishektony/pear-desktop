import { DomManager } from './dom-manager';
import { ColorExtractor } from './color-extractor';
import { DisplayMode } from '../types';

export class ThumbnailManager {
    private dom: DomManager;
    private colorExtractor: ColorExtractor;
    private currentMiniplayerUrl: string | null = null;
    private currentFullscreenUrl: string | null = null;

    constructor(dom: DomManager, colorExtractor: ColorExtractor) {
        this.dom = dom;
        this.colorExtractor = colorExtractor;
    }

    public getThumbnailSrc(): string | null {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            s = s.trim();
            if (s === '') return true;
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        // 1) Media Session API
        try {
            const ms = (navigator as any).mediaSession;
            if (ms && ms.metadata && Array.isArray(ms.metadata.artwork)) {
                const arts = ms.metadata.artwork.slice().reverse();
                for (const a of arts) {
                    if (a && a.src && !isPlaceholder(a.src)) return a.src;
                }
            }
        } catch (_) {}

        // 2) Try to derive YouTube video id
        const tryVideoId = (): string | null => {
            try {
                const urlVid = new URL(window.location.href).searchParams.get('v');
                if (urlVid) return urlVid;
            } catch (_) {}

            const titleLink = document.querySelector<HTMLAnchorElement>('.title.ytmusic-player-bar a[href*="watch?v="]');
            if (titleLink) {
                try {
                    const u = new URL(titleLink.href, window.location.href);
                    const v = u.searchParams.get('v');
                    if (v) return v;
                } catch (_) {}
            }

            const vidAttrEl = document.querySelector<HTMLElement>('[data-video-id], [video-id], [data-videoid]');
            if (vidAttrEl) {
                return (
                    vidAttrEl.getAttribute('data-video-id') ||
                    vidAttrEl.getAttribute('video-id') ||
                    vidAttrEl.getAttribute('data-videoid') ||
                    null
                );
            }

            return null;
        };

        const vid = tryVideoId();
        if (vid) {
            return `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`;
        }

        // 3) DOM fallback heuristics
        const imgSelectors = [
            'ytmusic-player-bar #song-image img',
            'ytmusic-player-bar yt-img-shadow img',
            '#song-image img',
            'yt-img-shadow img',
            '.image.ytmusic-player-bar img',
            '.thumbnail img',
            '#thumbnail img',
        ];
        for (const sel of imgSelectors) {
            const img = document.querySelector<HTMLImageElement>(sel);
            if (!img) continue;
            const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-thumb') || null;
            if (src && !isPlaceholder(src)) return src;
        }

        const bgEl = document.querySelector<HTMLElement>('#song-image, ytmusic-player-bar yt-img-shadow, .image.ytmusic-player-bar, .thumbnail');
        if (bgEl) {
            const bg = bgEl.style.backgroundImage || window.getComputedStyle(bgEl).backgroundImage;
            if (bg && bg !== 'none') {
                const m = bg.match(/url\(["']?(.*?)["']?\)/);
                if (m && m[1] && !isPlaceholder(m[1])) return m[1];
            }
        }

        const metaImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="og:image"]');
        if (metaImg && metaImg.content && !isPlaceholder(metaImg.content)) return metaImg.content;

        return null;
    }

    public updateThumbnails(candidate: string | null, preferredMode: DisplayMode): void {
        this.verifyAndSetMiniplayerImage(candidate);
        this.verifyAndSetFullscreenImage(candidate, preferredMode);
    }

    public verifyAndSetMiniplayerImage(candidate: string | null): void {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        const setBg = (url: string | null) => {
            if (!this.dom.miniplayerThumb) return;
            if (!url) {
                this.dom.miniplayerThumb.style.backgroundImage = '';
                this.currentMiniplayerUrl = null;
                return;
            }
            if (url === this.currentMiniplayerUrl) return;
            this.currentMiniplayerUrl = url;
            this.dom.miniplayerThumb.style.backgroundImage = `url(${url})`;
            this.dom.miniplayerThumb.style.backgroundSize = 'cover';
            this.dom.miniplayerThumb.style.backgroundPosition = 'center';
        };

        if (!candidate || isPlaceholder(candidate)) {
            setBg(null);
            return;
        }

        const tryLoad = (url: string, onFail?: () => void) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setBg(url);
            img.onerror = () => {
                if (onFail) onFail();
                else setBg(null);
            };
            img.src = url;
        };

        const ytMatch = candidate.match(/\/vi\/([^/]+)\/([^/]+)\.jpg/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const fallbacks = [
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/default.jpg`,
            ];
            let i = 0;
            const tryNext = () => {
                if (i >= fallbacks.length) return setBg(null);
                const url = fallbacks[i++];
                tryLoad(url, tryNext);
            };
            tryNext();
            return;
        }

        tryLoad(candidate);
    }

    public verifyAndSetFullscreenImage(candidate: string | null, preferredMode: DisplayMode): void {
        const isPlaceholder = (s?: string | null) => {
            if (!s) return true;
            if (s.startsWith('data:') && s.length < 200) return true;
            return false;
        };

        const setBg = (url: string | null) => {
            if (!this.dom.fullscreenThumbTop) return;

            if (!url) {
                this.dom.fullscreenThumbTop.style.backgroundImage = '';
                this.currentFullscreenUrl = null;
                this.dom.fullscreenPlayer.style.setProperty('--bg-image', 'none');
                document.documentElement.style.setProperty('--bg-image', 'none');
                this.colorExtractor.resetColors();
                return;
            }

            if (url === this.currentFullscreenUrl) return;

            const topLayer = this.dom.fullscreenThumbTop;
            const bottomLayer = this.dom.fullscreenThumbBottom;

            if (!topLayer || !bottomLayer || preferredMode === 'video') {
                if (topLayer) {
                    topLayer.style.backgroundImage = `url(${url})`;
                    topLayer.style.backgroundSize = 'cover';
                    topLayer.style.backgroundPosition = 'center';
                    topLayer.style.opacity = '1';
                }
                if (bottomLayer) {
                    bottomLayer.style.backgroundImage = `url(${url})`;
                    bottomLayer.style.backgroundSize = 'cover';
                    bottomLayer.style.backgroundPosition = 'center';
                }
                this.currentFullscreenUrl = url;
                this.dom.fullscreenPlayer.style.setProperty('--bg-image', `url("${url}")`);
                document.documentElement.style.setProperty('--bg-image', `url("${url}")`);
                this.colorExtractor.extractAndApply(url);
                return;
            }

            // Dual-layer smooth dissolve crossfade
            bottomLayer.style.backgroundImage = `url(${url})`;
            bottomLayer.style.backgroundSize = 'cover';
            bottomLayer.style.backgroundPosition = 'center';

            topLayer.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)';
            topLayer.style.opacity = '0';

            setTimeout(() => {
                topLayer.style.backgroundImage = `url(${url})`;
                topLayer.style.backgroundSize = 'cover';
                topLayer.style.backgroundPosition = 'center';

                topLayer.style.transition = 'none';
                topLayer.style.opacity = '1';

                setTimeout(() => {
                    topLayer.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)';
                }, 50);

                this.currentFullscreenUrl = url;
                this.dom.fullscreenPlayer.style.setProperty('--bg-image', `url("${url}")`);
                document.documentElement.style.setProperty('--bg-image', `url("${url}")`);
                this.colorExtractor.extractAndApply(url);
            }, 1000);
        };

        if (!candidate || isPlaceholder(candidate)) {
            setBg(null);
            return;
        }

        const tryLoad = (url: string, onFail?: () => void) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setBg(url);
            img.onerror = () => {
                if (onFail) onFail();
                else setBg(null);
            };
            img.src = url;
        };

        const ytMatch = candidate.match(/\/vi\/([^/]+)\/([^/]+)\.jpg/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const fallbacks = [
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                `https://i.ytimg.com/vi/${videoId}/default.jpg`,
            ];
            let i = 0;
            const tryNext = () => {
                if (i >= fallbacks.length) return setBg(null);
                const url = fallbacks[i++];
                tryLoad(url, tryNext);
            };
            tryNext();
            return;
        }

        tryLoad(candidate);
    }

    public getCurrentFullscreenUrl(): string | null {
        return this.currentFullscreenUrl;
    }

    public getCurrentMiniplayerUrl(): string | null {
        return this.currentMiniplayerUrl;
    }
}
