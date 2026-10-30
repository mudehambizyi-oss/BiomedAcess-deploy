import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import '../landing.css';

const HERO_BG = 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1800&q=70&auto=format&fit=crop';

const TIERS = [
  {
    name: 'Free',
    price: 'ZMW 0',
    note: 'Start learning today',
    cta: { label: 'Create a free account', to: '/signup' },
    features: ['Core courses and topics', 'Per-topic quizzes with instant grading', 'Community discussions', 'Progress dashboard', '24/7 tutor bot'],
  },
  {
    name: 'Pro',
    price: 'Coming soon',
    note: 'Everything in Free, plus',
    cta: null,
    features: ['All Free features', 'Virtual labs', 'One-to-one mentorship', 'Advanced and paid courses', 'Priority support'],
  },
];

// Feature cards: each carries a real lab photo and an icon
const FEATURES = [
  {
    title: 'Structured courses',
    body: 'Topics, subtopics and resources arranged in a clear learning path, from first-year basics to advanced bench practice.',
    img: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=900&q=70&auto=format&fit=crop',
    alt: 'Fluorescence micrograph of stained cells',
    icon: 'book',
  },
  {
    title: 'Quizzes with instant feedback',
    body: 'Per-topic quizzes graded on the spot, so you see exactly which result reads or concept needs another look.',
    img: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=900&q=70&auto=format&fit=crop',
    alt: 'Pipette filling a multiwell plate',
    icon: 'check',
  },
  {
    title: 'Case studies',
    body: 'Work through realistic clinical presentations, vitals and questions, then check your reasoning against the answers.',
    img: 'https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=900&q=70&auto=format&fit=crop',
    alt: 'Gloved hands pipetting into a tube rack',
    icon: 'case',
  },
  {
    title: 'Professional communities',
    body: 'Discuss diagnostic challenges and share findings with laboratory scientists across the region.',
    img: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=900&q=70&auto=format&fit=crop',
    alt: 'Scientist in safety goggles',
    icon: 'people',
  },
  {
    title: 'Certificates you can verify',
    body: 'Complete a course and download a certificate with a public verification ID that employers can check.',
    img: 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=900&q=70&auto=format&fit=crop',
    alt: 'DNA double helix on a blue background',
    icon: 'cert',
  },
  {
    title: 'Learn on any phone',
    body: 'Built to work on modest connections, so you can revise a smear or a protocol from a clinic or the bench.',
    img: '/images/lab-work.jpg',
    alt: 'Laboratory scientist at work',
    icon: 'phone',
  },
];

const STEPS = [
  { title: 'Create an account', body: 'Sign up free. Free courses are available to enrol in straight away.', icon: 'user' },
  { title: 'Read the topics', body: 'Work through structured topics, subtopics and the resources attached to each one.', icon: 'book' },
  { title: 'Take the quiz', body: 'Test yourself per topic. Every answer is graded instantly, with an explanation.', icon: 'check' },
  { title: 'Earn your certificate', body: 'Finish a course and download a certificate with a public ID employers can verify.', icon: 'cert' },
];

const VALUE_POINTS = [
  { title: 'Built by laboratory practice', body: 'Protocols and QC are grounded in HPCZ and ISO 15189 standards, not generic theory.' },
  { title: 'Made for Zambia and the region', body: 'Designed for scientists in central hospitals and remote clinics alike, on modest connections.' },
  { title: 'Free to start', body: 'Core courses, per-topic quizzes and communities are free to use. Pro features are coming later.' },
  { title: 'Available 24/7', body: 'Learn at night shift, between samples, or on the weekend. A tutor bot answers questions any time.' },
];

const PHOTO_STRIP = [
  { src: 'https://images.unsplash.com/photo-1602052577122-f73b9710adba?w=900&q=70&auto=format&fit=crop', alt: 'Laboratory bench with microscope and equipment', caption: 'The lab bench' },
  { src: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=900&q=70&auto=format&fit=crop', alt: 'Pipette dropping liquid into glassware', caption: 'Sample handling' },
  { src: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=900&q=70&auto=format&fit=crop', alt: 'Fluorescence micrograph of stained cells', caption: 'Cell imaging' },
  { src: 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=900&q=70&auto=format&fit=crop', alt: 'DNA double helix on a blue background', caption: 'Molecular biology' },
];

// ---------- small inline icons (stroke, currentColor) ----------
function Icon({ name, size = 22 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  switch (name) {
    case 'book':
      return <svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 7h6" /></svg>;
    case 'check':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>;
    case 'case':
      return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></svg>;
    case 'people':
      return <svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.6c2.6.2 5 2 5 4.9" /></svg>;
    case 'cert':
      return <svg {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20l4-3 4 3v-4" /><path d="M7.5 9.5h9" /></svg>;
    case 'phone':
      return <svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>;
    case 'user':
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></svg>;
    case 'arrow':
      return <svg {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;
    case 'shield':
      return <svg {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'globe':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.8 2.6 15.2 0 18-2.6-2.8-2.6-15.2 0-18z" /></svg>;
    case 'gift':
      return <svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8" /><path d="M12 8v12" /><path d="M12 8c-1.5-3-5-3.5-5-1.2S9.5 8 12 8zm0 0c1.5-3 5-3.5 5-1.2S14.5 8 12 8z" /></svg>;
    case 'clock':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    default:
      return null;
  }
}

// ---------- scroll reveal ----------
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } });
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function Reveal({ children, delay = 0, as: Tag = 'div', className = '', ...rest }) {
  const [ref, inView] = useInView(0.15);
  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${inView ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ---------- animated counter (eases 0 -> target once visible) ----------
function Counter({ to, duration = 1400 }) {
  const [ref, inView] = useInView(0.4);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !to) { setVal(to); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return <span ref={ref}>{val.toLocaleString('en-US')}</span>;
}

export default function Landing() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => { api('/courses').then((c) => setCourses(Array.isArray(c) ? c : [])).catch(() => setCourses([])); }, []);
  useEffect(() => { api('/stats').then(setStats).catch(() => {}); }, []);

  const previewCourses = (courses || []).slice(0, 8);
  const statItems = stats ? [
    { n: stats.courses, label: 'Courses', hint: 'across the lab disciplines' },
    { n: stats.topics, label: 'Topics', hint: 'structured lessons' },
    { n: stats.case_studies, label: 'Case studies', hint: 'clinical presentations' },
    { n: stats.communities, label: 'Communities', hint: 'peer discussion groups' },
  ] : [];

  return (
    <div className="lp">
      {/* 1. HERO */}
      <section className="lp-hero" style={{ backgroundImage: `url(${HERO_BG})` }}>
        <div className="lp-hero-inner">
          <Reveal className="lp-hero-copy">
            <span className="lp-eyebrow">Professional Digital Residency</span>
            <h1>
              Sharpen your bench.<br />
              <span className="lp-grad-text">Prove your standard.</span>
            </h1>
            <p className="lp-sub">
              BiomedAccess is the learning platform built for the Laboratory Scientist: structured courses,
              instant quizzes, real clinical cases and certificates that employers can verify.
            </p>
            <div className="lp-cta-row">
              {user ? (
                <Link to="/dashboard" className="btn teal lp-btn-lg">Go to your dashboard</Link>
              ) : (
                <Link to="/signup" className="btn teal lp-btn-lg">Start learning free</Link>
              )}
              <Link to="/courses" className="btn ghost lp-btn-lg lp-btn-outline">
                Explore courses <Icon name="arrow" size={18} />
              </Link>
              <a href="/downloads/biomedaccess.apk" download className="btn ghost lp-btn-lg lp-btn-outline">
                Download Android app
              </a>
            </div>
            <p className="lp-micro">Free core courses · Built for Zambia and the region</p>
          </Reveal>
        </div>
        <div className="lp-scroll-cue" aria-hidden="true"><span /></div>
      </section>

      {/* 2. ANIMATED STATS */}
      {statItems.length > 0 && (
        <section className="lp-stats" aria-label="Platform numbers">
          {statItems.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} className="lp-stat">
              <strong><Counter to={Number(s.n) || 0} /></strong>
              <span className="lp-stat-label">{s.label}</span>
              <span className="lp-stat-hint">{s.hint}</span>
            </Reveal>
          ))}
        </section>
      )}

      {/* 3. FEATURE CARDS WITH PHOTOS */}
      <section className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-eyebrow">What you get</span>
          <h2>Everything a working scientist needs</h2>
          <p className="lp-lede">From the first protocol to the final certificate, in one place.</p>
        </Reveal>
        <div className="lp-feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90} className="lp-feature">
              <div className="lp-feature-media">
                <img src={f.img} alt={f.alt} loading="lazy" decoding="async" />
                <span className="lp-feature-icon"><Icon name={f.icon} /></span>
              </div>
              <div className="lp-feature-body">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-eyebrow">How it works</span>
          <h2>From sign-up to certificate in four steps</h2>
        </Reveal>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 110} className="lp-step">
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="lp-step-icon"><Icon name={s.icon} /></span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* 5. COURSE PREVIEW STRIP (live catalogue) */}
      {previewCourses.length > 0 && (
        <section className="lp-section">
          <Reveal className="lp-head lp-head-row">
            <div>
              <span className="lp-eyebrow">Course catalogue</span>
              <h2>Start with a course today</h2>
            </div>
            <Link to="/courses" className="lp-link">View all courses <Icon name="arrow" size={16} /></Link>
          </Reveal>
          <div className="lp-strip" role="list">
            {previewCourses.map((c, i) => (
              <Reveal key={c.id} delay={i * 60} className="lp-strip-item">
                <Link to={`/courses/${c.id}`} className="lp-course" role="listitem">
                  <div className="lp-course-top">
                    {c.level && <span className="badge">{c.level}</span>}
                    {c.is_paid
                      ? <span className="badge paid">Paid</span>
                      : <span className="badge teal">Free</span>}
                  </div>
                  <h3>{c.title}</h3>
                  {c.discipline && <span className="lp-course-disc">{c.discipline}</span>}
                  <p className="muted small">{c.description}</p>
                  <div className="lp-course-foot">
                    <span className="small muted">{c.topic_count ?? 0} topics</span>
                    <span className="lp-course-go">Open <Icon name="arrow" size={14} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* 6. VALUE-PROP BAND */}
      <section className="lp-band">
        <div className="lp-band-photo" style={{ backgroundImage: `url(${PHOTO_STRIP[0].src})` }} aria-hidden="true" />
        <div className="lp-band-inner">
          <Reveal className="lp-head">
            <span className="lp-eyebrow">Why BiomedAccess</span>
            <h2>Built for the bench, not just the classroom</h2>
          </Reveal>
          <div className="lp-value-grid">
            {VALUE_POINTS.map((v, i) => (
              <Reveal key={v.title} delay={i * 80} className="lp-value">
                <span className="lp-value-icon">
                  <Icon name={['shield', 'globe', 'gift', 'clock'][i]} />
                </span>
                <div>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Photo ribbon */}
      <section className="lp-ribbon" aria-label="Laboratory photography">
        {PHOTO_STRIP.map((im) => (
          <figure key={im.src} className="lp-ribbon-tile">
            <img src={im.src} alt={im.alt} loading="lazy" decoding="async" />
            <figcaption>{im.caption}</figcaption>
          </figure>
        ))}
      </section>

      {/* PRICING */}
      <section className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-eyebrow">Pricing</span>
          <h2>Simple pricing</h2>
        </Reveal>
        <div className="lp-pricing">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100} className={`card pricing-card lp-price-card ${t.name === 'Pro' ? 'pro' : ''}`}>
              <span className="badge teal">{t.name}</span>
              <div className="price">{t.price}</div>
              <p className="muted small">{t.note}</p>
              <ul className="check-list">
                {t.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {t.cta
                ? <Link to={t.cta.to} className="btn teal">{t.cta.label}</Link>
                : <button type="button" className="btn ghost" disabled>Coming soon</button>}
            </Reveal>
          ))}
        </div>
      </section>

      {/* MISSION + PILLARS */}
      <section className="lp-section">
        <Reveal className="mission-block">
          <h2>Our Mission</h2>
          <p className="mission-line">
            Standardizing clinical excellence through digital innovation, technical integrity and
            unwavering commitment to the laboratory scientists of Zambia.
          </p>
          <blockquote>
            Behind every specimen is a human life; behind every result is our professional integrity.
            BiomedAccess exists to ensure that integrity is never compromised.
            <cite>- BiomedAccess</cite>
          </blockquote>
        </Reveal>
        <div className="pillars">
          <h2>Three Strategic Pillars</h2>
          <div className="lp-pillars">
            <Reveal delay={0} className="card pillar"><h3>01 · Standardization</h3><p>Aligned with HPCZ and international ISO 15189 laboratory standards. Every training protocol is clinically validated, not just theoretical.</p></Reveal>
            <Reveal delay={100} className="card pillar"><h3>02 · Accessibility</h3><p>Whether a student is at a central hospital in Lusaka or a remote clinic in North-Western Province, equal access to elite diagnostic archives, courses and communities, 24/7.</p></Reveal>
            <Reveal delay={200} className="card pillar"><h3>03 · Collaboration</h3><p>A unified professional community sharing clinical cases, diagnostic challenges and research findings, building collective intelligence across the healthcare backbone.</p></Reveal>
          </div>
          <p className="affiliation">Affiliated with Rusangu University · Content validated against HPCZ and ISO 15189 standards</p>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <strong>BiomedAccess</strong>
            <p>Built for the Laboratory Scientist. A Professional Digital Residency for biomedical scientists across Zambia and Africa.</p>
          </div>
          <nav className="lp-footer-col" aria-label="Learn">
            <span className="lp-footer-h">Learn</span>
            <Link to="/courses">Courses</Link>
            <Link to="/cases">Case studies</Link>
            <Link to="/communities">Communities</Link>
            <a href="https://t.me/biomedaccess_tutor_bot" target="_blank" rel="noopener noreferrer">Tutor bot</a>
          </nav>
          <nav className="lp-footer-col" aria-label="Account">
            <span className="lp-footer-h">Account</span>
            {user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Log in</Link>}
            {user ? <Link to="/profile">Profile</Link> : <Link to="/signup">Create account</Link>}
          </nav>
          <nav className="lp-footer-col" aria-label="Legal">
            <span className="lp-footer-h">Legal</span>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
        </div>
        <div className="lp-footer-base">
          <span>BiomedAccess. Sample content for learning only, not medical advice.</span>
          <span>Affiliated with Rusangu University</span>
        </div>
      </footer>
    </div>
  );
}
