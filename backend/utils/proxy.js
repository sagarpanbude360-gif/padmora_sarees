// Who is really calling? The shop runs behind the host's proxy, which puts the visitor's address into X-Forwarded-For. A visitor can
// also send that header themselves, so it may only be believed for the part the PROXY added. Express does exactly this when it is told
// how many proxies sit in front of it ("trust proxy"); req.ip is then the real visitor address and cannot be faked from outside.
//
// TRUST_PROXY (hosting settings) says how many proxies are in front of this app:
//   unset      production: 1 (the host's own proxy). Anywhere else: 0 (no proxy; X-Forwarded-For is ignored).
//   1, 2, ...  that many proxies (a CDN in front of the host's proxy makes it 2)
//   0 / off    trust none (use when the app is reached directly)
//   a list     e.g. "loopback, 10.0.0.0/8" to trust proxies at those addresses
const { isProduction } = require('./secrets');

function trustProxySetting() {
  const raw = String(process.env.TRUST_PROXY == null ? '' : process.env.TRUST_PROXY).trim();
  if (raw) {
    if (/^(false|off|no|0)$/i.test(raw)) return false;
    if (/^\d+$/.test(raw)) return Number(raw);
    if (/^(true|on|yes)$/i.test(raw)) return 1;   // "trust everyone" would let a visitor claim any address
    return raw;
  }
  return isProduction() ? 1 : false;
}

// The visitor's address as Express worked it out (req.ip). IPv4-mapped IPv6 ("::ffff:1.2.3.4") is shown as plain IPv4.
function clientIp(req) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  return String(ip).replace(/^::ffff:/i, '');
}

module.exports = { trustProxySetting, clientIp };
