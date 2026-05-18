const COVER_THEMES = [
  {
    background: ['#081C3A', '#125D98', '#4FC3F7'],
    accent: '#CFFAFE',
  },
  {
    background: ['#2B124C', '#522B5B', '#854F6C'],
    accent: '#F5D0FE',
  },
  {
    background: ['#183A1D', '#2F5233', '#7FB069'],
    accent: '#DCFCE7',
  },
  {
    background: ['#3B1F2B', '#8C3A4A', '#E76F51'],
    accent: '#FDE68A',
  },
  {
    background: ['#1F2937', '#374151', '#9CA3AF'],
    accent: '#F8FAFC',
  },
];

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getTheme(seed: string) {
  return COVER_THEMES[hashSeed(seed) % COVER_THEMES.length];
}

function getBadge(label?: string) {
  if (!label) {
    return 'SMART COURSE';
  }
  return label.split('/')[0].trim().slice(0, 18).toUpperCase() || 'SMART COURSE';
}

export function buildCourseCoverDataUri(title: string, label?: string) {
  const theme = getTheme(`${title}-${label || ''}`);
  const safeTitle = title || 'Course';
  const badge = getBadge(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.background[0]}" />
          <stop offset="55%" stop-color="${theme.background[1]}" />
          <stop offset="100%" stop-color="${theme.background[2]}" />
        </linearGradient>
        <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.12)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.34)" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" rx="48" fill="url(#bg)" />
      <circle cx="1020" cy="120" r="190" fill="rgba(255,255,255,0.08)" />
      <circle cx="980" cy="560" r="240" fill="rgba(255,255,255,0.06)" />
      <path d="M82 548C240 392 388 334 564 346c120 8 238 48 384 18 72-14 140-42 170-64v170H82Z" fill="rgba(255,255,255,0.10)" />
      <path d="M82 590c142-112 260-152 390-138 118 12 224 64 344 58 108-6 198-44 302-110" stroke="url(#line)" stroke-width="28" stroke-linecap="round" fill="none" />
      <rect x="82" y="82" width="210" height="46" rx="23" fill="rgba(255,255,255,0.14)" />
      <text x="187" y="112" font-size="22" text-anchor="middle" fill="${theme.accent}" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="2">${badge}</text>
      <text x="82" y="452" font-size="74" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${safeTitle}</text>
      <text x="82" y="506" font-size="28" fill="rgba(255,255,255,0.82)" font-family="Segoe UI, Arial, sans-serif">Adaptive learning dashboard</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
