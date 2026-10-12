// Tiny in-memory failed-attempt limiter for unauthenticated lookups (guest
// order cancellation). Counts only *failed* verifications, so a genuine
// customer who types the right email first time is never slowed down, while
// someone guessing order-ID/email combinations gets cut off quickly.
// The counters live in this process's memory: a restart empties them, and a host that runs several copies of the app counts each
// copy separately (so the real limit can be up to N times higher). Limits that must hold regardless (login codes) are ALSO enforced
// in the database, see utils/otp.js. The numbers are chosen so people who share one address (a phone network, an office) are not hurt.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 5000;

const buckets = new Map(); // key -> { count, resetAt }

function prune(now) {
  if (buckets.size < MAX_ENTRIES) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
  // Still full of live entries — drop the oldest so memory can't grow unbounded.
  while (buckets.size >= MAX_ENTRIES) buckets.delete(buckets.keys().next().value);
}

function isBlocked(key, max) {
  const b = buckets.get(key);
  if (!b) return false;
  if (b.resetAt <= Date.now()) { buckets.delete(key); return false; }
  return b.count >= max;
}

function recordFailure(key) {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else b.count++;
}

function clearFailures(key) {
  buckets.delete(key);
}

// The caller's address (see utils/proxy.js: only the part of X-Forwarded-For that our own proxy added is believed).
const { clientIp } = require('./proxy');

// Counts EVERY attempt (not only failures) in its own window and says whether this one is over the limit - for things like contact
// messages or file uploads where each use costs us something. -> { blocked, retryAfterSec }
function hit(key, max, windowMs) {
  const now = Date.now();
  prune(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) { b = { count: 0, resetAt: now + (windowMs || WINDOW_MS) }; buckets.set(key, b); }
  b.count++;
  return { blocked: b.count > max, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

module.exports = { isBlocked, recordFailure, clearFailures, clientIp, hit };
