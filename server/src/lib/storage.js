import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { UPLOAD_DIR } from '../db.js';

// File storage for uploads. When CLOUDINARY_URL is set, files go to Cloudinary and the DB stores the secure_url.
// When it is absent, files stay on local disk exactly as before (UPLOAD_DIR, file name stored in the DB).

export const cloudEnabled = () => !!process.env.CLOUDINARY_URL;

// cloudinary://<api_key>:<api_secret>@<cloud_name>, read from the env var at call time.
function configureCloudinary() {
  const m = String(process.env.CLOUDINARY_URL || '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error('CLOUDINARY_URL is malformed');
  cloudinary.config({ cloud_name: m[3], api_key: m[1], api_secret: m[2], secure: true });
}
export const isRemote = (ref) => typeof ref === 'string' && /^https:\/\//.test(ref);

const diskStorage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
});

function uploadToCloudinary(file) {
  configureCloudinary();
  // Cloudinary blocks PDF delivery by URL on this environment, so PDFs are stored
  // with a .dat public id and streamed back through our server with the right type.
  const ext = path.extname(file.originalname).toLowerCase() === '.pdf' ? '.dat' : path.extname(file.originalname).toLowerCase();
  const publicId = 'biomedaccess/' + crypto.randomBytes(12).toString('hex') + ext;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: 'raw', public_id: publicId, use_filename: false }, (err, result) => {
      if (err || !result?.secure_url) return reject(err || new Error('Cloudinary returned no URL'));
      resolve(result.secure_url);
    });
    stream.end(file.buffer);
  });
}

// Multer middleware for a single 'file' field. Respects the byte cap and mime allow-list in both modes.
// With Cloudinary on, the file is pushed to Cloudinary and req.file.filename becomes the secure_url, so
// routes keep saving req.file.filename as file_path with no other change.
export function uploadFile({ maxBytes, allowed, errorMessage }) {
  const fileFilter = (_req, file, cb) => (allowed.has(file.mimetype) ? cb(null, true) : cb(new Error(errorMessage)));
  const disk = multer({ storage: diskStorage, limits: { fileSize: maxBytes }, fileFilter });
  const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes }, fileFilter });
  return (req, res, next) => {
    const useCloud = cloudEnabled();
    (useCloud ? memory : disk).single('file')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 25 MB.' : err.message });
      if (useCloud && req.file) {
        try {
          req.file.filename = await uploadToCloudinary(req.file);
          delete req.file.buffer;
        } catch (e) {
          console.error('Cloudinary upload failed:', e?.message || e);
          return res.status(502).json({ error: 'Could not store the file right now. Please try again.' });
        }
      }
      next();
    });
  };
}

// Delete a stored file: Cloudinary asset for URLs, local file otherwise.
export function removeStored(ref) {
  if (!ref) return;
  if (isRemote(ref)) {
    const m = ref.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!m) return;
    configureCloudinary();
    cloudinary.uploader.destroy(decodeURIComponent(m[1]), { resource_type: 'raw', invalidate: true })
      .catch((e) => console.error('Cloudinary delete failed:', e?.message || e));
    return;
  }
  fs.rmSync(path.join(UPLOAD_DIR, path.basename(ref)), { force: true });
}

// Serve a stored file. Callers must enforce access and locks before calling this.
export async function sendStored(res, ref, originalName, mime) {
  if (isRemote(ref)) {
    // Stream remote files through the server so PDFs get the right name/type even
    // though Cloudinary serves them as generic binary.
    try {
      const upstream = await fetch(ref);
      if (!upstream.ok) return res.status(502).json({ error: 'Stored file could not be fetched.' });
      res.setHeader('Content-Type', mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/["\\\r\n]/g, '_')}"`);
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.send(buf);
    } catch (e) {
      console.error('Remote file fetch failed:', e?.message || e);
      return res.status(502).json({ error: 'Stored file could not be fetched.' });
    }
  }
  const full = path.join(UPLOAD_DIR, path.basename(ref));
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File is missing from storage.' });
  res.download(full, originalName, { headers: { 'Content-Type': mime } });
}
