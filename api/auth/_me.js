/* ============================================================
   GET /api/auth/me   (Authorization: Bearer <session token>)

   Who the caller is, or 401.

   The client calls this once on load to turn a stored token back into
   a signed-in state — and to find out that a token has expired at a
   moment when it can say so quietly, rather than when the person is
   halfway through creating a battle room.
   ============================================================ */
'use strict';

const { sendJson, sendError, methodGuard } = require('../_lib/http.js');
const session = require('../_lib/session.js');
const accounts = require('../_lib/accounts.js');

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['GET'])) return;

    try {
        const header = req.headers.authorization || req.headers.Authorization || '';
        const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
        const user = match && session.verify(match[1].trim());
        if (!user) {
            const e = new Error('Your sign-in has expired. Sign in again.');
            e.status = 401; e.code = 'invalid_session';
            throw e;
        }
        // The token is the authority on WHO this is. The record is the
        // authority on what they look like — a picture cannot live in a
        // token that travels on every request. If storage cannot answer,
        // the token's own claims still sign the person in; they just see
        // no picture, which is a better failure than being signed out.
        let profile = null;
        try { profile = await accounts.publicProfile(user.uid); } catch (e) {
            console.error('[auth] could not read the profile behind a valid session:', e.message);
        }

        sendJson(res, 200, { user: profile || user });
    } catch (err) {
        sendError(res, err);
    }
};
