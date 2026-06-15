import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { THEMES, DEFAULT_THEME, THEME_KEY, isValidTheme, applyTheme } from './themes.js';

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

function initial() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && isValidTheme(saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initial);
  const [washKey, setWashKey] = useState(0);
  const washColor = useRef(null);

  const setTheme = useCallback((id) => {
    if (!isValidTheme(id) || id === theme) return;
    const t = applyTheme(id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* ignore */ }
    washColor.current = t.primary;
    setThemeState(id);
    setWashKey((k) => k + 1);   // re-trigger the wash animation
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
      {washKey > 0 && (
        <div key={washKey} className="theme-wash" style={{ '--wash': washColor.current }} aria-hidden="true" />
      )}
    </ThemeCtx.Provider>
  );
}
