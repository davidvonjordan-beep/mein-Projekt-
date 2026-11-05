import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, checkServer, getToken, setToken, type User } from './api';
import { DEMO } from './demo';
import { clearLocalRounds, syncRounds } from './rounds';
import { read, write } from './storage';

const USER_KEY = 'golfmap.user';

interface AuthState {
  user: User | null;
  /** null = wird geprüft; false = ohne Server (nur lokale Funktionen) */
  serverAvailable: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Zuletzt bekannter Nutzer, damit die App auch offline angemeldet bleibt
  const [user, setUser] = useState<User | null>(() => (getToken() ? read<User | null>(USER_KEY, null) : null));

  const [serverAvailable, setServerAvailable] = useState<boolean | null>(DEMO ? false : null);
  useEffect(() => {
    if (DEMO) return;
    checkServer().then(setServerAvailable);
  }, []);

  const applySession = useCallback((token: string, u: User) => {
    setToken(token);
    write(USER_KEY, u);
    setUser(u);
    // Lokal gespielte Runden ins Konto übernehmen
    syncRounds();
  }, []);

  // Beim Start Sitzung prüfen und abgleichen
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(({ user: u }) => {
        write(USER_KEY, u);
        setUser(u);
        syncRounds();
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null);
          setUser(null);
        }
      });
  }, []);

  // Sobald wieder Netz da ist (z. B. nach dem Platz), ausstehende Runden übertragen
  useEffect(() => {
    const onOnline = () => syncRounds();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.login(email, password);
      applySession(r.token, r.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const r = await api.register(email, password, name);
      applySession(r.token, r.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await syncRounds();
    await api.logout().catch(() => undefined);
    setToken(null);
    write(USER_KEY, null);
    clearLocalRounds();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, serverAvailable, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}
