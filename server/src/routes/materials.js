import { Router } from 'express';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireAdmin, requireAdminOrTutor, requireModerator, requireContentManager, optionalAuth } from '../lib/auth.js';
import { uploadFile, removeStored, sendStored } from '../lib/storage.js';
import { courseAccess } from './courses.js';
import { parseExamQuestions, normalizeExamQuestions } from '../lib/examQuestions.js';
import { bulkUpload, readUploadedText, baseTitle } from '../lib/bulkNotes.js';

// Course documents (admin uploads per course/topic) and exams (locked until admin unlocks or a release time passes).
const router = Router();
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

// Files go to Cloudinary when CLOUDINARY_URL is set, otherwise to local disk (see lib/storage.js).
const runUpload = uploadFile({ maxBytes: MAX_BYTES, allowed: ALLOWED, errorMessage: 'Unsupported file type. Upload PDF, DOCX, TXT, MD, PNG or JPG.' });
const removeFile = (name) => removeStored(name);
const clean = (s, max = 200) => String(s ?? '').trim().slice(0, max);

// An exam is open when it is unlocked, or when its scheduled unlock time has passed.
export function examOpen(exam) {
  if (!exam.locked) return true;
  return !!exam.unlock_at && new Date(exam.unlock_at).getTime() <= Date.now();
}

// Open for one student: the exam is open for everyone, or this student entered the unlock password.
export async function examOpenFor(exam, userId) {
  if (examOpen(exam)) return true;
  if (!exam.locked || !userId) return false;
  return !!(await db.get('SELECT 1 AS x FROM exam_unlocks WHERE exam_id = ? AND user_id = ?', [exam.id, userId]));
}

// Public-safe exam shape (no file paths, never the password hash).
export function examView(e, open = examOpen(e)) {
  return {
    id: e.id, course_id: e.course_id, title: e.title, locked: !!e.locked, unlock_at: e.unlock_at || null,
    closes_at: e.closes_at || null, closed: examClosed(e),
    open: open && !examClosed(e), has_file: !!e.file_path, original_name: e.original_name || null, size: e.size || 0,
    has_password: !!e.unlock_password_hash, question_count: Number(e.question_count) || 0,
  };
}

// An exam with a scheduled end time is closed once that moment passes.
export function examClosed(exam) {
  return !!exam.closes_at && new Date(exam.closes_at).getTime() <= Date.now();
}

// Admin sets or clears the unlock password. Empty string clears it. Stored as a bcrypt hash (same as logins).
function passwordHash(raw) {
  const pw = String(raw ?? '').trim();
  if (!pw) return { clear: true };
  if (pw.length < 4) return { error: 'Unlock password must be at least 4 characters.' };
  if (pw.length > 72) return { error: 'Unlock password must be 72 characters or fewer.' };
  return { hash: bcrypt.hashSync(pw, 10) };
}

// Wrong-password attempts per student and exam: 10 misses in 15 minutes locks further tries for that window.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function attemptsLeft(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.start > WINDOW_MS) return 10;
  return Math.max(0, 10 - f.count);
}
function recordFailure(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.start > WINDOW_MS) failures.set(key, { start: Date.now(), count: 1 });
  else f.count += 1;
}

export async function documentsForCourse(courseId) {
  return (await db.all(`SELECT d.id, d.title, d.topic_id, t.title AS topic_title, d.original_name, d.size, d.created_at
    FROM course_documents d LEFT JOIN topics t ON t.id = d.topic_id WHERE d.course_id = ? ORDER BY d.id`, [courseId]));
}

export async function examsForCourse(courseId, userId) {
  const rows = await db.all(`SELECT e.*, (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count
    FROM exams e WHERE e.course_id = ? ORDER BY e.id`, [courseId]);
  return Promise.all(rows.map(async (e) => examView(e, await examOpenFor(e, userId))));
}

// ---------- admin ----------

// Upload a document to a course (optionally tied to one of its topics)
router.post('/admin/courses/:id/documents', requireContentManager, runUpload, async (req, res) => {
  const course = (await db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]));
  if (!course) { if (req.file) removeFile(req.file.filename); return res.status(404).json({ error: 'Course not found.' }); }
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
  let topicId = null;
  if (req.body.topic_id) {
    const t = (await db.get('SELECT id FROM topics WHERE id = ? AND course_id = ?', [req.body.topic_id, course.id]));
    if (!t) { removeFile(req.file.filename); return res.status(400).json({ error: 'That topic is not in this course.' }); }
    topicId = t.id;
  }
  const title = clean(req.body.title) || path.parse(req.file.originalname).name;
  const info = (await db.run(`INSERT INTO course_documents (course_id, topic_id, title, file_path, original_name, mime, size, uploaded_by)
    VALUES (?,?,?,?,?,?,?,?)`, [course.id, topicId, title, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.user.id]));
  res.status(201).json({ id: info.lastInsertRowid, title, original_name: req.file.originalname, size: req.file.size });
});

router.delete('/admin/documents/:id', requireContentManager, async (req, res) => {
  const d = (await db.get('SELECT * FROM course_documents WHERE id = ?', [req.params.id]));
  if (!d) return res.status(404).json({ error: 'Document not found.' });
  (await db.run('DELETE FROM course_documents WHERE id = ?', [d.id]));
  removeFile(d.file_path);
  res.json({ ok: true });
});

// Create an exam for a course: a PDF, a text question set, or both. Locked by default.
router.post('/admin/courses/:id/exams', requireAdminOrTutor, runUpload, async (req, res) => {
  const course = (await db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]));
  if (!course) { if (req.file) removeFile(req.file.filename); return res.status(404).json({ error: 'Course not found.' }); }
  const title = clean(req.body.title);
  const body = String(req.body.body ?? '').trim();
  if (!title) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'Exam title is required.' }); }
  if (body.length > 20000) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'Question set is too long (20000 characters max).' }); }
  let questions = null;
  if (req.body.questions !== undefined && String(req.body.questions).trim() !== '') {
    let raw;
    try { raw = JSON.parse(req.body.questions); } catch { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'The question list could not be read. Preview the file again.' }); }
    const n = normalizeExamQuestions(raw);
    if (n.error) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: n.error }); }
    questions = n.questions;
  } else if (req.file) {
    // Uploaded file with no confirmed question list: auto-convert its text into questions.
    try {
      const text = await readUploadedText(req.file);
      const n = normalizeExamQuestions(parseExamQuestions(text).questions);
      if (!n.error && n.questions.length) questions = n.questions;
    } catch (_) { /* not a parseable question file: keep as attachment */ }
  }
  if (!req.file && !body && !questions) return res.status(400).json({ error: 'Add a PDF, type the questions, or upload a question file.' });
  const locked = req.body.locked === undefined || req.body.locked === '' ? 1 : (['false', '0', 'off', false, 0].includes(req.body.locked) ? 0 : 1);
  let unlockAt = null;
  if (locked && req.body.unlock_at) {
    const t = Date.parse(req.body.unlock_at);
    if (Number.isNaN(t)) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'Release time is not a valid date.' }); }
    unlockAt = new Date(t).toISOString();
  }
  let closesAt = null;
  if (req.body.closes_at) {
    const t = Date.parse(req.body.closes_at);
    if (Number.isNaN(t)) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'End time is not a valid date.' }); }
    closesAt = new Date(t).toISOString();
    if (unlockAt && new Date(closesAt) <= new Date(unlockAt)) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: 'End time must be after the release time.' }); }
  }
  const pw = passwordHash(req.body.unlock_password);
  if (pw.error) { if (req.file) removeFile(req.file.filename); return res.status(400).json({ error: pw.error }); }
  const examId = await db.tx(async () => {
    const info = (await db.run(`INSERT INTO exams (course_id, title, body, file_path, original_name, mime, size, locked, unlock_at, unlock_password_hash, closes_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [course.id, title, body, req.file?.filename || null, req.file?.originalname || null, req.file?.mimetype || null, req.file?.size || 0, locked, unlockAt, pw.hash || null, closesAt]));
    if (questions) await insertExamQuestions(info.lastInsertRowid, questions);
    return info.lastInsertRowid;
  });
  res.status(201).json(examView({ ...(await db.get('SELECT * FROM exams WHERE id = ?', [examId])), question_count: questions ? questions.length : 0 }));
});

// Question file preview: parse an uploaded .txt / .md / .pdf into MCQ questions. Writes nothing.
// The admin reviews the result, then the confirmed list goes into POST /admin/courses/:id/exams as `questions`.
router.post('/admin/exam-questions/preview', requireAdminOrTutor, bulkUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a .txt, .md or .pdf file.' });
  try {
    const { text, format } = await readUploadedText(req.file);
    const parsed = parseExamQuestions(text);
    res.json({ format, file_name: req.file.originalname, title_suggestion: baseTitle(req.file.originalname), ...parsed });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Could not read this file.' });
  }
});

// Admin exam list (all courses) with lock state
router.get('/admin/exams', requireAdminOrTutor, async (_req, res) => {
  const rows = (await db.all(`SELECT e.*, c.title AS course_title, (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count
    FROM exams e JOIN courses c ON c.id = e.course_id ORDER BY e.id DESC`, []));
  res.json(rows.map((e) => ({ ...examView(e), course_title: e.course_title })));
});

// Lock / unlock toggle, release time, and title/question edits.
// locked:false opens now. locked:true locks now (clears any release time). unlock_at with locked:true opens automatically at that time.
router.patch('/admin/exams/:id', requireAdminOrTutor, async (req, res) => {
  const e = (await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  const b = req.body || {};
  const locked = b.locked !== undefined ? (b.locked ? 1 : 0) : e.locked;
  let unlockAt = e.unlock_at;
  if (b.locked !== undefined) unlockAt = null;
  if (b.unlock_at !== undefined) {
    if (!b.unlock_at) unlockAt = null;
    else {
      const t = Date.parse(b.unlock_at);
      if (Number.isNaN(t)) return res.status(400).json({ error: 'Release time is not a valid date.' });
      unlockAt = new Date(t).toISOString();
    }
  }
  if (!locked) unlockAt = null;
  const title = b.title !== undefined ? clean(b.title) : e.title;
  if (!title) return res.status(400).json({ error: 'Exam title is required.' });
  const body = b.body !== undefined ? String(b.body).trim() : e.body;
  if (body.length > 20000) return res.status(400).json({ error: 'Question set is too long (20000 characters max).' });
  let passwordHashValue = e.unlock_password_hash;
  if (b.unlock_password !== undefined) {
    const pw = passwordHash(b.unlock_password);
    if (pw.error) return res.status(400).json({ error: pw.error });
    passwordHashValue = pw.clear ? null : pw.hash;
  }
  let newQuestions = null;
  if (b.questions !== undefined) {
    const n = b.questions === null ? { questions: [] } : normalizeExamQuestions(b.questions);
    if (n.error) return res.status(400).json({ error: n.error });
    newQuestions = n.questions;
  }
  await db.tx(async () => {
    let closesAt = e.closes_at || null;
    if (req.body.closes_at !== undefined) {
      if (!req.body.closes_at) closesAt = null;
      else {
        const t = Date.parse(req.body.closes_at);
        if (Number.isNaN(t)) return res.status(400).json({ error: 'End time is not a valid date.' });
        closesAt = new Date(t).toISOString();
        if (unlockAt && new Date(closesAt) <= new Date(unlockAt)) return res.status(400).json({ error: 'End time must be after the release time.' });
      }
    }
    (await db.run('UPDATE exams SET title=?, body=?, locked=?, unlock_at=?, unlock_password_hash=?, closes_at=? WHERE id=?', [title, body, locked, unlockAt, passwordHashValue, closesAt, e.id]));
    if (newQuestions) {
      (await db.run('DELETE FROM exam_questions WHERE exam_id = ?', [e.id]));
      await insertExamQuestions(e.id, newQuestions);
    }
    // Locking again starts a new lock: students who entered the old password must enter it again.
    // An explicit lock (body is just {locked:true}) re-locks for everyone. Saving a release time sends unlock_at too and keeps them.
    if (b.locked === true && b.unlock_at === undefined) (await db.run('DELETE FROM exam_unlocks WHERE exam_id = ?', [e.id]));
    // Changing or clearing the password: students who got in with the old one must enter the new one.
    if (b.unlock_password !== undefined) (await db.run('DELETE FROM exam_unlocks WHERE exam_id = ?', [e.id]));
  });
  res.json(examView((await db.get('SELECT * FROM exams WHERE id = ?', [e.id]))));
});

router.delete('/admin/exams/:id', requireAdminOrTutor, async (req, res) => {
  const e = (await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  (await db.run('DELETE FROM exams WHERE id = ?', [e.id]));
  removeFile(e.file_path);
  res.json({ ok: true });
});

// ---------- students / public ----------

// Course materials list: documents and exams (titles and lock state only; exam text and files need access)
router.get('/courses/:id/materials', optionalAuth, async (req, res) => {
  const course = (await db.get('SELECT * FROM courses WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!course || (!course.published && req.user?.role !== 'admin')) return res.status(404).json({ error: 'Course not found.' });
  const access = req.user ? await courseAccess(req.user.id, req.user.role, course.id) : false;
  res.json({
    has_access: access,
    documents: (await documentsForCourse(course.id)).map((d) => ({ ...d, topic_title: d.topic_title || null })),
    exams: await examsForCourse(course.id, req.user?.id),
  });
});

// Exam detail: admins always see it; students see it only once it is open
router.get('/exams/:id', requireAuth, async (req, res) => {
  const e = (await db.get('SELECT e.*, (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count FROM exams e WHERE e.id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  if (!await courseAccess(req.user.id, req.user.role, e.course_id)) return res.status(403).json({ error: 'Enroll in this course to see its exams.' });
  const open = await examOpenFor(e, req.user.id);
  const view = examView(e, open);
  const canSee = req.user.role === 'admin' || view.open;
  const questions = canSee && view.question_count > 0 && (req.user.role === 'admin' || !view.closed) ? await examQuestions(e.id, req.user.role === 'admin') : null;
  const message = view.closed ? 'This exam has closed.' : (view.open ? null : lockedMessage(e));
  res.json({ ...view, body: canSee ? e.body : null, questions, locked_message: message });
});

// Student submits in-app answers: { answers: { [questionId]: optionIndex } }. Scores the marked questions and saves the attempt.
// Questions with no marked answer are saved as unmarked and not scored.
router.post('/exams/:id/submit', requireAuth, async (req, res) => {
  const e = (await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  if (!await courseAccess(req.user.id, req.user.role, e.course_id)) return res.status(403).json({ error: 'Enroll in this course to take the exam.' });
  if (req.user.role !== 'admin' && !await examOpenFor(e, req.user.id)) return res.status(423).json({ error: lockedMessage(e), locked: true });
  if (req.user.role !== 'admin' && examClosed(e)) return res.status(423).json({ error: 'This exam has closed.', closed: true });
  // One attempt per student per exam. Admins keep retakes for testing.
  if (req.user.role !== 'admin') {
    const prior = await db.get('SELECT 1 AS x FROM exam_attempts WHERE exam_id = ? AND user_id = ?', [e.id, req.user.id]);
    if (prior) return res.status(409).json({ error: 'You have already taken this exam. Only one attempt is allowed.', already_taken: true });
  }
  const questions = await examQuestions(e.id, true);
  if (questions.length === 0) return res.status(400).json({ error: 'This exam has no in-app questions.' });
  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};

  let score = 0;
  let marked = 0;
  let unmarked = 0;
  const details = questions.map((q) => {
    const raw = answers[q.id];
    const n = raw === undefined || raw === null || raw === '' ? null : Number(raw);
    const selected = Number.isInteger(n) && n >= 0 && n < q.options.length ? n : null;
    const hasKey = q.correct_index !== null;
    const isCorrect = hasKey && selected !== null ? selected === q.correct_index : (hasKey ? false : null);
    if (hasKey) { marked++; if (isCorrect) score++; } else unmarked++;
    return { question_id: q.id, position: q.position, prompt: q.prompt, options: q.options, selected_index: selected, correct_index: q.correct_index, is_correct: isCorrect };
  });

  const attemptId = await db.tx(async () => {
    const id = (await db.run('INSERT INTO exam_attempts (exam_id, user_id, score, total, unmarked) VALUES (?,?,?,?,?)', [e.id, req.user.id, score, marked, unmarked])).lastInsertRowid;
    for (const d of details) {
      (await db.run('INSERT INTO exam_attempt_answers (attempt_id, question_id, selected_index, is_correct) VALUES (?,?,?,?)',
        [id, d.question_id, d.selected_index, d.is_correct === null ? null : (d.is_correct ? 1 : 0)]));
    }
    return id;
  });
  res.status(201).json({
    attempt_id: attemptId, score, total: marked, unmarked,
    percent: marked ? Math.round((score / marked) * 100) : null, details,
  });
});

// The student's own attempts for one exam, newest first.
router.get('/exams/:id/attempts', requireAuth, async (req, res) => {
  const rows = (await db.all('SELECT id, score, total, unmarked, created_at FROM exam_attempts WHERE user_id = ? AND exam_id = ? ORDER BY id DESC LIMIT 50', [req.user.id, req.params.id]));
  res.json(rows.map((r) => ({ ...r, percent: r.total ? Math.round((r.score / r.total) * 100) : null })));
});

// Student enters the exam's unlock password. Right password opens the exam for this student only.
router.post('/exams/:id/unlock', requireAuth, async (req, res) => {
  const e = (await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  if (!await courseAccess(req.user.id, req.user.role, e.course_id)) return res.status(403).json({ error: 'Enroll in this course to unlock its exams.' });
  if (await examOpenFor(e, req.user.id)) return res.json({ ok: true, ...examView(e, true) });
  if (!e.unlock_password_hash) return res.status(400).json({ error: lockedMessage(e) });
  const key = `${req.user.id}:${e.id}`;
  if (attemptsLeft(key) === 0) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes or ask your tutor.' });
  const password = String(req.body?.password ?? '');
  if (!password) return res.status(400).json({ error: 'Enter the unlock password.' });
  if (!bcrypt.compareSync(password, e.unlock_password_hash)) {
    recordFailure(key);
    const left = attemptsLeft(key);
    return res.status(403).json({ error: left > 0 ? `Wrong unlock password. ${left} tries left before a 15 minute pause.` : 'Wrong unlock password. Too many tries, wait 15 minutes.' });
  }
  failures.delete(key);
  (await db.run('INSERT OR IGNORE INTO exam_unlocks (exam_id, user_id) VALUES (?, ?)', [e.id, req.user.id]));
  res.json({ ok: true, ...examView(e, true) });
});

// Questions for one exam. Students never get correct_index; admins do.
async function examQuestions(examId, withAnswers) {
  const rows = await db.all('SELECT id, prompt, options, correct_index, position FROM exam_questions WHERE exam_id = ? ORDER BY position, id', [examId]);
  return rows.map((q) => {
    const base = { id: q.id, position: q.position, prompt: q.prompt, options: JSON.parse(q.options) };
    return withAnswers ? { ...base, correct_index: q.correct_index ?? null } : base;
  });
}

// Inserts a confirmed question list for an exam (runs inside the caller's transaction).
async function insertExamQuestions(examId, questions) {
  for (const q of questions) {
    (await db.run('INSERT INTO exam_questions (exam_id, prompt, options, correct_index, position) VALUES (?,?,?,?,?)',
      [examId, q.prompt, JSON.stringify(q.options), q.correct_index, q.position]));
  }
}

function lockedMessage(e) {
  if (e.unlock_password_hash) return 'This exam is locked. Enter the unlock password your tutor gave you to open it.';
  if (e.unlock_at) return `This exam is locked. It opens on ${new Date(e.unlock_at).toUTCString()} or when the admin unlocks it.`;
  return 'This exam is locked. It will open when the admin unlocks it.';
}

router.get('/exams/:id/download', requireAuth, async (req, res) => {
  const e = (await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]));
  if (!e) return res.status(404).json({ error: 'Exam not found.' });
  if (!await courseAccess(req.user.id, req.user.role, e.course_id)) return res.status(403).json({ error: 'Enroll in this course to download exams.' });
  if (req.user.role !== 'admin' && !await examOpenFor(e, req.user.id)) return res.status(423).json({ error: lockedMessage(e), locked: true });
  if (req.user.role !== 'admin' && examClosed(e)) return res.status(423).json({ error: 'This exam has closed.', closed: true });
  // One attempt per student per exam. Admins keep retakes for testing.
  if (req.user.role !== 'admin') {
    const prior = await db.get('SELECT 1 AS x FROM exam_attempts WHERE exam_id = ? AND user_id = ?', [e.id, req.user.id]);
    if (prior) return res.status(409).json({ error: 'You have already taken this exam. Only one attempt is allowed.', already_taken: true });
  }
  if (!e.file_path) return res.status(404).json({ error: 'This exam has no PDF attached.' });
  return sendStored(res, e.file_path, e.original_name, e.mime);
});

router.get('/documents/:id/download', requireAuth, async (req, res) => {
  const d = (await db.get('SELECT * FROM course_documents WHERE id = ?', [req.params.id]));
  if (!d) return res.status(404).json({ error: 'Document not found.' });
  if (!await courseAccess(req.user.id, req.user.role, d.course_id)) return res.status(403).json({ error: 'Enroll in this course to download its documents.' });
  return sendStored(res, d.file_path, d.original_name, d.mime);
});

export default router;
