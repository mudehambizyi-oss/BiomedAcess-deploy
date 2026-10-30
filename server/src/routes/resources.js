import { Router } from 'express';
import path from 'node:path';
import db from '../db.js';
import { requireAuth, requireContentManager } from '../lib/auth.js';
import { uploadFile, removeStored, sendStored } from '../lib/storage.js';
import { courseAccess, topicCourse } from './courses.js';

const router = Router();
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

const runUpload = uploadFile({ maxBytes: MAX_BYTES, allowed: ALLOWED, errorMessage: 'Unsupported file type. Upload PDF, DOCX, TXT, MD, PNG or JPG.' });

// Admin: attach a resource (upload) to a subtopic
router.post('/subtopics/:id/resources', requireContentManager, (req, res) => {
  runUpload(req, res, async () => {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const sub = (await db.get('SELECT id FROM subtopics WHERE id = ?', [req.params.id]));
    if (!sub) { removeStored(req.file.filename); return res.status(404).json({ error: 'Subtopic not found.' }); }
    const title = String(req.body.title || '').trim() || path.parse(req.file.originalname).name;
    const kind = req.file.mimetype === 'application/pdf' ? 'pdf' : 'document';
    const info = (await db.run('INSERT INTO resources (subtopic_id, title, kind, file_path, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?,?)', [sub.id, title, kind, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.user.id]));
    res.status(201).json({ id: info.lastInsertRowid, title, kind, original_name: req.file.originalname, size: req.file.size });
  });
});

router.delete('/resources/:id', requireContentManager, async (req, res) => {
  const r = (await db.get('SELECT * FROM resources WHERE id = ?', [req.params.id]));
  if (!r) return res.status(404).json({ error: 'Resource not found.' });
  (await db.run('DELETE FROM resources WHERE id = ?', [r.id]));
  removeStored(r.file_path);
  res.json({ ok: true });
});

// Download a resource (students must be enrolled / admin)
router.get('/resources/:id/download', requireAuth, async (req, res) => {
  const r = (await db.get(`SELECT r.*, t.course_id FROM resources r JOIN subtopics s ON s.id = r.subtopic_id JOIN topics t ON t.id = s.topic_id WHERE r.id = ?`, [req.params.id]));
  if (!r) return res.status(404).json({ error: 'Resource not found.' });
  if (!await courseAccess(req.user.id, req.user.role, r.course_id)) return res.status(403).json({ error: 'Enroll in this course to download resources.' });
  return sendStored(res, r.file_path, r.original_name, r.mime);
});

// Admin: list all resources for a subtopic (for admin editor)
router.get('/subtopics/:id/resources', requireContentManager, async (req, res) => {
  res.json((await db.all('SELECT id, title, kind, original_name, size, created_at FROM resources WHERE subtopic_id = ? ORDER BY id', [req.params.id])));
});

export default router;
