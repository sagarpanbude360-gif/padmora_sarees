// Permanent file storage for everything admins and customers upload (product photos, collection
// and hero images, reel videos, return-request photos).
//
// Files used to be written to backend/uploads on the web server's own disk. That broke twice over on
// Hostinger: the admin site and the storefront are separate Node apps with separate disks (a photo
// uploaded in admin simply didn't exist on the storefront), and every redeploy wipes untracked
// folders, so older uploads vanished too. They now live in a public Supabase Storage bucket that every
// server — and every future deploy — reads from, and the database stores the full public URL.
//
// Old rows that still hold a relative "/uploads/<file>" path keep working wherever that file
// happens to exist; nothing here rewrites them.
const fs = require('fs');
const path = require('path');
const { supabase } = require('./db');

const BUCKET = 'uploads';
const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
};

function publicBase() {
  return `${String(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;
}

function newName(file, prefix) {
  const ext = EXT[file.mimetype] || path.extname(file.originalname || '') || '';
  return `${prefix || ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

// What the file REALLY is, from its first bytes. The browser's "this is a JPEG" label is only a claim: a web page or script can
// be sent under an image label, so the label is checked against the content before anything is stored. -> a mime type, or null.
function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG' && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return buf.toString('ascii', 8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'video/webm';
  return null;
}
const sameKind = (declared, sniffed) => declared === sniffed || (/^video\/(mp4|quicktime)$/.test(declared) && /^video\/(mp4|quicktime)$/.test(sniffed));

// Stores one multer memory file and returns the public URL to save in the database.
async function saveUpload(file, prefix) {
  const real = sniffMime(file.buffer);
  if (!real || !sameKind(file.mimetype, real)) {
    const e = new Error('That file is not a valid photo or video. Please choose a JPG, PNG or WEBP photo.');
    e.badType = true;
    throw e;
  }
  file = Object.assign(file, { mimetype: real === 'video/quicktime' && file.mimetype === 'video/mp4' ? 'video/mp4' : real });
  const name = newName(file, prefix);
  const { error } = await supabase.storage.from(BUCKET).upload(name, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '31536000', // the name is unique per upload, so browsers can cache it for a year
    upsert: false
  });
  if (error) throw new Error('Storage upload failed: ' + error.message);
  return publicBase() + name;
}

// True for a URL this server handed out for a customer's return photo (new storage URL or the old local path).
function isReturnPhotoUrl(u) {
  if (typeof u !== 'string') return false;
  if (/^\/uploads\/return-[\w.-]+$/.test(u)) return true;
  const base = publicBase();
  return u.startsWith(base + 'return-') && /^[\w.-]+$/.test(u.slice(base.length));
}

// Same check for any prefix ('return-', 'review-'): the URL must be one this server handed out for that kind of photo.
function isCustomerPhotoUrl(u, prefix) {
  if (typeof u !== 'string' || !/^[\w-]+$/.test(prefix)) return false;
  if (u.startsWith('/uploads/' + prefix) && /^[\w.-]+$/.test(u.slice('/uploads/'.length))) return true;
  const base = publicBase();
  return u.startsWith(base + prefix) && /^[\w.-]+$/.test(u.slice(base.length));
}

// Best-effort delete of a file we stored — never lets a missing file turn a successful
// database change into an error.
async function removeUpload(url) {
  try {
    if (typeof url !== 'string' || !url) return;
    const base = publicBase();
    if (url.startsWith(base)) {
      await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(base.length))]);
    } else if (url.startsWith('/uploads/')) {
      const file = path.join(__dirname, '..', 'uploads', path.basename(url));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  } catch (_) { /* ignore */ }
}

module.exports = { sniffMime, saveUpload, removeUpload, isReturnPhotoUrl, isCustomerPhotoUrl, publicBase, BUCKET };
