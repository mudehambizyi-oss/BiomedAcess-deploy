// BiomedAccess Telegram tutor bot
// Env: BOT_TOKEN (telegram), GROQ_API_KEY, SITE_URL
const https = require('https');
const TOKEN=process.env.BOT_TOKEN;
const GROQ = process.env.GROQ_API_KEY;
const SITE = process.env.SITE_URL || 'https://biomedaccess.onrender.com';
const API_URL = 'https://api.telegram.org/bot' + TOKEN;

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { resolve({ ok: false }); } });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

function groq(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'openai/gpt-oss-120b', messages, temperature: 0.4 });
    const req = https.request('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ, 'Content-Length': Buffer.byteLength(data) } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode !== 200) { console.error('groq error', res.statusCode, buf.slice(0, 300)); resolve('The tutor brain is resting, try again in a sec.'); return; }
        try { const j = JSON.parse(buf); resolve(j.choices?.[0]?.message?.content || 'Hmm, try again.'); }
        catch (e) { console.error('groq parse fail:', buf.slice(0, 300)); resolve('The tutor brain is resting, try again in a sec.'); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

const SYSTEM = 'You are the BiomedAccess Tutor, a friendly biomedical sciences tutor for Zambian students. Answer clearly, simply, correctly. Keep answers short unless asked for depth. When relevant, mention that full courses, quizzes and communities are on ' + SITE + '. Never give medical advice for real patients; for clinical cases say see a professional.';

let offset = 0;
console.log('TOKEN length:', (TOKEN||'').length, '| GROQ set:', !!GROQ);
if (!TOKEN) console.error('BOT_TOKEN missing!');
async function handle(msg) {
  const chat = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;
  if (text.startsWith('/start')) {
    await post(API_URL + '/sendMessage', { chat_id: chat, text: 'Welcome to the BiomedAccess Tutor 🧬\n\nAsk me anything about anatomy, microbiology, hematology, lab practice. For full courses, quizzes and communities: ' + SITE, reply_markup: { inline_keyboard: [[{ text: '📚 Open courses', url: SITE }]] } });
    return;
  }
  await post(API_URL + '/sendChatAction', { chat_id: chat, action: 'typing' });
  const reply = await groq([{ role: 'system', content: SYSTEM }, { role: 'user', content: text }]);
  await post(API_URL + '/sendMessage', { chat_id: chat, text: reply.slice(0, 4000) });
}

async function poll() {
  let r = {};
  try {
    r = await new Promise((resolve, reject) => {
      https.get(API_URL + '/getUpdates?timeout=50&offset=' + offset, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { resolve({}); } });
      }).on('error', reject);
    });
    for (const upd of r.result || []) {
      offset = upd.update_id + 1;
      if (upd.message) handle(upd.message).catch(e => console.error('handle error:', e && e.message || e));
    }
  } catch (e) { console.error('poll error:', e && e.message || e); }
  if (r && r.ok === false) console.error('telegram said:', JSON.stringify(r).slice(0,200));
  setTimeout(poll, 500);
}
console.log('BiomedAccess bot polling...');
poll();
