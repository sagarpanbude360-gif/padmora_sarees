// The private link for an order inquiry. Anyone holding it can open the inquiry form for THAT order only - no login
// needed - which is how guests (and customers who just prefer the e-mail button) reach it. The link itself never
// expires; what limits it is the order: the form only opens once the order is delivered and only for as long as the
// store's return window (7 days after delivery by default) or, after a rejection, the extra time for the last chance.
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./secrets');

const secret = () => jwtSecret() + ':order-inquiry';
const SITE_URL = () => String(process.env.SITE_URL || 'https://padmorasarees.com').replace(/\/$/, '');

function inquiryToken(orderId) {
  // new links last 120 days (links already sent, which have no expiry, keep working: the order's own rules still apply)
  return jwt.sign({ purpose: 'order-inquiry', o: String(orderId) }, secret(), { algorithm: 'HS256', expiresIn: '120d' });
}

// -> the order id, or null for anything that is not a genuine link
function readInquiryToken(token) {
  try {
    const p = jwt.verify(String(token || ''), secret(), { algorithms: ['HS256'] });
    return p && p.purpose === 'order-inquiry' && p.o ? String(p.o) : null;
  } catch (e) { return null; }
}

function inquiryLink(orderId) {
  return `${SITE_URL()}/order-inquiry?token=${encodeURIComponent(inquiryToken(orderId))}`;
}

module.exports = { inquiryToken, readInquiryToken, inquiryLink, siteUrl: SITE_URL };
