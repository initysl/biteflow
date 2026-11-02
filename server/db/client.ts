import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

function migrationsFolder() {
  // Works both from source (tsx) and from the bundled dist/server.cjs.
  const candidates = [
    path.resolve(process.cwd(), 'server/db/migrations'),
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'migrations') : '',
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(path.join(p, 'meta', '_journal.json')));
  if (!found) throw new Error('Could not locate database migrations folder');
  return found;
}

export function createDb(url: string): { db: DB; sqlite: Database.Database } {
  if (url !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(url)), { recursive: true });
  const sqlite = new Database(url);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });

  // Migrations that rebuild a table (SQLite's only way to change a column) drop
  // the old table. With foreign keys on, that drop cascades and deletes child
  // rows (e.g. every order item). `PRAGMA foreign_keys` is ignored inside the
  // migrator's transaction, so switch it off around the whole run instead.
  sqlite.pragma('foreign_keys = OFF');
  migrate(db, { migrationsFolder: migrationsFolder() });
  const broken = sqlite.pragma('foreign_key_check') as unknown[];
  if (broken.length) throw new Error(`Migration left ${broken.length} broken foreign key reference(s)`);
  sqlite.pragma('foreign_keys = ON');
  return { db, sqlite };
}
