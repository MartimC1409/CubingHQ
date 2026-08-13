/* ============================================================
   Coach API — storage
   ------------------------------------------------------------
   Thin REST wrapper over the Firebase Realtime Database, used only
   from the server. The database secret is appended as ?auth=, which
   bypasses the security rules — that is the point: /coach is closed
   to the world in the rules, and only this code can open it.

   Paths are always built from a verified uid, never from request
   input, so a caller cannot walk out of their own subtree.
   ============================================================ */
'use strict';

const DB_URL = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const DB_SECRET = process.env.FIREBASE_DB_SECRET || '';

class StorageError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
    }
}

/** True when the server is configured to persist anything at all. */
function isConfigured() {
    return !!(DB_URL && DB_SECRET);
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

function url(path) {
    if (!isConfigured()) {
        throw new StorageError('not_configured',
            'Cloud sync is not configured on this deployment.');
    }
    const clean = path.split('/').filter(Boolean).map(safeSegment).join('/');
    return `${DB_URL}/${clean}.json?auth=${encodeURIComponent(DB_SECRET)}`;
}

async function request(path, method, body) {
    let res;
    try {
        res = await fetch(url(path), {
            method,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
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
            console.error('[rtdb] auth rejected — check FIREBASE_DB_SECRET and the /coach rules');
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
