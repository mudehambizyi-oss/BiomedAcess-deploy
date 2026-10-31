// Designed course-completion certificate as a real PDF, generated on demand.
// No dependencies: raw PDF 1.4 with vector shapes and standard Helvetica fonts.
// Palette: dark background, green #10b981 and orange #e07b39 accents.

// A4 portrait, in PDF points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;

function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(' ');
}

const ascii = (s) => String(s ?? '').replace(/[^\x20-\x7E]/g, '?');
const esc = (s) => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// Rough Helvetica width estimate (avg glyph ~0.5em, bold ~0.56em) to center text
const textWidth = (s, size, bold) => ascii(s).length * size * (bold ? 0.56 : 0.5);

export function buildCertificatePdf({ certId, studentName, courseTitle, issuedDate, verifyUrl }) {
  const GREEN = '#10b981';
  const ORANGE = '#e07b39';
  const BG = '#0d1714';
  const PANEL = '#13211c';
  const TEXT = '#e8f1ee';
  const MUTED = '#b4c9c0';

  const ops = [];
  const fill = (hex) => ops.push(`${rgb(hex)} rg`);
  const stroke = (hex) => ops.push(`${rgb(hex)} RG`);
  const rect = (x, y, w, h) => ops.push(`${x} ${y} ${w} ${h} re f`);
  const text = (s, x, y, size, { bold = false, italic = false, color = TEXT, center = false } = {}) => {
    const font = bold ? 'F2' : italic ? 'F3' : 'F1';
    const tx = center ? x - textWidth(s, size, bold) / 2 : x;
    fill(color);
    ops.push(`BT /${font} ${size} Tf ${tx.toFixed(1)} ${y} Td (${esc(s)}) Tj ET`);
  };

  // background + panel
  fill(BG); rect(0, 0, PAGE_W, PAGE_H);
  fill(PANEL); rect(26, 26, PAGE_W - 52, PAGE_H - 52);
  // green outer border and orange inner rule
  stroke(GREEN); ops.push('6 w'); ops.push(`36 36 ${PAGE_W - 72} ${PAGE_H - 72} re S`);
  stroke(ORANGE); ops.push('1.5 w'); ops.push(`54 54 ${PAGE_W - 108} ${PAGE_H - 108} re S`);
  // top and bottom accent bars
  fill(GREEN); rect(54, PAGE_H - 92, 140, 4);
  fill(ORANGE); rect(PAGE_W - 194, PAGE_H - 92, 140, 4);

  // branding
  fill(GREEN); rect(0, PAGE_H - 112, PAGE_W, 112);
  text('BiomedAccess', PAGE_W / 2, PAGE_H - 62, 30, { bold: true, color: '#ffffff', center: true });
  text('Built for the Laboratory Scientist', PAGE_W / 2, PAGE_H - 84, 12, { color: '#ffffff', center: true });

  text('CERTIFICATE OF COMPLETION', PAGE_W / 2, PAGE_H - 220, 22, { bold: true, color: TEXT, center: true });
  text('This certifies that', PAGE_W / 2, PAGE_H - 278, 14, { italic: true, color: MUTED, center: true });
  text(studentName, PAGE_W / 2, PAGE_H - 330, 30, { bold: true, color: ORANGE, center: true });
  fill(GREEN); rect(PAGE_W / 2 - 180, PAGE_H - 346, 360, 1.5);
  text('has successfully completed every topic of the course', PAGE_W / 2, PAGE_H - 386, 13, { italic: true, color: MUTED, center: true });
  text(courseTitle, PAGE_W / 2, PAGE_H - 432, 19, { bold: true, color: GREEN, center: true });

  // founder signature and issue details
  fill(ORANGE); rect(PAGE_W / 2 - 106, 184, 212, 1.2);
  text('Bizyi Mudehambi, Founder', PAGE_W / 2, 164, 12, { bold: true, color: TEXT, center: true });
  text('Authorised issuer', PAGE_W / 2, 146, 9, { color: MUTED, center: true });
  text(`Date completed: ${issuedDate}`, 76, 108, 11, { color: TEXT });
  text(`Certificate ID: ${certId}`, 76, 88, 11, { bold: true, color: ORANGE });
  text(`Verify at: ${verifyUrl}`, 76, 68, 8, { color: MUTED });

  const stream = ops.join('\n');
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add(null);
  const pagesId = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> >>`);
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
