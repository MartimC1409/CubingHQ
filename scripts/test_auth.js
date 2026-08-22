/* Tests email + password accounts and the session tokens they issue.

   Three things are load-bearing here and each has its own section:

     1. a password is never recoverable from what is stored, and a
        wrong one is rejected;
     2. a session token cannot be edited by the person holding it —
        which is the whole reason the battle gate can trust one; and
     3. the endpoints do not answer questions they were not asked,
        in particular "does this person have an account here".

   The database is stubbed at the fetch boundary, so the real storage
   paths and the real hashing run.

   Run: node scripts/test_auth.js */

'use strict';

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const MODULES = ['../api/auth/signup.js', '../api/auth/login.js', '../api/auth/me.js',
    '../api/_lib/accounts.js', '../api/_lib/session.js', '../api/_lib/rtdb.js',
    '../api/_lib/firebase-auth.js', '../api/_lib/ratelimit.js', '../api/_lib/http.js'];

const ENV = {
    FIREBASE_DB_URL: 'https://db.example.com',
    FIREBASE_DB_SECRET: 'legacy-secret',
    AUTH_SIGNING_SECRET: 'test-signing-secret',
};

/** The database: a plain object keyed by path. */
let store = {};
let writes = [];

function installFetch() {
    global.fetch = async (url, opts = {}) => {
        const path = decodeURIComponent(String(url).split('/.json')[0])
            .replace('https://db.example.com/', '').split('.json')[0];
        const method = opts.method || 'GET';
        if (method === 'GET') {
            const v = store[path];
            return { ok: true, status: 200, text: async () => JSON.stringify(v === undefined ? null : v) };
        }
        writes.push({ path, method, body: opts.body ? JSON.parse(opts.body) : undefined });
        if (method === 'PUT') store[path] = JSON.parse(opts.body);
        if (method === 'PATCH') store[path] = Object.assign({}, store[path], JSON.parse(opts.body));
        return { ok: true, status: 200, text: async () => opts.body || 'null' };
    };
}

function load(path, env = ENV) {
    for (const k of ['FIREBASE_DB_URL', 'FIREBASE_DB_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON',
        'AUTH_SIGNING_SECRET']) delete process.env[k];
    Object.assign(process.env, env);
    for (const m of MODULES) delete require.cache[require.resolve(m)];
    return require(path);
}

async function call(handlerPath, req, env) {
    const handler = load(handlerPath, env);
    require('../api/_lib/ratelimit.js')._reset();
    let status = 0, payload = null;
    const res = {
        statusCode: 0, setHeader() { },
        end(b) { payload = b ? JSON.parse(b) : null; status = this.statusCode; },
    };
    await handler(Object.assign({ method: 'POST', headers: {}, socket: {} }, req), res);
    return { status, body: payload };
}

(async () => {
    /* ---- hashing ------------------------------------------------- */

    const accounts = load('../api/_lib/accounts.js');

    const stored = await accounts.hashPassword('a good password');
    check('the password is not in what is stored', !stored.includes('a good password'), stored);
    check('the algorithm and cost travel with it', stored.startsWith('scrypt$16384$8$1$'), stored);
    eq('the right password verifies', await accounts.verifyPassword(stored, 'a good password'), true);
    eq('a wrong one does not', await accounts.verifyPassword(stored, 'a good passwore'), false);
    eq('and case matters', await accounts.verifyPassword(stored, 'A good password'), false);

    const again = await accounts.hashPassword('a good password');
    check('the same password hashes differently each time — the salt is real',
        again !== stored);
    eq('and still verifies', await accounts.verifyPassword(again, 'a good password'), true);

    eq('a corrupted record fails closed', await accounts.verifyPassword('garbage', 'x'), false);
    eq('an empty record fails closed', await accounts.verifyPassword('', 'x'), false);
    eq('and so does one with the hash stripped',
        await accounts.verifyPassword('scrypt$16384$8$1$c2FsdA==$', 'x'), false);

    /* ---- addresses and passwords are checked --------------------- */

    eq('the address is lowercased', accounts.normalizeEmail(' Foo@Bar.COM '), 'foo@bar.com');
    eq('one address is one account',
        accounts.uidFor('Foo@Bar.com'), accounts.uidFor('foo@bar.com'));
    check('the uid does not contain the address',
        !accounts.uidFor('foo@bar.com').includes('foo'), accounts.uidFor('foo@bar.com'));

    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.', '@b.com', 'a'.repeat(250) + '@b.com']) {
        let threw = false;
        try { accounts.normalizeEmail(bad); } catch (e) { threw = e.status === 400; }
        check(`${JSON.stringify(bad)} is refused as an address`, threw);
    }
    for (const ok of ['a@b.co', 'first.last+tag@sub.domain.org']) {
        let threw = false;
        try { accounts.normalizeEmail(ok); } catch (e) { threw = true; }
        check(`${ok} is accepted`, !threw);
    }

    let threw = null;
    try { accounts.checkPassword('short'); } catch (e) { threw = e; }
    check('a short password is refused', threw && threw.code === 'weak_password');
    check('and the message says how long', threw && /8/.test(threw.message), threw && threw.message);

    /* ---- session tokens ------------------------------------------ */

    const session = load('../api/_lib/session.js');
    const token = session.issue({ uid: 'acct_abc', email: 'a@b.com', name: 'Ana' });
    const claims = session.verify(token);
    eq('a token verifies back to its user', claims && claims.uid, 'acct_abc');
    eq('carrying the display name', claims && claims.name, 'Ana');

    // The point of the signature.
    const [v, payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({
        uid: 'acct_someone_else', name: 'Mallory', exp: Date.now() + 1000,
    })).toString('base64url');
    eq('a re-written payload is refused', session.verify(`${v}.${forged}.${sig}`), null);
    eq('a truncated signature is refused', session.verify(`${v}.${payload}.${sig.slice(0, -1)}`), null);
    eq('an unsigned token is refused', session.verify(`${v}.${payload}.`), null);
    eq('a WCA access token is simply not one of ours', session.verify('abc123def456'), null);
    eq('nor is nothing at all', session.verify(''), null);
    eq('nor is a null', session.verify(null), null);

    eq('an expired token is refused',
        session.verify(session.issue({ uid: 'a', name: 'A' }, 1), Date.now()), null);

    // A different signing secret must not validate our tokens.
    const other = load('../api/_lib/session.js',
        Object.assign({}, ENV, { AUTH_SIGNING_SECRET: 'a different secret' }));
    eq('a token signed elsewhere is refused', other.verify(token), null);

    /* ---- signup --------------------------------------------------- */

    store = {}; writes = []; installFetch();
    let r = await call('../api/auth/signup.js', {
        body: { email: 'Ana@Example.com', password: 'a good password', name: 'Ana Silva' },
    });
    eq('signup succeeds', r.status, 200);
    check('and returns a token', typeof r.body.token === 'string' && r.body.token.length > 20);
    eq('and the account', r.body.user.email, 'ana@example.com');
    eq('with the display name', r.body.user.name, 'Ana Silva');

    const record = store[`accounts/${accounts.uidFor('ana@example.com')}`];
    check('the account was written', !!record, JSON.stringify(Object.keys(store)));
    check('the stored record has no plaintext password',
        !JSON.stringify(record).includes('a good password'), JSON.stringify(record));
    check('the response never carries the hash',
        !JSON.stringify(r.body).includes('scrypt'), JSON.stringify(r.body));

    r = await call('../api/auth/signup.js', {
        body: { email: 'ana@example.com', password: 'another password' },
    });
    eq('a second signup for the same address is refused', r.status, 409);
    eq('and says to sign in instead', r.body.error.code, 'email_taken');

    r = await call('../api/auth/signup.js', { body: { email: 'b@c.com', password: 'short' } });
    eq('a weak password is refused at signup', r.status, 400);

    r = await call('../api/auth/signup.js', { body: { email: 'not-an-address', password: 'a good password' } });
    eq('a bad address is refused at signup', r.status, 400);

    // No display name: derived from the address rather than left blank.
    r = await call('../api/auth/signup.js', { body: { email: 'solo@example.com', password: 'a good password' } });
    eq('a nameless signup still gets a name', r.body.user.name, 'solo');

    /* ---- login ---------------------------------------------------- */

    r = await call('../api/auth/login.js', { body: { email: 'ana@example.com', password: 'a good password' } });
    eq('the right password signs in', r.status, 200);
    eq('as the same account', r.body.user.uid, accounts.uidFor('ana@example.com'));
    check('with a working token', !!load('../api/_lib/session.js').verify(r.body.token));

    // Case and spacing in the address must not matter.
    r = await call('../api/auth/login.js', { body: { email: '  ANA@example.com ', password: 'a good password' } });
    eq('the address is matched case-insensitively', r.status, 200);

    r = await call('../api/auth/login.js', { body: { email: 'ana@example.com', password: 'wrong' } });
    eq('a wrong password is refused', r.status, 401);
    const wrongPassword = r.body.error;

    r = await call('../api/auth/login.js', { body: { email: 'nobody@example.com', password: 'wrong' } });
    eq('an unknown address is refused', r.status, 401);
    // The load-bearing one: this endpoint must not be a way to ask
    // whether someone has an account here.
    eq('with the SAME code as a wrong password', r.body.error.code, wrongPassword.code);
    eq('and the same message', r.body.error.message, wrongPassword.message);

    /* ---- rate limiting -------------------------------------------- */

    const login = load('../api/auth/login.js');
    const rate = require('../api/_lib/ratelimit.js');
    rate._reset();
    const attempt = async (ip, password) => {
        let status = 0;
        const res = { statusCode: 0, setHeader() { }, end() { status = this.statusCode; } };
        await login({
            method: 'POST', headers: { 'x-forwarded-for': ip }, socket: {},
            body: { email: 'ana@example.com', password },
        }, res);
        return status;
    };
    let blocked = 0;
    for (let i = 0; i < 14; i++) if (await attempt('9.9.9.9', 'guess' + i) === 429) blocked++;
    check('a guessing run is cut off', blocked > 0, `${blocked} of 14 refused`);
    eq('and the correct password is refused too while it lasts — the account is what is limited',
        await attempt('8.8.8.8', 'a good password'), 429);

    /* ---- /me ------------------------------------------------------ */

    rate._reset();
    r = await call('../api/auth/login.js', { body: { email: 'ana@example.com', password: 'a good password' } });
    const good = r.body.token;

    r = await call('../api/auth/me.js', { method: 'GET', headers: { authorization: `Bearer ${good}` } });
    eq('me returns the signed-in user', r.status, 200);
    eq('by uid', r.body.user.uid, accounts.uidFor('ana@example.com'));

    r = await call('../api/auth/me.js', { method: 'GET', headers: {} });
    eq('me without a token is 401', r.status, 401);

    r = await call('../api/auth/me.js', { method: 'GET', headers: { authorization: 'Bearer nonsense' } });
    eq('me with a forged token is 401', r.status, 401);

    /* ---- a deployment with no storage ------------------------------ */

    const NO_STORAGE = { AUTH_SIGNING_SECRET: 'test-signing-secret' };
    r = await call('../api/auth/signup.js', { body: { email: 'a@b.com', password: 'a good password' } }, NO_STORAGE);
    eq('signup without storage fails as configuration', r.status, 503);
    eq('and says so', r.body.error.code, 'not_configured');

    // No secret at all: nothing can be signed, so nothing pretends to work.
    r = await call('../api/auth/login.js', { body: { email: 'a@b.com', password: 'a good password' } }, {});
    eq('login with nothing configured is 503', r.status, 503);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
