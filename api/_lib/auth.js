/* ============================================================
   Coach API — identity
   ------------------------------------------------------------
   The rest of the site derives a user id client-side and trusts it.
   That is fine for a public leaderboard and not fine for private
   coaching data, so every /api/coach/* request is verified here:
   the caller's WCA access token is checked against the WCA API and
   the user id is derived from WHAT WCA SAYS, never from the request.

   This is not a full auth system — a stolen bearer token is still a
   valid bearer token — but it does mean one user cannot read another
   user's coaching data by editing a string in devtools.
   ============================================================ */
'use strict';

const WCA_ME = 'https://www.worldcubeassociation.org/api/v0/me';

// Verifying costs a round trip to the WCA API, which would otherwise be
// paid on every keystroke in the chat. Cache per token, briefly.
// Module scope, so it survives warm invocations and vanishes on cold
// ones — exactly the lifetime we want for a credential cache.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();   // token -> { user, expires }

function cacheGet(token) {
    const hit = cache.get(token);
    if (!hit) return null;
    if (Date.now() > hit.expires) { cache.delete(token); return null; }
    return hit.user;
}

function cacheSet(token, user) {
    // Cheap bound: drop the oldest entry rather than growing without limit.
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(token, { user, expires: Date.now() + CACHE_TTL_MS });
}

class AuthError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
        this.code = code;
    }
}

function readBearer(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
    if (!match) {
        throw new AuthError(401, 'no_token',
            'Sign in with your WCA account to sync your coaching data.');
    }
    return match[1].trim();
}

/**
 * A stable id for this account.
 *
 * Prefers the WCA ID because it is the identity the rest of the site
 * already uses (`wca_<id>` in the battle system). Falls back to the WCA
 * account id for users who are signed in but have no competition record
 * yet — they are still a real, verified account.
 */
function deriveUid(me) {
    if (me.wca_id) return 'wca_' + String(me.wca_id).toUpperCase();
    if (me.id) return 'wcauser_' + String(me.id);
    throw new AuthError(401, 'no_identity', 'That WCA account has no usable id.');
}

/**
 * Verifies the request and returns { uid, wcaId, name, accountId }.
 * Throws AuthError, which handlers turn into a JSON error response.
 */
async function requireUser(req) {
    const token = readBearer(req);

    const cached = cacheGet(token);
    if (cached) return cached;

    let res;
    try {
        res = await fetch(WCA_ME, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
        });
    } catch (e) {
        // WCA being unreachable is not the user's fault; say so plainly
        // and let the client fall back to local-only mode.
        throw new AuthError(503, 'wca_unreachable',
            "Couldn't reach the WCA to verify your sign-in. Your data is safe locally — try again shortly.");
    }

    if (res.status === 401 || res.status === 403) {
        throw new AuthError(401, 'invalid_token',
            'Your WCA sign-in has expired. Sign in again to keep syncing.');
    }
    if (!res.ok) {
        throw new AuthError(503, 'wca_error', 'The WCA API returned an error. Try again shortly.');
    }

    let body;
    try { body = await res.json(); } catch (e) {
        throw new AuthError(503, 'wca_error', 'The WCA API returned an unreadable response.');
    }

    const me = body && body.me;
    if (!me) throw new AuthError(401, 'invalid_token', 'That sign-in is not valid.');

    const user = {
        uid: deriveUid(me),
        wcaId: me.wca_id || null,
        accountId: me.id || null,
        name: me.name || 'Cuber',
    };
    cacheSet(token, user);
    return user;
}

module.exports = { requireUser, AuthError, deriveUid, _cache: cache };
