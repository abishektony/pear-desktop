export type AnimationType = 'pop' | 'sad' | 'slide-left' | 'slide-right' | 'pulse';

export class ActionAnimator {
    private container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    public trigger(
        iconHTML: string,
        _color: string = '#ffffff',
        animType: AnimationType = 'pop'
    ): void {
        if (!this.container) return;

        const dpr = window.devicePixelRatio || 1;
        const W = 400;
        const H = 400;
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = `${-W / 2}px`;
        canvas.style.top = `${-H / 2}px`;
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '99998';
        this.container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            return;
        }

        ctx.scale(dpr, dpr);
        const cx = W / 2;
        const cy = H / 2;
        const start = performance.now();

        const durations: Record<AnimationType, number> = {
            pulse: 1000,
            sad: 1200,
            'slide-left': 700,
            'slide-right': 700,
            pop: 900
        };
        const totalDuration = durations[animType] || 900;

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const drawHeart = (x: number, y: number, size: number) => {
            const w = size;
            const h = size * 1.35;
            const topY = y - h * 0.35;
            ctx.beginPath();
            ctx.moveTo(x, topY + h * 0.85);
            ctx.bezierCurveTo(x - w * 0.02, topY + h * 0.6, x - w * 0.5, topY + h * 0.55, x - w * 0.5, topY + h * 0.3);
            ctx.bezierCurveTo(x - w * 0.5, topY, x - w * 0.15, topY - h * 0.05, x, topY + h * 0.2);
            ctx.bezierCurveTo(x + w * 0.15, topY - h * 0.05, x + w * 0.5, topY, x + w * 0.5, topY + h * 0.3);
            ctx.bezierCurveTo(x + w * 0.5, topY + h * 0.55, x + w * 0.02, topY + h * 0.6, x, topY + h * 0.85);
            ctx.closePath();
        };

        const drawMorphedPlayPause = (x: number, y: number, size: number, morphT: number) => {
            const s = size;
            const pL = -s * 0.4, pR = s * 0.5, pT = -s * 0.5, pB = s * 0.5;
            const bw = s * 0.22;
            const gap = s * 0.13;
            const bT = -s * 0.45, bB = s * 0.45;

            const lb_tl_x = x + lerp(pL, -gap - bw, morphT);
            const lb_tl_y = y + lerp(pT, bT, morphT);
            const lb_tr_x = x + lerp(pL, -gap, morphT);
            const lb_tr_y = y + lerp(pT * 0.15, bT, morphT);
            const lb_br_x = x + lerp(pL, -gap, morphT);
            const lb_br_y = y + lerp(pB * 0.15, bB, morphT);
            const lb_bl_x = x + lerp(pL, -gap - bw, morphT);
            const lb_bl_y = y + lerp(pB, bB, morphT);

            const rb_tl_x = x + lerp(pR * 0.2, gap, morphT);
            const rb_tl_y = y + lerp(pT * 0.6, bT, morphT);
            const rb_tr_x = x + lerp(pR, gap + bw, morphT);
            const rb_tr_y = y + lerp(0, bT, morphT);
            const rb_br_x = x + lerp(pR, gap + bw, morphT);
            const rb_br_y = y + lerp(0, bB, morphT);
            const rb_bl_x = x + lerp(pR * 0.2, gap, morphT);
            const rb_bl_y = y + lerp(pB * 0.6, bB, morphT);

            ctx.beginPath();
            ctx.moveTo(lb_tl_x, lb_tl_y);
            ctx.lineTo(lb_tr_x, lb_tr_y);
            ctx.lineTo(lb_br_x, lb_br_y);
            ctx.lineTo(lb_bl_x, lb_bl_y);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(rb_tl_x, rb_tl_y);
            ctx.lineTo(rb_tr_x, rb_tr_y);
            ctx.lineTo(rb_br_x, rb_br_y);
            ctx.lineTo(rb_bl_x, rb_bl_y);
            ctx.closePath();
            ctx.fill();
        };

        const drawPrev = (x: number, y: number, size: number) => {
            const s = size * 0.45;
            ctx.beginPath();
            ctx.moveTo(x + s * 0.5, y - s);
            ctx.lineTo(x - s * 0.5, y);
            ctx.lineTo(x + s * 0.5, y + s);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(x - s * 0.75, y - s * 0.9, s * 0.18, s * 1.8);
        };

        const drawNext = (x: number, y: number, size: number) => {
            const s = size * 0.45;
            ctx.beginPath();
            ctx.moveTo(x - s * 0.5, y - s);
            ctx.lineTo(x + s * 0.5, y);
            ctx.lineTo(x - s * 0.5, y + s);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(x + s * 0.57, y - s * 0.9, s * 0.18, s * 1.8);
        };

        const animate = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / totalDuration, 1);
            ctx.clearRect(0, 0, W, H);

            switch (animType) {
                case 'pulse': {
                    let scale = 1, alpha = 1, yOff = 0;
                    if (t < 0.15) {
                        scale = easeOut(t / 0.15) * 1.4;
                        alpha = easeOut(t / 0.15);
                    } else if (t < 0.25) {
                        scale = 1.4 - (t - 0.15) / 0.1 * 0.4;
                    } else if (t < 0.4) {
                        scale = 1.0 + easeOut((t - 0.25) / 0.15) * 0.5;
                    } else if (t < 0.55) {
                        scale = 1.5 - (t - 0.4) / 0.15 * 0.5;
                    } else {
                        const ft = (t - 0.55) / 0.45;
                        scale = 1.0 + ft * 0.15;
                        alpha = 1 - easeInOut(ft);
                        yOff = -ft * 50;
                    }

                    ctx.save();
                    ctx.translate(cx, cy + yOff);
                    ctx.scale(scale, scale);
                    ctx.globalAlpha = alpha;
                    ctx.shadowBlur = 30 * alpha;
                    ctx.shadowColor = '#ff2a5f';
                    ctx.fillStyle = '#ff2a5f';
                    drawHeart(0, 0, 80);
                    ctx.fill();
                    ctx.restore();
                    break;
                }

                case 'sad': {
                    const HS = 80;
                    if (t < 0.15) {
                        const at = easeOut(t / 0.15);
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.scale(at * 1.1, at * 1.1);
                        ctx.globalAlpha = at;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = 'rgba(255,255,255,0.4)';
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        drawHeart(0, 0, HS);
                        ctx.fill();
                        ctx.restore();
                    } else if (t < 0.4) {
                        const crackT = (t - 0.15) / 0.25;
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = 'rgba(255,255,255,0.3)';
                        drawHeart(0, 0, HS);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.strokeStyle = '#222';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        const pts = [[0,-40],[-5,-25],[6,-10],[-4,5],[5,20],[-3,35],[0,48]];
                        const drawTo = Math.floor(crackT * pts.length);
                        ctx.moveTo(pts[0][0], pts[0][1]);
                        for (let i = 1; i <= drawTo && i < pts.length; i++) {
                            ctx.lineTo(pts[i][0], pts[i][1]);
                        }
                        ctx.stroke();
                        ctx.restore();
                    } else {
                        const splitT = (t - 0.4) / 0.6;
                        const eased = easeInOut(splitT);
                        const leftX = -eased * 45;
                        const rightX = eased * 45;
                        const fallY = eased * eased * 70;
                        const alpha = 1 - easeInOut(Math.max(0, (splitT - 0.35) / 0.65));

                        ctx.save();
                        ctx.translate(cx + leftX, cy + fallY);
                        ctx.rotate(-eased * 0.45);
                        ctx.globalAlpha = alpha;
                        ctx.beginPath();
                        ctx.rect(-90, -90, 90, 180);
                        ctx.clip();
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = 'rgba(255,255,255,0.2)';
                        drawHeart(0, 0, HS);
                        ctx.fill();
                        ctx.restore();

                        ctx.save();
                        ctx.translate(cx + rightX, cy + fallY);
                        ctx.rotate(eased * 0.45);
                        ctx.globalAlpha = alpha;
                        ctx.beginPath();
                        ctx.rect(0, -90, 90, 180);
                        ctx.clip();
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = 'rgba(255,255,255,0.2)';
                        drawHeart(0, 0, HS);
                        ctx.fill();
                        ctx.restore();
                    }
                    break;
                }

                case 'slide-left': {
                    let alpha = 1, xOff = 0, scale = 1;
                    if (t < 0.2) {
                        const at = easeOut(t / 0.2);
                        alpha = at; scale = 0.5 + at * 0.6;
                    } else if (t < 0.5) {
                        scale = 1.1 - (t - 0.2) / 0.3 * 0.1;
                    } else {
                        const st = (t - 0.5) / 0.5;
                        xOff = -easeInOut(st) * 100;
                        alpha = 1 - easeInOut(st);
                        scale = 1 - st * 0.15;
                    }
                    ctx.save();
                    ctx.translate(cx + xOff, cy);
                    ctx.scale(scale, scale);
                    ctx.globalAlpha = alpha;
                    ctx.shadowBlur = 25 * alpha;
                    ctx.shadowColor = 'rgba(255,255,255,0.5)';
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    drawPrev(0, 0, 90);
                    ctx.restore();
                    break;
                }

                case 'slide-right': {
                    let alpha = 1, xOff = 0, scale = 1;
                    if (t < 0.2) {
                        const at = easeOut(t / 0.2);
                        alpha = at; scale = 0.5 + at * 0.6;
                    } else if (t < 0.5) {
                        scale = 1.1 - (t - 0.2) / 0.3 * 0.1;
                    } else {
                        const st = (t - 0.5) / 0.5;
                        xOff = easeInOut(st) * 100;
                        alpha = 1 - easeInOut(st);
                        scale = 1 - st * 0.15;
                    }
                    ctx.save();
                    ctx.translate(cx + xOff, cy);
                    ctx.scale(scale, scale);
                    ctx.globalAlpha = alpha;
                    ctx.shadowBlur = 25 * alpha;
                    ctx.shadowColor = 'rgba(255,255,255,0.5)';
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    drawNext(0, 0, 90);
                    ctx.restore();
                    break;
                }

                case 'pop':
                default: {
                    const isPausing = iconHTML.includes('rect') || iconHTML.includes('pause');
                    let alpha = 1, scale = 1, morphT = 0;

                    if (t < 0.15) {
                        const at = easeOut(t / 0.15);
                        alpha = at; scale = 0.3 + at * 0.9;
                        morphT = isPausing ? 0 : 1;
                    } else if (t < 0.25) {
                        scale = 1.15 - (t - 0.15) / 0.1 * 0.15;
                        morphT = isPausing ? 0 : 1;
                    } else if (t < 0.6) {
                        const mt = easeInOut((t - 0.25) / 0.35);
                        morphT = isPausing ? mt : 1 - mt;
                        scale = 1;
                    } else {
                        const ft = (t - 0.6) / 0.4;
                        alpha = 1 - easeInOut(ft);
                        scale = 1 + ft * 0.15;
                        morphT = isPausing ? 1 : 0;
                    }

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(scale, scale);
                    ctx.globalAlpha = alpha;
                    ctx.shadowBlur = 25 * alpha;
                    ctx.shadowColor = 'rgba(255,255,255,0.5)';
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    drawMorphedPlayPause(0, 0, 80, morphT);
                    ctx.restore();
                    break;
                }
            }

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        };

        requestAnimationFrame(animate);
    }
}
