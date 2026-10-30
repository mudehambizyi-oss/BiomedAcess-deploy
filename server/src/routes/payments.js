import { Router } from 'express';
import Stripe from 'stripe';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';

// Stripe Checkout stub. Paid courses are gated by courses.is_paid / price_cents.
// - No STRIPE_SECRET_KEY: payments are disabled, checkout returns 503 with a clear message.
// - Optional DEMO_UNLOCK_PAID=true: dev-only shortcut that enrolls without charging (off by default).
// - Webhook (optional): set STRIPE_WEBHOOK_SECRET and point Stripe at POST /api/payments/webhook.
// - Without a webhook, the success page calls GET /api/payments/verify/:sessionId to enroll.

const router = Router();
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const DEMO_UNLOCK = process.env.DEMO_UNLOCK_PAID === 'true';

export const paymentsEnabled = () => !!stripe;

export async function enroll(userId, courseId) {
  (await db.run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [userId, courseId]));
}

router.get('/status', (_req, res) => {
  res.json({ provider: 'stripe', mode: STRIPE_KEY.startsWith('sk_live') ? 'live' : (STRIPE_KEY ? 'test' : 'disabled'), enabled: !!stripe, demo_unlock: DEMO_UNLOCK });
});

router.post('/checkout/:courseId', requireAuth, async (req, res) => {
  const course = (await db.get('SELECT * FROM courses WHERE id = ? AND published = 1', [req.params.courseId]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (!course.is_paid) return res.status(400).json({ error: 'This course is free. Enroll directly.' });

  const already = (await db.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]));
  if (already) return res.json({ ok: true, enrolled: true });

  if (!stripe) {
    if (DEMO_UNLOCK) {
      enroll(req.user.id, course.id);
      return res.json({ ok: true, enrolled: true, demo: true, message: 'You have been enrolled in this course for now. Card checkout is coming soon.' });
    }
    return res.status(503).json({ error: 'Payments are not configured on this server yet. Add STRIPE_SECRET_KEY to enable checkout.', payments_enabled: false });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: course.currency || 'usd',
          unit_amount: course.price_cents,
          product_data: { name: course.title, description: course.slug },
        },
      }],
      metadata: { user_id: String(req.user.id), course_id: String(course.id) },
      success_url: `${APP_URL}/courses/${course.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/courses/${course.id}?cancelled=1`,
    });
    (await db.run(`INSERT INTO payments (user_id, course_id, provider, provider_ref, amount_cents, currency, status) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(provider_ref) DO NOTHING`, [req.user.id, course.id, 'stripe', session.id, course.price_cents, course.currency || 'usd', 'pending']));
    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('stripe checkout error:', err.message);
    res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Confirm a completed session (used by the success redirect when no webhook is configured)
router.get('/verify/:sessionId', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured.' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const userId = Number(session.metadata?.user_id);
    const courseId = Number(session.metadata?.course_id);
    if (userId !== req.user.id) return res.status(403).json({ error: 'This session does not belong to you.' });
    if (session.payment_status !== 'paid') return res.json({ paid: false, status: session.payment_status });
    enroll(userId, courseId);
    (await db.run("UPDATE payments SET status = 'paid' WHERE provider_ref = ?", [session.id]));
    res.json({ paid: true, course_id: courseId });
  } catch (err) {
    res.status(400).json({ error: 'Could not verify that payment session.' });
  }
});

// Stripe webhook (raw body mounted in index.js before express.json)
export async function webhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).json({ error: 'Webhook not configured.' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = Number(s.metadata?.user_id);
    const courseId = Number(s.metadata?.course_id);
    if (userId && courseId && s.payment_status === 'paid') {
      enroll(userId, courseId);
      (await db.run("UPDATE payments SET status = 'paid' WHERE provider_ref = ?", [s.id]));
    }
  }
  res.json({ received: true });
}

// ---------- Manual mobile-money unlock (no Stripe) ----------
// Student sends money to the platform's mobile money number, then submits a request with the
// transaction reference and sender name. Admin approves (enrolls the student) or rejects.
// Config (optional): MOMO_NUMBER, MOMO_NAME (account name), MOMO_NETWORK (e.g. "MTN MoMo").

await db.exec(`CREATE TABLE IF NOT EXISTS enrollment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  reference TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);`);
await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_requests_pending ON enrollment_requests(user_id, course_id) WHERE status = \'pending\'');

const momoInfo = () => {
  const raw = (process.env.MOMO_NUMBER || '').trim();
  const numbers = raw ? raw.split(',').map((n) => n.trim()).filter(Boolean) : [];
  const labelsRaw = (process.env.MOMO_NUMBERS_LABELS || '').trim();
  const labels = labelsRaw ? labelsRaw.split(',').map((n) => n.trim()) : [];
  return {
    numbers,
    numbers_with_labels: numbers.map((n, i) => ({ number: n, label: labels[i] || '' })),
    account_name: (process.env.MOMO_NAME || '').trim(),
    network: (process.env.MOMO_NETWORK || 'Mobile money').trim(),
  };
};

const requestRow = (r) => ({
  id: r.id, course_id: r.course_id, status: r.status, reference: r.reference, sender_name: r.sender_name,
  amount_cents: r.amount_cents, currency: r.currency, created_at: r.created_at, reviewed_at: r.reviewed_at,
});

async function paidCourse(id) {
  const course = (await db.get('SELECT * FROM courses WHERE id = ? AND published = 1', [id]));
  if (!course) return { error: { code: 404, msg: 'Course not found.' } };
  if (!course.is_paid) return { error: { code: 400, msg: 'This course is free. Enroll directly.' } };
  return { course };
}

// Student: payment instructions (number shown only when configured)
router.get('/manual/info', requireAuth, (_req, res) => {
  const m = momoInfo();
  const nums = m.numbers_with_labels.map((n) => `${n.label ? n.label + ' ' : ''}${n.number}`).join(' or ');
  res.json({ enabled: m.numbers.length > 0, ...m, instructions: [
    `Send the course price by ${m.network} to ${nums || 'the number shown once payments are configured'}${m.account_name ? ` (name: ${m.account_name})` : ''}.`,
    'Copy the transaction reference or message ID from the payment confirmation SMS.',
    'Enter the reference and the name the payment was sent from below, then submit.',
    'An admin checks the payment and unlocks the course for your account.',
  ] });
});

// Student: status of my latest request for a course
router.get('/manual/requests/:courseId', requireAuth, async (req, res) => {
  const course = (await db.get('SELECT id FROM courses WHERE id = ?', [req.params.courseId]));
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const enrolled = !!(await db.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]));
  const latest = (await db.get('SELECT * FROM enrollment_requests WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 1', [req.user.id, course.id]));
  res.json({ enrolled, request: latest ? requestRow(latest) : null });
});

// Student: submit a payment reference for review (status pending)
router.post('/manual/requests/:courseId', requireAuth, async (req, res) => {
  const { course, error } = paidCourse(req.params.courseId) || {};
  if (error) return res.status(error.code).json({ error: error.msg });

  const already = (await db.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', [req.user.id, course.id]));
  if (already) return res.json({ ok: true, enrolled: true });

  const reference = String(req.body?.reference || '').trim();
  const senderName = String(req.body?.sender_name || '').trim();
  if (reference.length < 3 || reference.length > 60) return res.status(400).json({ error: 'Enter the payment reference or transaction ID (3 to 60 characters).' });
  if (senderName.length < 2 || senderName.length > 80) return res.status(400).json({ error: 'Enter the name the payment was sent from (2 to 80 characters).' });

  const pending = (await db.get("SELECT * FROM enrollment_requests WHERE user_id = ? AND course_id = ? AND status = 'pending'", [req.user.id, course.id]));
  if (pending) return res.status(409).json({ error: 'You already have a pending request for this course. An admin will review it soon.', request: requestRow(pending) });

  const info = (await db.run('INSERT INTO enrollment_requests (user_id, course_id, amount_cents, currency, reference, sender_name, status) VALUES (?,?,?,?,?,?,?)', [req.user.id, course.id, course.price_cents, course.currency || 'usd', reference, senderName, 'pending']));
  const row = (await db.get('SELECT * FROM enrollment_requests WHERE id = ?', [info.lastInsertRowid]));
  res.status(201).json({ ok: true, enrolled: false, request: requestRow(row) });
});

// Admin: list requests (default pending)
router.get('/admin/requests', requireAdmin, async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = (await db.all(`SELECT r.*, u.name AS user_name, u.email AS user_email, c.title AS course_title
    FROM enrollment_requests r JOIN users u ON u.id = r.user_id JOIN courses c ON c.id = r.course_id
    WHERE r.status = ? ORDER BY r.id ASC LIMIT 500`, [status]));
  res.json(rows.map((r) => ({ ...requestRow(r), user_id: r.user_id, user_name: r.user_name, user_email: r.user_email, course_title: r.course_title })));
});

// Admin: approve (unlocks the course for the student)
router.post('/admin/requests/:id/approve', requireAdmin, async (req, res) => {
  const r = (await db.get('SELECT * FROM enrollment_requests WHERE id = ?', [req.params.id]));
  if (!r) return res.status(404).json({ error: 'Request not found.' });
  if (r.status !== 'pending') return res.status(409).json({ error: `This request is already ${r.status}.` });
  await db.tx(async () => {
    (await db.run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [r.user_id, r.course_id]));
    (await db.run("UPDATE enrollment_requests SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?", [req.user.id, r.id]));
    (await db.run(`INSERT INTO payments (user_id, course_id, provider, provider_ref, amount_cents, currency, status) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(provider_ref) DO NOTHING`, [r.user_id, r.course_id, 'manual_momo', `manual-request-${r.id}`, r.amount_cents, r.currency, 'paid']));
  });
  res.json({ ok: true, status: 'approved' });
});

// Admin: reject (student can submit a new request with the correct reference)
router.post('/admin/requests/:id/reject', requireAdmin, async (req, res) => {
  const r = (await db.get('SELECT * FROM enrollment_requests WHERE id = ?', [req.params.id]));
  if (!r) return res.status(404).json({ error: 'Request not found.' });
  if (r.status !== 'pending') return res.status(409).json({ error: `This request is already ${r.status}.` });
  (await db.run("UPDATE enrollment_requests SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?", [req.user.id, r.id]));
  res.json({ ok: true, status: 'rejected' });
});

export default router;
