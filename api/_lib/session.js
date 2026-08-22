/* ============================================================
   Sign-in sessions
   ------------------------------------------------------------
   A signed, self-contained session token. Serverless functions
   remember nothing between requests, so the alternative — a session
   row looked up on every call — is a database round trip per request
   for something an HMAC answers locally.

   The token is `v1.<payload>.<signature>`, where the payload is
   readable base64url JSON. That is deliberate: it carries a uid, a
   display name and an expiry, and none of those are secrets. What it
   does not carry is anything a holder could edit, because the
   signature is over the exact payload bytes and the key never leaves
   the server.

   It is a bearer token, so whoever holds it is the user. It expires,
   and there is no revocation list — signing out forgets it on the
   client, which is the honest limit of this design.
   ============================================================ */
'use strict';

const crypto = require('crypto');

const TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
const VERSION = 'v1';

/**
 * Signing key.
 *
 * Derived from a server-only secret rather than adding one more thing
 * to configure and forget. A dedicated AUTH_SIGNING_SECRET wins when
 * set; otherwise the database credential stands in, since accounts
 * cannot be stored without one anyway. It is a derivation, not the
 * secret itself: HMAC output never reveals its input, and the label
 * keeps this use separate from any other.
 */
function signingKey() {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
    const secret = process.env.AUTH_SIGNING_SECRET
        || process.env.FIREBASE_DB_SECRET
        || sa;
    if (!secret) {
        const e = new Error('Accounts are not set up on this deployment yet.');
        e.status = 503; e.code = 'not_configured';
        throw e;
    }
    return crypto.createHmac('sha256', String(secret))
        .update('cubinghq:session:v1')
        .digest();
}

function sign(payload) {
    return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

/**
 * A token for this user.
 * @param user { uid, email, name, wcaId?, passwordChangedAt? }
 *
 * `wcaId` is present once an account has linked a WCA account. It is
 * carried here so the rest of the server can see the link without a
 * database read, and re-issued on every sign-in — which is also why
 * linking hands back a new token rather than editing the old one: a
 * signed token cannot be amended, only replaced.
 *
 * `passwordChangedAt`, likewise, is what lets a token be recognised as
 * stale after a password reset — see the note on `pwv` below.
 */
function issue(user, now = Date.now()) {
    const claims = {
        uid: user.uid,
        email: user.email || null,
        name: user.name || 'Cuber',
        wcaId: user.wcaId || null,
        // Named short and separately from passwordChangedAt on purpose:
        // this is a version stamp compared for equality, not a time to
        // be read or reasoned about, and giving it its own name stops
        // a future change from quietly starting to treat it as one.
        pwv: user.passwordChangedAt || 0,
        exp: now + TTL_MS,
    };
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    return `${VERSION}.${payload}.${sign(payload)}`;
}

/**
 * The claims inside a token, or null if it is not one of ours.
 *
 * Null rather than throwing, because the battle gateway asks "is this
 * one of our sessions?" about tokens that are legitimately something
 * else — a WCA access token, most often — and that is not an error.
 */
function verify(token, now = Date.now()) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts[0] !== VERSION || !parts[1] || !parts[2]) return null;

    const [, payload, provided] = parts;

    let expected;
    try { expected = sign(payload); } catch (e) { return null; }

    // Constant time: a fast reject leaks how much of a guess was right.
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let claims;
    try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return null; }
    if (!claims || typeof claims.uid !== 'string' || !claims.uid) return null;
    if (!Number.isFinite(claims.exp) || claims.exp < now) return null;

    return {
        uid: claims.uid,
        email: claims.email || null,
        name: claims.name || 'Cuber',
        wcaId: claims.wcaId || null,
        pwv: Number.isFinite(claims.pwv) ? claims.pwv : 0,
    };
}

/**
 * Whether a session predates the account's current password.
 *
 * verify() alone cannot know this — checking would mean a database
 * read on every call, which is the whole cost this design exists to
 * avoid. So it stays a signature-and-expiry check everywhere, and
 * THIS function exists for the few call sites that already touch the
 * account row anyway (today: only /api/auth/me) and can compare for
 * free. A token from before a reset then stops working the next time
 * that endpoint is asked — not instantly everywhere, which would need
 * the database read this design does not make.
 */
function isStaleAfterPasswordChange(claims, accountPasswordChangedAt) {
    const current = accountPasswordChangedAt || 0;
    return current > 0 && (claims.pwv || 0) !== current;
}

/** True when a session could be signed at all. */
function isConfigured() {
    try { signingKey(); return true; } catch (e) { return false; }
}

module.exports = { issue, verify, isConfigured, isStaleAfterPasswordChange, TTL_MS };
