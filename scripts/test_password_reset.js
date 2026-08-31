/* Tests forgotten-password reset: requesting one, and spending the
   link it sends.

   Four things are load-bearing enough to get their own coverage:

     1. requesting a reset must never reveal whether an address has an
        account — the same anti-enumeration rule every other account
        endpoint in this codebase keeps, extended to one more place a
        mail failure could just as easily leak the answer through;
     2. a token is single-use and expires — reusing one, or using one
        past its 30 minutes, must fail exactly like a wrong token;
     3. only the token's HASH is ever stored, never the raw value, so
        a database leak cannot be replayed into a password change; and
     4. a session issued before a reset is recognised as stale by
        /api/auth/me afterward — the one place that check runs, and
        why it exists at all is explained in session.js.

   The database is a flat stub, the same shape test_auth.js uses —
   resetPassword's own logic only ever reads and writes one exact leaf
   path (accounts/<uid>/resetToken), so there was no reason to reach
   for the heavier tree stub from test_social.js.

   Run: node scripts/test_password_reset.js */

'use strict';

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const MODULES = ['../api/auth/_request-reset.js', '../api/auth/_reset-password.js',
    '../api/auth/_signup.js', '../api/auth/_login.js', '../api/auth/_me.js', '../api/auth/_health.js',
    '../api/_lib/accounts.js', '../api/_lib/session.js', '../api/_lib/mailer.js',
    '../api/_lib/rtdb.js', '../api/_lib/firebase-auth.js', '../api/_lib/ratelimit.js',
    '../api/_lib/http.js'];

const ENV = {
    FIREBASE_DB_URL: 'https://db.example.com',
    FIREBASE_DB_SECRET: 'legacy-secret',
    AUTH_SIGNING_SECRET: 'test-signing-secret',
    RESEND_API_KEY: 'test-resend-key',
    MAIL_FROM: 'CubingHQ <noreply@example.com>',
};
const ENV_KEYS = ['FIREBASE_DB_URL', 'FIREBASE_DB_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON',
    'AUTH_SIGNING_SECRET', 'RESEND_API_KEY', 'MAIL_FROM'];

let store = {};
let sentMail = [];

function installFetch() {
    store = {};
    sentMail = [];
    global.fetch = async (url, opts = {}) => {
        if (String(url).includes('api.resend.com')) {
            sentMail.push(JSON.parse(opts.body));
            return { ok: true, status: 200, text: async () => '{"id":"mail_1"}' };
        }
        const path = decodeURIComponent(String(url).split('/.json')[0])
            .replace('https://db.example.com/', '').split('.json')[0];
        const method = opts.method || 'GET';
        if (method === 'GET') {
            const v = store[path];
            return { ok: true, status: 200, text: async () => JSON.stringify(v === undefined ? null : v) };
        }
        if (method === 'PUT') store[path] = JSON.parse(opts.body);
        if (method === 'PATCH') store[path] = Object.assign({}, store[path], JSON.parse(opts.body));
        if (method === 'DELETE') delete store[path];
        return { ok: true, status: 200, text: async () => opts.body || 'null' };
    };
}

function load(env) {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, env || ENV);
    for (const m of MODULES) delete require.cache[require.resolve(m)];
}

async function call(handlerPath, req, env) {
    load(env);
    const handler = require(handlerPath);
    require('../api/_lib/ratelimit.js')._reset();
    let status = 0, payload = null;
    const res = {
        statusCode: 0, setHeader() { },
        end(b) { payload = b ? JSON.parse(b) : null; status = this.statusCode; },
    };
    await handler(Object.assign({ method: 'POST', headers: {}, socket: {} }, req), res);
    return { status, body: payload };
}

async function signUp(email) {
    const r = await call('../api/auth/_signup.js',
        { body: { email, password: 'a good password', name: 'Ana Silva' } });
    // Signup sends its own welcome email in this ENV (mail is
    // configured by default here). That is not what this file is
    // about — cleared immediately so every sentMail assertion below
    // is about the reset flow specifically, not a leftover from setup.
    sentMail = [];
    return r.body.user.uid;
}

/** Extracts { uid, token } from the link in the most recently sent mail. */
function linkFromLastMail() {
    const mail = sentMail[sentMail.length - 1];
    const href = mail.html.match(/href="([^"]+)"/)[1];
    const params = new URLSearchParams(href.split('#')[1]);
    return { uid: params.get('reset_uid'), token: params.get('reset_token'), href };
}

(async () => {
    /* ---- anti-enumeration ------------------------------------------- */

    installFetch();
    await signUp('ana@example.com');

    let r = await call('../api/auth/_request-reset.js', { body: { email: 'ana@example.com' } });
    eq('a real account gets 200', r.status, 200);
    eq('and the same shape', r.body.sent, true);
    eq('mail was actually sent', sentMail.length, 1);

    sentMail = [];
    r = await call('../api/auth/_request-reset.js', { body: { email: 'nobody@example.com' } });
    eq('an unregistered address gets the SAME status', r.status, 200);
    eq('the SAME response shape', r.body.sent, true);
    eq('but no mail went anywhere', sentMail.length, 0);

    // A malformed address is a format problem the caller already knows
    // about — not an account-existence question — so this one case is
    // fine to answer differently.
    r = await call('../api/auth/_request-reset.js', { body: { email: 'not an address' } });
    eq('a malformed address is refused, not silently accepted', r.status, 400);

    /* ---- only a hash is stored, never the token ---------------------- */

    installFetch();
    const brunoUid = await signUp('bruno@example.com');
    await call('../api/auth/_request-reset.js', { body: { email: 'bruno@example.com' } });

    const stored = store[`accounts/${brunoUid}/resetToken`];
    check('a reset record exists', !!stored && typeof stored.hash === 'string');
    check('expiry is recorded', Number.isFinite(stored.expiresAt) && stored.expiresAt > Date.now());

    const { uid: linkUid, token: rawToken } = linkFromLastMail();
    eq('the link names the right account', linkUid, brunoUid);
    check('the raw token itself is not sitting in storage anywhere',
        !JSON.stringify(store).includes(rawToken));
    check('the stored hash is not simply the token re-encoded',
        stored.hash !== rawToken && stored.hash.length === 64 /* sha256 hex */);

    /* ---- spending it ---------------------------------------------------- */

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: brunoUid, token: rawToken, password: 'a brand new password' } });
    eq('a real token resets the password', r.status, 200);
    check('and signs the person straight in — no separate login step',
        typeof r.body.token === 'string' && r.body.token.length > 20);
    eq('for the right account', r.body.user.uid, brunoUid);

    check('the token record is gone after use', !store[`accounts/${brunoUid}/resetToken`]);

    r = await call('../api/auth/_login.js', { body: { email: 'bruno@example.com', password: 'the old password' } });
    eq('the OLD password no longer works', r.status, 401);
    r = await call('../api/auth/_login.js', { body: { email: 'bruno@example.com', password: 'a brand new password' } });
    eq('the NEW password does', r.status, 200);

    /* ---- single-use: the same link cannot be spent twice ---------------- */

    installFetch();
    const carlaUid = await signUp('carla@example.com');
    await call('../api/auth/_request-reset.js', { body: { email: 'carla@example.com' } });
    const { token: carlaToken } = linkFromLastMail();

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: carlaUid, token: carlaToken, password: 'first new password' } });
    eq('the first use succeeds', r.status, 200);

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: carlaUid, token: carlaToken, password: 'second new password' } });
    eq('reusing the same link fails', r.status, 400);
    eq('as an invalid token, not a server error', r.body.error.code, 'bad_reset_token');

    /* ---- wrong inputs, none of which should work ------------------------- */

    installFetch();
    const daniUid = await signUp('dani@example.com');
    await call('../api/auth/_request-reset.js', { body: { email: 'dani@example.com' } });
    const { token: daniToken } = linkFromLastMail();

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: daniUid, token: 'a-completely-wrong-token', password: 'whatever new password' } });
    eq('the wrong token is refused', r.status, 400);

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: 'acct_someone_elses_id_here', token: daniToken, password: 'whatever new password' } });
    eq("dani's token does not work for a different uid", r.status, 400);

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: daniUid, token: daniToken, password: 'short' } });
    eq('a weak new password is refused, token untouched', r.status, 400);
    r = await call('../api/auth/_reset-password.js',
        { body: { uid: daniUid, token: daniToken, password: 'a properly long new password' } });
    eq('the same token still works after a validation failure — it was not burned by that', r.status, 200);

    r = await call('../api/auth/_reset-password.js', { body: { uid: '', token: '', password: 'anything at all here' } });
    eq('empty uid and token are refused, not treated as "no reset in progress"', r.status, 400);

    /* ---- expiry --------------------------------------------------------- */

    installFetch();
    const evaUid = await signUp('eva@example.com');
    await call('../api/auth/_request-reset.js', { body: { email: 'eva@example.com' } });
    const { token: evaToken } = linkFromLastMail();
    // Force it into the past directly, rather than waiting 30 minutes.
    store[`accounts/${evaUid}/resetToken`].expiresAt = Date.now() - 1000;

    r = await call('../api/auth/_reset-password.js',
        { body: { uid: evaUid, token: evaToken, password: 'a perfectly fine new password' } });
    eq('an expired token is refused', r.status, 400);
    eq('as invalid, the same as any other bad token — expiry is not distinguished in the response',
        r.body.error.code, 'bad_reset_token');

    /* ---- a stale session is caught the next time /me is asked ----------- */

    installFetch();
    const finnUid = await signUp('finn@example.com');
    const loginBefore = await call('../api/auth/_login.js', { body: { email: 'finn@example.com', password: 'a good password' } });
    const tokenIssuedBeforeReset = loginBefore.body.token;

    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: `Bearer ${tokenIssuedBeforeReset}` } });
    eq('that token works fine before any reset', r.status, 200);

    await call('../api/auth/_request-reset.js', { body: { email: 'finn@example.com' } });
    const { token: finnResetToken } = linkFromLastMail();
    await call('../api/auth/_reset-password.js',
        { body: { uid: finnUid, token: finnResetToken, password: 'a totally different password' } });

    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: `Bearer ${tokenIssuedBeforeReset}` } });
    eq('the OLD session is now refused', r.status, 401);
    eq('recognisably, not as a generic expiry', r.body.error.code, 'invalid_session');

    const loginAfter = await call('../api/auth/_login.js', { body: { email: 'finn@example.com', password: 'a totally different password' } });
    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: `Bearer ${loginAfter.body.token}` } });
    eq('a token issued AFTER the reset works fine', r.status, 200);

    // A brand new account, which has never reset, must not be treated
    // as though it had — passwordChangedAt is 0/absent and the check
    // must not fire on that.
    installFetch();
    const freshUid = await signUp('fresh@example.com');
    const freshLogin = await call('../api/auth/_login.js', { body: { email: 'fresh@example.com', password: 'a good password' } });
    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: `Bearer ${freshLogin.body.token}` } });
    eq('an account that has never reset its password is never treated as stale', r.status, 200);

    /* ---- rate limiting ---------------------------------------------------- */

    installFetch();
    load(ENV);
    const requestReset = require('../api/auth/_request-reset.js');
    require('../api/_lib/ratelimit.js')._reset();
    await signUp('flood@example.com');

    const attemptReset = async (ip) => {
        let status = 0;
        const res = { statusCode: 0, setHeader() { }, end() { status = this.statusCode; } };
        await requestReset({
            method: 'POST', headers: { 'x-forwarded-for': ip }, socket: {},
            body: { email: 'flood@example.com' },
        }, res);
        return status;
    };
    let limited = 0;
    for (let i = 0; i < 10; i++) if (await attemptReset('9.9.9.9') === 429) limited++;
    check('repeated reset requests for one address are eventually cut off', limited > 0, `${limited} of 10 refused`);

    /* ---- mail not configured: still succeeds, still safe ------------------- */

    installFetch();
    await signUp('nomail@example.com');
    const NO_MAIL = Object.assign({}, ENV, { RESEND_API_KEY: '', MAIL_FROM: '' });
    r = await call('../api/auth/_request-reset.js', { body: { email: 'nomail@example.com' } }, NO_MAIL);
    eq('still answers success — the response cannot say mail is off, or it would leak the account check', r.status, 200);
    eq('same shape as every other case', r.body.sent, true);
    eq('and genuinely sent nothing', sentMail.length, 0);

    /* ---- GET /api/auth/health tells the operator what the response cannot -- */

    r = await call('../api/auth/_health.js', { method: 'GET' }, ENV);
    eq('fully configured reports ok', r.status, 200);
    eq('mail is seen as configured', r.body.hasMailer, true);

    r = await call('../api/auth/_health.js', { method: 'GET' }, NO_MAIL);
    eq('health still answers 200 without mail — storage/sessions still work', r.status, 200);
    eq('but says mail is not configured', r.body.hasMailer, false);
    check('and explains what that means for reset specifically',
        /password reset/i.test(r.body.diagnosis), r.body.diagnosis);

    const serialised = JSON.stringify(r.body);
    check('never a key or address leaks through health either',
        !serialised.includes('test-resend-key') && !serialised.includes('noreply@example.com'));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
