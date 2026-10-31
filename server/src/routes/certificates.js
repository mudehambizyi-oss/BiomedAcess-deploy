import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { buildCertificatePdf } from '../lib/certificate.js';
import { courseAccess } from './courses.js';

// Completion = every subtopic of the course is marked done (progress table).
const router = Router();

async function courseProgress(userId, courseId) {
  const total = (await db.get('SELECT COUNT(*) n FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ?', [courseId])).n;
  const done = (await db.get('SELECT COUNT(*) n FROM progress p JOIN subtopics s ON s.id = p.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ? AND p.user_id = ?', [courseId, userId])).n;
  return { total, done, complete: total > 0 && done === total };
}

// Stable, readable certificate IDs derived from the student and course.
function certificateId(courseId, userId) {
  const digest = crypto.createHash('sha256').update(`BiomedAccess:${courseId}:${userId}`).digest('hex').slice(0, 12).toUpperCase();
  return `BMA-CERT-${courseId}-${userId}-${digest}`;
}

function formatDate(iso) {
  return new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function issueCertificate(user, course) {
  let cert = await db.get('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?', [user.id, course.id]);
  if (!cert) {
    const id = certificateId(course.id, user.id);
    await db.run('INSERT OR IGNORE INTO certificates (id, user_id, course_id, student_name, course_title) VALUES (?,?,?,?,?)', [id, user.id, course.id, user.name, course.title]);
    cert = await db.get('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?', [user.id, course.id]);
  }
  return cert;
}

// List the user's earned certificates. Only enrolled course completion qualifies.
router.get('/certificates', requireAuth, async (req, res) => {
  const courses = await db.all(`SELECT c.id, c.title FROM courses c JOIN enrollments e ON e.course_id = c.id
    WHERE e.user_id = ? AND c.published = 1 ORDER BY c.position, c.id`, [req.user.id]);
  const earned = [];
  for (const course of courses) {
    const progress = await courseProgress(req.user.id, course.id);
    if (!progress.complete) continue;
    const cert = await issueCertificate(req.user, course);
    earned.push({ id: cert.id, course_id: course.id, course_title: course.title, student_name: req.user.name, issued_at: cert.issued_at });
  }
  res.json(earned);
});

// Status for the course page and dashboard
router.get('/certificates/status/:courseId', requireAuth, async (req, res) => {
  const course = await db.get('SELECT id, title FROM courses WHERE id = ?', [req.params.courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const progress = await courseProgress(req.user.id, course.id);
  const cert = await db.get('SELECT id, issued_at FROM certificates WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]);
  res.json({ course_id: course.id, eligible: progress.complete, progress, certificate: cert ? { id: cert.id, issued_at: cert.issued_at } : null });
});

async function downloadCertificate(req, res) {
  const courseId = req.params.id || req.params.courseId;
  const course = await db.get('SELECT id, title FROM courses WHERE id = ?', [courseId]);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (!await courseAccess(req.user.id, req.user.role, course.id)) return res.status(403).json({ error: 'Enroll in this course first.' });
  const progress = await courseProgress(req.user.id, course.id);
  if (!progress.complete) return res.status(403).json({ error: `Finish every topic to earn your certificate (${progress.done}/${progress.total} done).` });

  const cert = await issueCertificate(req.user, course);
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const pdf = buildCertificatePdf({
    certId: cert.id,
    studentName: cert.student_name,
    courseTitle: cert.course_title,
    issuedDate: formatDate(cert.issued_at),
    verifyUrl: `${base}/verify/${cert.id}`,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BiomedAccess-certificate-${cert.id}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(pdf);
}
router.get('/courses/:id/certificate.pdf', requireAuth, downloadCertificate);
router.get('/certificates/:courseId/pdf', requireAuth, downloadCertificate);

// Public verification (no login). Returns only what the certificate itself shows.
router.get('/verify/:certId', async (req, res) => {
  const cert = await db.get('SELECT id, student_name, course_title, issued_at FROM certificates WHERE id = ?', [String(req.params.certId).toUpperCase()]);
  if (!cert) return res.status(404).json({ valid: false, error: 'No certificate with this ID.' });
  res.json({ valid: true, certificate_id: cert.id, student_name: cert.student_name, course_title: cert.course_title, issued_on: formatDate(cert.issued_at), issuer: 'BiomedAccess' });
});

export default router;
