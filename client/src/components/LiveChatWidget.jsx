import React, { useState } from 'react';

export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setMessages((items) => [...items, { role: 'user', content: message }]);
    setText(''); setBusy(true); setError('');
    try {
      const response = await fetch('/api/chat-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Chat is temporarily unavailable.');
      setMessages((items) => [...items, { role: 'assistant', content: data.answer }]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="live-assistant">
    {open && <section className="live-assistant-panel" aria-label="BiomedAccess live chat">
      <header className="live-assistant-header"><div><strong>BiomedAccess assistant</strong><div className="small">Courses, exams and platform help</div></div><button type="button" className="live-assistant-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button></header>
      <div className="live-assistant-messages" aria-live="polite">
        {messages.length === 0 && <p className="muted small">Hi! Ask me about courses, exams or using BiomedAccess.</p>}
        {messages.map((m, i) => <div key={`${i}-${m.role}`} className={`live-assistant-message ${m.role}`}>{m.content}</div>)}
        {busy && <div className="muted small">Thinking…</div>}
        {error && <div className="error small">{error}</div>}
      </div>
      <form className="live-assistant-form" onSubmit={send}><input className="input" value={text} maxLength={1200} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" aria-label="Message" /><button className="btn teal small" disabled={busy || !text.trim()}>Send</button></form>
    </section>}
    <button type="button" className="live-assistant-toggle" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close live chat' : 'Open live chat'}>{open ? '×' : 'Chat'}</button>
  </div>;
}
