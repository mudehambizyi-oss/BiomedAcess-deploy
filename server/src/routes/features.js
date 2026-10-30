import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth, requireAdmin } from '../lib/auth.js';

const router = Router();
const DAY = 86400000;

// ---------- quiz streak ----------
// Consecutive UTC days with at least one completed quiz attempt. A streak stays "current"
// through today or yesterday (so it does not reset until a full day is missed).
export async function quizStreak(userId, nowMs = Date.now()) {
  const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const days = (await db.all('SELECT DISTINCT date(created_at) AS d FROM quiz_attempts WHERE user_id = ? AND created_at IS NOT NULL', [userId])).map((r) => r.d).filter(Boolean).sort();
  const set = new Set(days);
  const today = utcDay(nowMs);
  const yesterday = utcDay(nowMs - DAY);
  let current = 0;
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current++;
    cursor = utcDay(new Date(cursor + 'T00:00:00Z').getTime() - DAY);
  }
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && utcDay(new Date(prev + 'T00:00:00Z').getTime() + DAY) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, active_today: set.has(today), days_completed: days.length };
}

router.get('/streak', requireAuth, async (req, res) => res.json(await quizStreak(req.user.id)));

// ---------- public platform stats (landing page) ----------
// Counts only; no user data. Used by the landing page so the numbers are real.
router.get('/stats', async (_req, res) => {
  const n = async (sql) => (await db.get(sql, [])).n;
  res.json({
    courses: await n('SELECT COUNT(*) AS n FROM courses WHERE published = 1'),
    topics: await n('SELECT COUNT(*) AS n FROM topics'),
    communities: await n('SELECT COUNT(*) AS n FROM communities'),
    case_studies: await n('SELECT COUNT(*) AS n FROM case_studies WHERE published = 1'),
  });
});

// ---------- contact ----------
const contactClip = (value, max) => String(value ?? '').replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, max);

router.post('/contact', async (req, res) => {
  const name = contactClip(req.body?.name, 120);
  const email = contactClip(req.body?.email, 254).toLowerCase();
  const message = String(req.body?.message ?? '').replace(/\x00/g, '').trim().slice(0, 10000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return res.status(400).json({ error: 'Enter your name, a valid email, and a message.' });
  await db.run('INSERT INTO contact_messages (name, email, message) VALUES (?,?,?)', [name, email, message]);
  res.status(201).json({ ok: true });
});

router.get('/admin/contact-messages', requireAdmin, async (_req, res) => {
  res.json(await db.all('SELECT id, name, email, message, created_at FROM contact_messages ORDER BY id DESC LIMIT 500', []));
});

// ---------- global search ----------
// LIKE wildcards are escaped so the user's text is matched literally.
const ESC = "ESCAPE '\\'";
const likeTerm = (q) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

router.get('/search', optionalAuth, async (req, res) => {
  const q = String(req.query.q || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 100);
  if (q.length < 2) return res.json({ query: q, courses: [], topics: [], cases: [], note: 'Type at least 2 characters.' });
  const term = likeTerm(q);
  const courses = (await db.all(`SELECT id, slug, title, level, description FROM courses
      WHERE published = 1 AND (title LIKE ? ${ESC} OR description LIKE ? ${ESC})
      ORDER BY position, id LIMIT 10`, [term, term]));
  const topics = (await db.all(`SELECT t.id, t.title, c.id AS course_id, c.title AS course_title FROM topics t
      JOIN courses c ON c.id = t.course_id
      WHERE c.published = 1 AND (t.title LIKE ? ${ESC} OR t.description LIKE ? ${ESC})
      ORDER BY c.position, t.position, t.id LIMIT 10`, [term, term]));
  const cases = req.user ? (await db.all(`SELECT id, slug, title, specialty FROM case_studies
      WHERE (published = 1 OR ? = 'admin') AND (title LIKE ? ${ESC} OR specialty LIKE ? ${ESC} OR patient LIKE ? ${ESC} OR presentation LIKE ? ${ESC})
      ORDER BY id LIMIT 10`, [req.user.role, term, term, term, term])) : [];
  res.json({ query: q, courses, topics, cases, signed_in: !!req.user });
});

// ---------- bookmarks ----------
const KINDS = ['case', 'course'];

router.get('/bookmarks', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const cases = (await db.all(`SELECT b.created_at AS saved_at, c.id, c.slug, c.title, c.specialty FROM bookmarks b
      JOIN case_studies c ON c.id = b.item_id WHERE b.user_id = ? AND b.kind = 'case' AND c.published = 1 ORDER BY b.created_at DESC`, [uid]));
  const courses = (await db.all(`SELECT b.created_at AS saved_at, c.id, c.slug, c.title, c.level FROM bookmarks b
      JOIN courses c ON c.id = b.item_id WHERE b.user_id = ? AND b.kind = 'course' AND c.published = 1 ORDER BY b.created_at DESC`, [uid]));
  res.json({ cases, courses });
});

router.get('/bookmarks/:kind/:id', requireAuth, async (req, res) => {
  if (!KINDS.includes(req.params.kind)) return res.status(400).json({ error: 'Unknown bookmark type.' });
  const row = (await db.get('SELECT 1 FROM bookmarks WHERE user_id = ? AND kind = ? AND item_id = ?', [req.user.id, req.params.kind, Number(req.params.id)]));
  res.json({ saved: !!row });
});

router.post('/bookmarks', requireAuth, async (req, res) => {
  const kind = String(req.body?.kind || '');
  const itemId = Number(req.body?.id);
  if (!KINDS.includes(kind) || !Number.isInteger(itemId)) return res.status(400).json({ error: 'Choose a case study or course to save.' });
  const exists = kind === 'case'
    ? (await db.get("SELECT 1 FROM case_studies WHERE id = ? AND (published = 1 OR ? = 'admin')", [itemId, req.user.role]))
    : (await db.get('SELECT 1 FROM courses WHERE id = ? AND published = 1', [itemId]));
  if (!exists) return res.status(404).json({ error: 'Item not found.' });
  (await db.run('INSERT OR IGNORE INTO bookmarks (user_id, kind, item_id) VALUES (?,?,?)', [req.user.id, kind, itemId]));
  res.status(201).json({ saved: true, kind, id: itemId });
});

router.delete('/bookmarks/:kind/:id', requireAuth, async (req, res) => {
  if (!KINDS.includes(req.params.kind)) return res.status(400).json({ error: 'Unknown bookmark type.' });
  (await db.run('DELETE FROM bookmarks WHERE user_id = ? AND kind = ? AND item_id = ?', [req.user.id, req.params.kind, Number(req.params.id)]));
  res.json({ saved: false });
});

// ---------- lab of the week ----------
// ISO 8601 week (Monday start). Same answer for every visitor in the same ISO week.
export function isoWeekInfo(ms) {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1 .. Sun=7
  const thursday = new Date(date.getTime() + (4 - dayNum) * DAY); // the week's Thursday decides the ISO year
  const isoYear = thursday.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY + 1) / 7);
  const monday = new Date(thursday.getTime() - 3 * DAY).toISOString().slice(0, 10);
  return { iso_year: isoYear, iso_week: week, label: `${isoYear}-W${String(week).padStart(2, '0')}`, week_starts: monday };
}

export async function labOfTheWeek(nowMs = Date.now()) {
  const communities = (await db.all(`SELECT c.id, c.slug, c.name, c.description, c.tag,
      (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id) AS member_count,
      (SELECT COUNT(*) FROM threads t WHERE t.community_id = c.id) AS thread_count
    FROM communities c ORDER BY c.id`, []));
  if (!communities.length) return null;
  const info = isoWeekInfo(nowMs);
  // index from ISO year + week so the rotation changes each week and each year
  const index = (info.iso_year * 53 + info.iso_week) % communities.length;
  return { ...info, community: communities[index], rotation_size: communities.length };
}

router.get('/lab-of-the-week', requireAuth, async (_req, res) => {
  const lab = await labOfTheWeek();
  if (!lab) return res.status(404).json({ error: 'No communities yet.' });
  res.json(lab);
});

export default router;
