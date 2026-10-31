import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import 'express-async-errors';

dotenv.config();

import './db.js';
import { runExpansionSeed } from './seed-expand.js';
import { runCaseSeed } from './seed-cases.js';
import caseRoutes from './routes/cases.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import resourceRoutes from './routes/resources.js';
import learningRoutes from './routes/learning.js';
import adminRoutes from './routes/admin.js';
import certificateRoutes from './routes/certificates.js';
import communityRoutes from './routes/community.js';
import phase3Routes from './routes/phase3.js';
import featureRoutes from './routes/features.js';
import announcementRoutes from './routes/announcements.js';
import testimonialRoutes from './routes/testimonials.js';
import materialRoutes from './routes/materials.js';
import paymentRoutes, { webhookHandler } from './routes/payments.js';
import { requireAdmin } from './lib/auth.js';
import db from './db.js';

// Idempotent starter content (courses, topics, communities): inserts only missing rows
try { await runExpansionSeed(); } catch (e) { console.error('expansion seed failed:', e.message); }
// Idempotent main seed (demo users, communities, threads, sample quizzes): no-ops when data exists
try { await import('./seed.js'); } catch (e) { console.error('seed failed:', e.message); }
// Idempotent case studies: inserts only slugs that are missing
try { await runCaseSeed(); } catch (e) { console.error('case seed failed:', e.message); }

const app = express();
const PORT = process.env.PORT || 4000;
const here = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

// Stripe webhook needs the raw body, so it is mounted before express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'BiomedAccess API' }));

// Public, live content counts for the landing page.
app.get('/api/stats', async (_req, res) => {
  const [courses, topics, cases, jobs] = await Promise.all([
    db.get('SELECT COUNT(*) AS n FROM courses WHERE published = 1'),
    db.get('SELECT COUNT(*) AS n FROM topics t JOIN courses c ON c.id = t.course_id WHERE c.published = 1'),
    db.get('SELECT COUNT(*) AS n FROM case_studies WHERE published = 1'),
    db.get('SELECT COUNT(*) AS n FROM jobs'),
  ]);
  res.json({ courses: courses.n, topics: topics.n, case_studies: cases.n, jobs: jobs.n, communities: 1 });
});

app.use('/api/auth', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', resourceRoutes);
app.use('/api', learningRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', communityRoutes);
app.use('/api', caseRoutes);
app.use('/api', phase3Routes);
app.use('/api', featureRoutes);
app.use('/api', announcementRoutes);
app.use('/api', testimonialRoutes);
app.use('/api', materialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', certificateRoutes);

// Public certificate verification: /verify/:certId
// Browsers get a readable page; API clients (curl, apps) get JSON.
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
app.get('/verify/:certId', async (req, res) => {
  const cert = (await db.get('SELECT id, student_name, course_title, issued_at FROM certificates WHERE id = ?', [String(req.params.certId).toUpperCase()]));
  const wantsHtml = (req.headers.accept || '').includes('text/html');
  if (!wantsHtml) {
    if (!cert) return res.status(404).json({ valid: false, error: 'No certificate with this ID.' });
    return res.json({ valid: true, certificate_id: cert.id, student_name: cert.student_name, course_title: cert.course_title, issued_on: cert.issued_at.slice(0, 10), issuer: 'BiomedAccess' });
  }
  const body = cert
    ? `<h1 style="color:#10b981">Valid certificate</h1><p>This certifies that <strong style="color:#e07b39">${escHtml(cert.student_name)}</strong> completed <strong>${escHtml(cert.course_title)}</strong> on BiomedAccess.</p><p>Certificate ID: <strong>${escHtml(cert.id)}</strong><br>Issued: ${escHtml(cert.issued_at.slice(0, 10))}</p>`
    : '<h1 style="color:#e07b39">Not found</h1><p>No BiomedAccess certificate matches this ID.</p>';
  res.status(cert ? 200 : 404).type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify certificate | BiomedAccess</title></head><body style="margin:0;background:#0d1714;color:#e8f1ee;font-family:Helvetica,Arial,sans-serif;padding:48px 24px;text-align:center"><div style="max-width:560px;margin:auto;background:#13211c;border:2px solid #10b981;border-radius:12px;padding:32px">${body}<p style="color:#8fa59d;font-size:13px">BiomedAccess verification</p></div></body></html>`);
});

// Admin-only: full topic quiz (with correct answers) for the editor
app.get('/api/admin/topics/:id/quiz', requireAdmin, async (req, res) => {
  const quiz = (await db.get('SELECT * FROM quizzes WHERE topic_id = ?', [req.params.id]));
  if (!quiz) return res.json(null);
  const questions = (await db.all('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position, id', [quiz.id]))
    .map((q) => ({ prompt: q.prompt, options: JSON.parse(q.options), correct: q.correct_index, explanation: q.explanation }));
  res.json({ title: quiz.title, questions });
});

// Admin-only: full course tree for the editor (resources included)
app.get('/api/admin/courses/:id/tree', requireAdmin, async (req, res) => {
  const course = (await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const topicRows = await db.all('SELECT * FROM topics WHERE course_id = ? ORDER BY position, id', [course.id]);
  const topics = [];
  for (const t of topicRows) {
    const subRows = await db.all('SELECT * FROM subtopics WHERE topic_id = ? ORDER BY position, id', [t.id]);
    const subtopics = [];
    for (const s of subRows) {
      const resources = await db.all('SELECT id, title, kind, original_name, size FROM resources WHERE subtopic_id = ? ORDER BY id', [s.id]);
      subtopics.push({ ...s, resources });
    }
    const has_quiz = !!(await db.get('SELECT 1 FROM quizzes WHERE topic_id = ?', [t.id]));
    topics.push({ ...t, subtopics, has_quiz });
  }
  res.json({ ...course, is_paid: !!course.is_paid, published: !!course.published, topics });
});

// Serve built frontend in production
const dist = path.join(here, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use('/downloads', express.static(path.join(here, '../downloads')));
  app.use('/uploads', express.static(path.join(here, '../uploads')));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`BiomedAccess API listening on http://localhost:${PORT}`);
});
