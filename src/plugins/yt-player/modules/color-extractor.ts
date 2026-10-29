import { FastAverageColor } from 'fast-average-color';
import Color from 'color';

export class ColorExtractor {
    private fac: FastAverageColor;
    private lastExtractedUrl: string | null = null;

    constructor() {
        this.fac = new FastAverageColor();
    }

    public async extractAndApply(imageUrl: string | null): Promise<void> {
        if (!imageUrl || imageUrl.startsWith('data:')) {
            this.resetColors();
            return;
        }

        if (imageUrl === this.lastExtractedUrl) {
            return;
        }

        try {
            const colorResult = await this.fac.getColorAsync(imageUrl, {
                algorithm: 'dominant',
                ignoredColor: [0, 0, 0, 255, 10], // ignore pure blacks
            });

            this.lastExtractedUrl = imageUrl;
            const hex = colorResult.hex;
            const c = Color(hex);

            // Enhance vibrancy if it's too dark or dull
            const vibrant = c.isDark() ? c.lighten(0.3).saturate(0.2) : c.saturate(0.1);
            const accentHex = vibrant.hex();
            const [r, g, b] = vibrant.rgb().array();

            const root = document.documentElement;
            root.style.setProperty('--pear-accent-color', accentHex);
            root.style.setProperty('--pear-accent-rgb', `${r}, ${g}, ${b}`);
            root.style.setProperty('--pear-accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
            root.style.setProperty('--pear-dominant-color', hex);
        } catch (err) {
            // Ignore color extraction errors (e.g. CORS or network failure)
            this.resetColors();
        }
    }

    public resetColors(): void {
        this.lastExtractedUrl = null;
        const root = document.documentElement;
        root.style.removeProperty('--pear-accent-color');
        root.style.removeProperty('--pear-accent-rgb');
        root.style.removeProperty('--pear-accent-glow');
        root.style.removeProperty('--pear-dominant-color');
    }

    public destroy(): void {
        this.resetColors();
        this.fac.destroy();
    }
}
