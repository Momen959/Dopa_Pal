// ─── Five fixed category colors — same in every theme ──────────────────────
// Full-hex = small accents (icon, dot, chip icon). Tint = large areas (card bg, button bg).
// Hard rule: never mix more than 2 category colors on one screen.
const CAT = {
  'cat-blue': '#4285F4',  // Default / focus task
  'cat-blue-tint': '#E8F0FE',
  'cat-green': '#1E8E3E',  // Completion / done — only at the completion moment
  'cat-green-tint': '#E6F4EA',
  'cat-amber': '#F9AB00',  // Momentum / streak / Interest Vault
  'cat-amber-tint': '#FEF7E0',
  'cat-coral': '#E8703A',  // Soft nudge / empty-queue — NEVER alarm/warning
  'cat-coral-tint': '#FCE8E0',
  'cat-purple': '#A142F4',  // Bonus / novelty items only
  'cat-purple-tint': '#F3E8FD',
};

export const THEMES = [
  {
    id: 'default',
    name: 'Material Dark',
    cost: 0,

    // ── Accent (UI chrome) ────────────────────────────────────────────────
    accent: '#a78bfa',
    'accent-rgb': '167,139,250',
    glow: 'rgba(167,139,250,.28)',
    dim: 'rgba(167,139,250,.10)',

    // ── Surfaces ──────────────────────────────────────────────────────────
    bg: '#0d0d14',
    'bg-rgb': '13,13,20',
    'bg-canvas': '#0d0d14',
    'bg-card': '#1a1a27',
    'bg-card-2': '#222233',
    surface: 'rgba(26,26,39,.92)',
    'surface-rgb': '26,26,39',
    surface2: 'rgba(34,34,51,.92)',
    'surface-alt': '#1a1a27',
    'surface-alt2': '#222233',

    // ── Borders & shadows ─────────────────────────────────────────────────
    border: 'rgba(255,255,255,.07)',
    'shadow-ink': '0,0,0',

    // ── Ink (text) ────────────────────────────────────────────────────────
    text: '#f0eeff',
    text2: '#9b96c9',
    text3: '#5a567a',
    'text3-rgb': '90,86,122',
    'ink-primary': '#f0eeff',
    'ink-muted': '#9b96c9',
    'ink-faint': '#5a567a',

    // ── Semantic ──────────────────────────────────────────────────────────
    high: '#F9AB00',
    'high-rgb': '249,171,0',
    med: '#1E8E3E',
    low: '#4285F4',
    'low-rgb': '66,133,244',
    error: '#E8703A',
    'error-rgb': '232,112,58',

    // ── Misc ──────────────────────────────────────────────────────────────
    overlay: 'rgba(0,0,0,.55)',
    'overlay-rgb': '255,255,255',
    'glass-rgb': '255,255,255',

    ...CAT,
  },
  {
    id: 'calmed-light',
    name: 'Material Light',
    cost: 0,

    // ── Accent (UI chrome) ────────────────────────────────────────────────
    accent: '#4285F4',
    'accent-rgb': '66,133,244',
    glow: 'rgba(66,133,244,.18)',
    dim: 'rgba(66,133,244,.10)',

    // ── Surfaces (spec §3.1) ──────────────────────────────────────────────
    bg: '#FAF8F5',
    'bg-rgb': '250,248,245',
    'bg-canvas': '#FAF8F5',
    'bg-card': '#FFFFFF',
    'bg-card-2': '#F3F0EA',
    surface: '#FFFFFF',
    'surface-rgb': '255,255,255',
    surface2: '#F3F0EA',
    'surface-alt': '#FFFFFF',
    'surface-alt2': '#F3F0EA',

    // ── Borders & shadows ─────────────────────────────────────────────────
    border: 'rgba(31,27,22,.08)',
    'shadow-ink': '31,27,22',

    // ── Ink (text) (spec §3.2) ────────────────────────────────────────────
    text: '#1F1B16',
    text2: '#6B6358',
    text3: '#A8A096',
    'text3-rgb': '168,160,150',
    'ink-primary': '#1F1B16',
    'ink-muted': '#6B6358',
    'ink-faint': '#A8A096',

    // ── Semantic ──────────────────────────────────────────────────────────
    high: '#F9AB00',
    'high-rgb': '249,171,0',
    med: '#1E8E3E',
    low: '#4285F4',
    'low-rgb': '66,133,244',
    error: '#E8703A',
    'error-rgb': '232,112,58',

    // ── Misc ──────────────────────────────────────────────────────────────
    overlay: 'rgba(31,27,22,.14)',
    'overlay-rgb': '31,27,22',
    'glass-rgb': '31,27,22',

    ...CAT,
  },
  { id: 'ocean', name: 'Ocean Breeze', cost: 500, accent: '#38bdf8', 'accent-rgb': '56,189,248', glow: 'rgba(56,189,248,.28)', dim: 'rgba(56,189,248,.10)', bg: '#111827', 'bg-rgb': '17,24,39', 'bg-canvas': '#111827', 'bg-card': '#1f2937', 'bg-card-2': '#243447', surface: 'rgba(31,41,55,.92)', 'surface-rgb': '31,41,55', surface2: 'rgba(37,51,68,.92)', 'surface-alt': '#1f2937', 'surface-alt2': '#243447', border: 'rgba(255,255,255,.08)', 'shadow-ink': '0,0,0', text: '#f8fafc', text2: '#cbd5e1', text3: '#94a3b8', 'text3-rgb': '148,163,184', 'ink-primary': '#f8fafc', 'ink-muted': '#cbd5e1', 'ink-faint': '#94a3b8', high: '#f9ab00', 'high-rgb': '249,171,0', med: '#1e8e3e', low: '#4285f4', 'low-rgb': '66,133,244', error: '#e8703a', 'error-rgb': '232,112,58', overlay: 'rgba(0,0,0,.50)', 'overlay-rgb': '255,255,255', 'glass-rgb': '255,255,255', ...CAT },
  { id: 'sunset', name: 'Sunset Flare', cost: 1500, accent: '#f97316', 'accent-rgb': '249,115,22', glow: 'rgba(249,115,22,.28)', dim: 'rgba(249,115,22,.10)', bg: '#181310', 'bg-rgb': '24,19,16', 'bg-canvas': '#181310', 'bg-card': '#201914', 'bg-card-2': '#2b221c', surface: 'rgba(40,32,28,.92)', 'surface-rgb': '40,32,28', surface2: 'rgba(49,40,35,.92)', 'surface-alt': '#201914', 'surface-alt2': '#2b221c', border: 'rgba(255,255,255,.08)', 'shadow-ink': '0,0,0', text: '#fff7ed', text2: '#f5d0b0', text3: '#c8a28a', 'text3-rgb': '200,162,138', 'ink-primary': '#fff7ed', 'ink-muted': '#f5d0b0', 'ink-faint': '#c8a28a', high: '#f9ab00', 'high-rgb': '249,171,0', med: '#1e8e3e', low: '#4285f4', 'low-rgb': '66,133,244', error: '#e8703a', 'error-rgb': '232,112,58', overlay: 'rgba(0,0,0,.50)', 'overlay-rgb': '255,255,255', 'glass-rgb': '255,255,255', ...CAT },
  { id: 'cyber', name: 'Neon Cyberpunk', cost: 3000, accent: '#ec4899', 'accent-rgb': '236,72,153', glow: 'rgba(236,72,153,.28)', dim: 'rgba(236,72,153,.10)', bg: '#12081a', 'bg-rgb': '18,8,26', 'bg-canvas': '#12081a', 'bg-card': '#1a1024', 'bg-card-2': '#271336', surface: 'rgba(32,18,44,.92)', 'surface-rgb': '32,18,44', surface2: 'rgba(40,24,56,.92)', 'surface-alt': '#1a1024', 'surface-alt2': '#271336', border: 'rgba(255,255,255,.08)', 'shadow-ink': '0,0,0', text: '#fdf4ff', text2: '#e9c5ff', text3: '#c084fc', 'text3-rgb': '192,132,252', 'ink-primary': '#fdf4ff', 'ink-muted': '#e9c5ff', 'ink-faint': '#c084fc', high: '#f9ab00', 'high-rgb': '249,171,0', med: '#1e8e3e', low: '#4285f4', 'low-rgb': '66,133,244', error: '#e8703a', 'error-rgb': '232,112,58', overlay: 'rgba(0,0,0,.50)', 'overlay-rgb': '255,255,255', 'glass-rgb': '255,255,255', ...CAT },
  { id: 'gold', name: 'Midnight Gold', cost: 10000, accent: '#fbbf24', 'accent-rgb': '251,191,36', glow: 'rgba(251,191,36,.28)', dim: 'rgba(251,191,36,.10)', bg: '#171208', 'bg-rgb': '23,18,8', 'bg-canvas': '#171208', 'bg-card': '#201807', 'bg-card-2': '#2c220b', surface: 'rgba(40,32,20,.92)', 'surface-rgb': '40,32,20', surface2: 'rgba(48,39,24,.92)', 'surface-alt': '#201807', 'surface-alt2': '#2c220b', border: 'rgba(255,255,255,.08)', 'shadow-ink': '0,0,0', text: '#fefce8', text2: '#f6e7b7', text3: '#c9aa57', 'text3-rgb': '201,170,87', 'ink-primary': '#fefce8', 'ink-muted': '#f6e7b7', 'ink-faint': '#c9aa57', high: '#f9ab00', 'high-rgb': '249,171,0', med: '#1e8e3e', low: '#4285f4', 'low-rgb': '66,133,244', error: '#e8703a', 'error-rgb': '232,112,58', overlay: 'rgba(0,0,0,.50)', 'overlay-rgb': '255,255,255', 'glass-rgb': '255,255,255', ...CAT },
];

export const THEME_VARS = [
  // UI chrome accent
  'accent', 'accent-rgb', 'accent-glow', 'accent-dim',
  // Surfaces
  'bg', 'bg-rgb', 'bg-canvas', 'bg-card', 'bg-card-2',
  'surface', 'surface-rgb', 'surface2', 'surface-alt', 'surface-alt2',
  // Borders & shadows
  'border', 'shadow-ink',
  // Ink
  'text', 'text2', 'text3', 'text3-rgb',
  'ink-primary', 'ink-muted', 'ink-faint',
  // Semantic
  'high', 'high-rgb', 'med', 'low', 'low-rgb',
  'error', 'error-rgb',
  // Misc
  'overlay', 'overlay-rgb', 'glass-rgb',
  // Fixed five-color category palette
  'cat-blue', 'cat-blue-tint',
  'cat-green', 'cat-green-tint',
  'cat-amber', 'cat-amber-tint',
  'cat-coral', 'cat-coral-tint',
  'cat-purple', 'cat-purple-tint',
];

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  for (const v of THEME_VARS) {
    if (theme[v] !== undefined) {
      document.documentElement.style.setProperty(`--${v}`, theme[v]);
    }
  }
  // Set derived computed vars
  document.documentElement.style.setProperty('--accent-glow', theme.glow);
  document.documentElement.style.setProperty('--accent-dim', theme.dim);
  // data-theme attribute for CSS-level [data-theme="calmed-light"] selectors
  document.documentElement.setAttribute('data-theme', theme.id);
}

export function getActiveThemeId() {
  try {
    return localStorage.getItem('dopapal_active_theme_v3') || 'default';
  } catch {
    return 'default';
  }
}
