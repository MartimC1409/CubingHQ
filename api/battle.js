/* ============================================================
   POST /api/battle   — the battle rooms database gateway
   GET  /api/battle   — what is configured, for diagnosis

   The browser used to talk to the Realtime Database directly. It no
   longer can: anonymous writes are refused once /battle is locked in
   the rules, and the credential that would unlock them must never be
   shipped to a browser. app.js therefore sends every battle read and
   write here as { method, path, data } and this relays it.

   This file is the missing half of that change. Without it every call
   landed on a route that does not exist, so creating a room failed with
   a 404 that looked exactly like a database refusal — the reported
   symptom, "rooms cannot be created", with nothing in the database to
   explain it.

   What it is not: an open proxy. The path is checked against the two
   battle subtrees and every segment against Firebase's key rules, so a
   caller cannot walk into /coach or anywhere else; the method must be
   one of the five REST verbs; and the payload is size- and shape-
   checked before it is relayed.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody } = require('./_lib/http.js');
const { authorize, hasCredential, CREDENTIAL_VAR } = require('./_lib/firebase-auth.js');

// The public instance the site has always used. A deployment can point
// somewhere else with FIREBASE_DB_URL; it does not have to, because a
// gateway that needs configuration before it works at all would just
// move the outage rather than end it.
const DEFAULT_DB_URL = 'https://simulatecubing-default-rtdb.firebaseio.com';
const DB_URL = (process.env.FIREBASE_DB_URL || DEFAULT_DB_URL).replace(/\/$/, '');

const METHODS = ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'];

// Only these two subtrees, and only below them. Room ids, user ids,
// event ids and scramble indexes are all path segments underneath.
const ROOTS = [['battle', 'rooms'], ['battle_chats']];

// A room carries its scrambles, members and every solve, so it is the
// largest thing written here; 256KB is far above any real one and far
// below anything worth storing in a lobby.
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_DEPTH = 12;

/* ----- Write limits ---------------------------------------------
   The credential this gateway holds bypasses the database rules, so
   the rules can no longer be what stops someone hammering it. These
   are the client's own guards restated where a client cannot skip
   them: app.js already refuses more than one room every 30s, but
   that check lives in the browser.

   Per instance and in memory, which is the honest description — a
   platform running several instances multiplies these. That is fine
   for what they are for: making a flood cost something, not gating
   correctness. Reads are not limited; the lobby polls every 4s. */
const WRITE_LIMIT = { max: 120, windowMs: 60 * 1000 };
const CREATE_LIMIT = { max: 6, windowMs: 60 * 1000 };
const buckets = new Map();

function clientIp(req) {
    const fwd = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    const first = String(fwd || '').split(',')[0].trim();
    return first || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit(key, limit) {
    const now = Date.now();
    // Bounded so a spray of forged addresses cannot grow this without
    // limit; the oldest entry goes, and the worst case is a limiter that
    // forgets someone, which is the failure mode to prefer here.
    if (buckets.size > 5000) buckets.delete(buckets.keys().next().value);

    const hits = (buckets.get(key) || []).filter(t => now - t < limit.windowMs);
    if (hits.length >= limit.max) {
        buckets.set(key, hits);
        return false;
    }
    hits.push(now);
    buckets.set(key, hits);
    return true;
}

function bad(status, code, message) {
    const err = new Error(message);
    err.status = status; err.code = code;
    return err;
}

/**
 * Splits a client path into segments, or throws.
 *
 * Firebase keys cannot contain . $ # [ ] / or control characters, and a
 * segment that could contain a slash or a dot is how a proxy gets walked
 * out of its subtree — so the allowed set is narrower than Firebase's
 * own: exactly what the battle paths actually use.
 */
function segmentsOf(path) {
    if (typeof path !== 'string' || !path) {
        throw bad(400, 'bad_path', 'That request did not name a database path.');
    }
    if (path.includes('?') || path.includes('#') || path.includes('..')) {
        throw bad(400, 'bad_path', 'That database path is not allowed.');
    }
    const segs = path.split('/').filter(Boolean);
    if (!segs.length || segs.length > 10) {
        throw bad(400, 'bad_path', 'That database path is not allowed.');
    }
    for (const s of segs) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(s)) {
            throw bad(400, 'bad_path', 'That database path is not allowed.');
        }
    }
    return segs;
}

/** True when `segs` sits at or below one of the permitted roots. */
function withinRoots(segs) {
    return ROOTS.some(root => root.every((r, i) => segs[i] === r));
}

/**
 * Rejects payloads that are not plain data.
 *
 * Firebase stores whatever JSON it is given, so the guard here is against
 * shape rather than content: no unbounded nesting, no keys that Firebase
 * would reject anyway, and nothing bigger than a room.
 */
function checkPayload(data, depth = 0) {
    if (depth > MAX_DEPTH) {
        throw bad(400, 'bad_body', 'That request was nested too deeply.');
    }
    if (data === null || typeof data === 'string'
        || typeof data === 'boolean' || typeof data === 'number') return;
    if (Array.isArray(data)) {
        data.forEach(v => checkPayload(v, depth + 1));
        return;
    }
    if (typeof data === 'object') {
        for (const key of Object.keys(data)) {
            if (!/^[^.$#[\]/\x00-\x1f\x7f]{1,192}$/.test(key)) {
                throw bad(400, 'bad_body', 'That request contained a key the database cannot store.');
            }
            checkPayload(data[key], depth + 1);
        }
        return;
    }
    throw bad(400, 'bad_body', 'That request contained a value the database cannot store.');
}

/**
 * Relays one call to the database.
 *
 * The status is passed through rather than flattened, because the client
 * distinguishes a refusal (401/403 — a server setting, where "try again"
 * is actively wrong advice) from anything transient.
 */
async function relay(method, segs, data) {
    const auth = await authorize();
    if (auth.kind === 'service_account_failed') {
        throw bad(503, 'not_configured',
            'The rooms database is not reachable from the server right now.');
    }
    if (auth.kind === 'none') {
        // Not fatal: the rules may still allow this. It is, however, the
        // most likely cause of a 401 below, so leave the breadcrumb.
        console.warn(`[battle] no ${CREDENTIAL_VAR} configured — calling the database `
            + 'unauthenticated, which its rules may refuse');
    }

    const url = `${DB_URL}/${segs.join('/')}.json${auth.query ? `?${auth.query}` : ''}`;
    const headers = Object.assign({}, auth.headers);
    if (data !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(url, {
            method,
            headers: Object.keys(headers).length ? headers : undefined,
            body: data === undefined ? undefined : JSON.stringify(data),
            signal: AbortSignal.timeout(15000),
        });
    } catch (e) {
        console.error(`[battle] ${method} /${segs.join('/')} → unreachable:`, e.message);
        throw bad(504, 'unreachable', 'The rooms database is temporarily unreachable.');
    }

    const text = await res.text().catch(() => '');

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            console.error(`[battle] ${method} /${segs.join('/')} → denied by the database rules `
                + `(auth: ${auth.kind}). Check ${CREDENTIAL_VAR} and that the /battle rules `
                + 'match the deployment.');
            throw bad(403, 'denied', 'The rooms database refused this request.');
        }
        console.error(`[battle] ${method} /${segs.join('/')} → HTTP ${res.status} ${text.slice(0, 200)}`);
        throw bad(502, 'db_error', 'The rooms database could not complete that request.');
    }

    // DELETE answers `null`, and a missing node answers `null` too. Both
    // are valid JSON and the client reads null as "nothing there".
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) {
        console.error(`[battle] ${method} /${segs.join('/')} → unreadable response`);
        throw bad(502, 'db_error', 'The rooms database returned an unreadable response.');
    }
}

/**
 * GET is a health check, not a read.
 *
 * The client only ever POSTs. This exists because the failure it
 * diagnoses — a credential added without a redeploy, or a database URL
 * pointing somewhere else — is invisible from the browser, and every
 * round of guessing at it costs a deploy. Presence only: never a
 * credential, never a fragment of one, and never the database host.
 */
function health(res) {
    const configured = hasCredential();
    sendJson(res, 200, {
        ok: true,
        hasCredential: configured,
        credentialVar: CREDENTIAL_VAR,
        usingDefaultDbUrl: !process.env.FIREBASE_DB_URL,
        diagnosis: configured
            ? 'A database credential is configured. If rooms still fail, the logs '
              + 'will carry a "[battle]" line naming what the database said.'
            : `${CREDENTIAL_VAR} is not set, so the database is called unauthenticated. `
              + 'That works only while the /battle rules allow anonymous writes. Set it in '
              + 'the project settings, then REDEPLOY — environment variables are read at boot.',
    });
}

async function handler(req, res) {
    if (req.method === 'GET') return health(res);
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return sendJson(res, 405, { error: { code: 'method', message: 'Method not allowed.' } });
    }

    try {
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw bad(400, 'bad_body', 'That request was not shaped like a database call.');
        }
        const method = String(body.method || 'GET').toUpperCase();
        if (!METHODS.includes(method)) {
            throw bad(400, 'bad_method', 'That database method is not allowed.');
        }

        const segs = segmentsOf(body.path);
        if (!withinRoots(segs)) {
            throw bad(403, 'forbidden_path', 'That database path is not allowed.');
        }

        if (method !== 'GET') {
            const ip = clientIp(req);
            const isCreate = method === 'POST' && segs.join('/') === 'battle/rooms';
            const ok = rateLimit(`w:${ip}`, WRITE_LIMIT)
                && (!isCreate || rateLimit(`c:${ip}`, CREATE_LIMIT));
            if (!ok) {
                throw bad(429, 'rate_limited',
                    'That is a lot of requests at once — give it a minute.');
            }
        }

        let data = body.data;
        if (method === 'GET' || method === 'DELETE') {
            data = undefined;   // a body here would be ignored; drop it rather than relay it
        } else {
            if (data === undefined) {
                throw bad(400, 'bad_body', 'That request carried nothing to write.');
            }
            const encoded = Buffer.byteLength(JSON.stringify(data) || '', 'utf8');
            if (encoded > MAX_PAYLOAD_BYTES) {
                throw bad(413, 'too_large', 'That room is too large to save.');
            }
            checkPayload(data);
        }

        const result = await relay(method, segs, data);
        sendJson(res, 200, result === undefined ? null : result);
    } catch (err) {
        sendError(res, err);
    }
}

module.exports = handler;
/** Test seam: forgets every rate-limit bucket. */
module.exports._resetLimits = () => buckets.clear();
