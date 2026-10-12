const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const secret = crypto.randomBytes(32).toString('hex');
function run(overrides) {
  return spawnSync(process.execPath, ['-e', `
    const s = require('./utils/secrets');
    s.assertConfig();
    console.log(JSON.stringify({ debug: s.otpDebugEnabled(), secret: s.jwtSecret() === process.env.JWT_SECRET }));
  `], { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: {
    ...process.env, NODE_ENV: 'production', SITE_URL: 'https://padmorasarees.com',
    JWT_SECRET: secret, OTP_DEBUG_LOG: '', ...overrides
  }});
}
for (const flag of ['', 'false', '0', 'off', 'true', '1', 'yes', 'on']) {
  test(`production starts with debug flag ${JSON.stringify(flag)} but never logs codes`, () => {
    const r = run({ OTP_DEBUG_LOG: flag });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { debug: false, secret: true });
    assert.ok(!r.stderr.includes(secret));
  });
}
for (const value of ['', 'dev_secret', 'short']) {
  test(`unsafe signing secret is rejected: ${JSON.stringify(value)}`, () => {
    const r = run({ JWT_SECRET: value });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /JWT_SECRET/);
  });
}
test('a public HTTPS deployment cannot enable OTP logging even outside production NODE_ENV', () => {
  const r = run({ NODE_ENV: 'development', OTP_DEBUG_LOG: 'true' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).debug, false);
});
test('local debug requires explicit opt-in', () => {
  for (const flag of ['false', 'true']) {
    const r = run({ NODE_ENV: 'development', SITE_URL: 'http://localhost:5000', OTP_DEBUG_LOG: flag });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).debug, flag === 'true');
  }
});
