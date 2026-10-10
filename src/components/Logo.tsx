export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="sp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="rgba(255,255,255,0.06)" />
      <path d="M16 5l9 4v6c0 6-4 10-9 12-5-2-9-6-9-12V9z" fill="none" stroke="url(#sp-logo)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 16l3 3 5-6" fill="none" stroke="#22d3ee" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
