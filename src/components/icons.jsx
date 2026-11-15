// Small inline line-icon set (16px grid, currentColor).
const P = {
  apps: <g fill="currentColor">{[3, 8, 13].flatMap((x) => [3, 8, 13].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}</g>,
  search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></>,
  help: <><circle cx="8" cy="8" r="6.5" /><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" /><circle cx="8" cy="11.6" r=".5" fill="currentColor" /></>,
  explore: <><circle cx="8" cy="8" r="6.5" /><path d="m10.6 5.4-1.6 3.6-3.6 1.6 1.6-3.6z" /></>,
  heart: <path d="M8 13.5s-5.5-3.2-5.5-7A2.9 2.9 0 0 1 8 4.8a2.9 2.9 0 0 1 5.5 1.7c0 3.8-5.5 7-5.5 7z" />,
  building: <><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M6 5.5h1M9 5.5h1M6 8h1M9 8h1M7 13.5v-2.5h2v2.5" /></>,
  upload: <><path d="M8 10.5V2.5M5 5.5l3-3 3 3" /><path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" /></>,
  book: <><path d="M2.5 3.5h4a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3.5h-4A1.5 1.5 0 0 0 8 5v8.5a1.5 1.5 0 0 1 1.5-1.5h4z" /></>,
  chevronLeft: <path d="m10 3-5 5 5 5" />,
  chevronRight: <path d="m6 3 5 5-5 5" />,
  chevronDown: <path d="m3 6 5 5 5-5" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  cookie: <><circle cx="8" cy="8" r="6" /><circle cx="6" cy="6.5" r=".6" fill="currentColor" /><circle cx="10" cy="9.5" r=".6" fill="currentColor" /><circle cx="6.5" cy="10.5" r=".6" fill="currentColor" /></>,
  download: <><path d="M8 2.5v8M5 7.5l3 3 3-3" /><path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" /></>,
  external: <><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5" /><path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" /></>,
  headset: <><path d="M3 9V8a5 5 0 0 1 10 0v1" /><rect x="2.5" y="9" width="2.5" height="4" rx="1" /><rect x="11" y="9" width="2.5" height="4" rx="1" /></>,
  link: <><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.7.7" /><path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.7-.7" /></>,
  filter: <path d="M2.5 3h11L9.3 8.3v4.2l-2.6 1V8.3z" />,
  share: <><circle cx="4" cy="8" r="1.8" /><circle cx="12" cy="4" r="1.8" /><circle cx="12" cy="12" r="1.8" /><path d="m5.6 7.2 4.8-2.4M5.6 8.8l4.8 2.4" /></>,
  partner: <path fill="currentColor" stroke="none" d="M2 12V6l3 2 3-4 3 4 3-2v6z" />,
};

export function Icon({ name, size = 16, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

// Original line-art hero illustration (blocks being assembled).
export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 300 220" fill="none" stroke="#d4e23a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="40" y="120" width="60" height="60" rx="6" />
      <rect x="110" y="120" width="60" height="60" rx="6" />
      <rect x="75" y="52" width="60" height="60" rx="6" strokeDasharray="5 5" />
      <path d="M150 52l40-30M190 22l12 30-30 4z" />
      <rect x="190" y="90" width="70" height="90" rx="8" />
      <path d="M205 110h40M205 125h28M205 140h36" />
      <circle cx="225" cy="162" r="7" />
      <circle cx="48" cy="40" r="16" />
      <path d="M48 32v16M40 40h16" />
      <path d="M180 196h90M20 196h150" opacity=".6" />
      <g fill="#d4e23a" stroke="none" opacity=".55">
        {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={120 + (i % 6) * 8} cy={132 + Math.floor(i / 6) * 10} r="1.4" />)}
      </g>
    </svg>
  );
}
