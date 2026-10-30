import { Router } from 'express';
import db from '../db.js';
import { requireAdmin, optionalAuth } from '../lib/auth.js';

// Announcements: admins post, everyone reads. Newest first, pinned on top.
const router = Router();
const clean = (s, max = 300) => String(s ?? '').trim().slice(0, max);

router.get('/announcements', async (_req, res) => {
  const rows = await db.all('SELECT a.id, a.title, a.body, a.pinned, a.created_at, u.name AS author FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.pinned DESC, a.id DESC LIMIT 50');
  res.json(rows);
});

router.post('/admin/announcements', requireAdmin, async (req, res) => {
  const title = clean(req.body.title, 120);
  const body = clean(String(req.body.body ?? ''), 3000);
  if (!title) return res.status(400).json({ error: 'Announcement title is required.' });
  const pinned = req.body.pinned ? 1 : 0;
  const info = await db.run('INSERT INTO announcements (title, body, pinned, created_by) VALUES (?,?,?,?)', [title, body, pinned, req.user.id]);

  // Forward to the Telegram channel when TELEGRAM_ANNOUNCE_CHANNEL is set (e.g. @biomedaccess or -1001234...).
  const channel = process.env.TELEGRAM_ANNOUNCE_CHANNEL;
  if (channel) {
    const text = `📢 *${title}*\n\n${body}\n\n— BiomedAccess`;
    fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN || ''}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel, text, parse_mode: 'Markdown' }),
    }).catch(() => {});
  }

  res.status(201).json({ id: info.lastInsertRowid, title, body, pinned, created_at: new Date().toISOString() });
});

router.patch('/admin/announcements/:id', requireAdmin, async (req, res) => {
  const a = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Announcement not found.' });
  const title = req.body.title !== undefined ? clean(req.body.title, 120) : a.title;
  const body = req.body.body !== undefined ? clean(String(req.body.body), 3000) : a.body;
  if (!title) return res.status(400).json({ error: 'Announcement title is required.' });
  const pinned = req.body.pinned !== undefined ? (req.body.pinned ? 1 : 0) : a.pinned;
  await db.run('UPDATE announcements SET title=?, body=?, pinned=? WHERE id=?', [title, body, pinned, a.id]);
  res.json({ ok: true });
});

router.delete('/admin/announcements/:id', requireAdmin, async (req, res) => {
  await db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
