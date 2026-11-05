const FAVS_KEY = 'golfmap.favorites.v1';

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher nicht verfügbar – ignorieren */
  }
}

export const loadFavorites = () => read<string[]>(FAVS_KEY, []);
export const saveFavorites = (f: string[]) => write(FAVS_KEY, f);

