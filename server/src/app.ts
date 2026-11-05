import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from './db.ts';
import {
  authenticate,
  createSession,
  deleteSession,
  hashPassword,
  rateLimit,
  requireUser,
  verifyPassword,
} from './auth.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLUB_ID_RE = /^[\w:.-]{1,100}$/;

interface RoundRow {
  id: string;
  club_id: string;
  club_name: string;
  date: string;
  finished: number;
  data: string;
  updated_at: number;
}

function toRound(r: RoundRow) {
  const data = JSON.parse(r.data) as { scores: unknown; pars: unknown; shots: unknown };
  return {
    id: r.id,
    clubId: r.club_id,
    clubName: r.club_name,
    date: r.date,
    finished: !!r.finished,
    updatedAt: r.updated_at,
    ...data,
  };
}

const isRecordOfNumbers = (v: unknown) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'number');

export function createApp(db: DB, opts: { staticDir?: string } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', authenticate(db));

  const bad = (res: Response, msg: string, status = 400) => res.status(status).json({ error: msg });

  // ---------- Konto ----------
  const authLimiter = rateLimit(20, 15 * 60 * 1000);

  app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const name = String(req.body?.name ?? '').trim().slice(0, 50);
    if (!EMAIL_RE.test(email)) return bad(res, 'Bitte gib eine gültige E-Mail-Adresse ein.');
    if (password.length < 8) return bad(res, 'Das Passwort muss mindestens 8 Zeichen haben.');
    if (!name) return bad(res, 'Bitte gib einen Namen ein.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return bad(res, 'Für diese E-Mail gibt es schon ein Konto.', 409);
    }
    const hash = await hashPassword(password);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, name, hash);
    const id = Number(lastInsertRowid);
    res.status(201).json({ token: createSession(db, id), user: { id, email, name } });
  });

  app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const row = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email) as
      | { id: number; email: string; name: string; password_hash: string }
      | undefined;
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return bad(res, 'E-Mail oder Passwort ist falsch.', 401);
    }
    res.json({ token: createSession(db, row.id), user: { id: row.id, email: row.email, name: row.name } });
  });

  app.post('/api/auth/logout', requireUser, (req, res) => {
    deleteSession(db, req.token!);
    res.status(204).end();
  });

  app.get('/api/me', requireUser, (req, res) => {
    res.json({ user: req.user });
  });

  // ---------- Bewertungen ----------
  /** Durchschnitt & Anzahl für mehrere Clubs: /api/ratings?ids=a,b,c */
  app.get('/api/ratings', (req, res) => {
    const ids = String(req.query.ids ?? '')
      .split(',')
      .filter((id) => CLUB_ID_RE.test(id))
      .slice(0, 300);
    const result: Record<string, { avg: number; count: number }> = {};
    if (ids.length) {
      const rows = db
        .prepare(
          `SELECT club_id, AVG(stars) AS avg, COUNT(*) AS count FROM reviews
           WHERE club_id IN (${ids.map(() => '?').join(',')}) GROUP BY club_id`,
        )
        .all(...ids) as Array<{ club_id: string; avg: number; count: number }>;
      for (const r of rows) result[r.club_id] = { avg: r.avg, count: r.count };
    }
    res.json(result);
  });

  app.get('/api/clubs/:clubId/reviews', (req, res) => {
    const clubId = String(req.params.clubId);
    if (!CLUB_ID_RE.test(clubId)) return bad(res, 'Ungültige Club-ID.');
    const rows = db
      .prepare(
        `SELECT r.id, r.stars, r.text, r.created_at, r.user_id, u.name FROM reviews r
         JOIN users u ON u.id = r.user_id WHERE r.club_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 200`,
      )
      .all(clubId) as Array<{ id: number; stars: number; text: string; created_at: string; user_id: number; name: string }>;
    res.json(
      rows.map((r) => ({
        id: r.id,
        stars: r.stars,
        text: r.text,
        author: r.name,
        date: r.created_at.replace(' ', 'T') + 'Z',
        mine: r.user_id === req.user?.id,
      })),
    );
  });

  /** Eine Bewertung pro Nutzer und Club – erneutes Abschicken überschreibt sie. */
  app.post('/api/clubs/:clubId/reviews', requireUser, (req, res) => {
    const clubId = String(req.params.clubId);
    const stars = Number(req.body?.stars);
    const text = String(req.body?.text ?? '').trim().slice(0, 2000);
    if (!CLUB_ID_RE.test(clubId)) return bad(res, 'Ungültige Club-ID.');
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return bad(res, 'Bitte 1 bis 5 Sterne vergeben.');
    db.prepare(
      `INSERT INTO reviews (club_id, user_id, stars, text) VALUES (?, ?, ?, ?)
       ON CONFLICT (club_id, user_id) DO UPDATE SET stars = excluded.stars, text = excluded.text, created_at = datetime('now')`,
    ).run(clubId, req.user!.id, stars, text);
    res.status(201).json({ ok: true });
  });

  app.delete('/api/clubs/:clubId/reviews/mine', requireUser, (req, res) => {
    db.prepare('DELETE FROM reviews WHERE club_id = ? AND user_id = ?').run(String(req.params.clubId), req.user!.id);
    res.status(204).end();
  });

  // ---------- Favoriten ----------
  app.get('/api/favorites', requireUser, (req, res) => {
    const rows = db.prepare('SELECT club_id FROM favorites WHERE user_id = ?').all(req.user!.id) as Array<{ club_id: string }>;
    res.json(rows.map((r) => r.club_id));
  });

  app.put('/api/favorites/:clubId', requireUser, (req, res) => {
    if (!CLUB_ID_RE.test(String(req.params.clubId))) return bad(res, 'Ungültige Club-ID.');
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, club_id) VALUES (?, ?)').run(req.user!.id, String(req.params.clubId));
    res.status(204).end();
  });

  app.delete('/api/favorites/:clubId', requireUser, (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND club_id = ?').run(req.user!.id, String(req.params.clubId));
    res.status(204).end();
  });

  // ---------- Runden ----------
  app.get('/api/rounds', requireUser, (req, res) => {
    const rows = db
      .prepare('SELECT * FROM rounds WHERE user_id = ? ORDER BY date DESC')
      .all(req.user!.id) as unknown as RoundRow[];
    res.json(rows.map(toRound));
  });

  /** Runde anlegen oder aktualisieren. Die neuere Version (updatedAt) gewinnt. */
  app.put('/api/rounds/:id', requireUser, (req, res) => {
    const id = String(req.params.id);
    const b = req.body ?? {};
    if (!/^[\w-]{1,64}$/.test(id)) return bad(res, 'Ungültige Runden-ID.');
    if (!CLUB_ID_RE.test(String(b.clubId))) return bad(res, 'Ungültige Club-ID.');
    if (!isRecordOfNumbers(b.scores) || !isRecordOfNumbers(b.pars) || !Array.isArray(b.shots)) {
      return bad(res, 'Ungültige Rundendaten.');
    }
    const updatedAt = Number(b.updatedAt) || Date.now();
    const existing = db.prepare('SELECT updated_at FROM rounds WHERE user_id = ? AND id = ?').get(req.user!.id, id) as
      | { updated_at: number }
      | undefined;
    if (!existing || existing.updated_at <= updatedAt) {
      db.prepare(
        `INSERT INTO rounds (id, user_id, club_id, club_name, date, finished, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET club_id = excluded.club_id, club_name = excluded.club_name,
           date = excluded.date, finished = excluded.finished, data = excluded.data, updated_at = excluded.updated_at`,
      ).run(
        id,
        req.user!.id,
        String(b.clubId),
        String(b.clubName ?? '').slice(0, 200),
        String(b.date ?? new Date().toISOString()),
        b.finished ? 1 : 0,
        JSON.stringify({ scores: b.scores, pars: b.pars, shots: b.shots }),
        updatedAt,
      );
    }
    const row = db.prepare('SELECT * FROM rounds WHERE user_id = ? AND id = ?').get(req.user!.id, id) as unknown as RoundRow;
    res.json(toRound(row));
  });

  app.delete('/api/rounds/:id', requireUser, (req, res) => {
    db.prepare('DELETE FROM rounds WHERE user_id = ? AND id = ?').run(req.user!.id, String(req.params.id));
    res.status(204).end();
  });

  app.use('/api', (_req, res) => {
    bad(res, 'Nicht gefunden.', 404);
  });

  // ---------- Frontend ausliefern (Produktion) ----------
  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(opts.staticDir!, 'index.html')));
  }

  return app;
}
