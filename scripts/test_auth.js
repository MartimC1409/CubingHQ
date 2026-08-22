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

const MODULES = ['../api/auth/_signup.js', '../api/auth/_login.js', '../api/auth/_me.js',
    '../api/auth/_link-wca.js', '../api/auth/_unlink-wca.js', '../api/auth/_avatar.js',
    '../api/_lib/auth.js',
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
        // DELETE was missing, so anything removed stayed in the stub and
        // an unlinked WCA id looked permanently taken.
        if (method === 'DELETE') delete store[path];
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
    let r = await call('../api/auth/_signup.js', {
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

    r = await call('../api/auth/_signup.js', {
        body: { email: 'ana@example.com', password: 'another password' },
    });
    eq('a second signup for the same address is refused', r.status, 409);
    eq('and says to sign in instead', r.body.error.code, 'email_taken');

    r = await call('../api/auth/_signup.js', { body: { email: 'b@c.com', password: 'short' } });
    eq('a weak password is refused at signup', r.status, 400);

    r = await call('../api/auth/_signup.js', { body: { email: 'not-an-address', password: 'a good password' } });
    eq('a bad address is refused at signup', r.status, 400);

    // No display name: derived from the address rather than left blank.
    r = await call('../api/auth/_signup.js', { body: { email: 'solo@example.com', password: 'a good password' } });
    eq('a nameless signup still gets a name', r.body.user.name, 'solo');

    /* ---- login ---------------------------------------------------- */

    r = await call('../api/auth/_login.js', { body: { email: 'ana@example.com', password: 'a good password' } });
    eq('the right password signs in', r.status, 200);
    eq('as the same account', r.body.user.uid, accounts.uidFor('ana@example.com'));
    check('with a working token', !!load('../api/_lib/session.js').verify(r.body.token));

    // Case and spacing in the address must not matter.
    r = await call('../api/auth/_login.js', { body: { email: '  ANA@example.com ', password: 'a good password' } });
    eq('the address is matched case-insensitively', r.status, 200);

    r = await call('../api/auth/_login.js', { body: { email: 'ana@example.com', password: 'wrong' } });
    eq('a wrong password is refused', r.status, 401);
    const wrongPassword = r.body.error;

    r = await call('../api/auth/_login.js', { body: { email: 'nobody@example.com', password: 'wrong' } });
    eq('an unknown address is refused', r.status, 401);
    // The load-bearing one: this endpoint must not be a way to ask
    // whether someone has an account here.
    eq('with the SAME code as a wrong password', r.body.error.code, wrongPassword.code);
    eq('and the same message', r.body.error.message, wrongPassword.message);

    /* ---- rate limiting -------------------------------------------- */

    const login = load('../api/auth/_login.js');
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
    r = await call('../api/auth/_login.js', { body: { email: 'ana@example.com', password: 'a good password' } });
    const good = r.body.token;

    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: `Bearer ${good}` } });
    eq('me returns the signed-in user', r.status, 200);
    eq('by uid', r.body.user.uid, accounts.uidFor('ana@example.com'));

    r = await call('../api/auth/_me.js', { method: 'GET', headers: {} });
    eq('me without a token is 401', r.status, 401);

    r = await call('../api/auth/_me.js', { method: 'GET', headers: { authorization: 'Bearer nonsense' } });
    eq('me with a forged token is 401', r.status, 401);

    /* ---- linking a WCA account ------------------------------------ */

    // Two identities have to be proven, and neither may come from the
    // request: the session says which account, the WCA says which
    // competitor. A caller who could name a WCA ID could claim someone
    // else's competition record.

    const WCA_TOKENS = {
        'wca-ana': { id: 11, wca_id: '2016ANAA01', name: 'Ana Silva' },
        'wca-bruno': { id: 22, wca_id: '2018BRUN02', name: 'Bruno Costa' },
        'wca-newcomer': { id: 33, wca_id: null, name: 'No Results Yet' },
    };

    function installWcaFetch() {
        const db = global.fetch;
        global.fetch = async (url, opts = {}) => {
            const u = String(url);
            if (!u.includes('worldcubeassociation.org')) return db(url, opts);
            const bearer = String((opts.headers && opts.headers.Authorization) || '')
                .replace(/^Bearer /, '');
            const me = WCA_TOKENS[bearer];
            if (!me) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
            return { ok: true, status: 200, json: async () => ({ me }) };
        };
    }

    store = {}; writes = []; installFetch(); installWcaFetch();
    rate._reset();

    // Two accounts to link from.
    r = await call('../api/auth/_signup.js', { body: { email: 'ana@example.com', password: 'a good password' } });
    const anaToken = r.body.token;
    const anaUid = r.body.user.uid;
    r = await call('../api/auth/_signup.js', { body: { email: 'bruno@example.com', password: 'a good password' } });
    const brunoToken = r.body.token;

    // installFetch is reinstalled by nothing here, but load() re-requires
    // the modules, so re-apply the WCA layer before each group.
    installWcaFetch();

    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { wcaToken: 'wca-ana' },
    });
    eq('linking succeeds', r.status, 200);
    eq('and reports the linked id', r.body.user.wcaId, '2016ANAA01');
    check('handing back a new session token', typeof r.body.token === 'string');

    const linkedSession = load('../api/_lib/session.js').verify(r.body.token);
    eq('the new token knows about the link', linkedSession.wcaId, '2016ANAA01');
    eq('and is still the same account', linkedSession.uid, anaUid);

    eq('the link is stored on the account', store[`accounts/${anaUid}`].wcaId, '2016ANAA01');
    eq('and indexed by WCA id', store['wca_links/2016ANAA01'], anaUid);

    // The rule that matters: one WCA account, one CubingHQ account.
    // Without it two accounts would present the same competition record
    // AND be the same player in a battle room.
    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${brunoToken}` }, body: { wcaToken: 'wca-ana' },
    });
    eq('a second account cannot claim the same WCA account', r.status, 409);
    eq('and is told why', r.body.error.code, 'wca_taken');

    // Re-linking the same one is a no-op, so a retry is not punished.
    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { wcaToken: 'wca-ana' },
    });
    eq('re-linking the same account is fine', r.status, 200);

    // Switching to a different one needs an explicit unlink first.
    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { wcaToken: 'wca-bruno' },
    });
    eq('switching WCA accounts is refused', r.status, 409);
    eq('and says to unlink first', r.body.error.code, 'already_linked');

    /* ---- neither identity can be asserted ------------------------- */

    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: {}, body: { wcaToken: 'wca-bruno' },
    });
    eq('linking without a session is refused', r.status, 401);

    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${brunoToken}` }, body: { wcaToken: 'not-a-wca-token' },
    });
    eq('a WCA token the WCA does not know is refused', r.status, 401);
    eq('and says which side failed', r.body.error.code, 'bad_wca_token');

    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${brunoToken}` }, body: { wcaId: '2016ANAA01' },
    });
    eq('naming a WCA ID without a token proves nothing', r.status, 400);
    eq('and is refused for that reason', r.body.error.code, 'no_wca_token');
    check('and nothing was written for it',
        store['wca_links/2016ANAA01'] === anaUid, JSON.stringify(store['wca_links/2016ANAA01']));

    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${brunoToken}` }, body: { wcaToken: 'wca-newcomer' },
    });
    eq('a WCA account with no WCA ID yet cannot be linked', r.status, 400);
    eq('and is told what to do about it', r.body.error.code, 'no_wca_id');

    /* ---- unlinking ------------------------------------------------- */

    installWcaFetch();
    r = await call('../api/auth/_unlink-wca.js', { headers: { authorization: `Bearer ${anaToken}` } });
    eq('unlinking succeeds', r.status, 200);
    eq('and the account no longer carries an id', r.body.user.wcaId, null);
    eq('the new token agrees',
        load('../api/_lib/session.js').verify(r.body.token).wcaId, null);
    check('the index entry is gone', !store['wca_links/2016ANAA01'],
        JSON.stringify(store['wca_links/2016ANAA01']));
    check('but the account itself is untouched',
        store[`accounts/${anaUid}`].email === 'ana@example.com'
        && !!store[`accounts/${anaUid}`].password);

    // And now the WCA account is free for someone else.
    installWcaFetch();
    r = await call('../api/auth/_link-wca.js', {
        headers: { authorization: `Bearer ${brunoToken}` }, body: { wcaToken: 'wca-ana' },
    });
    eq('a freed WCA account can be claimed again', r.status, 200);

    installWcaFetch();
    r = await call('../api/auth/_unlink-wca.js', { headers: {} });
    eq('unlinking without a session is refused', r.status, 401);

    // Unlinking when nothing is linked is not an error — the end state
    // the caller asked for is the state they get.
    installWcaFetch();
    r = await call('../api/auth/_unlink-wca.js', { headers: { authorization: `Bearer ${anaToken}` } });
    eq('unlinking an unlinked account is a no-op, not a failure', r.status, 200);

    /* ---- the profile picture -------------------------------------- */

    // An email account had no picture and fell back to the WCA's grey
    // silhouette — a stock image of nobody, fetched from someone else's
    // server. It can upload one now, which means this endpoint decides
    // what counts as a picture, and that value is later written into
    // other people's pages.

    const jpeg = (bytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02]) =>
        'data:image/jpeg;base64,' + Buffer.from(bytes).toString('base64');

    installWcaFetch();
    r = await call('../api/auth/_avatar.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { avatar: jpeg() },
    });
    eq('a picture is accepted', r.status, 200);
    check('and stored on the account', String(store[`accounts/${anaUid}`].avatar).startsWith('data:image/jpeg'),
        String(store[`accounts/${anaUid}`].avatar).slice(0, 40));

    // The one that matters: an SVG is a document, and a document can
    // carry script. It is an image by MIME type and not by nature.
    installWcaFetch();
    r = await call('../api/auth/_avatar.js', {
        headers: { authorization: `Bearer ${anaToken}` },
        body: { avatar: 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64') },
    });
    eq('an SVG is refused', r.status, 400);
    eq('as a bad picture', r.body.error.code, 'bad_avatar');

    for (const [what, value] of [
        ['a remote URL', 'https://example.com/me.png'],
        ['a javascript: URL', 'javascript:alert(1)'],
        ['an HTML data URI', 'data:text/html;base64,' + Buffer.from('<script>').toString('base64')],
        ['a PNG that is not a PNG', 'data:image/png;base64,' + Buffer.from([1, 2, 3, 4]).toString('base64')],
        ['an empty image', 'data:image/jpeg;base64,'],
    ]) {
        installWcaFetch();
        r = await call('../api/auth/_avatar.js', {
            headers: { authorization: `Bearer ${anaToken}` }, body: { avatar: value },
        });
        eq(`${what} is refused`, r.status, 400);
    }

    installWcaFetch();
    r = await call('../api/auth/_avatar.js', {
        headers: { authorization: `Bearer ${anaToken}` },
        body: { avatar: jpeg(new Array(120 * 1024).fill(0xFF).map((v, i) => (i < 3 ? [0xFF, 0xD8, 0xFF][i] : v))) },
    });
    eq('an oversized picture is refused', r.status, 400);

    installWcaFetch();
    r = await call('../api/auth/_avatar.js', { headers: {}, body: { avatar: jpeg() } });
    eq('a picture without a session is refused', r.status, 401);

    // Clearing is the only way back to no picture, so it must work.
    installWcaFetch();
    r = await call('../api/auth/_avatar.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { avatar: null },
    });
    eq('a picture can be removed', r.status, 200);
    eq('and the account carries none', r.body.user.avatar, null);

    /* ---- /me carries the profile, not just the token --------------- */

    installWcaFetch();
    await call('../api/auth/_avatar.js', {
        headers: { authorization: `Bearer ${anaToken}` }, body: { avatar: jpeg() },
    });
    installWcaFetch();
    r = await call('../api/auth/_me.js', {
        method: 'GET', headers: { authorization: `Bearer ${anaToken}` },
    });
    eq('me still answers', r.status, 200);
    check('with the picture, which is not in the token',
        String(r.body.user.avatar || '').startsWith('data:image/jpeg'),
        String(r.body.user.avatar).slice(0, 40));
    check('and the token itself never carries one',
        !String(anaToken).includes('data:image'),
        'a picture in a token would travel on every request');

    // Storage failing must not sign anybody out: the token is the
    // authority on WHO they are, the record only on what they look like.
    const savedFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (String(url).includes('worldcubeassociation.org')) return savedFetch(url, opts);
        throw new Error('storage down');
    };
    r = await call('../api/auth/_me.js', {
        method: 'GET', headers: { authorization: `Bearer ${anaToken}` },
    });
    eq('me survives storage being down', r.status, 200);
    eq('still naming the right account', r.body.user.uid, anaUid);
    global.fetch = savedFetch;

    /* ---- a deployment with no storage ------------------------------ */

    const NO_STORAGE = { AUTH_SIGNING_SECRET: 'test-signing-secret' };
    r = await call('../api/auth/_signup.js', { body: { email: 'a@b.com', password: 'a good password' } }, NO_STORAGE);
    eq('signup without storage fails as configuration', r.status, 503);
    eq('and says so', r.body.error.code, 'not_configured');

    // No secret at all: nothing can be signed, so nothing pretends to work.
    r = await call('../api/auth/_login.js', { body: { email: 'a@b.com', password: 'a good password' } }, {});
    eq('login with nothing configured is 503', r.status, 503);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
