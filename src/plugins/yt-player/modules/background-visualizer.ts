import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';
import { SpherePoint } from '../types';

export type BackgroundVisualizerType = 'none' | 'butterchurn' | 'sphere';

export class BackgroundVisualizer {
    private canvas: HTMLCanvasElement;
    private audioContext: AudioContext | null = null;
    private audioSource: any = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;

    private type: BackgroundVisualizerType = 'butterchurn';
    private butterchurnVisualizer: ReturnType<typeof Butterchurn.createVisualizer> | null = null;
    private presetCycleInterval: number | null = null;

    private spherePoints: SpherePoint[] = [];
    private sphereRotation: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public setType(type: BackgroundVisualizerType): void {
        if (this.type === type) return;
        this.cleanup();
        this.type = type;

        if (this.audioSource) {
            this.init(this.audioSource, this.audioContext, this.analyser, this.dataArray);
        }
    }

    public init(
        audioSource: any,
        audioContext: AudioContext | null,
        analyser: AnalyserNode | null,
        dataArray: Uint8Array | null
    ): void {
        this.audioSource = audioSource;
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.dataArray = dataArray;

        if (!this.canvas || this.type === 'none') return;

        if (this.type === 'butterchurn') {
            this.initButterchurn();
        } else if (this.type === 'sphere') {
            this.initSphere();
        }
    }

    private initButterchurn(): void {
        if (!this.audioContext || !this.audioSource || !this.canvas) return;
        if (this.butterchurnVisualizer) return;

        this.canvas.style.opacity = '1';
        this.canvas.style.filter = 'none';
        this.canvas.style.transform = 'none';

        try {
            this.butterchurnVisualizer = Butterchurn.createVisualizer(this.audioContext, this.canvas, {
                width: this.canvas.width || 800,
                height: this.canvas.height || 800,
                pixelRatio: window.devicePixelRatio || 1,
                textureRatio: 1,
            } as any);

            this.butterchurnVisualizer.connectAudio(this.audioSource);

            const presets = ButterchurnPresets as Record<string, any>;
            const presetKeys = Object.keys(presets);
            if (presetKeys.length > 0) {
                const randomPreset = presetKeys[Math.floor(Math.random() * presetKeys.length)];
                this.butterchurnVisualizer.loadPreset(presets[randomPreset], 0);

                if (this.presetCycleInterval) clearInterval(this.presetCycleInterval);
                this.presetCycleInterval = window.setInterval(() => {
                    const nextPreset = presetKeys[Math.floor(Math.random() * presetKeys.length)];
                    this.butterchurnVisualizer?.loadPreset(presets[nextPreset], 2.0);
                }, 15000);
            }
        } catch (e) {
            console.error('[BackgroundVisualizer] Failed to initialize Butterchurn:', e);
        }
    }

    private initSphere(): void {
        this.canvas.style.opacity = '1';
        this.canvas.style.filter = 'none';
        this.canvas.style.transform = 'none';

        this.spherePoints = [];
        const numPoints = 800;
        for (let i = 0; i < numPoints; i++) {
            const theta = Math.acos(-1 + (2 * i) / numPoints);
            const phi = Math.sqrt(numPoints * Math.PI) * theta;
            this.spherePoints.push({
                x: Math.cos(phi) * Math.sin(theta),
                y: Math.sin(phi) * Math.sin(theta),
                z: Math.cos(theta),
            });
        }
    }

    public render(): void {
        if (this.type === 'none' || !this.canvas) return;

        if (this.type === 'butterchurn') {
            this.renderButterchurn();
        } else if (this.type === 'sphere') {
            this.renderSphere();
        }
    }

    private renderButterchurn(): void {
        if (!this.butterchurnVisualizer || !this.canvas) return;

        const width = this.canvas.clientWidth || 800;
        const height = this.canvas.clientHeight || 800;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.butterchurnVisualizer.setRendererSize(width, height);
        }

        this.butterchurnVisualizer.render();
    }

    private renderSphere(): void {
        if (!this.canvas || !this.analyser || !this.dataArray) return;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const width = this.canvas.clientWidth || 800;
        const height = this.canvas.clientHeight || 800;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        this.analyser.getByteFrequencyData(this.dataArray as any);

        let bass = 0;
        for (let i = 0; i < 10; i++) {
            bass += this.dataArray[i] || 0;
        }
        bass = bass / 10;
        const scale = 1 + (bass / 255) * 0.5;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * scale;

        const rotationSpeed = 0.002 + (bass / 255) * 0.012;
        this.sphereRotation += rotationSpeed;

        this.spherePoints.forEach((p) => {
            const x1 = p.x * Math.cos(this.sphereRotation) - p.z * Math.sin(this.sphereRotation);
            const z1 = p.z * Math.cos(this.sphereRotation) + p.x * Math.sin(this.sphereRotation);
            const y1 = p.y;

            const tilt = 0.5;
            const y2 = y1 * Math.cos(tilt) - z1 * Math.sin(tilt);
            const z2 = z1 * Math.cos(tilt) + y1 * Math.sin(tilt);
            const x2 = x1;

            const zOffset = 2;
            const perspective = 1 / (zOffset + z2);

            const x2d = centerX + x2 * radius * perspective;
            const y2d = centerY + y2 * radius * perspective;

            const size = Math.max(2, 5 * perspective);

            ctx.beginPath();
            ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    public cleanup(): void {
        if (this.presetCycleInterval) {
            clearInterval(this.presetCycleInterval);
            this.presetCycleInterval = null;
        }
        this.butterchurnVisualizer = null;

        if (this.canvas) {
            const ctx = this.canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }

    public destroy(): void {
        this.cleanup();
    }
}
