/* Tests /api/battle — the gateway the battle rooms write through.

   The bug this covers: app.js sends every battle read and write to
   /api/battle, and that route did not exist. Creating a room therefore
   hit a 404 that the client could only report as a generic failure,
   which is the "rooms cannot be created" symptom.

   So the first assertion is the one that would have caught it — a create
   reaches the database and comes back with the pushed id — and the rest
   are about the gateway not becoming an open door to the database while
   holding a credential that bypasses its rules.

   Run: node scripts/test_battle_gateway.js */

'use strict';

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const MODULES = ['../api/battle.js', '../api/_lib/firebase-auth.js', '../api/_lib/http.js',
    '../api/_lib/session.js', '../api/_lib/auth.js', '../api/_lib/ratelimit.js'];
const ENV_KEYS = ['FIREBASE_DB_URL', 'FIREBASE_DB_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON',
    'AUTH_SIGNING_SECRET'];

const DB = 'https://db.example.com';

/** Every outbound request, so the relay can be asserted exactly. */
let sent = [];

function installFetch({ status = 200, body = '{"name":"-NroomId"}', token = 'ya29.test' } = {}) {
    sent = [];
    global.fetch = async (url, opts = {}) => {
        const u = String(url);
        sent.push({ url: u, method: opts.method, headers: opts.headers || {}, body: opts.body });

        if (u.includes('oauth2.googleapis.com')) {
            return {
                ok: true, status: 200,
                text: async () => JSON.stringify({ access_token: token, expires_in: 3600 }),
            };
        }
        // The WCA, for the other kind of sign-in the gateway accepts.
        // It answers 401 to a token it does not know, which is what makes
        // "any string in an Authorization header" not a sign-in.
        if (u.includes('worldcubeassociation.org')) {
            const bearer = String((opts.headers && opts.headers.Authorization) || '');
            if (bearer !== 'Bearer wca-access-token') {
                return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
            }
            return {
                ok: true, status: 200,
                json: async () => ({ me: { id: 42, wca_id: '2019TEST01', name: 'Test Cuber' } }),
            };
        }
        return { ok: status >= 200 && status < 300, status, text: async () => body };
    };
}

function load(env) {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, env);
    for (const m of MODULES) delete require.cache[require.resolve(m)];
    const handler = require('../api/battle.js');
    handler._resetLimits();
    return handler;
}

/** Drives the handler and returns { status, body }. */
async function call(env, req) {
    const handler = load(env);
    let status = 0, payload = null;
    const res = {
        statusCode: 0,
        setHeader() { },
        end(b) { payload = b ? JSON.parse(b) : null; status = this.statusCode; },
    };
    await handler(Object.assign({ method: 'POST', headers: {}, socket: {} }, req), res);
    return { status, body: payload };
}

const SECRET_ENV = {
    FIREBASE_DB_URL: DB,
    FIREBASE_DB_SECRET: 'legacy-secret',
    AUTH_SIGNING_SECRET: 'test-signing-secret',
};

/**
 * Creating a room requires an account, so almost every call below
 * carries one. Built with the real session library under the same
 * secret the handler will verify with.
 */
function signedIn(name = 'Ana') {
    delete require.cache[require.resolve('../api/_lib/session.js')];
    Object.assign(process.env, SECRET_ENV);
    const token = require('../api/_lib/session.js').issue({ uid: 'acct_abc', name });
    return { authorization: `Bearer ${token}` };
}
const AUTH = signedIn();

// A throwaway key, generated here rather than checked in, so the service
// account path is exercised for real: the JWT is actually signed.
const { generateKeyPairSync } = require('crypto');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SERVICE_ACCOUNT = JSON.stringify({
    type: 'service_account',
    client_email: 'battle@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

const room = {
    name: 'Test room', isPrivate: false, password: null,
    host: 'g_abc', hostName: 'Guest', event: '3x3',
    currentScrambleIndex: 0,
    scrambles: { 0: { scramble: "R U R' U'", event: '3x3', createdAt: 1 } },
    createdAt: 1, updatedAt: 1,
    members: { g_abc: { name: 'Guest', joinedAt: 1 } },
    solves: {},
};

(async () => {
    /* ---- the reported failure ------------------------------------ */

    installFetch();
    let r = await call(SECRET_ENV, { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('creating a room succeeds', r.status, 200);
    eq('and returns the pushed id', r.body.name, '-NroomId');
    eq('one call reaches the database', sent.length, 1);
    eq('as a POST', sent[0].method, 'POST');
    check('to the room path', sent[0].url.startsWith(`${DB}/battle/rooms.json`), sent[0].url);
    check('carrying the room', JSON.parse(sent[0].body).name === 'Test room');

    /* ---- creating a room requires an account --------------------- */

    // The rule the user asked for: rooms belong to someone. Everything
    // else about a battle stays open, so a room a signed-in person opens
    // is still somewhere a guest can play.

    installFetch();
    r = await call(SECRET_ENV, { body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('a guest cannot create a room', r.status, 401);
    eq('and is told to sign in', r.body.error.code, 'sign_in_required');
    eq('the database is never touched', sent.length, 0);

    for (const header of ['', 'Bearer', 'Bearer ', 'Basic abc', 'Bearer not-a-token',
        'Bearer v1.eyJ1aWQiOiJhY2N0X2ZvcmdlZCJ9.no-signature']) {
        installFetch();
        r = await call(SECRET_ENV, {
            headers: { authorization: header },
            body: { method: 'POST', path: '/battle/rooms', data: room },
        });
        eq(`${JSON.stringify(header)} does not create a room`, r.status, 401);
        // Only database calls count — a malformed bearer may cost one
        // question to the WCA, which is the point of checking ours first.
        eq('and never reaches the database',
            sent.filter(x => x.url.startsWith(DB)).length, 0);
    }

    // A token signed with someone else's secret is not a sign-in here.
    delete require.cache[require.resolve('../api/_lib/session.js')];
    Object.assign(process.env, { AUTH_SIGNING_SECRET: 'a different secret' });
    const foreign = require('../api/_lib/session.js').issue({ uid: 'acct_abc', name: 'Mallory' });
    installFetch();
    r = await call(SECRET_ENV, {
        headers: { authorization: `Bearer ${foreign}` },
        body: { method: 'POST', path: '/battle/rooms', data: room },
    });
    eq('a token signed elsewhere is refused', r.status, 401);

    // The other sign-in: a WCA access token, verified against the WCA.
    installFetch();
    r = await call(SECRET_ENV, {
        headers: { authorization: 'Bearer wca-access-token' },
        body: { method: 'POST', path: '/battle/rooms', data: room },
    });
    eq('a WCA sign-in creates a room too', r.status, 200);
    check('by asking the WCA who it is',
        sent.some(x => x.url.includes('worldcubeassociation.org')));

    // And our own token must not cost a WCA round trip.
    installFetch();
    r = await call(SECRET_ENV, { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('an account sign-in creates a room', r.status, 200);
    check('without asking the WCA anything',
        !sent.some(x => x.url.includes('worldcubeassociation.org')));

    // Everything that is NOT room creation stays open to guests.
    const GUEST_OK = [
        ['GET', '/battle/rooms'],
        ['GET', '/battle/rooms/-NroomId'],
        ['PATCH', '/battle/rooms/-NroomId/members/g_abc'],
        ['PUT', '/battle/rooms/-NroomId/solves/3x3/0/g_abc'],
        ['DELETE', '/battle/rooms/-NroomId/members/g_abc'],
        ['POST', '/battle_chats/-NroomId'],
    ];
    for (const [method, path] of GUEST_OK) {
        installFetch({ body: 'null' });
        const payload = { method, path };
        if (method !== 'GET' && method !== 'DELETE') payload.data = { t: 1 };
        r = await call(SECRET_ENV, { body: payload });
        eq(`a guest may still ${method} ${path}`, r.status, 200);
    }

    /* ---- the rest of the client's calls -------------------------- */

    installFetch({ body: 'null' });
    r = await call(SECRET_ENV, { body: { method: 'GET', path: '/battle/rooms' } });
    eq('an empty lobby is 200, not an error', r.status, 200);
    eq('and reads as null', r.body, null);
    check('a GET sends no body', sent[0].body === undefined);

    installFetch({ body: 'null' });
    r = await call(SECRET_ENV, {
        body: { method: 'PATCH', path: '/battle/rooms/-NroomId/members/g_abc', data: { name: 'Guest' } },
    });
    eq('joining a room succeeds', r.status, 200);
    eq('as a PATCH', sent[0].method, 'PATCH');

    installFetch({ body: 'null' });
    r = await call(SECRET_ENV, { body: { method: 'DELETE', path: '/battle/rooms/-NroomId' } });
    eq('leaving a room succeeds', r.status, 200);
    eq('as a DELETE', sent[0].method, 'DELETE');

    installFetch({ body: '{"name":"-NmsgId"}' });
    r = await call(SECRET_ENV, {
        body: { method: 'POST', path: '/battle_chats/-NroomId', data: { text: 'hi', timestamp: 1 } },
    });
    eq('chat needs no account — guests can talk', r.status, 200);

    /* ---- credentials --------------------------------------------- */

    installFetch();
    r = await call(SECRET_ENV, { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    check('the legacy secret goes in the query', sent[0].url.includes('auth=legacy-secret'), sent[0].url);

    installFetch();
    r = await call({ FIREBASE_DB_URL: DB, FIREBASE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT,
        AUTH_SIGNING_SECRET: 'test-signing-secret' },
        { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('a service account works', r.status, 200);
    const dbCall = sent.find(s => s.url.startsWith(DB));
    check('the token is a header, not a URL', !!dbCall.headers.Authorization
        && dbCall.headers.Authorization.startsWith('Bearer ya29.'), JSON.stringify(dbCall.headers));
    check('and never appears in the URL', !dbCall.url.includes('ya29.'), dbCall.url);
    check('the JWT was minted', sent.some(s => s.url.includes('oauth2.googleapis.com')));

    // Base64 is accepted because a JSON blob with newlines survives some
    // dashboards badly.
    installFetch();
    r = await call({
        FIREBASE_DB_URL: DB,
        FIREBASE_SERVICE_ACCOUNT_JSON: Buffer.from(SERVICE_ACCOUNT).toString('base64'),
        AUTH_SIGNING_SECRET: 'test-signing-secret',
    }, { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('a base64 service account works too', r.status, 200);

    // No credential at all: still relayed, because a deployment whose
    // rules were never locked worked that way from the browser.
    installFetch();
    r = await call({ FIREBASE_DB_URL: DB }, { body: { method: 'GET', path: '/battle/rooms' } });
    eq('no credential still reaches the database', r.status, 200);
    check('unauthenticated', !sent[0].url.includes('auth='), sent[0].url);

    // A configured-but-broken key must not fall back to anonymous: that
    // would hide the real fault behind a permission error.
    installFetch();
    r = await call({ FIREBASE_DB_URL: DB, FIREBASE_SERVICE_ACCOUNT_JSON: '{"client_email":"a@b","private_key":"not a key"}' },
        { body: { method: 'GET', path: '/battle/rooms' } });
    eq('an unusable key fails loudly', r.status, 503);
    eq('and says it is configuration', r.body.error.code, 'not_configured');
    eq('without touching the database', sent.filter(s => s.url.startsWith(DB)).length, 0);

    // With no FIREBASE_DB_URL the site's own instance is the default, so
    // the gateway works on a deployment that sets nothing.
    installFetch({ body: 'null' });
    r = await call({}, { body: { method: 'GET', path: '/battle/rooms' } });
    eq('it defaults to the public instance', r.status, 200);
    check('which is the one app.js has always used',
        sent[0].url.startsWith('https://simulatecubing-default-rtdb.firebaseio.com/'), sent[0].url);

    /* ---- it is not an open proxy --------------------------------- */

    const forbidden = ['/coach/2019TEST01', '/records', '/', '/battle', '/battlex/rooms',
        '/battle/roomsx', '/battle_chatsx/1'];
    for (const path of forbidden) {
        installFetch();
        r = await call(SECRET_ENV, { body: { method: 'GET', path } });
        check(`${path} is refused`, r.status === 400 || r.status === 403, `got ${r.status}`);
        eq(`${path} never reaches the database`, sent.length, 0);
    }

    const malformed = ['/battle/rooms/../coach', '/battle/rooms/a?orderBy="x"',
        '/battle/rooms/a#b', '/battle/rooms/a.b', '/battle/rooms/' + 'a'.repeat(200), 42, null];
    for (const path of malformed) {
        installFetch();
        r = await call(SECRET_ENV, { body: { method: 'GET', path } });
        eq(`${JSON.stringify(path)} is rejected`, r.status, 400);
        eq(`${JSON.stringify(path)} never reaches the database`, sent.length, 0);
    }

    installFetch();
    r = await call(SECRET_ENV, { body: { method: 'HEAD', path: '/battle/rooms' } });
    eq('an unknown method is rejected', r.status, 400);
    eq('and is not relayed', sent.length, 0);

    installFetch();
    r = await call(SECRET_ENV, { method: 'PUT', body: {} });
    eq('the endpoint itself only takes GET and POST', r.status, 405);

    // A JSON body that is not an object at all. `null` arrives as a
    // stream because that is how a platform delivers a raw body it did
    // not parse into anything.
    for (const body of ['null', '"a string"', '[1,2,3]']) {
        installFetch();
        r = await call(SECRET_ENV, {
            [Symbol.asyncIterator]: async function* () { yield Buffer.from(body); },
        });
        eq(`a body of ${body} is refused`, r.status, 400);
        eq('and is not relayed', sent.length, 0);
    }

    installFetch();
    r = await call(SECRET_ENV, {
        [Symbol.asyncIterator]: async function* () { yield Buffer.from('{ not json'); },
    });
    eq('an unparseable body is refused', r.status, 400);

    /* ---- payload guards ------------------------------------------ */

    installFetch();
    r = await call(SECRET_ENV, {
        body: { method: 'PUT', path: '/battle/rooms/-NroomId', data: { x: 'y'.repeat(300 * 1024) } },
    });
    eq('an oversized write is refused', r.status, 413);
    eq('and is not relayed', sent.length, 0);

    let deep = 'leaf';
    for (let i = 0; i < 20; i++) deep = { down: deep };
    installFetch();
    r = await call(SECRET_ENV, { body: { method: 'PUT', path: '/battle/rooms/-NroomId', data: deep } });
    eq('an absurdly nested write is refused', r.status, 400);

    installFetch();
    r = await call(SECRET_ENV, {
        body: { method: 'PUT', path: '/battle/rooms/-NroomId', data: { 'a/b': 1 } },
    });
    eq('a key the database cannot store is refused', r.status, 400);
    eq('and is not relayed', sent.length, 0);

    installFetch();
    r = await call(SECRET_ENV, { body: { method: 'PUT', path: '/battle/rooms/-NroomId' } });
    eq('a write with nothing to write is refused', r.status, 400);

    /* ---- what the database says comes through --------------------- */

    // The client keys off this: 'denied' is a server setting, and telling
    // someone to try again is then actively wrong advice.
    installFetch({ status: 401, body: '{"error":"Permission denied"}' });
    r = await call(SECRET_ENV, { headers: AUTH, body: { method: 'POST', path: '/battle/rooms', data: room } });
    eq('a refusal stays a refusal', r.status, 403);
    eq('with its own code', r.body.error.code, 'denied');
    check('and no database wording leaks into the message',
        !/permission denied/i.test(r.body.error.message), r.body.error.message);

    installFetch({ status: 500, body: 'boom' });
    r = await call(SECRET_ENV, { body: { method: 'GET', path: '/battle/rooms' } });
    eq('a database error is a gateway error', r.status, 502);

    installFetch();
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
    r = await call(SECRET_ENV, { body: { method: 'GET', path: '/battle/rooms' } });
    eq('an unreachable database is a timeout', r.status, 504);

    /* ---- rate limiting ------------------------------------------- */

    installFetch();
    const handler = load(SECRET_ENV);
    const drive = async (body, ip) => {
        let status = 0;
        const res = { statusCode: 0, setHeader() { }, end() { status = this.statusCode; } };
        await handler({
            method: 'POST', socket: {}, body,
            headers: Object.assign({ 'x-forwarded-for': ip }, AUTH),
        }, res);
        return status;
    };

    let limited = 0;
    for (let i = 0; i < 12; i++) {
        if (await drive({ method: 'POST', path: '/battle/rooms', data: room }, '1.2.3.4') === 429) limited++;
    }
    check('a flood of rooms is cut off', limited > 0, `${limited} of 12 refused`);
    eq('a different address is unaffected',
        await drive({ method: 'POST', path: '/battle/rooms', data: room }, '5.6.7.8'), 200);
    eq('and reads are never limited',
        await drive({ method: 'GET', path: '/battle/rooms' }, '1.2.3.4'), 200);

    /* ---- client and gateway, end to end --------------------------- */

    // The two halves are written in different files and only meet in a
    // browser, which is exactly how they got out of step: app.js started
    // posting to /api/battle while /api/battle did not exist. So run the
    // REAL helpers out of app.js against the REAL handler, with only the
    // database stubbed. A path app.js sends that the gateway refuses, or
    // a shape the gateway returns that app.js reads as a failure, fails
    // here rather than in production.
    const fs = require('fs');
    const vm = require('vm');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
    const start = src.indexOf('    let fbLastError = null;');
    const endMark = "    function fbDelete(path)       { return fbRequest('DELETE', path); }";
    const helpers = src.slice(start, src.indexOf(endMark) + endMark.length);
    check('the helpers were found in app.js', start > -1 && helpers.length > 200);

    const gateway = load(SECRET_ENV);
    let dbCalls = [];

    /** Stands in for the browser: /api/battle runs the real handler. */
    async function browserFetch(url, opts = {}) {
        const u = String(url);
        if (u !== '/api/battle') throw new Error(`unexpected direct call: ${u}`);
        let status = 0, payload = '';
        const res = {
            statusCode: 0, setHeader() { },
            end(b) { payload = b || ''; status = this.statusCode; },
        };
        await gateway({
            method: 'POST', socket: {},
            // Relayed, not dropped: the Authorization header the client
            // attaches is the whole basis of the room-creation gate.
            headers: Object.assign({}, opts.headers || {},
                opts.headers && opts.headers.Authorization
                    ? { authorization: opts.headers.Authorization } : {}),
            body: JSON.parse(opts.body),
        }, res);
        return {
            ok: status >= 200 && status < 300, status,
            json: async () => JSON.parse(payload),
            text: async () => payload,
        };
    }

    function client() {
        const ctx = {
            RTDB: DB,
            console: { error() { }, warn() { }, log() { } },
            JSON, Error, Object, Date, Promise, fetch: browserFetch,
            // app.js attaches this to every battle call; creating a room
            // is refused without it.
            authToken: () => AUTH.authorization.replace(/^Bearer /, ''),
        };
        vm.runInNewContext(helpers + '\nthis.api = { fbGet, fbSet, fbUpdate, fbPush, fbDelete, fbError };',
            ctx, { filename: 'app.js:fb' });
        return ctx.api;
    }

    // The database, as far as the gateway is concerned.
    global.fetch = async (url, opts = {}) => {
        const u = String(url);
        if (u.includes('oauth2.googleapis.com')) {
            return { ok: true, status: 200, text: async () => '{"access_token":"t","expires_in":3600}' };
        }
        dbCalls.push({ url: u, method: opts.method });
        if (opts.method === 'POST') return { ok: true, status: 200, text: async () => '{"name":"-Nreal"}' };
        if (opts.method === 'GET') return { ok: true, status: 200, text: async () => JSON.stringify({ '-Nreal': room }) };
        return { ok: true, status: 200, text: async () => 'null' };
    };

    let api = client();
    gateway._resetLimits();
    dbCalls = [];

    const created = await api.fbPush('/battle/rooms', room);
    check('end to end: the client gets a room id back', !!created && created.name === '-Nreal',
        JSON.stringify(created));
    eq('and records no failure', api.fbError(), null);
    eq('one write reached the database', dbCalls.length, 1);

    // The gate, through the real client: no token, no room.
    const anon = (() => {
        const ctx = {
            RTDB: DB, console: { error() { }, warn() { }, log() { } },
            JSON, Error, Object, Date, Promise, fetch: browserFetch,
            authToken: () => null,
        };
        vm.runInNewContext(helpers + '\nthis.api = { fbGet, fbSet, fbUpdate, fbPush, fbDelete, fbError };',
            ctx, { filename: 'app.js:fb' });
        return ctx.api;
    })();
    gateway._resetLimits();
    eq('end to end: a guest cannot create a room',
        await anon.fbPush('/battle/rooms', room), null);
    eq('and the client calls it a refusal, not a retry', anon.fbError(), 'denied');
    check('a guest can still read the lobby', (await anon.fbGet('/battle/rooms')) !== null);
    check('and still send chat', !!(await anon.fbPush('/battle_chats/-Nreal', { text: 'hi' })));

    api = client();
    const lobby = await api.fbGet('/battle/rooms');
    check('end to end: the lobby reads back the room', !!lobby && !!lobby['-Nreal'],
        JSON.stringify(lobby));

    // Every path app.js actually sends, in one pass — a divergence
    // between the client's routing and the gateway's allowlist shows up
    // as a null here rather than as a broken room in production.
    const CLIENT_PATHS = [
        ['GET', '/battle/rooms/-Nreal'],
        ['PUT', '/battle/rooms/-Nreal/scrambles/1'],
        ['PATCH', '/battle/rooms/-Nreal'],
        ['PATCH', '/battle/rooms/-Nreal/members/wca_2019TEST01'],
        ['PUT', '/battle/rooms/-Nreal/solves/3x3/0/g_abc'],
        ['DELETE', '/battle/rooms/-Nreal/members/g_abc'],
        ['GET', '/battle/rooms/-Nreal/members'],
        ['DELETE', '/battle/rooms/-Nreal'],
        ['GET', '/battle_chats/-Nreal'],
        ['POST', '/battle_chats/-Nreal'],
    ];
    for (const [method, path] of CLIENT_PATHS) {
        api = client();
        const verb = { GET: 'fbGet', PUT: 'fbSet', PATCH: 'fbUpdate', POST: 'fbPush', DELETE: 'fbDelete' }[method];
        const args = (method === 'GET' || method === 'DELETE') ? [path] : [path, { t: 1 }];
        await api[verb](...args);
        eq(`${method} ${path} is accepted end to end`, api.fbError(), null);
    }

    /* ---- the health view ------------------------------------------ */

    installFetch();
    r = await call(SECRET_ENV, { method: 'GET' });
    eq('GET reports configuration', r.status, 200);
    eq('and sees the credential', r.body.hasCredential, true);
    const serialised = JSON.stringify(r.body);
    check('without disclosing it', !serialised.includes('legacy-secret'), serialised);
    check('or the database host', !serialised.includes('db.example.com'), serialised);
    check('naming the variable to set', serialised.includes('FIREBASE_SERVICE_ACCOUNT_JSON'));

    r = await call({}, { method: 'GET' });
    eq('and says when nothing is configured', r.body.hasCredential, false);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
