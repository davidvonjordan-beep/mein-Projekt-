import type { Round } from '../types';
import { read, write } from './storage';

const TOKEN_KEY = 'golfmap.token';

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface ServerReview {
  id: number;
  stars: number;
  text: string;
  author: string;
  date: string;
  mine: boolean;
}

export type RatingSummary = { avg: number; count: number };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => read<string | null>(TOKEN_KEY, null);
export const setToken = (t: string | null) => {
  if (t) write(TOKEN_KEY, t);
  else {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignorieren */
    }
  }
};

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keine JSON-Antwort */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Serverfehler (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>('/api/auth/register', { body: { email, password, name } }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', { body: { email, password } }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/api/me'),

  ratings: (ids: string[]) =>
    request<Record<string, RatingSummary>>(`/api/ratings?ids=${ids.map(encodeURIComponent).join(',')}`),
  reviews: (clubId: string) => request<ServerReview[]>(`/api/clubs/${encodeURIComponent(clubId)}/reviews`),
  addReview: (clubId: string, stars: number, text: string) =>
    request<void>(`/api/clubs/${encodeURIComponent(clubId)}/reviews`, { body: { stars, text } }),

  favorites: () => request<string[]>('/api/favorites'),
  addFavorite: (clubId: string) => request<void>(`/api/favorites/${encodeURIComponent(clubId)}`, { method: 'PUT' }),
  removeFavorite: (clubId: string) => request<void>(`/api/favorites/${encodeURIComponent(clubId)}`, { method: 'DELETE' }),

  rounds: () => request<Round[]>('/api/rounds'),
  putRound: (r: Round) => request<Round>(`/api/rounds/${r.id}`, { method: 'PUT', body: r }),
  deleteRound: (id: string) => request<void>(`/api/rounds/${id}`, { method: 'DELETE' }),
};
