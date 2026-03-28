/**
 * Shared gift card color utility.
 * Derives a two-stop gradient from the business primary color.
 * Used by both the in-app preview and the email template so they always match.
 */

const DEFAULT_PRIMARY = '#0D9488';

/**
 * Parse a hex color string into [r, g, b] (0–255).
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const n = parseInt(full.slice(0, 6), 16);
  if (isNaN(n)) return [13, 148, 136]; // fallback teal
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Lighten a hex color by mixing with white.
 * @param hex   source color
 * @param amount  0 = original, 1 = white
 */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a hex color by mixing with black.
 * @param hex   source color
 * @param amount  0 = original, 1 = black
 */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

/**
 * Rotate the hue of a hex color by `degrees` around the color wheel.
 * Used to make a distinct second gradient stop.
 */
function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = hexToRgb(hex);
  // Convert RGB → HSL
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  h = ((h * 360 + degrees) % 360 + 360) % 360 / 360;
  // Convert HSL → RGB
  const hue2rgb = (p: number, q: number, t: number): number => {
    const tt = ((t % 1) + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q2;
  const nr = Math.round(hue2rgb(p2, q2, h + 1 / 3) * 255);
  const ng = Math.round(hue2rgb(p2, q2, h) * 255);
  const nb = Math.round(hue2rgb(p2, q2, h - 1 / 3) * 255);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Compute luminance of a hex color (0 = dark, 1 = light).
 */
export function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns true if the given color is light enough to require dark text.
 */
export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.35;
}

/**
 * Derive the two-stop gradient from a business primary color.
 *
 * Strategy:
 *  - gradientStart: slightly lightened version of the primary color
 *  - gradientEnd:   rotated 30° + darkened version for depth
 *
 * This ensures every brand color produces a rich, harmonious gradient.
 */
export function getGiftCardGradient(primaryColor?: string): {
  gradientStart: string;
  gradientEnd: string;
} {
  const base = primaryColor || DEFAULT_PRIMARY;
  const gradientStart = lighten(base, 0.15);
  const gradientEnd = darken(rotateHue(base, 30), 0.2);
  return { gradientStart, gradientEnd };
}
