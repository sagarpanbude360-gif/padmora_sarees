// Shared 6-digit email OTP helper — used by both "forgot password" and the
// guest-account "claim" flow (backend/routes/auth.js), one generic table
// instead of two near-identical ones. A code is never stored in the clear:
// only its bcrypt hash, same as a real password, so a DB leak doesn't hand
// out live codes.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { supabase, must } = require('./db');

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends for the same email+purpose
const MAX_PER_HOUR = 5; // hard cap on how many codes one email+purpose can request per hour
const MAX_ATTEMPTS = 5; // wrong-code guesses allowed against one row before it's burned

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Creates and returns a fresh plaintext code to email, or null if this
// email+purpose is currently rate-limited — the caller still reports the
// same generic success to the outside world either way, so nobody can tell
// the difference between "we sent it" and "we silently rate-limited it".
async function createOtp(email, purpose) {
  const normalizedEmail = email.toLowerCase().trim();
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = must(
    await supabase.from('email_otps').select('created_at').eq('email', normalizedEmail).eq('purpose', purpose).gte('created_at', since1h).order('created_at', { ascending: false }),
    'createOtp:recent'
  );
  if (recent.length >= MAX_PER_HOUR) return null;
  if (recent.length && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) return null;

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  must(await supabase.from('email_otps').insert({
    email: normalizedEmail, purpose, code_hash: codeHash,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(), created_at: new Date().toISOString()
  }), 'createOtp:insert');
  if (process.env.OTP_DEBUG_LOG) console.log(`[OTP_DEBUG_LOG] ${purpose} code for ${normalizedEmail}: ${code}`);
  return code;
}

// Every failure path (no row, expired, wrong code, too many attempts)
// returns false with no further detail - the caller shows one generic
// "invalid or expired" message so a code can't be probed apart from a typo.
//
// Two requests can arrive at the same instant (a script firing hundreds of guesses, or a double click). So the two things that must
// hold are done with single database updates that only succeed for ONE caller:
//  - every guess first takes its own numbered attempt slot (attempts = n -> n + 1 only while it is still n), so a burst of parallel
//    guesses cannot all be counted as "attempt 1": at most MAX_ATTEMPTS guesses are ever compared against one code;
//  - a correct code is consumed with "consumed_at is still empty", so it can sign in once, however many requests carry it.
async function verifyOtp(email, purpose, code) {
  const normalizedEmail = email.toLowerCase().trim();
  for (let round = 0; round < 4; round++) {
    const row = must(
      await supabase.from('email_otps').select('*').eq('email', normalizedEmail).eq('purpose', purpose)
        .is('consumed_at', null).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      'verifyOtp:lookup'
    );
    if (!row || row.attempts >= MAX_ATTEMPTS) return false;

    const slot = must(
      await supabase.from('email_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id).eq('attempts', row.attempts).is('consumed_at', null).select('id'),
      'verifyOtp:attempt'
    );
    if (!slot.length) continue;   // another request took that attempt slot first: look again

    const match = await bcrypt.compare(String(code || ''), row.code_hash);
    if (!match) {
      if (row.attempts + 1 >= MAX_ATTEMPTS) must(await supabase.from('email_otps').update({ consumed_at: new Date().toISOString() }).eq('id', row.id).is('consumed_at', null), 'verifyOtp:burn');
      return false;
    }
    const used = must(
      await supabase.from('email_otps').update({ consumed_at: new Date().toISOString() }).eq('id', row.id).is('consumed_at', null).select('id'),
      'verifyOtp:consume'
    );
    return used.length === 1;
  }
  return false;
}

module.exports = { createOtp, verifyOtp };
