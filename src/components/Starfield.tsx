import React, { useMemo } from 'react';

/* Fixed, behind-everything animated starfield with soft nebula glows. */
export default function Starfield() {
  const rand2 = (a: number, b: number) => a + Math.random() * (b - a);
  const layers = useMemo(() => {
    const make = (count: number, maxSize: number) =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * maxSize + 0.5,
        delay: Math.random() * 6,
        dur: 3 + Math.random() * 5,
        op: 0.35 + Math.random() * 0.55,
      }));
    return { far: make(90, 1.4), mid: make(45, 2.2), near: make(18, 3) };
  }, []);

  const meteors = useMemo(() =>
    Array.from({ length: 6 }, () => ({
      left: rand2(-5, 70),
      top: rand2(-5, 45),
      delay: rand2(0, 12),
      dur: rand2(3.5, 7),
      len: rand2(90, 180),
    })), []);

  const renderStars = (stars: any[]) =>
    stars.map((s, i) => (
      <span
        key={i}
        className="absolute rounded-full bg-white animate-twinkle"
        style={{
          left: `${s.left}%`, top: `${s.top}%`,
          width: `${s.size}px`, height: `${s.size}px`,
          opacity: s.op,
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.dur}s`,
          boxShadow: s.size > 2 ? '0 0 6px 1px rgba(255,255,255,0.6)' : undefined,
        }}
      />
    ));

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#05030f]">
      {/* deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0620] via-[#070417] to-[#05030f]" />
      {/* nebula glows */}
      <div className="absolute -top-32 -left-24 w-[42rem] h-[42rem] rounded-full blur-3xl opacity-30"
           style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5), transparent 60%)' }} />
      <div className="absolute top-1/3 -right-24 w-[38rem] h-[38rem] rounded-full blur-3xl opacity-25"
           style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.4), transparent 60%)' }} />
      <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-20"
           style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.4), transparent 60%)' }} />
      {/* stars */}
      {renderStars(layers.far)}
      {renderStars(layers.mid)}
      {renderStars(layers.near)}
      {/* shooting stars */}
      {meteors.map((m, i) => (
        <span
          key={`mt-${i}`}
          className="absolute animate-shoot"
          style={{
            left: `${m.left}%`, top: `${m.top}%`,
            width: `${m.len}px`, height: '2px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0))',
            borderRadius: '9999px',
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))',
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
