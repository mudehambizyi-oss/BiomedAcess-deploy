import { Router } from 'express';
import db, { stmt } from '../db.js';
import { requireAuth, requireAdmin, requireModerator, requireContentManager } from '../lib/auth.js';

const router = Router();
const STAGES = ['diagnosis', 'lab', 'treatment', 'explanation'];
const MAX_IMAGE_BYTES = 300 * 1024;
function imageData(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  const match = String(value).match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)$/i);
  if (!match) throw Object.assign(new Error('Upload a valid JPEG, PNG, WebP or GIF image.'), { status: 400 });
  if (Buffer.byteLength(match[2], 'base64') > MAX_IMAGE_BYTES) throw Object.assign(new Error('Image must be 300 KB or smaller.'), { status: 413 });
  return value;
}

async function loadQuestions(caseId, withAnswers) {
  return (await db.all('SELECT * FROM case_questions WHERE case_id = ? ORDER BY position, id', [caseId])).map((q) => {
    const base = { id: q.id, stage: q.stage, prompt: q.prompt, options: JSON.parse(q.options), position: q.position };
    return withAnswers ? { ...base, correct_index: q.correct_index, explanation: q.explanation } : base;
  });
}

// List published case studies (with question counts, no answers)
router.get('/cases', requireAuth, async (req, res) => {
  const rows = (await db.all(`SELECT c.id, c.slug, c.title, c.specialty, c.patient, c.image_data,
      (SELECT COUNT(*) FROM case_questions q WHERE q.case_id = c.id) AS question_count,
      (SELECT ROUND(AVG(score * 1.0 / total) * 100) FROM case_attempts a WHERE a.case_id = c.id AND a.user_id = ?) AS my_best_percent
    FROM case_studies c WHERE c.published = 1 OR ? IN ('admin', 'moderator') ORDER BY c.id`, [req.user.id, req.user.role]));
  res.json(rows);
});

// Full case (presentation, vitals, questions) without answers for students
router.get('/cases/:id', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT * FROM case_studies WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!c || (!c.published && !['admin', 'moderator'].includes(req.user.role))) return res.status(404).json({ error: 'Case study not found.' });
  res.json({ ...c, published: !!c.published, questions: await loadQuestions(c.id, ['admin', 'moderator'].includes(req.user.role)) });
});

// Submit answers: body { answers: { [questionId]: selectedIndex } }
router.post('/cases/:id/attempt', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM case_studies WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!c) return res.status(404).json({ error: 'Case study not found.' });
  const qs = (await db.all('SELECT id, correct_index, explanation, stage, prompt FROM case_questions WHERE case_id = ?', [c.id]));
  const answers = req.body?.answers || {};
  let score = 0;
  const graded = qs.map((q) => {
    const sel = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
    const ok = sel === q.correct_index;
    if (ok) score++;
    return { question_id: q.id, stage: q.stage, selected_index: sel, is_correct: ok, correct_index: q.correct_index, explanation: q.explanation };
  });
  const attemptId = await db.tx(async () => {
    const id = (await db.run('INSERT INTO case_attempts (user_id, case_id, score, total) VALUES (?,?,?,?)', [req.user.id, c.id, score, qs.length])).lastInsertRowid;
    const ins = stmt('INSERT INTO case_answers (attempt_id, question_id, selected_index, is_correct) VALUES (?,?,?,?)');
    for (const g of graded) { await ins.run(id, g.question_id, g.selected_index, g.is_correct ? 1 : 0); };
    return id;
  });
  // Per-stage breakdown
  const stages = {};
  for (const g of graded) {
    stages[g.stage] = stages[g.stage] || { correct: 0, total: 0 };
    stages[g.stage].total++;
    if (g.is_correct) stages[g.stage].correct++;
  }
  res.status(201).json({ attempt_id: attemptId, score, total: qs.length, stages, results: graded });
});

// Student's own history for a case
router.get('/cases/:id/history', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM case_studies WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!c) return res.status(404).json({ error: 'Case study not found.' });
  res.json((await db.all('SELECT id, score, total, created_at FROM case_attempts WHERE user_id = ? AND case_id = ? ORDER BY id DESC LIMIT 20', [req.user.id, c.id])));
});

// Admin: create a case study with its questions (stage-tagged)
// Admin-only case study authoring endpoints
router.get('/admin/cases', requireContentManager, async (_req, res) => {
  res.json(await db.all('SELECT id, slug, title, specialty, patient, published, image_data FROM case_studies ORDER BY id DESC', []));
});

router.post('/admin/cases', requireContentManager, async (req, res) => {
  const { slug, title, specialty = '', patient = '', presentation = '', vitals = '', published = true, questions = [] } = req.body || {};
  let image;
  try { image = imageData(req.body?.image_data); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  if (!String(title || '').trim()) return res.status(400).json({ error: 'Title is required.' });
  const safeSlug = String(slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if ((await db.get('SELECT 1 FROM case_studies WHERE slug = ?', [safeSlug]))) return res.status(409).json({ error: 'A case with that slug already exists.' });
  for (const [i, q] of questions.entries()) {
    if (!STAGES.includes(q.stage)) return res.status(400).json({ error: `Question ${i + 1} needs a stage (diagnosis, lab, treatment, explanation).` });
    if (!String(q.prompt || '').trim() || !Array.isArray(q.options) || q.options.length < 2) return res.status(400).json({ error: `Question ${i + 1} needs a prompt and at least 2 options.` });
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) return res.status(400).json({ error: `Question ${i + 1} needs a valid correct option.` });
  }
  const id = await db.tx(async () => {
    const cid = (await db.run('INSERT INTO case_studies (slug, title, specialty, patient, presentation, vitals, published, image_data) VALUES (?,?,?,?,?,?,?,?)', [safeSlug, title.trim(), specialty, patient, presentation, vitals, published ? 1 : 0, image || ''])).lastInsertRowid;
    const ins = stmt('INSERT INTO case_questions (case_id, stage, prompt, options, correct_index, explanation, position) VALUES (?,?,?,?,?,?,?)');
    for (const [i, q] of questions.entries()) { await ins.run(cid, q.stage, q.prompt.trim(), JSON.stringify(q.options.map(String)), q.correct_index, q.explanation || '', i); };
    return cid;
  });
  res.status(201).json({ id, slug: safeSlug });
});

router.patch('/admin/cases/:id', requireContentManager, async (req, res) => {
  const c = await db.get('SELECT * FROM case_studies WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Case study not found.' });
  const b = req.body || {};
  let image;
  try { image = imageData(b.image_data); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  const title = String(b.title ?? c.title).trim().slice(0, 180);
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  await db.run('UPDATE case_studies SET title = ?, specialty = ?, patient = ?, presentation = ?, vitals = ?, published = ?, image_data = ? WHERE id = ?', [title, String(b.specialty ?? c.specialty).trim().slice(0, 100), String(b.patient ?? c.patient).trim().slice(0, 300), String(b.presentation ?? c.presentation).trim().slice(0, 12000), String(b.vitals ?? c.vitals).trim().slice(0, 1000), b.published === undefined ? c.published : (b.published ? 1 : 0), image === undefined ? c.image_data : image, c.id]);
  res.json({ ok: true });
});

router.delete('/admin/cases/:id', requireContentManager, async (req, res) => {
  const result = await db.run('DELETE FROM case_studies WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Case study not found.' });
  res.json({ ok: true });
});

export default router;
