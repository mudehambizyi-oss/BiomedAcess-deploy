import { Router } from 'express';
import db, { stmt } from '../db.js';
import { requireAuth, requireAdmin, optionalAuth } from '../lib/auth.js';
import { courseAccess, topicCourse } from './courses.js';

const router = Router();

// ---------- quizzes ----------
// Student view: questions WITHOUT correct answers
router.get('/topics/:id/quiz', requireAuth, async (req, res) => {
  const topic = await topicCourse(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found.' });
  if (!await courseAccess(req.user.id, req.user.role, topic.course_id)) return res.status(403).json({ error: 'Enroll in this course to take the quiz.' });
  const quiz = (await db.get('SELECT id, title FROM quizzes WHERE topic_id = ?', [topic.id]));
  if (!quiz) return res.status(404).json({ error: 'No quiz for this topic yet.' });
  const questions = (await db.all('SELECT id, prompt, options FROM questions WHERE quiz_id = ? ORDER BY position, id', [quiz.id]))
    .map((q) => ({ id: q.id, prompt: q.prompt, options: JSON.parse(q.options) }));
  res.json({ id: quiz.id, title: quiz.title, topic: { id: topic.id, title: topic.title }, questions });
});

// Submit answers: body { answers: { [questionId]: optionIndex } }
router.post('/quizzes/:id/attempt', requireAuth, async (req, res) => {
  const quiz = (await db.get('SELECT q.*, t.course_id, t.id AS topic_id FROM quizzes q JOIN topics t ON t.id = q.topic_id WHERE q.id = ?', [req.params.id]));
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (!await courseAccess(req.user.id, req.user.role, quiz.course_id)) return res.status(403).json({ error: 'Enroll in this course to take the quiz.' });
  // One attempt per student per quiz. Admins keep unlimited attempts for testing.
  if (req.user.role !== 'admin') {
    const prior = await db.get('SELECT 1 AS x FROM quiz_attempts WHERE user_id = ? AND quiz_id = ?', [req.user.id, quiz.id]);
    if (prior) return res.status(409).json({ error: 'You have already taken this quiz. Only one attempt is allowed.', already_taken: true });
  }
  const answers = req.body?.answers || {};
  const questions = (await db.all('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position, id', [quiz.id]));
  if (questions.length === 0) return res.status(400).json({ error: 'This quiz has no questions.' });

  let score = 0;
  const details = questions.map((q) => {
    const raw = answers[q.id];
    const selected = raw === undefined || raw === null || raw === '' ? null : Number(raw);
    const options = JSON.parse(q.options);
    const isCorrect = selected === q.correct_index;
    if (isCorrect) score++;
    return { question_id: q.id, prompt: q.prompt, options, selected_index: selected, correct_index: q.correct_index, is_correct: isCorrect, explanation: q.explanation };
  });

  const tx = await db.tx(async () => {
    const attemptId = (await db.run('INSERT INTO quiz_attempts (user_id, quiz_id, score, total) VALUES (?,?,?,?)', [req.user.id, quiz.id, score, questions.length])).lastInsertRowid;
    const ins = stmt('INSERT INTO attempt_answers (attempt_id, question_id, topic_id, selected_index, is_correct) VALUES (?,?,?,?,?)');
    for (const d of details) (await ins.run(attemptId, d.question_id, quiz.topic_id, d.selected_index, d.is_correct ? 1 : 0));
    (await db.run(`INSERT INTO activity (user_id, topic_id, last_accessed_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id, topic_id) DO UPDATE SET last_accessed_at = datetime('now')`, [req.user.id, quiz.topic_id]));
    return attemptId;
  });
  const attemptId = tx;
  res.status(201).json({ attempt_id: attemptId, score, total: questions.length, percent: Math.round((score / questions.length) * 100), details });
});

// Score history for one quiz
router.get('/quizzes/:id/history', requireAuth, async (req, res) => {
  const rows = (await db.all('SELECT id, score, total, created_at FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY id DESC LIMIT 50', [req.user.id, req.params.id]));
  res.json(rows.map((r) => ({ ...r, percent: Math.round((r.score / r.total) * 100) })));
});

// Analytics: per-topic accuracy and weak areas across the user's history
router.get('/analytics/quizzes', requireAuth, async (req, res) => {
  const perTopic = (await db.all(`
    SELECT t.id AS topic_id, t.title AS topic_title, c.id AS course_id, c.title AS course_title,
      COUNT(aa.id) AS attempted, SUM(aa.is_correct) AS correct
    FROM attempt_answers aa
    JOIN quiz_attempts qa ON qa.id = aa.attempt_id
    JOIN topics t ON t.id = aa.topic_id
    JOIN courses c ON c.id = t.course_id
    WHERE qa.user_id = ?
    GROUP BY t.id ORDER BY c.position, t.position
  `, [req.user.id])).map((r) => ({
    ...r, correct: r.correct || 0, accuracy: r.attempted ? Math.round(((r.correct || 0) / r.attempted) * 100) : 0,
  }));
  const attempts = (await db.all(`SELECT qa.id, qa.score, qa.total, qa.created_at, q.title AS quiz_title, t.title AS topic_title
    FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id JOIN topics t ON t.id = q.topic_id
    WHERE qa.user_id = ? ORDER BY qa.id DESC LIMIT 50`, [req.user.id])).map((r) => ({ ...r, percent: Math.round((r.score / r.total) * 100) }));
  const overall = perTopic.reduce((acc, r) => ({ attempted: acc.attempted + r.attempted, correct: acc.correct + r.correct }), { attempted: 0, correct: 0 });
  res.json({
    overall: { ...overall, accuracy: overall.attempted ? Math.round((overall.correct / overall.attempted) * 100) : null },
    per_topic: perTopic,
    weak_areas: perTopic.filter((t) => t.attempted >= 2 && t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy),
    recent_attempts: attempts,
  });
});

// ---------- dashboard ----------
router.get('/dashboard', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const enrolled = (await db.all(`SELECT c.id, c.slug, c.title, c.level, c.is_paid, c.discipline FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND c.published = 1 ORDER BY e.created_at`, [uid]));
  const progressFor = async (courseId) => {
    const total = (await db.get('SELECT COUNT(*) n FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ?', [courseId])).n;
    const done = (await db.get('SELECT COUNT(*) n FROM progress p JOIN subtopics s ON s.id = p.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ? AND p.user_id = ?', [courseId, uid])).n;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  };
  const enrolledWithProgress = [];
  for (const c of enrolled) enrolledWithProgress.push({ ...c, is_paid: !!c.is_paid, progress: await progressFor(c.id) });
  const totals = enrolledWithProgress.reduce((a, c) => ({ total: a.total + c.progress.total, done: a.done + c.progress.done }), { total: 0, done: 0 });

  const recent = (await db.all(`SELECT t.id, t.title, c.id AS course_id, c.title AS course_title, a.last_accessed_at
    FROM activity a JOIN topics t ON t.id = a.topic_id JOIN courses c ON c.id = t.course_id
    WHERE a.user_id = ? AND c.published = 1 ORDER BY a.last_accessed_at DESC LIMIT 5`, [uid]));

  const recommended = (await db.all(`SELECT c.id, c.slug, c.title, c.description, c.level, c.is_paid, c.price_cents, c.currency FROM courses c
    WHERE c.published = 1 AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = ?) ORDER BY c.position LIMIT 3`, [uid]))
    .map((c) => ({ ...c, is_paid: !!c.is_paid }));

  const acc = (await db.all(`SELECT t.id AS topic_id, t.title AS topic_title, c.title AS course_title, COUNT(aa.id) attempted, SUM(aa.is_correct) correct
    FROM attempt_answers aa JOIN quiz_attempts qa ON qa.id = aa.attempt_id JOIN topics t ON t.id = aa.topic_id JOIN courses c ON c.id = t.course_id
    WHERE qa.user_id = ? GROUP BY t.id`, [uid])).map((r) => ({ ...r, correct: r.correct || 0, accuracy: Math.round(((r.correct || 0) / r.attempted) * 100) }));
  const weak = acc.filter((r) => r.attempted >= 2 && r.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  const quizzesTaken = (await db.get('SELECT COUNT(*) n FROM quiz_attempts WHERE user_id = ?', [uid])).n;
  res.json({
    user: { id: uid, name: req.user.name },
    summary: {
      enrolled_courses: enrolledWithProgress.length,
      subtopics_completed: totals.done,
      subtopics_total: totals.total,
      overall_percent: totals.total ? Math.round((totals.done / totals.total) * 100) : 0,
      quizzes_taken: quizzesTaken,
    },
    courses: enrolledWithProgress,
    recent_topics: recent,
    recommended_courses: recommended,
    weak_areas: weak,
  });
});

// ---------- profile ----------
router.get('/profile', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const profile = (await db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [uid]));
  const courses = await Promise.all((await db.all(`SELECT c.id, c.slug, c.title, c.level, e.created_at AS enrolled_at FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY e.created_at`, [uid])).map(async (c) => {
    const total = (await db.get('SELECT COUNT(*) n FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ?', [c.id])).n;
    const done = (await db.get('SELECT COUNT(*) n FROM progress p JOIN subtopics s ON s.id = p.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ? AND p.user_id = ?', [c.id, uid])).n;
    return { ...c, progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 } };
  }));
  const subDone = (await db.get('SELECT COUNT(*) n FROM progress WHERE user_id = ?', [uid])).n;
  const quizStats = (await db.get('SELECT COUNT(*) attempts, COALESCE(SUM(CASE WHEN score * 1.0 / total >= 0.7 THEN 1 ELSE 0 END),0) passed FROM quiz_attempts WHERE user_id = ?', [uid]));
  const perfect = (await db.get('SELECT COUNT(*) n FROM quiz_attempts WHERE user_id = ? AND score = total', [uid])).n;
  const completedCourses = courses.filter((c) => (c.progress?.total || 0) > 0 && c.progress.done === c.progress.total).length;

  const achievements = [
    { id: 'first_enrol', title: 'First steps', description: 'Enrolled in your first course', earned: courses.length >= 1 },
    { id: 'five_lessons', title: 'Consistent learner', description: 'Completed 5 subtopics', earned: subDone >= 5 },
    { id: 'first_quiz', title: 'Quiz taker', description: 'Submitted your first quiz', earned: quizStats.attempts >= 1 },
    { id: 'passed_quiz', title: 'Passing grade', description: 'Scored 70% or higher on a quiz', earned: quizStats.passed >= 1 },
    { id: 'perfect', title: 'Perfect score', description: 'Got every question right on a quiz', earned: perfect >= 1 },
    { id: 'course_done', title: 'Course complete', description: 'Finished every subtopic in a course', earned: completedCourses >= 1 },
  ].map((a) => ({ ...a, earned: !!a.earned }));

  res.json({
    user: profile,
    courses,
    progress: { subtopics_completed: subDone, quizzes_taken: quizStats.attempts, completed_courses: completedCourses },
    achievements,
  });
});

router.patch('/profile', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
  (await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]));
  res.json({ ok: true, name });
});

export default router;
