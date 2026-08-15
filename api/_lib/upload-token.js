/* ============================================================
   Coach API — signed upload sessions
   ------------------------------------------------------------
   A resumable upload spans many requests, and serverless functions
   remember nothing between them. So the client has to hand the session
   back with every chunk — which, taken at face value, would let anyone
   point this server at a URL of their choosing and have it POST bytes
   there. That is a server-side request forgery, and the fix is not to
   trust the client with the URL at all.

   The session is therefore issued as an opaque token: the URL plus an
   HMAC over it. The client cannot read it, cannot forge one, and has no
   reason to care what is inside.

   Two independent checks, because a single one that is ever bypassed
   should not be enough:

     1. the signature must verify, and
     2. the decoded URL must live on Gemini's upload host.

   The second holds even for a perfectly signed token, so a mistake in
   the signing code cannot widen this into "POST anywhere".
   ============================================================ */
'use strict';

const crypto = require('crypto');

// The only host this server will ever relay an upload to.
const ALLOWED_ORIGIN = 'https://generativelanguage.googleapis.com';

/**
 * Signing key.
 *
 * Derived from a server-only secret rather than adding another variable
 * to configure — one more thing to set is one more thing to forget, and
 * this path already cannot run without the API key. It is a derivation,
 * not the key itself: the HMAC output never reveals the input, and the
 * label keeps this use separate from any other.
 */
function signingKey() {
    const secret = process.env.COACH_SIGNING_SECRET
        || process.env.GEMINI_API_KEY
        || process.env.GOOGLE_API_KEY;
    if (!secret) {
        const e = new Error('The Coach is not configured on this deployment yet.');
        e.status = 503; e.code = 'not_configured';
        throw e;
    }
    return crypto.createHmac('sha256', String(secret))
        .update('cubinghq:video-upload-session:v1')
        .digest();
}

function sign(payload) {
    return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

/** @returns {string} an opaque token the client stores and returns. */
function issue(uploadUrl) {
    const payload = Buffer.from(String(uploadUrl), 'utf8').toString('base64url');
    return `${payload}.${sign(payload)}`;
}

/**
 * Verifies a token and returns the URL inside it.
 * Throws rather than returning null: a bad token is never something to
 * carry on past.
 */
function open(token) {
    const bad = (why) => {
        const e = new Error('That upload session is not valid. Choose the video again.');
        e.status = 400; e.code = 'bad_session';
        console.error(`[upload-token] rejected: ${why}`);
        return e;
    };

    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw bad('malformed');

    const [payload, provided] = parts;
    const expected = sign(payload);

    // Constant time: a fast reject leaks how much of a guess was right.
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw bad('bad signature');

    let url;
    try {
        url = new URL(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (e) { throw bad('unparseable url'); }

    // Independent of the signature on purpose. Even a validly signed
    // token may not aim this server anywhere but Google.
    if (url.origin !== ALLOWED_ORIGIN) throw bad(`origin ${url.origin}`);

    return url.toString();
}

module.exports = { issue, open, ALLOWED_ORIGIN };
