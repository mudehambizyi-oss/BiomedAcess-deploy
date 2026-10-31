import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../lib/auth.js';

const router = Router();
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

router.get('/testimonials', async (_req, res) => {
  const rows = await db.all('SELECT id, quote, name, role, position, created_at FROM testimonials ORDER BY position, created_at, id');
  res.json(rows);
});

router.post('/admin/testimonials', requireAdmin, async (req, res) => {
  const quote = clean(req.body.quote, 2000);
  const name = clean(req.body.name, 120);
  const role = clean(req.body.role, 160);
  if (!quote || !name || !role) return res.status(400).json({ error: 'Quote, name and role are required.' });
  const next = await db.get('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM testimonials');
  const info = await db.run('INSERT INTO testimonials (quote, name, role, position) VALUES (?, ?, ?, ?)', [quote, name, role, next.position]);
  const testimonial = await db.get('SELECT id, quote, name, role, position, created_at FROM testimonials WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json(testimonial);
});

router.put('/admin/testimonials/:id', requireAdmin, async (req, res) => {
  const existing = await db.get('SELECT id, quote, name, role FROM testimonials WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Testimonial not found.' });
  const quote = req.body.quote !== undefined ? clean(req.body.quote, 2000) : existing.quote;
  const name = req.body.name !== undefined ? clean(req.body.name, 120) : existing.name;
  const role = req.body.role !== undefined ? clean(req.body.role, 160) : existing.role;
  if (!quote || !name || !role) return res.status(400).json({ error: 'Quote, name and role are required.' });
  await db.run('UPDATE testimonials SET quote = ?, name = ?, role = ? WHERE id = ?', [quote, name, role, existing.id]);
  res.json(await db.get('SELECT id, quote, name, role, position, created_at FROM testimonials WHERE id = ?', [existing.id]));
});

router.delete('/admin/testimonials/:id', requireAdmin, async (req, res) => {
  const result = await db.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Testimonial not found.' });
  res.json({ ok: true });
});

export default router;
