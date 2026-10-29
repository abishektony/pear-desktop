export type VisualizerStyle = 'bars' | 'wave';

export class VisualizerRenderer {
    /**
     * Draw visualizer frame on target canvas
     */
    public static render(
        canvas: HTMLCanvasElement,
        container: HTMLElement,
        analyser: AnalyserNode,
        dataArray: Uint8Array,
        style: VisualizerStyle,
        isWidescreen: boolean = true
    ): void {
        if (!canvas || !container || !analyser || !dataArray) return;

        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Container mode classes if in fullscreen
        const parent = container.parentElement;
        if (parent && parent.classList.contains('pear-fullscreen-media')) {
            parent.classList.remove('video-mode');
            if (isWidescreen) {
                parent.classList.add('visualizer-mode');
            } else {
                parent.classList.remove('visualizer-mode');
            }
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        analyser.getByteFrequencyData(dataArray as any);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        if (style === 'wave') {
            this.drawWave(ctx, dataArray, width, height);
        } else {
            this.drawBars(ctx, dataArray, width, height);
        }
    }

    private static drawWave(
        ctx: CanvasRenderingContext2D,
        dataArray: Uint8Array,
        width: number,
        height: number
    ): void {
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;

        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e90ff';
        ctx.lineWidth = 2;

        const circleCount = 5;
        const step = Math.floor((dataArray.length / 2) / circleCount);

        for (let i = 0; i < circleCount; i++) {
            let sum = 0;
            const start = i * step;
            const count = 3;
            for (let j = 0; j < count; j++) {
                sum += dataArray[start + j] || 0;
            }
            const value = sum / count;
            const intensity = value / 255;

            const radius = ((i + 1) * (maxRadius / (circleCount + 1))) + (intensity * 8);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(77, 166, 255, ${0.3 + intensity * 0.7})`;
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    private static drawBars(
        ctx: CanvasRenderingContext2D,
        dataArray: Uint8Array,
        width: number,
        height: number
    ): void {
        const barWidth = width / dataArray.length;
        let x = 0;

        ctx.shadowBlur = 4;
        ctx.shadowColor = '#1e8fff9b';
        ctx.fillStyle = '#4da6ff9b';

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * height;
            const w = Math.max(1, barWidth - 0.5);
            ctx.fillRect(x, height - barHeight, w, barHeight);
            x += barWidth;
        }

        ctx.shadowBlur = 0;
    }

    public static drawSourceToCanvas(
        canvas: HTMLCanvasElement,
        container: HTMLElement,
        source: CanvasImageSource
    ): void {
        if (!canvas || !container) return;

        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        ctx.drawImage(source, 0, 0, width, height);
    }

    public static clear(canvas: HTMLCanvasElement | null): void {
        if (canvas) {
            canvas.style.display = 'none';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }
}
