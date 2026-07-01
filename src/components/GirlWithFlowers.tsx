import React from 'react';

/* Cute flat-cartoon girl offering a bouquet. Pure SVG, scales to any size. */
export default function GirlWithFlowers({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 210" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cute girl offering flowers">
      <defs>
        <linearGradient id="dress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#c084fc" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c084fc" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft halo */}
      <circle cx="100" cy="95" r="92" fill="url(#halo)" />

      {/* legs */}
      <rect x="86" y="150" width="10" height="26" rx="5" fill="#f2b8a2" />
      <rect x="104" y="150" width="10" height="26" rx="5" fill="#f2b8a2" />
      {/* shoes */}
      <ellipse cx="90" cy="180" rx="9" ry="6" fill="#f472b6" />
      <ellipse cx="110" cy="180" rx="9" ry="6" fill="#f472b6" />

      {/* dress */}
      <path d="M100 92 C120 92 128 100 134 155 L66 155 C72 100 80 92 100 92 Z" fill="url(#dress)" />
      <path d="M100 92 C120 92 128 100 134 155 L100 155 Z" fill="#7c3aed" opacity="0.25" />
      {/* collar */}
      <circle cx="100" cy="94" r="8" fill="#ede9fe" />

      {/* arms reaching to bouquet */}
      <path d="M78 100 C66 116 74 132 96 132" fill="none" stroke="#a78bfa" strokeWidth="11" strokeLinecap="round" />
      <path d="M122 100 C134 116 126 132 104 132" fill="none" stroke="#a78bfa" strokeWidth="11" strokeLinecap="round" />
      {/* hands */}
      <circle cx="95" cy="133" r="7" fill="#f2b8a2" />
      <circle cx="105" cy="133" r="7" fill="#f2b8a2" />

      {/* head */}
      <circle cx="100" cy="58" r="34" fill="#fbcfe8" opacity="0" />
      {/* hair back */}
      <circle cx="100" cy="56" r="36" fill="#8b5e34" />
      {/* buns */}
      <circle cx="66" cy="46" r="14" fill="#8b5e34" />
      <circle cx="134" cy="46" r="14" fill="#8b5e34" />
      <circle cx="66" cy="46" r="6" fill="#a97142" />
      <circle cx="134" cy="46" r="6" fill="#a97142" />
      {/* face */}
      <circle cx="100" cy="60" r="28" fill="#f7c9ac" />
      {/* fringe */}
      <path d="M72 52 C80 34 120 34 128 52 C120 46 108 44 100 44 C92 44 80 46 72 52 Z" fill="#8b5e34" />
      {/* eyes */}
      <circle cx="90" cy="62" r="3.4" fill="#3b2f2f" />
      <circle cx="110" cy="62" r="3.4" fill="#3b2f2f" />
      <circle cx="91.2" cy="60.8" r="1" fill="#fff" />
      <circle cx="111.2" cy="60.8" r="1" fill="#fff" />
      {/* cheeks */}
      <circle cx="82" cy="70" r="4" fill="#fb7185" opacity="0.55" />
      <circle cx="118" cy="70" r="4" fill="#fb7185" opacity="0.55" />
      {/* smile */}
      <path d="M92 72 Q100 80 108 72" fill="none" stroke="#c2410c" strokeWidth="2.4" strokeLinecap="round" />

      {/* bouquet (offered in front) */}
      <path d="M100 130 L92 150 L108 150 Z" fill="#34d399" />
      <rect x="97" y="130" width="6" height="14" rx="3" fill="#10b981" />
      {/* leaves */}
      <ellipse cx="86" cy="126" rx="8" ry="4" fill="#34d399" transform="rotate(-25 86 126)" />
      <ellipse cx="114" cy="126" rx="8" ry="4" fill="#34d399" transform="rotate(25 114 126)" />
      {/* flowers */}
      {[
        { x: 88, y: 116, c: '#f472b6' },
        { x: 112, y: 116, c: '#fbbf24' },
        { x: 100, y: 108, c: '#22d3ee' },
        { x: 94, y: 124, c: '#fb7185' },
        { x: 108, y: 124, c: '#c084fc' },
      ].map((f, i) => (
        <g key={i}>
          {[0, 72, 144, 216, 288].map(a => (
            <circle key={a}
              cx={f.x + Math.cos((a * Math.PI) / 180) * 6}
              cy={f.y + Math.sin((a * Math.PI) / 180) * 6}
              r="4.2" fill={f.c} />
          ))}
          <circle cx={f.x} cy={f.y} r="3.2" fill="#fff7ed" />
        </g>
      ))}
    </svg>
  );
}
