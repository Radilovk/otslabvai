/**
 * WCAG AA contrast checks for portfolio design tokens (light + dark).
 */

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg, bg) {
  const l1 = luminance(parseHex(fg));
  const l2 = luminance(parseHex(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const THEMES = {
  light: {
    bg: '#f7f9fb',
    surface: '#ffffff',
    text: '#0f2540',
    textSecondary: '#2f4558',
    muted: '#3d5568',
    breadcrumbSep: '#6b8299',
    imageWell: '#fafbfa',
    onImageBtn: '#1a3555',
  },
  dark: {
    bg: '#080f1a',
    surface: '#121f32',
    text: '#f2f6fa',
    textSecondary: '#d8e4f0',
    muted: '#c5d6e8',
    breadcrumbSep: '#7d95ab',
    imageWell: '#e8edf2',
    onImageBtn: '#0f2540',
  },
};

describe('portfolio theme contrast', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    test(`${name}: body text on background`, () => {
      expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    });

    test(`${name}: secondary text on background`, () => {
      expect(contrastRatio(t.textSecondary, t.bg)).toBeGreaterThanOrEqual(4.5);
    });

    test(`${name}: breadcrumb separator on background`, () => {
      expect(contrastRatio(t.breadcrumbSep, t.bg)).toBeGreaterThanOrEqual(3);
    });

    test(`${name}: label button on image well`, () => {
      expect(contrastRatio(t.onImageBtn, t.imageWell)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
