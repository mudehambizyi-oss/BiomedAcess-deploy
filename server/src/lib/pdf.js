// Minimal text-only PDF writer (Helvetica / Helvetica-Bold, WinAnsi encoding,
// wrapped lines, multi-page, page numbers). No dependencies. Used for seeded
// sample resources and for the on-the-fly subtopic / topic PDF downloads.

// Characters outside WinAnsi (Latin-1 range) that we can map to a close ASCII form.
const CHAR_MAP = {
  '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2022': '-', '\u2026': '...',
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2264': '<=', '\u2265': '>=', '\u2192': '->', '\u2190': '<-', '\u2248': '~',
  '\u03B1': 'alpha', '\u03B2': 'beta', '\u03B3': 'gamma', '\u03B4': 'delta',
  '\u03BA': 'kappa', '\u03BB': 'lambda', '\u03BC': 'mu', '\u03C0': 'pi',
  '\u03C3': 'sigma', '\u03C4': 'tau', '\u03C6': 'phi', '\u03C9': 'omega',
  '\u0394': 'Delta', '\u03A3': 'Sigma', '\u03A9': 'Omega',
  '\t': '    ', '\r': '',
};

// Keep printable ASCII and Latin-1 (matches WinAnsiEncoding bytes 0x20-0x7E, 0xA0-0xFF).
export function toWinAnsi(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, (ch) => CHAR_MAP[ch] ?? '?');
}

function wrapLine(line, max) {
  const out = [];
  let cur = '';
  for (const word of line.split(' ')) {
    if (cur && (cur + ' ' + word).length > max) { out.push(cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  out.push(cur);
  return out;
}

export function makePdf(title, text) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const PAGE_TOP = 740;
  const PAGE_BOTTOM = 60;

  // Build a flat list of positioned lines: title first (bold, larger), then body.
  const items = [];
  wrapLine(toWinAnsi(title), 58).forEach((t) => items.push({ t, f: 'F2', s: 16, h: 24 }));
  items.push({ t: '', f: 'F1', s: 11, h: 14 });
  for (const raw of toWinAnsi(text).split('\n')) {
    if (!raw.trim()) { items.push({ t: '', f: 'F1', s: 11, h: 14 }); continue; }
    wrapLine(raw, 92).forEach((t) => items.push({ t, f: 'F1', s: 11, h: 14 }));
  }

  // Paginate by height.
  const pages = [[]];
  let y = PAGE_TOP;
  for (const it of items) {
    if (y - it.h < PAGE_BOTTOM) { pages.push([]); y = PAGE_TOP; }
    pages[pages.length - 1].push({ ...it, y });
    y -= it.h;
  }

  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add(null);
  const pagesId = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  pages.forEach((pageItems, idx) => {
    let stream = '';
    for (const it of pageItems) {
      if (!it.t) continue;
      stream += `BT /${it.f} ${it.s} Tf 60 ${it.y} Td (${esc(it.t)}) Tj ET\n`;
    }
    stream += `BT /F1 8 Tf 300 30 Td (${idx + 1} / ${pages.length}) Tj ET\n`;
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`);
    pageIds.push(pageId);
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  // All content is ASCII/Latin-1, so string offsets equal byte offsets under latin1.
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
