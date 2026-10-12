# Padmora security review and hardening (October 2026)

Branch: `security-and-copy-cleanup`. Nothing here has been deployed, and no migration has been run against the live database.
This is a review of the code in the repository plus tests against a local copy of the server that shares the live Supabase project
(QA rows only, removed afterwards). It is not a penetration test, and it does not prove the site is secure.

## Findings

| # | Severity | Finding | Where | Condition to exploit | Status |
|---|----------|---------|-------|----------------------|--------|
| A1 | Critical if hit | Login tokens were signed with the fallback secret `dev_secret` whenever `JWT_SECRET` was missing | `middleware/auth.js`, `middleware/adminAuth.js`, `routes/auth.js`, `utils/inquiryToken.js` | Production started without `JWT_SECRET`. Anyone could then forge an admin or customer token. **Could not verify whether production has it set.** | Fixed: production refuses to start without a strong secret (`utils/secrets.js`) |
| A2 | Low | Algorithm not pinned on token checks | same files | needs a library flaw | Fixed: `HS256` only |
| B | High if hit | Default admin e-mail and password (`ChangeMe123!`) used when seeding the first admin | `utils/db.js` | First start on an empty database without `ADMIN_*` env | Fixed: no defaults; weak passwords refused |
| C1 | High | Guest order lookup had no rate limit, and its 404 text differed for "no such order" and "wrong contact" | `routes/orders.js` | Order ID plus a guessed e-mail or phone | Fixed: per-visitor, per-order and overall limits; identical answer |
| C2 | High | Guest lookup, guest cancel and the e-mailed inquiry link returned the full street address and phone | `routes/orders.js`, `routes/inquiry.js` | Knowing an Order ID and a contact value, or holding an old link | Fixed: guests see first name, city, state and a partly hidden pincode |
| C3 | Low | Inquiry links never expired | `utils/inquiryToken.js` | a leaked e-mail | New links expire in 120 days. Links already e-mailed keep working |
| D | High | Rate limits trusted the first `X-Forwarded-For` entry, which the visitor controls, so every limit could be bypassed | `utils/attemptLimiter.js` | Send a different header per request | Fixed: proxy hop count (`utils/proxy.js`, `TRUST_PROXY`) |
| D2 | Medium | One-time codes: the attempt counter was read-then-write, so parallel guesses were undercounted and one code could be consumed twice | `utils/otp.js` | Fire many guesses at once | Fixed with atomic compare-and-swap |
| D3 | Medium | Admin login: no per-account limit, timing difference for unknown e-mails | `routes/adminAuth.js` | Distributed guessing | Fixed |
| D4 | Medium | Contact form unlimited | `routes/contact.js` | Script | Fixed: 20 per hour per visitor, 10 per hour per e-mail, length caps |
| E1 | Medium | `products_blended` view ran with the owner's rights and was readable with the public key; broad grants to `anon` / `authenticated`; functions executable by anyone; mutable `search_path` | database | Needs the public Supabase key (it ships in the browser only if used there; this site uses the service key on the server). Row-level security already blocks all tables | Migration prepared, **not applied** |
| F1 | Medium | Uploads trusted the browser's declared type | `utils/storage.js` | Logged-in customer | Fixed: content is checked against the declared type; per-account upload ceiling |
| F2 | Medium | Admin sessions survived a password change | `middleware/adminAuth.js` | Stolen token | Fixed: token carries a fingerprint of the password; older tokens stay valid until they expire |
| F3 | Low/Medium | Customer-typed name, address label and phone shown without escaping in the header, account, checkout and admin customer list | `components.js`, `account.html`, `checkout.html`, `admin.html` | Self-XSS, or an admin viewing a hostile customer record | Fixed: escaped on output, `<` `>` refused on input |
| F4 | Low | Admin-created accounts only needed 8 characters | `routes/admin.js` | | 12 characters |
| F5 | Low | Guest coupon "once per customer" could be dodged at checkout creation | `routes/payments.js` | Guest checkout | Fixed (looks up the customer by e-mail) |
| F6 | Low | Cart line update was not scoped to the owner in the query | `routes/cart.js` | Already blocked by an earlier check | Defence in depth |
| F7 | Low | CORS open to every site; request body limit unset; no Permissions-Policy; body-size errors answered 500 | `server.js` | | Fixed |

## Reviewed, no change, or accepted

- Prices, discounts and shipping are recomputed on the server and locked in `pending_checkouts`; the Razorpay amount is checked before an order is created (earlier work, re-tested: 39/39).
- Orders, addresses, cart, returns and inquiries are scoped to the signed-in customer. Another customer gets a 404 (tested).
- Admin roles: each role reaches only its own areas (tested). Analytics and the activity log are visible to every admin role by design.
- Backups include admin password hashes. Super Admin only.
- Return and review photos sit in a public bucket under unguessable file names. Anyone with the URL can view them.
- Product names, brand names and similar admin-written text are still inserted into some storefront templates without escaping. Only an admin can write them, so this is a trust-the-admin risk. Not changed.
- A coupon's total usage limit can be exceeded by simultaneous checkouts. Small impact. Not changed.
- The limiter is in memory: it resets when the server restarts and is per process. The one-time-code attempt counters are in the database and survive restarts.
- Dependencies: not audited in this pass (`npm audit` was not run).

## Tests

`scratchpad` suites (kept outside the repository): `security_api.js` has 90 checks covering all of the above and passes 90/90.
Regression suites that pass: `pay_hardening` 39/39, `parts_api` 65/65, `returns_revenue` 54/54, `returns_lock` 55/55, `geo_api` 55/55, `cache_api` 37/37, `otp_api` 40/40, `support_api` 54/54, `inquiry_api` 25/25 before its last stage.
Browser check: guest tracking page shows `Pune, Maharashtra, 411***` and no street or phone on desktop and phone width.

Not run or blocked:
- `g1`, `g2`, `g3` (old chained suites): `g2` needs a working Razorpay key and the local test key is rejected ("Authentication failed"), so checkout through the real gateway was not tested. `pay_hardening` covers payment, retries, stock and refunds with a simulated gateway.
- `guest-cancel` targets a route that no longer exists. `inquiry_api` (last stage) and `inquiry_access` could not find a product with enough stock in the live catalogue.
- The Supabase migration was not applied or tested against the database.
- Login by e-mailed code through a real mailbox, real payments, real shipping and real customer messages were not exercised.

## Deployment

Do these in order. Do not merge until you have read this.

1. **Hostinger environment first.** `JWT_SECRET`: set a random value of 32+ characters. The server now refuses to start without one.
   Changing it signs everyone out once, which is acceptable. If a strong value is already set, leave it.
   Check there is no `OTP_DEBUG_LOG`, and that `SITE_URL` is `https://padmorasarees.com`.
   `TRUST_PROXY` defaults to 1 behind Hostinger. If the real visitor address ever looks wrong in logs, set it to the right hop count.
   `CORS_ORIGINS` is only needed if another site must call the API.
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only needed on an empty database.
2. **Merge the branch** (Hostinger deploys `main`).
3. **Smoke test** the live site: home, a product, add to cart, login code, admin login, guest tracking.
4. **Then the SQL** `backend/migrations/2026-10-supabase-lockdown.sql`, in the Supabase SQL editor, after you take a backup (Supabase Pro daily backup, or Admin > Backups). It changes no data. Run the VERIFY queries at its end and keep the ROLLBACK block handy.
5. **Copy** `docs/copy-update-plan-2026-10.sql` is optional and separate. It edits live FAQ, weave and hero text. Review it, apply it when you are happy.

Rollback: revert the merge on `main` (Hostinger redeploys the previous version), run the ROLLBACK block of the lockdown SQL if it was applied, and run the ROLLBACK block of the copy plan if that was applied. Tokens already issued keep working after a revert.

Still pending on the live site from earlier: `RAZORPAY_WEBHOOK_SECRET` and the `SMTP_*` settings.
