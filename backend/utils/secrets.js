// The signing secret for every login token (customers, admins, private order-inquiry links) and the start-up checks that stop the
// server from running with an unsafe configuration.
//
// There is NO built-in fallback secret: a fallback that is written in the source code is known to everyone who can read it, and anyone
// could then mint a valid admin or customer token. On a real (production) deployment the server refuses to start without a strong
// JWT_SECRET. On a developer's machine, with no secret set, a random one is made for that run only (logins do not survive a restart).
const crypto = require('crypto');

const KNOWN_WEAK = new Set(['dev_secret', 'replace_this_with_a_long_random_secret', 'secret', 'changeme', 'jwt_secret', 'your_jwt_secret', 'your-secret', 'password']);

// Production = NODE_ENV=production, or a public https SITE_URL (the live site and the test site on its own domain are both caught).
function isProduction() {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return true;
  const site = String(process.env.SITE_URL || '');
  return /^https:\/\//i.test(site) && !/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(site);
}

function secretProblem(value) {
  if (!value) return 'is not set';
  if (KNOWN_WEAK.has(String(value).trim().toLowerCase())) return 'is a placeholder or well-known value';
  if (String(value).length < 16) return 'is shorter than 16 characters';
  return null;
}

let devSecret = null;
function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!secretProblem(value)) return value;
  if (isProduction()) throw new Error('JWT_SECRET ' + (secretProblem(value)) + '. Set a long random value (32+ characters) in the hosting settings.');
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[config] JWT_SECRET is not set (or is weak): using a random secret for this run only. Logins will not survive a restart. Set JWT_SECRET in backend/.env.');
  }
  return devSecret;
}

// Called once, before the server accepts traffic. Production: anything in `errors` stops the server; `warnings` are only logged.
function checkConfig() {
  const errors = [], warnings = [];
  const prod = isProduction();
  const p = secretProblem(process.env.JWT_SECRET);
  if (p) (prod ? errors : warnings).push('JWT_SECRET ' + p + ' (use a long random value, 32+ characters)');
  else if (String(process.env.JWT_SECRET).length < 32) warnings.push('JWT_SECRET is shorter than 32 characters: replace it with a longer random value when convenient (this signs out everyone once)');
  if (prod && process.env.OTP_DEBUG_LOG) errors.push('OTP_DEBUG_LOG is on: it prints every login code into the server log. Remove it.');
  if (prod) {
    if (!process.env.SITE_URL) warnings.push('SITE_URL is not set (e-mail links and the sitemap fall back to the request address)');
    const key = String(process.env.RAZORPAY_KEY_ID || '');
    if (key && /^rzp_test_/.test(key)) warnings.push('RAZORPAY_KEY_ID is a TEST key: no real money can be taken');
    if (key && !process.env.RAZORPAY_WEBHOOK_SECRET) warnings.push('RAZORPAY_WEBHOOK_SECRET is not set: paid orders are not recovered when a customer closes the page after paying');
    if (!process.env.SMTP_HOST) warnings.push('SMTP_* is not set: customers receive no e-mails (login codes, order confirmations)');
  }
  return { production: prod, errors, warnings };
}

function assertConfig() {
  const r = checkConfig();
  r.warnings.forEach(w => console.warn('[config] warning: ' + w));
  if (r.errors.length) {
    console.error('\n[config] The server will not start because the configuration is unsafe:\n  - ' + r.errors.join('\n  - ') + '\nFix these in the hosting settings (see backend/.env.example) and start again.\n');
    process.exit(1);
  }
  return r;
}

module.exports = { jwtSecret, isProduction, secretProblem, checkConfig, assertConfig, KNOWN_WEAK };
