import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { buildCertificatePdf } from '../lib/certificate.js';
import { courseAccess } from './courses.js';

// Completion = every subtopic of the course is marked done (progress table).
// Same rule the dashboard and profile use for "course complete".
const router = Router();

function publicBase(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

async function courseProgress(userId, courseId) {
  const total = (await db.get('SELECT COUNT(*) n FROM subtopics s JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ?', [courseId])).n;
  const done = (await db.get('SELECT COUNT(*) n FROM progress p JOIN subtopics s ON s.id = p.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE t.course_id = ? AND p.user_id = ?', [courseId, userId])).n;
  return { total, done, complete: total > 0 && done === total };
}

// Short, readable, unguessable enough for public lookup: BMA-XXXX-XXXX-XXXX
function newCertId() {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `BMA-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

function formatDate(iso) {
  return new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Status for the course page and dashboard
router.get('/certificates/status/:courseId', requireAuth, async (req, res) => {
  const course = (await db.get('SELECT id, title FROM courses WHERE id = ?', [req.params.courseId]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const progress = courseProgress(req.user.id, course.id);
  const cert = (await db.get('SELECT id, issued_at FROM certificates WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]));
  res.json({ course_id: course.id, eligible: progress.complete, progress, certificate: cert ? { id: cert.id, issued_at: cert.issued_at } : null });
});

// Download the PDF. Generated on demand; the record is stored once per student+course.
router.get('/courses/:id/certificate.pdf', requireAuth, async (req, res) => {
  const course = (await db.get('SELECT id, title FROM courses WHERE id = ?', [req.params.id]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (!await courseAccess(req.user.id, req.user.role, course.id)) return res.status(403).json({ error: 'Enroll in this course first.' });
  const progress = courseProgress(req.user.id, course.id);
  if (!progress.complete) return res.status(403).json({ error: `Finish every topic to earn your certificate (${progress.done}/${progress.total} done).` });

  let cert = (await db.get('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]));
  if (!cert) {
    const id = newCertId();
    (await db.run('INSERT INTO certificates (id, user_id, course_id, student_name, course_title) VALUES (?,?,?,?,?)', [id, req.user.id, course.id, req.user.name, course.title]));
    cert = (await db.get('SELECT * FROM certificates WHERE id = ?', [id]));
  }

  const pdf = buildCertificatePdf({
    certId: cert.id,
    studentName: cert.student_name,
    courseTitle: cert.course_title,
    issuedDate: formatDate(cert.issued_at),
    verifyUrl: `${publicBase(req)}/verify/${cert.id}`,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BiomedAccess-certificate-${cert.id}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  res.end(pdf);
});

// Public verification (no login). Returns only what the certificate itself shows.
router.get('/verify/:certId', async (req, res) => {
  const cert = (await db.get('SELECT id, student_name, course_title, issued_at FROM certificates WHERE id = ?', [String(req.params.certId).toUpperCase()]));
  if (!cert) return res.status(404).json({ valid: false, error: 'No certificate with this ID.' });
  res.json({ valid: true, certificate_id: cert.id, student_name: cert.student_name, course_title: cert.course_title, issued_on: formatDate(cert.issued_at), issuer: 'BiomedAccess' });
});

export default router;
