import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function getDb() {
  if (db) return db;

  const dbDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(path.join(dbDir, 'cards.db'));
  db.pragma('journal_mode = WAL');
  initSchema();
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      company     TEXT,
      phone       TEXT,
      email       TEXT,
      industry    TEXT,
      business    TEXT,
      company_info TEXT,
      tags        TEXT DEFAULT '[]',
      image_path  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_company ON cards(company);

    CREATE TABLE IF NOT EXISTS resumes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT,
      phone       TEXT,
      email       TEXT,
      summary     TEXT,
      education   TEXT,
      experience  TEXT,
      skills      TEXT,
      raw_text    TEXT,
      file_path   TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_name ON resumes(name);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
