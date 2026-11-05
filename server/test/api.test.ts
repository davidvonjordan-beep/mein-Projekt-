import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';

let server: Server;
let base = '';

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(base + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  server = createApp(openDb(':memory:')).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

describe('Konto', () => {
  it('registriert, meldet an und ab', async () => {
    const reg = await api('/api/auth/register', { body: { email: 'Anna@Example.com', password: 'geheim123', name: 'Anna' } });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.email, 'anna@example.com');

    const dup = await api('/api/auth/register', { body: { email: 'anna@example.com', password: 'geheim123', name: 'A' } });
    assert.equal(dup.status, 409);

    const wrong = await api('/api/auth/login', { body: { email: 'anna@example.com', password: 'falsch!!' } });
    assert.equal(wrong.status, 401);

    const login = await api('/api/auth/login', { body: { email: 'ANNA@example.com', password: 'geheim123' } });
    assert.equal(login.status, 200);
    const me = await api('/api/me', { token: login.data.token });
    assert.equal(me.data.user.name, 'Anna');

    assert.equal((await api('/api/auth/logout', { method: 'POST', token: login.data.token })).status, 204);
    assert.equal((await api('/api/me', { token: login.data.token })).status, 401);
  });

  it('lehnt zu kurze Passwörter ab', async () => {
    const r = await api('/api/auth/register', { body: { email: 'b@example.com', password: 'kurz', name: 'B' } });
    assert.equal(r.status, 400);
  });
});

describe('Bewertungen', () => {
  it('eine Bewertung pro Nutzer, Durchschnitt über alle', async () => {
    const a = (await api('/api/auth/register', { body: { email: 'r1@example.com', password: 'passwort1', name: 'Ralf' } })).data.token;
    const b = (await api('/api/auth/register', { body: { email: 'r2@example.com', password: 'passwort2', name: 'Rita' } })).data.token;

    assert.equal((await api('/api/clubs/osm-way-1/reviews', { body: { stars: 5, text: 'Top' } })).status, 401);
    await api('/api/clubs/osm-way-1/reviews', { body: { stars: 2, text: 'Naja' }, token: a });
    await api('/api/clubs/osm-way-1/reviews', { body: { stars: 4, text: 'Doch gut' }, token: a }); // überschreibt
    await api('/api/clubs/osm-way-1/reviews', { body: { stars: 5, text: 'Super' }, token: b });
    assert.equal((await api('/api/clubs/osm-way-1/reviews', { body: { stars: 9 }, token: b })).status, 400);

    const ratings = await api('/api/ratings?ids=osm-way-1,osm-way-2');
    assert.deepEqual(ratings.data, { 'osm-way-1': { avg: 4.5, count: 2 } });

    const list = await api('/api/clubs/osm-way-1/reviews', { token: a });
    assert.equal(list.data.length, 2);
    assert.equal(list.data.find((r: { mine: boolean }) => r.mine).text, 'Doch gut');
  });
});

describe('Runden & Favoriten', () => {
  it('speichert Runden pro Nutzer, neuere Version gewinnt', async () => {
    const t = (await api('/api/auth/register', { body: { email: 'g@example.com', password: 'golfgolf', name: 'Gerd' } })).data.token;
    const other = (await api('/api/auth/register', { body: { email: 'h@example.com', password: 'golfgolf', name: 'Hans' } })).data.token;
    const round = {
      clubId: 'demo-0', clubName: 'Demo', date: '2026-11-05T10:00:00Z', finished: false,
      scores: { 1: 4 }, pars: { 1: 4 }, shots: [{ hole: 1, club: 'Dr', pos: [48, 11], t: 1 }], updatedAt: 100,
    };
    assert.equal((await api('/api/rounds/r1', { method: 'PUT', body: round, token: t })).status, 200);
    await api('/api/rounds/r1', { method: 'PUT', body: { ...round, scores: { 1: 9 }, updatedAt: 50 }, token: t }); // älter → ignoriert
    await api('/api/rounds/r1', { method: 'PUT', body: { ...round, finished: true, scores: { 1: 5 }, updatedAt: 200 }, token: t });

    const mine = await api('/api/rounds', { token: t });
    assert.equal(mine.data.length, 1);
    assert.deepEqual(mine.data[0].scores, { 1: 5 });
    assert.equal(mine.data[0].finished, true);
    assert.equal((await api('/api/rounds', { token: other })).data.length, 0);

    assert.equal((await api('/api/rounds/r1', { method: 'PUT', body: { ...round, scores: 'x' }, token: t })).status, 400);
    await api('/api/rounds/r1', { method: 'DELETE', token: t });
    assert.equal((await api('/api/rounds', { token: t })).data.length, 0);

    await api('/api/favorites/osm-way-7', { method: 'PUT', token: t });
    assert.deepEqual((await api('/api/favorites', { token: t })).data, ['osm-way-7']);
    await api('/api/favorites/osm-way-7', { method: 'DELETE', token: t });
    assert.deepEqual((await api('/api/favorites', { token: t })).data, []);
  });
});
