import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin, requireModerator, requireContentManager } from '../lib/auth.js';

const router = Router();

const clip = (v, max) => String(v || '').trim().slice(0, max);
const MAX_IMAGE_BYTES = 300 * 1024;
function imageData(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  const match = String(value).match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)$/i);
  if (!match) throw Object.assign(new Error('Upload a valid JPEG, PNG, WebP or GIF image.'), { status: 400 });
  if (Buffer.byteLength(match[2], 'base64') > MAX_IMAGE_BYTES) throw Object.assign(new Error('Image must be 300 KB or smaller.'), { status: 413 });
  return value;
}

const assistantRequests = new Map();
const ASSISTANT_WINDOW_MS = 60_000;
const ASSISTANT_MAX_REQUESTS = 12;
router.post('/chat-assistant', async (req, res) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const prior = assistantRequests.get(key);
  const window = !prior || now - prior.start >= ASSISTANT_WINDOW_MS ? { start: now, count: 0 } : prior;
  if (window.count >= ASSISTANT_MAX_REQUESTS) return res.status(429).json({ error: 'Please wait a minute before sending more questions.' });
  window.count++;
  assistantRequests.set(key, window);
  if (assistantRequests.size > 5000) {
    for (const [ip, entry] of assistantRequests) if (now - entry.start >= ASSISTANT_WINDOW_MS) assistantRequests.delete(ip);
  }
  const message = String(req.body?.message || '').trim().slice(0, 1200);
  if (!message) return res.status(400).json({ error: 'Type a question first.' });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'Live chat is temporarily unavailable.' });
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', temperature: 0.4, max_tokens: 350,
        messages: [
          { role: 'system', content: 'You are the helpful BiomedAccess assistant. Answer briefly about BiomedAccess courses, exams, and platform features. You may explain biomedical topics only as study content. Never diagnose, recommend treatment, or give medical advice for real people; direct medical concerns to a qualified health professional.' },
          { role: 'user', content: message },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: 'Live chat is temporarily unavailable.' });
    res.json({ answer: String(data.choices?.[0]?.message?.content || 'I could not form an answer just now. Please try again.').slice(0, 2500) });
  } catch (e) {
    console.error('chat assistant error:', e.message);
    res.status(502).json({ error: 'Live chat is temporarily unavailable.' });
  }
});

// List communities with member counts; flag whether the caller has joined
router.get('/communities', requireAuth, async (req, res) => {
  const rows = (await db.all(`SELECT c.id, c.slug, c.name, c.description, c.tag, c.image_data,
      (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id) AS member_count,
      (SELECT COUNT(*) FROM threads t WHERE t.community_id = c.id) AS thread_count,
      EXISTS(SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?) AS joined
    FROM communities c ORDER BY c.id`, [req.user.id]));
  res.json(rows.map((r) => ({ ...r, joined: !!r.joined })));
});

// Admin community catalogue management. Community cards use name, description and tag.
router.get('/admin/communities', requireModerator, async (_req, res) => {
  const rows = await db.all(`SELECT c.id, c.slug, c.name, c.description, c.tag, c.image_data,
    (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id) AS member_count,
    (SELECT COUNT(*) FROM threads t WHERE t.community_id = c.id) AS thread_count
    FROM communities c ORDER BY c.id`, []);
  res.json(rows);
});

router.post('/admin/communities', requireModerator, async (req, res) => {
  const name = clip(req.body?.title ?? req.body?.name, 120);
  const description = clip(req.body?.description, 2000);
  const tag = clip(req.body?.tag || 'General', 60);
  let image;
  try { image = imageData(req.body?.image_data); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  if (!name) return res.status(400).json({ error: 'Community title is required.' });
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `community-${Date.now()}`;
  if (await db.get('SELECT id FROM communities WHERE slug = ?', [slug])) slug = `${slug}-${Date.now().toString(36)}`;
  const id = (await db.run('INSERT INTO communities (slug, name, description, tag, image_data) VALUES (?,?,?,?,?)', [slug, name, description, tag, image || ''])).lastInsertRowid;
  res.status(201).json({ id, slug });
});

router.patch('/admin/communities/:id', requireModerator, async (req, res) => {
  const c = await db.get('SELECT * FROM communities WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  if (req.body?.slug !== undefined) {
    const slug = clip(req.body.slug, 100).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return res.status(400).json({ error: 'Community slug is invalid.' });
    if (await db.get('SELECT id FROM communities WHERE slug = ? AND id != ?', [slug, c.id])) return res.status(409).json({ error: 'A community with that slug already exists.' });
    await db.run('UPDATE communities SET slug = ? WHERE id = ?', [slug, c.id]);
  }
  const name = clip(req.body?.title ?? req.body?.name ?? c.name, 120);
  let image;
  try { image = imageData(req.body?.image_data); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  if (!name) return res.status(400).json({ error: 'Community title is required.' });
  await db.run('UPDATE communities SET name = ?, description = ?, tag = ?, image_data = ? WHERE id = ?', [name, clip(req.body?.description ?? c.description, 2000), clip(req.body?.tag ?? c.tag, 60), image === undefined ? c.image_data : image, c.id]);
  res.json({ ok: true });
});

router.delete('/admin/communities/:id', requireAdmin, async (req, res) => {
  const result = await db.run('DELETE FROM communities WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Community not found.' });
  res.json({ ok: true });
});

router.get('/communities/:id', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT * FROM communities WHERE id = ? OR slug = ?', [req.params.id, req.params.id]));
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  const joined = !!(await db.get('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?', [c.id, req.user.id]));
  const member_count = (await db.get('SELECT COUNT(*) n FROM community_members WHERE community_id = ?', [c.id])).n;
  res.json({ ...c, joined, member_count });
});

router.post('/communities/:id/join', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM communities WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  (await db.run('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?, ?)', [c.id, req.user.id]));
  res.json({ joined: true });
});

router.delete('/communities/:id/leave', requireAuth, async (req, res) => {
  (await db.run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', [req.params.id, req.user.id]));
  res.json({ joined: false });
});

// Live chat: last 100 messages per community, any signed-in user can read and post.
// Bodies are stored as plain text (control characters stripped, max 1000 chars) and
// rendered as text on the client, so no HTML is ever interpreted.
const CHAT_CAP = 100;
const CHAT_MAX_LEN = 1000;
const cleanChat = (v) => String(v ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/\r\n?/g, '\n')
  .trim()
  .slice(0, CHAT_MAX_LEN);

router.get('/communities/:id/messages', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM communities WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  const rows = (await db.all(`SELECT m.id, m.community_id, m.user_id, m.body, m.created_at, u.name AS author
    FROM community_messages m JOIN users u ON u.id = m.user_id
    WHERE m.community_id = ? ORDER BY m.id DESC LIMIT ?`, [c.id, CHAT_CAP]));
  res.json(rows.reverse());
});

router.post('/communities/:id/messages', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM communities WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  const body = cleanChat(req.body?.body);
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  const id = (await db.run('INSERT INTO community_messages (community_id, user_id, body) VALUES (?,?,?)', [c.id, req.user.id, body])).lastInsertRowid;
  // keep the table bounded: only the newest CHAT_CAP messages per community are kept
  (await db.run(`DELETE FROM community_messages WHERE community_id = ? AND id NOT IN
    (SELECT id FROM community_messages WHERE community_id = ? ORDER BY id DESC LIMIT ?)`, [c.id, c.id, CHAT_CAP]));
  const row = (await db.get(`SELECT m.id, m.community_id, m.user_id, m.body, m.created_at, u.name AS author
    FROM community_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`, [id]));
  res.status(201).json(row);
});

// Threads
router.get('/communities/:id/threads', requireAuth, async (req, res) => {
  const rows = (await db.all(`SELECT t.id, t.title, t.body, t.created_at, u.name AS author,
      (SELECT COUNT(*) FROM replies r WHERE r.thread_id = t.id) AS reply_count
    FROM threads t JOIN users u ON u.id = t.user_id
    WHERE t.community_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT 100`, [req.params.id]));
  res.json(rows);
});

router.post('/communities/:id/threads', requireAuth, async (req, res) => {
  const c = (await db.get('SELECT id FROM communities WHERE id = ?', [req.params.id]));
  if (!c) return res.status(404).json({ error: 'Community not found.' });
  const isMember = (await db.get('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?', [c.id, req.user.id]));
  if (!isMember) return res.status(403).json({ error: 'Join this community to start a thread.' });
  const title = clip(req.body?.title, 160);
  const body = clip(req.body?.body, 4000);
  if (!title) return res.status(400).json({ error: 'Give your thread a title.' });
  const id = (await db.run('INSERT INTO threads (community_id, user_id, title, body) VALUES (?,?,?,?)', [c.id, req.user.id, title, body])).lastInsertRowid;
  res.status(201).json({ id, title, body });
});

router.get('/threads/:id', requireAuth, async (req, res) => {
  const t = (await db.get(`SELECT t.id, t.community_id, t.title, t.body, t.created_at, u.name AS author
    FROM threads t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Thread not found.' });
  const replies = (await db.all(`SELECT r.id, r.body, r.created_at, u.name AS author
    FROM replies r JOIN users u ON u.id = r.user_id WHERE r.thread_id = ? ORDER BY r.created_at, r.id`, [t.id]));
  const community = (await db.get('SELECT id, name FROM communities WHERE id = ?', [t.community_id]));
  res.json({ ...t, community, replies });
});

router.post('/threads/:id/replies', requireAuth, async (req, res) => {
  const t = (await db.get('SELECT id, community_id FROM threads WHERE id = ?', [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Thread not found.' });
  const isMember = (await db.get('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?', [t.community_id, req.user.id]));
  if (!isMember) return res.status(403).json({ error: 'Join this community to reply.' });
  const body = clip(req.body?.body, 4000);
  if (!body) return res.status(400).json({ error: 'Reply cannot be empty.' });
  const id = (await db.run('INSERT INTO replies (thread_id, user_id, body) VALUES (?,?,?)', [t.id, req.user.id, body])).lastInsertRowid;
  res.status(201).json({ id, body });
});

// Delete own thread/reply (admins can delete any)
router.delete('/threads/:id', requireAuth, async (req, res) => {
  const t = (await db.get('SELECT user_id FROM threads WHERE id = ?', [req.params.id]));
  if (!t) return res.status(404).json({ error: 'Thread not found.' });
  if (t.user_id !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) return res.status(403).json({ error: 'Not allowed.' });
  (await db.run('DELETE FROM threads WHERE id = ?', [t.id]));
  res.json({ ok: true });
});

router.delete('/replies/:id', requireAuth, async (req, res) => {
  const r = (await db.get('SELECT user_id FROM replies WHERE id = ?', [req.params.id]));
  if (!r) return res.status(404).json({ error: 'Reply not found.' });
  if (r.user_id !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) return res.status(403).json({ error: 'Not allowed.' });
  (await db.run('DELETE FROM replies WHERE id = ?', [req.params.id]));
  res.json({ ok: true });
});

export default router;
