import React, { useEffect, useRef } from 'react';

/* Lively, dependency-free celebration: repeated firework bursts + falling ribbons. */
export default function Confetti({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#c084fc', '#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#818cf8', '#fb7185', '#a78bfa', '#facc15'];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
    const W = () => canvas.width, H = () => canvas.height;

    type P = {
      x: number; y: number; vx: number; vy: number; life: number; max: number;
      c: string; size: number; kind: 'spark' | 'ribbon'; rot: number; vrot: number;
    };
    let parts: P[] = [];

    const burst = (cx: number, cy: number) => {
      const base = pick(colors);
      const n = 54;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + rand(-0.15, 0.15);
        const sp = rand(2.2, 5.4) * dpr;
        parts.push({
          x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 0, max: rand(55, 85), c: Math.random() < 0.35 ? pick(colors) : base,
          size: rand(1.6, 3.4) * dpr, kind: 'spark', rot: 0, vrot: 0,
        });
      }
    };

    const ribbon = () => {
      parts.push({
        x: rand(0, W()), y: -10 * dpr, vx: rand(-1, 1) * dpr, vy: rand(1.5, 3.5) * dpr,
        life: 0, max: rand(120, 200), c: pick(colors),
        size: rand(3, 6) * dpr, kind: 'ribbon', rot: rand(0, Math.PI * 2), vrot: rand(-0.2, 0.2),
      });
    };

    const nBursts = Math.round(11 * intensity);
    const ribbonFrames = Math.round(90 * intensity);
    let launched = 0, frame = 0, raf = 0;
    const gravity = 0.05 * dpr;

    const tick = () => {
      frame++;
      if (launched < nBursts && frame % 9 === 0) {
        burst(W() * rand(0.12, 0.88), H() * rand(0.15, 0.5));
        launched++;
      }
      if (frame < ribbonFrames) { for (let k = 0; k < 3; k++) ribbon(); }

      ctx.clearRect(0, 0, W(), H());
      parts = parts.filter(p => p.life < p.max && p.y < H() + 20 * dpr);
      parts.forEach(p => {
        p.life++;
        if (p.kind === 'spark') { p.vy += gravity; p.vx *= 0.985; p.vy *= 0.985; }
        else { p.vy += gravity * 0.25; p.vx += Math.sin((p.life + p.x) * 0.05) * 0.06 * dpr; p.rot += p.vrot; }
        p.x += p.vx; p.y += p.vy;
        const alpha = p.kind === 'spark' ? Math.max(0, 1 - p.life / p.max) : Math.min(1, (p.max - p.life) / 40);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.c;
        if (p.kind === 'spark') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size * 1.8, p.size * 2, p.size * 3.6);
          ctx.restore();
        }
      });
      ctx.globalAlpha = 1;
      if (launched < nBursts || frame < ribbonFrames || parts.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [intensity]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 w-full h-full z-40" />;
}
