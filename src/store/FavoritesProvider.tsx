import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { FavoritesContext, useNotify } from './contexts';
import { isArray, usePersistentState } from './persistence';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const [favorites, setFavorites] = usePersistentState<number[]>(STORAGE_KEYS.favorites, [], isArray);
  // Read the latest list without making toggleFavorite change on every update.
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const toggleFavorite = useCallback(
    (id: number, name: string) => {
      const isFavorite = favoritesRef.current.includes(id);
      notify(isFavorite ? `Removed "${name}" from favorites` : `Added "${name}" to favorites`);
      setFavorites((prev) => (isFavorite ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [notify, setFavorites],
  );

  const value = useMemo(() => ({ favorites, toggleFavorite }), [favorites, toggleFavorite]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
