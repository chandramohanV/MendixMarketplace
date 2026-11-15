import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const StoreContext = createContext(null);

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function StoreProvider({ children }) {
  const [favorites, setFavorites] = useState(() => load('mp.favorites', []));
  const [userReviews, setUserReviews] = useState(() => load('mp.reviews', {}));
  const [downloads, setDownloads] = useState(() => load('mp.downloads', []));
  const [toast, setToast] = useState(null);

  useEffect(() => { save('mp.favorites', favorites); }, [favorites]);
  useEffect(() => { save('mp.reviews', userReviews); }, [userReviews]);
  useEffect(() => { save('mp.downloads', downloads); }, [downloads]);

  const notify = useCallback((message) => {
    setToast({ message, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleFavorite = useCallback((id, name) => {
    setFavorites((prev) => {
      const has = prev.includes(id);
      notify(has ? `Removed "${name}" from favorites` : `Added "${name}" to favorites`);
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, [notify]);

  const addReview = useCallback((id, review) => {
    setUserReviews((prev) => ({ ...prev, [id]: [review, ...(prev[id] || [])] }));
    notify('Thanks! Your review has been posted.');
  }, [notify]);

  const recordDownload = useCallback((id, version, name) => {
    setDownloads((prev) => [{ id, version, date: new Date().toISOString() }, ...prev].slice(0, 50));
    notify(`Downloading ${name} v${version}…`);
  }, [notify]);

  return (
    <StoreContext.Provider value={{ favorites, toggleFavorite, userReviews, addReview, downloads, recordDownload, notify }}>
      {children}
      {toast && <div className="toast" key={toast.key} role="status">{toast.message}</div>}
    </StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  return useContext(StoreContext);
}
