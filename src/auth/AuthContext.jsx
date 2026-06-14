import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, logout as apiLogout } from '../api/client.js';
import { todayStr } from '../lib/util.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, prefs: null, emailEnabled: false });

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setState({ loading: false, user: data.user, prefs: data.prefs, emailEnabled: data.emailEnabled });
      // Best-effort: tell the server our real timezone once, so streaks/cron align.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && data.user.tz !== tz) api.setTz(tz).catch(() => {});
    } catch {
      setState({ loading: false, user: null, prefs: null, emailEnabled: false });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ loading: false, user: null, prefs: null, emailEnabled: false });
  }, []);

  return (
    <AuthCtx.Provider value={{ ...state, refresh, logout, today: todayStr(state.user?.tz) }}>
      {children}
    </AuthCtx.Provider>
  );
}
