import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin, optionalAuth } from '../lib/auth.js';
import { makePdf } from '../lib/pdf.js';

const router = Router();

// ---------- helpers ----------
export async function courseAccess(userId, role, courseId) {
  if (role === 'admin') return true;
  const course = (await db.get('SELECT is_paid FROM courses WHERE id = ?', [courseId]));
  if (!course) return false;
  return !!(await db.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]));
}

export async function topicCourse(topicId) {
  return (await db.get('SELECT t.*, c.id AS course_id, c.published, c.is_paid, c.price_cents, c.currency, c.title AS course_title FROM topics t JOIN courses c ON c.id = t.course_id WHERE t.id = ?', [topicId]));
}

async function courseProgress(userId, courseId) {
  const total = (await db.get(`SELECT COUNT(*) n FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ?`, [courseId])).n;
  const done = (await db.get(`SELECT COUNT(*) n FROM progress p JOIN subtopics s ON s.id = p.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ? AND p.user_id = ?`, [courseId, userId])).n;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

async function topicAccuracy(userId) {
  // returns [{topic_id, topic_title, course_id, course_title, attempted, correct, accuracy}]
  return (await db.all(`
    SELECT t.id AS topic_id, t.title AS topic_title, c.id AS course_id, c.title AS course_title,
      COUNT(aa.id) AS attempted, SUM(aa.is_correct) AS correct
    FROM attempt_answers aa
    JOIN quiz_attempts qa ON qa.id = aa.attempt_id
    JOIN topics t ON t.id = aa.topic_id
    JOIN courses c ON c.id = t.course_id
    WHERE qa.user_id = ?
    GROUP BY t.id
  `, [userId])).map((r) => ({ ...r, correct: r.correct || 0, accuracy: r.attempted ? Math.round(((r.correct || 0) / r.attempted) * 100) : 0 }));
}

// ---------- catalog (public) ----------
router.get('/courses', optionalAuth, async (req, res) => {
  const courses = (await db.all('SELECT * FROM courses WHERE published = 1 ORDER BY position, id', []));
  const enrolled = req.user ? new Set((await db.all('SELECT course_id FROM enrollments WHERE user_id = ?', [req.user.id])).map((r) => r.course_id)) : new Set();
  const counts = (await db.all(`SELECT t.course_id, COUNT(DISTINCT t.id) topics,
    COUNT(DISTINCT q.id) quizzes FROM topics t LEFT JOIN quizzes q ON q.topic_id = t.id GROUP BY t.course_id`, []));
  const topicCount = Object.fromEntries(counts.map((c) => [c.course_id, c.topics]));
  const quizCount = Object.fromEntries(counts.map((c) => [c.course_id, c.quizzes]));
  const docCount = Object.fromEntries((await db.all('SELECT course_id, COUNT(*) n FROM course_documents GROUP BY course_id', [])).map((r) => [r.course_id, r.n]));
  const examCount = Object.fromEntries((await db.all('SELECT course_id, COUNT(*) n FROM exams GROUP BY course_id', [])).map((r) => [r.course_id, r.n]));
  const out = [];
  for (const c of courses) {
    out.push({
      id: c.id, slug: c.slug, title: c.title, description: c.description, level: c.level, discipline: c.discipline || '',
      image_url: c.image_url || null, tracks: c.tracks || null,
      is_paid: !!c.is_paid, price_cents: c.price_cents, currency: c.currency,
      topic_count: topicCount[c.id] || 0,
      quiz_count: quizCount[c.id] || 0,
      document_count: docCount[c.id] || 0,
      exam_count: examCount[c.id] || 0,
      enrolled: enrolled.has(c.id),
      progress: req.user && enrolled.has(c.id) ? await courseProgress(req.user.id, c.id) : null,
    });
  }
  res.json(out);
});

router.get('/courses/:id', optionalAuth, async (req, res) => {
  const course = (await db.get('SELECT * FROM courses WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!course || (!course.published && req.user?.role !== 'admin')) return res.status(404).json({ error: 'Course not found.' });
  const access = req.user ? await courseAccess(req.user.id, req.user.role, course.id) : false;
  const topics = await Promise.all((await db.all('SELECT * FROM topics WHERE course_id = ? ORDER BY position, id', [course.id])).map(async (t) => {
    const subtopics = (await db.all('SELECT id, title, position FROM subtopics WHERE topic_id = ? ORDER BY position, id', [t.id]));
    const quiz = (await db.get('SELECT id, title FROM quizzes WHERE topic_id = ?', [t.id])) || null;
    return { ...t, subtopics, quiz };
  }));
  res.json({
    id: course.id, slug: course.slug, title: course.title, description: course.description, level: course.level, discipline: course.discipline || '',
    is_paid: !!course.is_paid, price_cents: course.price_cents, currency: course.currency,
    enrolled: access && !!(req.user && (await db.get('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', [req.user.id, course.id]))),
    has_access: access,
    progress: req.user ? await courseProgress(req.user.id, course.id) : null,
    topics,
  });
});

// Enroll in a FREE course. Paid courses must go through /api/payments/checkout.
router.post('/courses/:id/enroll', requireAuth, async (req, res) => {
  const course = (await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]));
  if (!course || !course.published) return res.status(404).json({ error: 'Course not found.' });
  if (course.is_paid && req.user.role !== 'admin') {
    return res.status(402).json({ error: 'This course is paid. Use checkout to enroll.', paid: true });
  }
  (await db.run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [req.user.id, course.id]));
  res.json({ ok: true });
});

// ---------- topic content (requires access) ----------
router.get('/topics/:id', requireAuth, async (req, res) => {
  const topic = await topicCourse(req.params.id);
  if (!topic || !topic.published) return res.status(404).json({ error: 'Topic not found.' });
  if (!await courseAccess(req.user.id, req.user.role, topic.course_id)) {
    return res.status(403).json({ error: 'Enroll in this course to view its topics.', needs_enrollment: true, paid: !!topic.is_paid, price_cents: topic.price_cents });
  }
  (await db.run(`INSERT INTO activity (user_id, topic_id, last_accessed_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id, topic_id) DO UPDATE SET last_accessed_at = datetime('now')`, [req.user.id, topic.id]));
  const subtopics = await Promise.all((await db.all('SELECT * FROM subtopics WHERE topic_id = ? ORDER BY position, id', [topic.id])).map(async (s) => {
    const resources = (await db.all(`SELECT r.id, r.title, r.kind, r.original_name, r.size, r.created_at,
      (SELECT COUNT(*) FROM comments c WHERE c.resource_id = r.id) AS comment_count
      FROM resources r WHERE r.subtopic_id = ? ORDER BY r.id`, [s.id]));
    const completed = !!(await db.get('SELECT 1 FROM progress WHERE user_id=? AND subtopic_id=?', [req.user.id, s.id]));
    return { ...s, resources, completed };
  }));
  const quiz = (await db.get('SELECT id, title FROM quizzes WHERE topic_id = ?', [topic.id])) || null;
  const quizBest = quiz ? (await db.get('SELECT MAX(CAST(score AS REAL)/total) best, COUNT(*) attempts FROM quiz_attempts WHERE user_id=? AND quiz_id=?', [req.user.id, quiz.id])) : null;
  res.json({
    id: topic.id, title: topic.title, description: topic.description,
    course: { id: topic.course_id, title: topic.course_title },
    subtopics, quiz: quiz ? { ...quiz, question_count: (await db.get('SELECT COUNT(*) n FROM questions WHERE quiz_id=?', [quiz.id])).n, best_percent: quizBest?.best != null ? Math.round(quizBest.best * 100) : null, attempts: quizBest?.attempts || 0 } : null,
  });
});

// ---------- per-subtopic / per-topic PDF (generated on the fly, access required) ----------
// Filenames: ASCII-only fallback plus RFC 5987 filename* so titles with accents still work.
function pdfDownload(res, filename, buf) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\\r\n]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buf);
}

function slugName(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
}

// One subtopic: title + body rendered as a PDF.
router.get('/subtopics/:id/pdf', requireAuth, async (req, res) => {
  const row = (await db.get(`SELECT s.id, s.title, s.body, t.id AS topic_id, t.title AS topic_title, t.course_id, c.title AS course_title, c.published
    FROM subtopics s JOIN topics t ON t.id = s.topic_id JOIN courses c ON c.id = t.course_id WHERE s.id = ?`, [req.params.id]));
  if (!row || (!row.published && req.user.role !== 'admin')) return res.status(404).json({ error: 'Subtopic not found.' });
  if (!await courseAccess(req.user.id, req.user.role, row.course_id)) return res.status(403).json({ error: 'Enroll in this course to download its materials.', needs_enrollment: true });
  const text = `${row.course_title} / ${row.topic_title}\n\n${row.body || ''}`;
  const buf = makePdf(row.title, text);
  return pdfDownload(res, `${slugName(row.course_title)}_${slugName(row.topic_title)}_${slugName(row.title)}.pdf`, buf);
});

// Whole topic: every subtopic, in order, as one PDF.
router.get('/topics/:id/pdf', requireAuth, async (req, res) => {
  const topic = await topicCourse(req.params.id);
  if (!topic || (!topic.published && req.user.role !== 'admin')) return res.status(404).json({ error: 'Topic not found.' });
  if (!await courseAccess(req.user.id, req.user.role, topic.course_id)) return res.status(403).json({ error: 'Enroll in this course to download its materials.', needs_enrollment: true });
  const subs = (await db.all('SELECT title, body FROM subtopics WHERE topic_id = ? ORDER BY position, id', [topic.id]));
  const body = subs.map((s) => `${s.title}\n\n${s.body || ''}`).join('\n\n');
  const buf = makePdf(topic.title, `${topic.course_title}\n\n${topic.description || ''}\n\n${body}`);
  return pdfDownload(res, `${slugName(topic.course_title)}_${slugName(topic.title)}.pdf`, buf);
});

// Mark subtopic complete
router.post('/subtopics/:id/complete', requireAuth, async (req, res) => {
  const sub = (await db.get('SELECT s.id, t.course_id FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE s.id = ?', [req.params.id]));
  if (!sub) return res.status(404).json({ error: 'Subtopic not found.' });
  if (!await courseAccess(req.user.id, req.user.role, sub.course_id)) return res.status(403).json({ error: 'Enroll first.' });
  (await db.run('INSERT OR IGNORE INTO progress (user_id, subtopic_id) VALUES (?, ?)', [req.user.id, sub.id]));
  res.json({ ok: true });
});
router.delete('/subtopics/:id/complete', requireAuth, async (req, res) => {
  (await db.run('DELETE FROM progress WHERE user_id=? AND subtopic_id=?', [req.user.id, req.params.id]));
  res.json({ ok: true });
});

// ---------- resource comments ----------
async function resourceAccess(req, resourceId) {
  const row = (await db.get(`SELECT r.id, t.course_id FROM resources r JOIN subtopics s ON s.id = r.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE r.id = ?`, [resourceId]));
  if (!row) return { ok: false, code: 404, error: 'Resource not found.' };
  if (!await courseAccess(req.user.id, req.user.role, row.course_id)) return { ok: false, code: 403, error: 'Enroll in this course to access its resources.' };
  return { ok: true };
}

router.get('/resources/:id/comments', requireAuth, async (req, res) => {
  const a = resourceAccess(req, req.params.id);
  if (!a.ok) return res.status(a.code).json({ error: a.error });
  const rows = (await db.all(`SELECT c.id, c.body, c.created_at, u.name AS author, u.role AS author_role, u.id AS user_id
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.resource_id = ? ORDER BY c.id DESC LIMIT 200`, [req.params.id]));
  res.json(rows);
});

router.post('/resources/:id/comments', requireAuth, async (req, res) => {
  const a = resourceAccess(req, req.params.id);
  if (!a.ok) return res.status(a.code).json({ error: a.error });
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (body.length > 2000) return res.status(400).json({ error: 'Comment is too long (2000 characters max).' });
  const info = (await db.run('INSERT INTO comments (resource_id, user_id, body) VALUES (?, ?, ?)', [req.params.id, req.user.id, body]));
  res.status(201).json({ id: info.lastInsertRowid, body, author: req.user.name, author_role: req.user.role, created_at: new Date().toISOString() });
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT * FROM comments WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Comment not found.' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own comments.' });
  (await db.run('DELETE FROM comments WHERE id = ?', [c.id]));
  res.json({ ok: true });
});

export default router;
