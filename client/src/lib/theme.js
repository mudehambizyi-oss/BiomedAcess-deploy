// Theme helpers: dark is the default, 'light' adds .light-theme on <html>.
export const THEME_KEY = 'biomedaccess-theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('light-theme', theme === 'light');
  root.dataset.theme = theme;
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable (private mode): theme still applies for this session */
  }
}
