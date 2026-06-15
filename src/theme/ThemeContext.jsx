import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { THEMES, DEFAULT_THEME, THEME_KEY, isValidTheme, applyTheme } from './themes.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';

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
  const { user } = useAuth();
  const [theme, setThemeState] = useState(initial);
  const [washKey, setWashKey] = useState(0);
  const washColor = useRef(null);

  // The account is the source of truth: when the user loads (or switches
  // device), adopt their saved theme. Cache it locally for instant pre-paint
  // next time. No server write here — this came *from* the server.
  useEffect(() => {
    const t = user?.theme;
    if (t && isValidTheme(t) && t !== theme) {
      applyTheme(t);
      try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
      setThemeState(t);
    }
  }, [user?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = useCallback((id) => {
    if (!isValidTheme(id) || id === theme) return;
    const t = applyTheme(id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* ignore */ }
    if (user) api.setTheme(id).catch(() => {});   // persist to the account
    washColor.current = t.primary;
    setThemeState(id);
    setWashKey((k) => k + 1);   // re-trigger the wash animation
  }, [theme, user]);

  return (
    <ThemeCtx.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
      {washKey > 0 && (
        <div key={washKey} className="theme-wash" style={{ '--wash': washColor.current }} aria-hidden="true" />
      )}
    </ThemeCtx.Provider>
  );
}
