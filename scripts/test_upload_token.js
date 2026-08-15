/* Tests the signed upload session.

   A resumable upload spans many stateless requests, so the client hands
   the session back each time. Taken at face value that would let anyone
   make this server POST bytes to a URL of their choosing — so these are
   security tests, and the one that matters most is that a VALID
   signature is still not enough to aim the server off Google's host.

   Run: node scripts/test_upload_token.js */

'use strict';

process.env.GEMINI_API_KEY = 'test-signing-secret';

const crypto = require('crypto');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function rejects(label, fn, code) {
    try { fn(); fail++; console.error(`FAIL ${label} — did not throw`); }
    catch (e) { check(label, !code || e.code === code, `code ${e.code}`); }
}

const { issue, open, ALLOWED_ORIGIN } = require('../api/_lib/upload-token.js');

const REAL = 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc123';

/* ---------- round trip ------------------------------------------ */

const token = issue(REAL);
eq('a token round-trips to the same URL', open(token), REAL);
check('the token is opaque — the URL is not readable in it',
    !token.includes('generativelanguage'), token);
check('it carries a signature', token.split('.').length === 2 && token.split('.')[1].length > 20);

// Query strings matter: the upload_id IS the session.
const other = issue(REAL.replace('abc123', 'def456'));
check('different sessions produce different tokens', other !== token);
check('and open() keeps the session id', open(other).includes('def456'));

/* ---------- forgery --------------------------------------------- */

rejects('a tampered payload is rejected',
    () => open('aHR0cHM6Ly9ldmlsLmV4YW1wbGU.' + token.split('.')[1]), 'bad_session');
rejects('a tampered signature is rejected',
    () => open(token.split('.')[0] + '.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), 'bad_session');
rejects('an unsigned token is rejected', () => open(token.split('.')[0]), 'bad_session');
rejects('an empty token is rejected', () => open(''), 'bad_session');
rejects('a missing token is rejected', () => open(undefined), 'bad_session');
rejects('rubbish is rejected', () => open('nonsense'), 'bad_session');
rejects('an empty signature is rejected', () => open(token.split('.')[0] + '.'), 'bad_session');

// A token signed with a different secret must not verify — otherwise
// the signature is decoration.
const foreign = crypto.createHmac('sha256', 'not-the-key').update('x').digest('base64url');
rejects('a foreign signature is rejected',
    () => open(Buffer.from(REAL).toString('base64url') + '.' + foreign), 'bad_session');

/* ---------- the check that survives a broken signature ----------- */

// This is the important one. Sign a hostile URL with the REAL key — as
// a bug in the signing path might — and it must STILL be refused,
// because the origin is checked independently.
function properlySigned(url) {
    const key = crypto.createHmac('sha256', 'test-signing-secret')
        .update('cubinghq:video-upload-session:v1').digest();
    const payload = Buffer.from(url, 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

eq('the harness signs the way the module does', open(properlySigned(REAL)), REAL);

for (const hostile of [
    'https://evil.example/steal',
    'http://generativelanguage.googleapis.com/upload',        // downgraded scheme
    'https://generativelanguage.googleapis.com.evil.example/', // suffix trick
    'https://evil.example/?x=generativelanguage.googleapis.com',
    'https://127.0.0.1/admin',
    'https://169.254.169.254/latest/meta-data/',               // cloud metadata
    'file:///etc/passwd',
]) {
    rejects(`a validly signed "${hostile}" is still refused`,
        () => open(properlySigned(hostile)), 'bad_session');
}

eq('the allowed origin is exactly Gemini',
    ALLOWED_ORIGIN, 'https://generativelanguage.googleapis.com');

/* ---------- the signing key is not the raw secret ---------------- */

// The token must never make the API key recoverable.
check('the API key does not appear in a token',
    !issue(REAL).includes('test-signing-secret'));

// An explicit secret takes precedence, so the key can be rotated
// independently of the API key if ever needed.
delete require.cache[require.resolve('../api/_lib/upload-token.js')];
process.env.COACH_SIGNING_SECRET = 'a-dedicated-secret';
const withOwnSecret = require('../api/_lib/upload-token.js');
const t2 = withOwnSecret.issue(REAL);
eq('a dedicated secret still round-trips', withOwnSecret.open(t2), REAL);
check('and produces a different signature than the derived key', t2 !== token);

// Tokens from the other key must not verify here — that is what makes
// rotation actually rotate.
rejects('a token from the previous key stops working',
    () => withOwnSecret.open(token), 'bad_session');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
