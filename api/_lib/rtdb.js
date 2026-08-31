/* ============================================================
   Coach API — storage
   ------------------------------------------------------------
   Thin REST wrapper over the Firebase Realtime Database, used only
   from the server. The credential it carries bypasses the security
   rules — that is the point: /coach is closed to the world in the
   rules, and only this code can open it.

   The credential itself comes from _lib/firebase-auth.js, which
   accepts either a service account (current) or the legacy database
   secret, so this file does not care which one a deployment has.

   Paths are always built from a verified uid, never from request
   input, so a caller cannot walk out of their own subtree.
   ============================================================ */
'use strict';

const { authorize, hasCredential, CREDENTIAL_VAR } = require('./firebase-auth.js');

const DB_URL = () => (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');

class StorageError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
    }
}

/** True when the server is configured to persist anything at all. */
function isConfigured() {
    return !!(DB_URL() && hasCredential());
}

// Firebase keys cannot contain . $ # [ ] / or control characters.
// uids come from the WCA (letters and digits), but encode defensively
// rather than trusting that to stay true.
function safeSegment(seg) {
    const s = String(seg);
    if (!/^[A-Za-z0-9_-]+$/.test(s)) {
        throw new StorageError('bad_path', 'Unsafe storage path segment.');
    }
    return s;
}

function url(path, query) {
    if (!isConfigured()) {
        throw new StorageError('not_configured',
            'Cloud sync is not configured on this deployment.');
    }
    const clean = path.split('/').filter(Boolean).map(safeSegment).join('/');
    return `${DB_URL()}/${clean}.json${query ? `?${query}` : ''}`;
}

async function request(path, method, body) {
    const auth = await authorize();
    if (auth.kind === 'service_account_failed') {
        // Configured but unusable — a wrong or mangled key. Distinct from
        // "not configured", and from a rules refusal, because the fix is
        // different for each.
        console.error(`[rtdb] ${CREDENTIAL_VAR} is set but could not be used`);
        throw new StorageError('denied', 'Storage rejected the request.');
    }
    const target = url(path, auth.query);
    const headers = Object.assign({}, auth.headers);
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(target, {
            method,
            headers: Object.keys(headers).length ? headers : undefined,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
    } catch (e) {
        throw new StorageError('unreachable', 'Storage is temporarily unreachable.');
    }
    if (!res.ok) {
        // 401 here means the secret is wrong or the rules changed —
        // an operator problem, so make it loud in the logs.
        if (res.status === 401 || res.status === 403) {
            console.error(`[rtdb] auth rejected — check ${CREDENTIAL_VAR} and the /coach rules`);
            throw new StorageError('denied', 'Storage rejected the request.');
        }
        throw new StorageError('http_' + res.status, `Storage returned ${res.status}.`);
    }
    if (method === 'DELETE') return null;
    const text = await res.text();
    if (!text || text === 'null') return null;
    try { return JSON.parse(text); } catch (e) {
        throw new StorageError('malformed', 'Storage returned an unreadable response.');
    }
}

const get = (path) => request(path, 'GET');
const set = (path, value) => request(path, 'PUT', value);
const patch = (path, value) => request(path, 'PATCH', value);
const push = (path, value) => request(path, 'POST', value);
const del = (path) => request(path, 'DELETE');

/** Root for one user's coaching data. Everything else hangs off this. */
const coachPath = (uid, ...rest) => ['coach', uid, ...rest].join('/');

module.exports = { get, set, patch, push, del, coachPath, isConfigured, StorageError };
