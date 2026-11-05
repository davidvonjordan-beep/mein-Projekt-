import { fileURLToPath } from 'node:url';
import { openDb } from './db.ts';
import { createApp } from './app.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const dbFile = process.env.DB_FILE ?? `${root}data/golfmap.db`;
const staticDir = process.env.STATIC_DIR ?? fileURLToPath(new URL('../../app/dist', import.meta.url));

const app = createApp(openDb(dbFile), { staticDir });
app.listen(port, () => {
  console.log(`GolfMap-Server läuft auf http://localhost:${port} (DB: ${dbFile})`);
});
