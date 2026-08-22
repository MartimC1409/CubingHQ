/* ============================================================
   Who is calling, from either sign-in
   ------------------------------------------------------------
   Two things now issue a bearer token a request can carry: our own
   session (email accounts, api/_lib/session.js) and a WCA access
   token (OAuth sign-in, verified by api/_lib/auth.js against the
   WCA API). Every endpoint that requires SOME sign-in but does not
   care which one shares this instead of re-deriving it — battle room
   creation first, friends and groups after it.

   Ours is tried first because it verifies locally with an HMAC; a WCA
   token costs a round trip and is only reached when the header is not
   one of ours.
   ============================================================ */
'use strict';

const session = require('./session.js');
const { requireUser } = require('./auth.js');

function bad(status, code, message) {
    const err = new Error(message);
    err.status = status; err.code = code;
    return err;
}

/**
 * @param messages override the two user-facing strings, since "sign in
 *        to create a battle room" and "sign in to add a friend" are
 *        both true but only one is right for a given endpoint.
 * @returns {uid, name, email, wcaId}
 */
async function resolveSignedInUser(req, messages = {}) {
    const required = messages.required || 'Sign in first.';
    const unavailable = messages.unavailable
        || "Couldn't check your sign-in just now. Try again shortly.";

    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
    if (!match) throw bad(401, 'sign_in_required', required);

    const token = match[1].trim();
    const ours = session.verify(token);
    if (ours) return { uid: ours.uid, name: ours.name, email: ours.email, wcaId: ours.wcaId };

    try {
        const wca = await requireUser(req);
        return { uid: wca.uid, name: wca.name, email: null, wcaId: wca.wcaId || null };
    } catch (e) {
        // A WCA outage must not read as "your sign-in is invalid" — the
        // person did nothing wrong and retrying is the right advice.
        if (e && e.status === 503) throw bad(503, 'sign_in_unavailable', unavailable);
        throw bad(401, 'sign_in_required', required);
    }
}

module.exports = { resolveSignedInUser };
