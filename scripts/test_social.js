/* Tests friends, friend requests and groups.

   The database here is a real tree — get/set/patch/del/push against a
   nested object, not a flat map of exact paths — because social.js
   reads whole subtrees (`friends/<uid>`, `friend_requests/<uid>`,
   `accounts/<uid>/group_ids`) and a flat stub would answer every one
   of those with null. That gap does not show up anywhere else in the
   test suite, because nothing before this feature ever read a subtree.

   Two things are load-bearing enough to get their own section:

     1. sending a friend request by email must never reveal whether
        that address has an account — the same rule login.js already
        keeps, extended to a second endpoint that could otherwise
        answer the same question one guess at a time; and
     2. group membership is an authorization boundary. Only a member
        can see a group, only the owner can add or evict someone, and
        the owner cannot leave their own group into an ownerless state.

   Run: node scripts/test_social.js */

'use strict';

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const MODULES = ['../api/social/[action].js', '../api/_lib/social.js',
    '../api/_lib/identity.js', '../api/_lib/accounts.js', '../api/_lib/session.js',
    '../api/_lib/auth.js', '../api/_lib/rtdb.js', '../api/_lib/firebase-auth.js',
    '../api/_lib/ratelimit.js', '../api/_lib/http.js'];

const ENV = {
    FIREBASE_DB_URL: 'https://db.example.com',
    FIREBASE_DB_SECRET: 'legacy-secret',
    AUTH_SIGNING_SECRET: 'test-signing-secret',
};

/** A real tree, because social.js reads subtrees the flat stub cannot answer. */
function makeTree() {
    let root = {};
    const segs = (p) => String(p).split('/').filter(Boolean);

    function getAt(path) {
        let node = root;
        for (const s of segs(path)) {
            if (node === null || typeof node !== 'object') return null;
            node = node[s];
        }
        if (node === undefined || node === null) return null;
        if (typeof node === 'object' && Object.keys(node).length === 0) return null;
        return node;
    }
    function setAt(path, value) {
        const parts = segs(path);
        if (!parts.length) { root = value && typeof value === 'object' ? value : {}; return; }
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const s = parts[i];
            if (typeof node[s] !== 'object' || node[s] === null) node[s] = {};
            node = node[s];
        }
        const leaf = parts[parts.length - 1];
        if (value === null || value === undefined) delete node[leaf];
        else node[leaf] = value;
    }
    function patchAt(path, value) {
        const existing = getAt(path);
        setAt(path, Object.assign({}, existing || {}, value));
    }
    return { getAt, setAt, patchAt, reset: () => { root = {}; } };
}

let tree = makeTree();
let pushCounter = 0;

function installFetch() {
    tree = makeTree();
    pushCounter = 0;
    global.fetch = async (url, opts = {}) => {
        const path = decodeURIComponent(String(url).split('/.json')[0])
            .replace('https://db.example.com/', '').split('.json')[0];
        const method = opts.method || 'GET';
        if (method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify(tree.getAt(path)) };
        }
        const body = opts.body ? JSON.parse(opts.body) : undefined;
        if (method === 'PUT') tree.setAt(path, body);
        if (method === 'PATCH') tree.patchAt(path, body);
        if (method === 'DELETE') tree.setAt(path, null);
        if (method === 'POST') {
            const id = `-Npush${pushCounter++}`;
            tree.setAt(`${path}/${id}`, body);
            return { ok: true, status: 200, text: async () => JSON.stringify({ name: id }) };
        }
        return { ok: true, status: 200, text: async () => JSON.stringify(body === undefined ? null : body) };
    };
}

function load(env = ENV) {
    for (const k of ['FIREBASE_DB_URL', 'FIREBASE_DB_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON',
        'AUTH_SIGNING_SECRET']) delete process.env[k];
    Object.assign(process.env, env);
    for (const m of MODULES) delete require.cache[require.resolve(m)];
    const handler = require('../api/social/[action].js');
    require('../api/_lib/ratelimit.js')._reset();
    return handler;
}

async function call(handler, req) {
    let status = 0, payload = null;
    const res = {
        statusCode: 0, setHeader() { },
        end(b) { payload = b ? JSON.parse(b) : null; status = this.statusCode; },
    };
    const empty = { [Symbol.asyncIterator]: async function* () { } };
    await handler(Object.assign({ method: 'POST', headers: {}, socket: {} }, empty, req), res);
    return { status, body: payload };
}

/** Creates a real account (through the real signup path) and returns a session bearer. */
async function makeUser(handler, email, name) {
    const accounts = require('../api/_lib/accounts.js');
    const session = require('../api/_lib/session.js');
    const user = await accounts.create({ email, password: 'a good password', name });
    const token = session.issue(user);
    return { uid: user.uid, name: user.name, headers: { authorization: `Bearer ${token}` } };
}

async function post(handler, url, user, body) {
    return call(handler, { url, headers: user.headers, body });
}
async function get(handler, url, user) {
    return call(handler, { url, method: 'GET', headers: user.headers });
}

(async () => {
    installFetch();
    let h = load();
    const ana = await makeUser(h, 'ana@example.com', 'Ana Silva');
    const bruno = await makeUser(h, 'bruno@example.com', 'Bruno Costa');
    const carla = await makeUser(h, 'carla@example.com', 'Carla Dias');

    /* ---- sending a request: anti-enumeration ------------------------ */

    let r = await post(h, '/api/social/request', ana, { identifier: 'nobody@example.com' });
    eq('a request to an unregistered email still says sent', r.status, 200);
    eq('with the same shape as success', r.body.sent, true);

    r = await post(h, '/api/social/request', ana, { identifier: 'bruno@example.com' });
    eq('a request to a real account looks identical', r.status, 200);
    eq('sent, from the outside, either way', r.body.sent, true);

    // The only difference is on disk, never in the response.
    check('the real request actually exists', !!tree.getAt(`friend_requests/${bruno.uid}/${ana.uid}`));
    check('the fake one left nothing behind',
        Object.keys(tree.getAt('friend_requests') || {}).every(uid =>
            !tree.getAt(`friend_requests/${uid}`) || Object.keys(tree.getAt(`friend_requests/${uid}`)).length <= 1));

    r = await post(h, '/api/social/request', ana, { identifier: 'ana@example.com' });
    eq('a request to yourself is refused', r.status, 400);
    eq('and named, since you already know it is your own address', r.body.error.code, 'self_request');

    // A WCA ID is public information; saying nobody has claimed it is not
    // the same kind of leak as an email would be.
    r = await post(h, '/api/social/request', ana, { identifier: '2016NOBO01' });
    eq('an unclaimed WCA ID says so plainly', r.status, 404);
    eq('by name', r.body.error.code, 'no_such_account');

    r = await post(h, '/api/social/request', ana, { identifier: 'not an address' });
    eq('a malformed identifier is refused', r.status, 400);

    /* ---- accepting -------------------------------------------------- */

    r = await get(h, '/api/social/list', bruno);
    eq('bruno sees the incoming request', r.body.incoming.length, 1);
    eq('naming ana', r.body.incoming[0].uid, ana.uid);

    r = await post(h, '/api/social/accept', bruno, { fromUid: 'acct_doesnotexist000000' });
    eq('accepting a request that was never sent is refused', r.status, 404);

    r = await post(h, '/api/social/accept', bruno, { fromUid: ana.uid });
    eq('accepting the real one succeeds', r.status, 200);

    check('the edge exists both ways',
        !!tree.getAt(`friends/${ana.uid}/${bruno.uid}`) && !!tree.getAt(`friends/${bruno.uid}/${ana.uid}`));
    check('and the request is cleared on both sides',
        !tree.getAt(`friend_requests/${bruno.uid}/${ana.uid}`)
        && !tree.getAt(`accounts/${ana.uid}/outgoing_requests/${bruno.uid}`));

    r = await get(h, '/api/social/list', ana);
    eq('ana now has one friend', r.body.friends.length, 1);
    eq('bruno', r.body.friends[0].uid, bruno.uid);
    eq('and no leftover request shows up for someone already a friend', r.body.outgoing.length, 0);

    /* ---- crossed requests auto-accept -------------------------------- */

    r = await post(h, '/api/social/request', carla, { identifier: 'ana@example.com' });
    eq('carla asks ana', r.status, 200);
    r = await post(h, '/api/social/request', ana, { identifier: 'carla@example.com' });
    eq('ana asking back becomes an acceptance, not a second pending request', r.body.becameFriends, true);
    check('and they are friends without either side clicking accept',
        !!tree.getAt(`friends/${ana.uid}/${carla.uid}`));

    /* ---- idempotency: repeats are not punished ----------------------- */

    r = await post(h, '/api/social/request', ana, { identifier: 'bruno@example.com' });
    eq('asking an existing friend again is a harmless no-op', r.status, 200);
    r = await post(h, '/api/social/decline', bruno, { uid: 'acct_neverexisted00000000' });
    eq('declining nothing does not error', r.status, 200);

    /* ---- removing a friend -------------------------------------------- */

    r = await post(h, '/api/social/remove-friend', ana, { uid: bruno.uid });
    eq('removing succeeds', r.status, 200);
    check('both edges are gone',
        !tree.getAt(`friends/${ana.uid}/${bruno.uid}`) && !tree.getAt(`friends/${bruno.uid}/${ana.uid}`));

    // Re-friend for the group tests below.
    await post(h, '/api/social/request', ana, { identifier: 'bruno@example.com' });
    await post(h, '/api/social/accept', bruno, { fromUid: ana.uid });

    /* ---- groups: membership is drawn from friends only ---------------- */

    const dani = await makeUser(h, 'dani@example.com', 'Dani Pereira');   // never friended

    r = await post(h, '/api/social/create-group', ana, { name: 'Weekend crew', memberUids: [dani.uid] });
    eq('a stranger cannot be put in a group', r.status, 400);
    eq('for that reason specifically', r.body.error.code, 'not_a_friend');

    r = await post(h, '/api/social/create-group', ana, {
        name: 'Weekend crew', memberUids: [bruno.uid, carla.uid],
    });
    eq('a group of real friends is created', r.status, 200);
    const groupId = r.body.groupId;
    eq('with the owner in it too', Object.keys(r.body.members).length, 3);

    r = await get(h, '/api/social/list-groups', bruno);
    eq('a member sees it in their own list', r.body.groups.length, 1);
    eq('by id', r.body.groups[0].groupId, groupId);

    r = await get(h, '/api/social/list-groups', dani);
    eq('a non-member sees no groups', r.body.groups.length, 0);

    /* ---- groups: viewing is a membership boundary ---------------------- */

    r = await get(h, `/api/social/group?id=${groupId}`, bruno);
    eq('a member can open the group', r.status, 200);

    r = await get(h, `/api/social/group?id=${groupId}`, dani);
    eq('a non-member cannot', r.status, 404);
    eq('indistinguishable from a group that does not exist', r.body.error.code, 'no_such_group');

    r = await get(h, '/api/social/group?id=not-a-real-id', ana);
    eq('a nonexistent id answers the same way', r.status, 404);

    /* ---- groups: only the owner manages membership ---------------------- */

    // dani is not a member yet, and not everyone's friend — but is
    // bruno's friend for this next check.
    await post(h, '/api/social/request', bruno, { identifier: 'dani@example.com' });
    await post(h, '/api/social/accept', dani, { fromUid: bruno.uid });

    r = await post(h, '/api/social/add-to-group', bruno, { groupId, memberUid: dani.uid });
    eq('a non-owner member cannot add anyone, even their own friend', r.status, 403);
    eq('and is told why', r.body.error.code, 'not_owner');

    r = await post(h, '/api/social/add-to-group', ana, { groupId, memberUid: dani.uid });
    eq('the owner can, once dani is THEIR friend too', r.status, 400,
        'dani is not yet a friend of ana specifically');

    await post(h, '/api/social/request', ana, { identifier: 'dani@example.com' });
    await post(h, '/api/social/accept', dani, { fromUid: ana.uid });
    r = await post(h, '/api/social/add-to-group', ana, { groupId, memberUid: dani.uid });
    eq('now the owner can add her', r.status, 200);

    r = await post(h, '/api/social/remove-from-group', carla, { groupId, memberUid: bruno.uid });
    eq('a non-owner member cannot evict someone else', r.status, 403);

    r = await post(h, '/api/social/remove-from-group', carla, { groupId });
    eq('but can remove themselves — leaving is not the same permission', r.status, 200);

    r = await get(h, `/api/social/group?id=${groupId}`, carla);
    eq('and immediately loses access to it', r.status, 404);

    r = await post(h, '/api/social/remove-from-group', ana, { groupId, memberUid: ana.uid });
    eq('the owner cannot leave their own group', r.status, 400);
    eq('there is a group to delete instead', r.body.error.code, 'owner_cannot_leave');

    r = await post(h, '/api/social/delete-group', bruno, { groupId });
    eq('a non-owner cannot delete it', r.status, 403);

    r = await post(h, '/api/social/delete-group', ana, { groupId });
    eq('the owner can', r.status, 200);
    check('and every remaining member loses it from their own list',
        !tree.getAt(`accounts/${bruno.uid}/group_ids/${groupId}`)
        && !tree.getAt(`accounts/${dani.uid}/group_ids/${groupId}`));

    /* ---- a WCA-only sign-in gets an account row on first use ---------- */

    installFetch();
    h = load();
    const wcaMe = { id: 77, wca_id: '2019SOLO01', name: 'Solo Cuber' };
    const savedFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (String(url).includes('worldcubeassociation.org')) {
            return { ok: true, status: 200, json: async () => ({ me: wcaMe }) };
        }
        return savedFetch(url, opts);
    };
    const wcaUser = { headers: { authorization: 'Bearer wca-access-token' } };
    r = await get(h, '/api/social/list', wcaUser);
    eq('a bare WCA sign-in reaches the friends list at all', r.status, 200);
    eq('with nothing in it yet', r.body.friends.length, 0);
    check('and now has a stand-in account row',
        !!tree.getAt('accounts/wca_2019SOLO01'));
    eq('carrying the name the WCA gave',
        tree.getAt('accounts/wca_2019SOLO01').name, 'Solo Cuber');
    check('marked as provisional', tree.getAt('accounts/wca_2019SOLO01').provisional === true);

    /* ---- signed-in requirement ----------------------------------------- */

    installFetch();
    h = load();
    r = await call(h, { url: '/api/social/list', method: 'GET', headers: {} });
    eq('no session at all is refused', r.status, 401);

    r = await call(h, { url: '/api/social/request', body: { identifier: 'x@y.com' } });
    eq('and applies to every action', r.status, 401);

    /* ---- method enforcement per action --------------------------------- */

    installFetch();
    h = load();
    const zoe = await makeUser(h, 'zoe@example.com', 'Zoe');
    r = await call(h, { url: '/api/social/list', method: 'POST', headers: zoe.headers, body: {} });
    eq('a read-only action refuses POST', r.status, 405);
    r = await call(h, { url: '/api/social/accept', method: 'GET', headers: zoe.headers });
    eq('a write action refuses GET', r.status, 405);
    r = await call(h, { url: '/api/social/nonsense', headers: zoe.headers, body: {} });
    eq('an unknown action is 404', r.status, 404);

    /* ---- rate limiting on requests, specifically -------------------------- */

    installFetch();
    h = load();
    const flooder = await makeUser(h, 'flooder@example.com', 'Flooder');
    let limited = 0;
    for (let i = 0; i < 25; i++) {
        const rr = await post(h, '/api/social/request', flooder, { identifier: `person${i}@example.com` });
        if (rr.status === 429) limited++;
    }
    check('a burst of requests is eventually cut off', limited > 0, `${limited} of 25 refused`);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
