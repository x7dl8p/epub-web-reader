function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function mixHex(a: string, b: string, factor: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex(
    ca.r + (cb.r - ca.r) * factor,
    ca.g + (cb.g - ca.g) * factor,
    ca.b + (cb.b - ca.b) * factor
  );
}

function hexWithOpacity(hex: string, opacity: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
}

function isLight(hex: string): boolean {
  const c = hexToRgb(hex);
  if (!c) return true;
  const lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  return lum > 0.5;
}

export function applyCustomTheme(bg: string, text: string): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (!bg || !text) {
    removeCustomTheme();
    return;
  }

  const bgIsLight = isLight(bg);
  const white = '#FFFFFF';
  const black = '#000000';
  const shadeToward = bgIsLight ? black : white;

  const card = mixHex(bg, shadeToward, bgIsLight ? 0.04 : 0.06);
  const secondary = mixHex(bg, shadeToward, bgIsLight ? 0.06 : 0.1);
  const muted = secondary;
  const popover = mixHex(bg, shadeToward, bgIsLight ? 0.02 : 0.04);
  const accent = mixHex(bg, text, 0.06);

  const mutedFg = hexWithOpacity(text, 0.55);
  const border = hexWithOpacity(text, 0.12);
  const ring = hexWithOpacity(text, 0.35);

  const primary = text;
  const primaryFg = bg;

  const vars: Record<string, string> = {
    '--color-fd-background':           bg,
    '--color-fd-foreground':           text,
    '--color-fd-card':                 card,
    '--color-fd-card-foreground':      text,
    '--color-fd-secondary':            secondary,
    '--color-fd-secondary-foreground': text,
    '--color-fd-muted':                muted,
    '--color-fd-muted-foreground':     mutedFg,
    '--color-fd-popover':              popover,
    '--color-fd-popover-foreground':   text,
    '--color-fd-border':               border,
    '--color-fd-ring':                 ring,
    '--color-fd-primary':              primary,
    '--color-fd-primary-foreground':   primaryFg,
    '--color-fd-accent':               accent,
    '--color-fd-accent-foreground':    text,
    '--color-fd-overlay':              hexWithOpacity(black, 0.25),
  };

  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }

  let styleEl = document.getElementById('custom-theme-vars') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-theme-vars';
    document.head.appendChild(styleEl);
  }

  const cssRules = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v} !important;`)
    .join('\n  ');

  styleEl.textContent = `
html, html *, body, header, nav, #nd-sidebar, .fd-nav, [data-theme] {
  ${cssRules}
}
`;

  root.setAttribute('data-custom-theme', 'true');
}

const INJECTED_VARS = [
  '--color-fd-background',
  '--color-fd-foreground',
  '--color-fd-card',
  '--color-fd-card-foreground',
  '--color-fd-secondary',
  '--color-fd-secondary-foreground',
  '--color-fd-muted',
  '--color-fd-muted-foreground',
  '--color-fd-popover',
  '--color-fd-popover-foreground',
  '--color-fd-border',
  '--color-fd-ring',
  '--color-fd-primary',
  '--color-fd-primary-foreground',
  '--color-fd-accent',
  '--color-fd-accent-foreground',
  '--color-fd-overlay',
] as const;

export function removeCustomTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const prop of INJECTED_VARS) {
    root.style.removeProperty(prop);
  }
  const styleEl = document.getElementById('custom-theme-vars');
  if (styleEl) {
    styleEl.remove();
  }
  root.removeAttribute('data-custom-theme');
}
