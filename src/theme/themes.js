// Available themes. `id` maps to the [data-theme="…"] block in tokens.css
// (default/lime has no attribute). Swatches drive the picker preview; `bg` sets
// the PWA <meta name="theme-color"> / status bar.
export const THEMES = [
  { id: 'lime',  name: 'Electric Lime', bg: '#14160f', primary: '#c6ff00', secondary: '#8fd6ff', surface: '#20241a' },
  { id: 'ember', name: 'Ember',         bg: '#171008', primary: '#ffb68a', secondary: '#ffd9a0', surface: '#251b12' },
  { id: 'aqua',  name: 'Aqua',          bg: '#0c1416', primary: '#5fdfe6', secondary: '#8fd6ff', surface: '#172123' },
  { id: 'grape', name: 'Grape',         bg: '#141019', primary: '#d6b4ff', secondary: '#ff9ec7', surface: '#211b2c' },
];

export const DEFAULT_THEME = 'lime';
export const THEME_KEY = 'drill_theme';

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}

/** Apply a theme to the document and sync the PWA theme-color meta. */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  if (theme.id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg);
  return theme;
}
