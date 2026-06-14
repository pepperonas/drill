import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
  }, []);

  const show = useCallback((msg, opts = {}) => {
    const id = ++idSeq;
    setToasts((t) => [...t, { id, msg, celebrate: !!opts.celebrate }]);
    timers.current[id] = setTimeout(() => dismiss(id), opts.duration || 2600);
  }, [dismiss]);

  // Celebrate the gamification deltas returned by write endpoints.
  const celebrate = useCallback((gami, leveled) => {
    if (!gami) return;
    if (leveled?.leveledUp) show(`🎉 Level ${leveled.to} erreicht!`, { celebrate: true, duration: 3200 });
    for (const a of gami.unlocked || []) {
      show(`${a.icon} Erfolg freigeschaltet: ${a.name}`, { celebrate: true, duration: 3400 });
    }
  }, [show]);

  return (
    <ToastCtx.Provider value={{ show, celebrate }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={'toast' + (t.celebrate ? ' celebrate' : '')} onClick={() => dismiss(t.id)}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
