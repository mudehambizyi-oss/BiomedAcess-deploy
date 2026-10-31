import { createClient } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.join(here, '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Turso (libSQL remote) when TURSO_DATABASE_URL is set, otherwise a local libSQL file.
const LOCAL_DB_FILE = path.join(DATA_DIR, 'local.db');
export const DB_PATH = process.env.TURSO_DATABASE_URL || `file:${LOCAL_DB_FILE}`;
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${LOCAL_DB_FILE}`,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
  intMode: 'number', // INTEGER columns come back as JS numbers, not bigint
});

// Query helpers. Inside db.tx(fn), every helper call automatically uses that transaction
// (AsyncLocalStorage), so the code inside the callback stays the same.
const txContext = new AsyncLocalStorage();
const exec = (sql, args = []) => {
  const ex = txContext.getStore() || client;
  return ex.execute({ sql, args: args.map((a) => (a === undefined ? null : a)) });
};
// Rebuild rows from the result's column list: the raw libsql Row objects can lose
// their named columns in some protocol paths, which serializes as {}.
function plainRows(r) {
  const cols = r.columns || [];
  return r.rows.map((row) => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i];
    return o;
  });
}

const db = {
  client,
  async all(sql, args = []) {
    return plainRows(await exec(sql, args));
  },
  async get(sql, args = []) {
    return plainRows(await exec(sql, args))[0];
  },
  async run(sql, args = []) {
    const r = await exec(sql, args);
    return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
  },
  async exec(sql) {
    await client.executeMultiple(sql);
  },
  // Runs fn() in one write transaction (rolls back if fn throws). Nested calls join the outer one.
  async tx(fn) {
    if (txContext.getStore()) return fn();
    const t = await client.transaction('write');
    try {
      const out = await txContext.run(t, () => fn());
      await t.commit();
      return out;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};

// Statement helper with the same get/all/run shape the old prepared statements had.
export const stmt = (sql) => ({
  get: (...args) => db.get(sql, args),
  all: (...args) => db.all(sql, args),
  run: (...args) => db.run(sql, args),
});

// Foreign keys are on by default in Turso; enforce locally too.
await client.execute('PRAGMA foreign_keys = ON');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT 'General',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS community_members (
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (community_id, user_id)
);
CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS community_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_community_messages_community ON community_messages(community_id, id);
CREATE TABLE IF NOT EXISTS case_studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  patient TEXT NOT NULL DEFAULT '',
  presentation TEXT NOT NULL DEFAULT '',
  vitals TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS case_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('diagnosis','lab','treatment','explanation')),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS case_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS case_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES case_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES case_questions(id) ON DELETE CASCADE,
  selected_index INTEGER,
  is_correct INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','tutor','moderator','admin')),
  track TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Beginner',
  is_paid INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  published INTEGER NOT NULL DEFAULT 1,
  tracks TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subtopics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subtopic_id INTEGER NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pdf',
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL UNIQUE REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  selected_index INTEGER,
  is_correct INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtopic_id INTEGER NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subtopic_id)
);
CREATE TABLE IF NOT EXISTS activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL,
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, topic_id)
);
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('case','course')),
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, item_id)
);
CREATE TABLE IF NOT EXISTS course_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  original_name TEXT,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 1,
  unlock_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_ref TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
await db.exec(SCHEMA);

// Add track fields to existing databases before any table rebuilds.
if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('users') WHERE name = 'track'"))) {
  await db.exec('ALTER TABLE users ADD COLUMN track TEXT');
}
if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('courses') WHERE name = 'tracks'"))) {
  await db.exec('ALTER TABLE courses ADD COLUMN tracks TEXT');
}

// Existing databases have the old role CHECK constraint. Rebuild only that table in place
// while foreign-key enforcement is briefly disabled, preserving all users and references.
const usersSql = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
if (usersSql && !usersSql.sql.includes("'tutor'")) {
  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    await db.exec(`CREATE TABLE users_role_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','tutor','moderator','admin')),
      track TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
      INSERT INTO users_role_migration (id,email,password_hash,name,role,track,created_at)
        SELECT id,email,password_hash,name,role,track,created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_role_migration RENAME TO users;`);
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
}

// Course completion certificates (one per student per course; PDF generated on demand)
await db.exec(`CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, course_id)
);`);

// Exam unlock passwords (bcrypt hash, never returned) and per-student unlocks once a student enters the password
if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('exams') WHERE name = 'unlock_password_hash'"))) {
  await db.exec('ALTER TABLE exams ADD COLUMN unlock_password_hash TEXT');
}
// Optional scheduled end time for exams. After this moment the exam closes for students.
if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('exams') WHERE name = 'closes_at'"))) {
  await db.exec('ALTER TABLE exams ADD COLUMN closes_at TEXT');
}
await db.exec(`CREATE TABLE IF NOT EXISTS exam_unlocks (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (exam_id, user_id)
);`);

// In-app exam questions (parsed from an uploaded .txt/.md/.pdf). correct_index NULL = not marked yet, not scored.
await db.exec(`CREATE TABLE IF NOT EXISTS exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER,
  position INTEGER NOT NULL DEFAULT 0
);`);
await db.exec('CREATE INDEX IF NOT EXISTS exam_questions_exam ON exam_questions (exam_id, position)');

// Student exam attempts and their per-question answers (same pattern as quiz_attempts / attempt_answers).
await db.exec(`CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  unmarked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
await db.exec(`CREATE TABLE IF NOT EXISTS exam_attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_index INTEGER,
  is_correct INTEGER,
  PRIMARY KEY (attempt_id, question_id)
);`);

if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('courses') WHERE name = 'image_url'"))) {
  await db.exec("ALTER TABLE courses ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}

// Optional small image data for community and case-study cards. Base64 data stays portable on Render free tier.
for (const [table, column] of [['communities', 'image_data'], ['case_studies', 'image_data']]) {
  if (!(await db.get(`SELECT 1 AS x FROM pragma_table_info('${table}') WHERE name = '${column}'`))) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
}

// Backfill discipline labels for the seeded courses (only where still empty)
const DISCIPLINE_BY_SLUG = {
  'haematology-blood-transfusion': 'Haematology', 'clinical-chemistry': 'Clinical Chemistry', 'parasitology': 'Parasitology',
  'histopathology-cytology': 'Histopathology', 'medical-virology': 'Virology', 'immunology-serology': 'Immunology',
  'medical-entomology': 'Entomology', 'anatomy-physiology': 'Anatomy', 'pharmacology': 'Pharmacology',
  'public-health-epidemiology': 'Public Health', 'laboratory-management-ethics': 'Lab Management', 'research-methods-biostatistics': 'Biostatistics',
};
// Migration: discipline label on courses (idempotent)
if (!(await db.get("SELECT 1 AS x FROM pragma_table_info('courses') WHERE name = 'discipline'"))) {
  await db.exec("ALTER TABLE courses ADD COLUMN discipline TEXT NOT NULL DEFAULT ''");
}
for (const [slug, label] of Object.entries(DISCIPLINE_BY_SLUG)) {
  await db.run("UPDATE courses SET discipline = ? WHERE slug = ? AND discipline = ''", [label, slug]);
}

// Promote the account in ADMIN_EMAIL to admin on boot (idempotent)
if (process.env.ADMIN_EMAIL) {
  await db.run("UPDATE users SET role='admin' WHERE email = ? COLLATE NOCASE", [process.env.ADMIN_EMAIL.trim()]);
}

export default db;
