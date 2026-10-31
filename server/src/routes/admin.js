import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import db, { stmt } from '../db.js';
import { UPLOAD_DIR } from '../db.js';
import { requireAdmin, requireContentManager } from '../lib/auth.js';
import { bulkUpload, readUploadedText, parseBulkNotes, baseTitle } from '../lib/bulkNotes.js';

const router = Router();
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const imageTypes = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp']]);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => imageTypes.has(file.mimetype) ? cb(null, true) : cb(new Error('Upload a JPG, PNG or WEBP image.')),
}).single('file');
router.post('/uploads/image', requireAdmin, (req, res, next) => imageUpload(req, res, (err) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : err.message });
  next();
}), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  const ext = imageTypes.get(req.file.mimetype);
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const target = path.join(UPLOAD_DIR, filename);
  try {
    // Check actual file signatures, not only the browser-supplied MIME type.
    const b = req.file.buffer;
    const valid = req.file.mimetype === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8
      : req.file.mimetype === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) return res.status(400).json({ error: 'The file does not match its image type.' });
    await fs.promises.writeFile(target, b, { flag: 'wx' });
    res.status(201).json({ url: `/uploads/${filename}` });
  } catch (e) {
    await fs.promises.rm(target, { force: true }).catch(() => {});
    res.status(500).json({ error: 'Image could not be stored.' });
  }
});

// Courses and learning content can be managed by moderators and admins.
router.get('/courses', requireContentManager, async (_req, res) => {
  res.json((await db.all('SELECT * FROM courses ORDER BY position, id', [])).map((c) => ({ ...c, is_paid: !!c.is_paid, published: !!c.published })));
});

router.post('/courses', requireContentManager, async (req, res) => {
  const { title, description = '', image_url = '', level = 'Beginner', discipline = '', is_paid = false, price_cents = 0, currency = 'usd', published = true } = req.body || {};
  if (!String(title || '').trim()) return res.status(400).json({ error: 'Course title is required.' });
  let slug = slugify(title);
  if ((await db.get('SELECT 1 FROM courses WHERE slug = ?', [slug]))) slug = `${slug}-${Date.now().toString(36)}`;
  const paid = is_paid ? 1 : 0;
  const price = paid ? Math.max(0, parseInt(price_cents, 10) || 0) : 0;
  if (paid && price < 50) return res.status(400).json({ error: 'Paid courses need a price of at least 50 cents.' });
  const pos = (await db.get('SELECT COALESCE(MAX(position),0)+1 p FROM courses', [])).p;
  const id = (await db.run('INSERT INTO courses (slug, title, description, image_url, level, discipline, is_paid, price_cents, currency, published, position) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [slug, title.trim(), description, String(image_url || '').slice(0, 500), level, String(discipline || '').trim().slice(0, 60), paid, price, currency, published ? 1 : 0, pos])).lastInsertRowid;
  res.status(201).json({ id, slug });
});

router.patch('/courses/:id', requireContentManager, async (req, res) => {
  const c = (await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Course not found.' });
  const b = req.body || {};
  const is_paid = b.is_paid !== undefined ? (b.is_paid ? 1 : 0) : c.is_paid;
  const price = b.price_cents !== undefined ? Math.max(0, parseInt(b.price_cents, 10) || 0) : c.price_cents;
  if (is_paid && price < 50) return res.status(400).json({ error: 'Paid courses need a price of at least 50 cents.' });
  (await db.run('UPDATE courses SET title=?, description=?, image_url=?, level=?, discipline=?, is_paid=?, price_cents=?, published=? WHERE id=?', [b.title ?? c.title, b.description ?? c.description, b.image_url !== undefined ? String(b.image_url || '').slice(0, 500) : c.image_url, b.level ?? c.level, b.discipline !== undefined ? String(b.discipline || '').trim().slice(0, 60) : c.discipline, is_paid, is_paid ? price : 0, b.published !== undefined ? (b.published ? 1 : 0) : c.published, c.id]));
  res.json({ ok: true });
});

router.delete('/courses/:id', requireContentManager, async (req, res) => {
  (await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]));
  res.json({ ok: true });
});

// Topics
router.post('/courses/:id/topics', requireContentManager, async (req, res) => {
  const course = (await db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Topic title is required.' });
  const pos = (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM topics WHERE course_id = ?', [course.id])).p;
  const id = (await db.run('INSERT INTO topics (course_id, title, description, position) VALUES (?,?,?,?)', [course.id, title, req.body.description || '', pos])).lastInsertRowid;
  res.status(201).json({ id });
});

router.patch('/topics/:id', requireContentManager, async (req, res) => {
  const t = (await db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const b = req.body || {};
  (await db.run('UPDATE topics SET title=?, description=?, position=? WHERE id=?', [b.title ?? t.title, b.description ?? t.description, b.position ?? t.position, t.id]));
  res.json({ ok: true });
});

router.delete('/topics/:id', requireContentManager, async (req, res) => {
  (await db.run('DELETE FROM topics WHERE id = ?', [req.params.id]));
  res.json({ ok: true });
});

// Subtopics
router.post('/topics/:id/subtopics', requireContentManager, async (req, res) => {
  const t = (await db.get('SELECT id FROM topics WHERE id = ?', [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Subtopic title is required.' });
  const pos = (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM subtopics WHERE topic_id = ?', [t.id])).p;
  const id = (await db.run('INSERT INTO subtopics (topic_id, title, body, position) VALUES (?,?,?,?)', [t.id, title, req.body.body || '', pos])).lastInsertRowid;
  res.status(201).json({ id });
});

router.patch('/subtopics/:id', requireContentManager, async (req, res) => {
  const s = (await db.get('SELECT * FROM subtopics WHERE id = ?', [req.params.id]));
  if (!s) return res.status(404).json({ error: 'Subtopic not found.' });
  const b = req.body || {};
  (await db.run('UPDATE subtopics SET title=?, body=?, position=? WHERE id=?', [b.title ?? s.title, b.body ?? s.body, b.position ?? s.position, s.id]));
  res.json({ ok: true });
});

router.delete('/subtopics/:id', requireContentManager, async (req, res) => {
  (await db.run('DELETE FROM subtopics WHERE id = ?', [req.params.id]));
  res.json({ ok: true });
});

// Quiz authoring: create/replace a topic's quiz. Body: { title, questions:[{prompt, options[], correct, explanation}] }
router.put('/topics/:id/quiz', requireContentManager, async (req, res) => {
  const t = (await db.get('SELECT id FROM topics WHERE id = ?', [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const { title = 'Quiz', questions = [] } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: 'Add at least one question.' });
  for (const [i, q] of questions.entries()) {
    if (!String(q.prompt || '').trim()) return res.status(400).json({ error: `Question ${i + 1} needs a prompt.` });
    if (!Array.isArray(q.options) || q.options.length < 2) return res.status(400).json({ error: `Question ${i + 1} needs at least 2 options.` });
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return res.status(400).json({ error: `Question ${i + 1} needs a valid correct option.` });
  }
  const tx = await db.tx(async () => {
    (await db.run('DELETE FROM quizzes WHERE topic_id = ?', [t.id]));
    const quizId = (await db.run('INSERT INTO quizzes (topic_id, title) VALUES (?,?)', [t.id, title])).lastInsertRowid;
    const ins = stmt('INSERT INTO questions (quiz_id, prompt, options, correct_index, explanation, position) VALUES (?,?,?,?,?,?)');
    for (const [i, q] of questions.entries()) { await ins.run(quizId, q.prompt.trim(), JSON.stringify(q.options.map(String)), q.correct, q.explanation || '', i); };
    return quizId;
  });
  res.json({ quiz_id: tx, question_count: questions.length });
});

// Per-student performance for the admin dashboard.
router.get('/students', requireAdmin, async (_req, res) => {
  res.json(await db.all(`SELECT u.id, u.name, u.email, u.created_at,
    (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollments,
    (SELECT COUNT(*) FROM quiz_attempts q WHERE q.user_id = u.id) AS quizzes_taken,
    (SELECT ROUND(AVG(q.score * 100.0 / NULLIF(q.total, 0)), 1) FROM quiz_attempts q WHERE q.user_id = u.id) AS quiz_avg_percent,
    (SELECT COUNT(*) FROM exam_attempts e WHERE e.user_id = u.id) AS exams_taken,
    (SELECT ROUND(AVG(e.score * 100.0 / NULLIF(e.total, 0)), 1) FROM exam_attempts e WHERE e.user_id = u.id) AS exam_avg_percent,
    (SELECT MAX(last_seen) FROM (
      SELECT a.last_accessed_at AS last_seen FROM activity a WHERE a.user_id = u.id
      UNION ALL SELECT q.created_at FROM quiz_attempts q WHERE q.user_id = u.id
      UNION ALL SELECT e.created_at FROM exam_attempts e WHERE e.user_id = u.id
      UNION ALL SELECT p.completed_at FROM progress p WHERE p.user_id = u.id
    )) AS last_active
    FROM users u WHERE u.role = 'student' ORDER BY u.id DESC`, []));
});

// Delete a student and their learning records. Admin accounts are never removable here.
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const target = await db.get('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted here.' });
  if (target.role !== 'student') return res.status(403).json({ error: 'Only student accounts can be deleted here.' });

  await db.tx(async () => {
    await db.run('DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = ?)', [target.id]);
    await db.run('DELETE FROM exam_attempt_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = ?)', [target.id]);
    await db.run('DELETE FROM quiz_attempts WHERE user_id = ?', [target.id]);
    await db.run('DELETE FROM exam_attempts WHERE user_id = ?', [target.id]);
    await db.run('DELETE FROM enrollments WHERE user_id = ?', [target.id]);
    await db.run('DELETE FROM users WHERE id = ?', [target.id]);
  });
  res.json({ ok: true });
});

// Platform stats for the admin dashboard
router.get('/stats', requireAdmin, async (_req, res) => {
  const one = async (sql) => (await db.get(sql, []));
  res.json({
    students: (await one("SELECT COUNT(*) AS n FROM users WHERE role = 'student'")).n,
    courses: (await one('SELECT COUNT(*) AS n FROM courses')).n,
    topics: (await one('SELECT COUNT(*) AS n FROM topics')).n,
    resources: (await one('SELECT COUNT(*) AS n FROM resources')).n,
    quiz_attempts: (await one('SELECT COUNT(*) AS n FROM quiz_attempts')).n,
    enrollments: (await one('SELECT COUNT(*) AS n FROM enrollments')).n,
    avg_score: (await one('SELECT ROUND(AVG(score),1) AS v FROM quiz_attempts')).v,
    avg_quiz_percent: (await one('SELECT ROUND(AVG(score * 100.0 / NULLIF(total, 0)),1) AS v FROM quiz_attempts')).v,
  });
});

// Admin: all users (students, moderators, and admins) with activity counts
router.get('/users', requireAdmin, async (_req, res) => {
  res.json((await db.all(`SELECT u.id, u.name, u.email, u.role, u.created_at,
    (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollments,
    (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) AS completed_subtopics,
    (SELECT ROUND(AVG(score * 1.0 / total) * 100, 1) FROM quiz_attempts q WHERE q.user_id = u.id) AS quiz_avg_percent
    FROM users u ORDER BY u.id DESC LIMIT 500`, [])));
});

router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  const role = String(req.body?.role || '');
  if (!['student', 'moderator', 'tutor', 'admin'].includes(role)) return res.status(400).json({ error: 'Choose student, moderator, tutor, or admin.' });
  if (Number(req.params.id) === req.user.id && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  const target = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  await db.run('UPDATE users SET role = ? WHERE id = ?', [role, target.id]);
  res.json({ ok: true, role });
});

// Admin: per-course enrollment and average quiz score (platform analytics)
router.get('/analytics', requireAdmin, async (_req, res) => {
  const courses = (await db.all(`SELECT c.id, c.title, c.published,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollments,
      (SELECT ROUND(AVG(qa.score * 1.0 / qa.total) * 100, 1) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN topics t ON t.id = q.topic_id WHERE t.course_id = c.id) AS quiz_avg_percent,
      (SELECT COUNT(*) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN topics t ON t.id = q.topic_id WHERE t.course_id = c.id) AS attempts
    FROM courses c ORDER BY c.position, c.id`, [])).map((c) => ({ ...c, published: !!c.published }));
  const topics = (await db.all(`SELECT t.id, t.title, c.title AS course_title,
      (SELECT ROUND(AVG(qa.score * 1.0 / qa.total) * 100, 1) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE q.topic_id = t.id) AS quiz_avg_percent,
      (SELECT COUNT(*) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE q.topic_id = t.id) AS attempts
    FROM topics t JOIN courses c ON c.id = t.course_id WHERE EXISTS (SELECT 1 FROM quizzes q WHERE q.topic_id = t.id) ORDER BY quiz_avg_percent ASC`, []));
  const casesCount = (await db.get('SELECT COUNT(*) n FROM case_studies', [])).n;
  const communitiesCount = (await db.get('SELECT COUNT(*) n FROM communities', [])).n;
  const threadsCount = (await db.get('SELECT COUNT(*) n FROM threads', [])).n;
  res.json({ courses, topics, totals: { cases: casesCount, communities: communitiesCount, threads: threadsCount } });
});

// Upload and immediately create course topics/subtopics from a .txt / .md / .pdf note file.
// Headings are parsed server-side and all rows are written atomically.
router.post('/notes/upload', requireContentManager, bulkUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a .txt, .md or .pdf file.' });
  const course = await db.get('SELECT id, title FROM courses WHERE id = ?', [req.body.course_id]);
  if (!course) return res.status(400).json({ error: 'Choose a course first.' });
  let parsed;
  try {
    const { text } = await readUploadedText(req.file);
    parsed = parseBulkNotes(text, baseTitle(req.file.originalname));
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Could not read this file.' });
  }
  const created = { topics: 0, subtopics: 0, words: 0 };
  try {
    await db.tx(async () => {
      let topicPos = (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM topics WHERE course_id = ?', [course.id])).p;
      for (const t of parsed.topics) {
        const tid = (await db.run('INSERT INTO topics (course_id, title, description, position) VALUES (?,?,?,?)', [course.id, bulkMaxLen(t.title, 200) || 'Notes', '', topicPos++])).lastInsertRowid;
        created.topics++;
        let subPos = 0;
        for (const s of t.subtopics) {
          await db.run('INSERT INTO subtopics (topic_id, title, body, position) VALUES (?,?,?,?)', [tid, bulkMaxLen(s.title, 200) || t.title, s.body, subPos++]);
          created.subtopics++;
          created.words += s.words;
        }
      }
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Import failed. Nothing was saved.' });
  }
  res.status(201).json({ ok: true, course_id: course.id, course_title: course.title, file_name: req.file.originalname, ...created, warnings: parsed.warnings });
});


// Preview: parse an uploaded .txt/.md/.pdf and return the detected structure. Writes nothing.
// Import: create topics and subtopics from the (optionally edited) structure in one transaction.
const bulkMaxLen = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

router.post('/bulk-notes/preview', requireContentManager, bulkUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a .txt, .md or .pdf file.' });
  try {
    const { text, format } = await readUploadedText(req.file);
    const parsed = parseBulkNotes(text, baseTitle(req.file.originalname));
    res.json({ format, file_name: req.file.originalname, ...parsed });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Could not read this file.' });
  }
});

// Body: multipart with file + course_id + optional topic_id + structure (JSON string of the preview topics, with edited titles).
// Without topic_id, each parsed topic becomes a new topic. With topic_id, the parsed topics are appended into that existing topic
// as subtopics (the topic's own title is not changed).
router.post('/bulk-notes/import', requireContentManager, bulkUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a .txt, .md or .pdf file.' });
  const course = (await db.get('SELECT id, title FROM courses WHERE id = ?', [req.body.course_id]));
  if (!course) return res.status(400).json({ error: 'Choose a course first.' });
  let topicTarget = null;
  if (req.body.topic_id) {
    topicTarget = (await db.get('SELECT id, title FROM topics WHERE id = ? AND course_id = ?', [req.body.topic_id, course.id]));
    if (!topicTarget) return res.status(400).json({ error: 'That topic is not in this course.' });
  }
  let edited;
  try {
    edited = JSON.parse(req.body.structure || 'null');
  } catch {
    return res.status(400).json({ error: 'The preview structure could not be read. Preview the file again.' });
  }
  if (!Array.isArray(edited) || edited.length === 0) return res.status(400).json({ error: 'Preview the file before importing.' });

  // Re-parse the upload on the server so body text is never trusted from the client.
  // The client's edited structure only supplies titles and must match the parsed shape.
  let parsed;
  try {
    const { text } = await readUploadedText(req.file);
    parsed = parseBulkNotes(text, baseTitle(req.file.originalname));
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Could not read this file.' });
  }
  if (edited.length !== parsed.topics.length) return res.status(400).json({ error: 'The file structure changed. Preview it again.' });
  for (const [i, t] of parsed.topics.entries()) {
    if (edited[i]?.subtopics?.length !== t.subtopics.length) return res.status(400).json({ error: 'The file structure changed. Preview it again.' });
  }

  const created = { topics: 0, subtopics: 0, words: 0 };
  try {
    await db.tx(async () => {
      let topicPos = (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM topics WHERE course_id = ?', [course.id])).p;
      for (const [i, t] of parsed.topics.entries()) {
        const et = edited[i];
        let tid;
        if (topicTarget) {
          tid = topicTarget.id;
        } else {
          const title = bulkMaxLen(et.title, 200) || bulkMaxLen(t.title, 200);
          if (!title) throw new Error('Every topic needs a name.');
          tid = (await db.run('INSERT INTO topics (course_id, title, description, position) VALUES (?,?,?,?)', [course.id, title, '', topicPos++])).lastInsertRowid;
          created.topics++;
        }
        let subPos = (await db.get('SELECT COALESCE(MAX(position),-1)+1 p FROM subtopics WHERE topic_id = ?', [tid])).p;
        for (const [j, s] of t.subtopics.entries()) {
          const es = et.subtopics[j];
          const title = bulkMaxLen(es?.title, 200) || bulkMaxLen(s.title, 200);
          if (!title) throw new Error('Every subtopic needs a name.');
          (await db.run('INSERT INTO subtopics (topic_id, title, body, position) VALUES (?,?,?,?)', [tid, title, s.body, subPos++]));
          created.subtopics++;
          created.words += s.words;
        }
      }
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Import failed. Nothing was saved.' });
  }
  res.status(201).json({ ok: true, course_id: course.id, course_title: course.title, topic_id: topicTarget?.id || null, ...created, warnings: parsed.warnings });
});

export default router;
