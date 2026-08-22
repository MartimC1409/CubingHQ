/* ============================================================
   POST /api/auth/link-wca

     Authorization: Bearer <session token>     who you are here
     { wcaToken: "<WCA access token>" }        who the WCA says you are

   Attaches a WCA identity to an email account, so someone who signed
   up with an address can still get their competition record, their
   official personal bests and a battle identity that other cubers
   recognise.

   Both sides are verified independently and neither comes from the
   request body beyond the token itself: the session names the account,
   and the WCA names the competitor. A caller cannot claim a WCA ID by
   asserting it — they have to hold a working WCA token for it.

   Answers with a NEW session token. A signed token cannot be amended,
   so the link is published by replacing it; the old one keeps working
   until it expires, and simply does not know about the link.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const { requireUser, AuthError } = require('../_lib/auth.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');
const rate = require('../_lib/ratelimit.js');

// Linking is a once-in-an-account-lifetime act. The limit is here
// because each attempt costs a round trip to the WCA.
const LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function currentSession(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
    const user = match && session.verify(match[1].trim());
    if (!user) {
        const e = new Error('Sign in again to link your WCA account.');
        e.status = 401; e.code = 'invalid_session';
        throw e;
    }
    return user;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const me = currentSession(req);

        if (!rate.take(`link:${me.uid}`, LIMIT)) {
            const e = new Error('Too many attempts. Wait a few minutes and try again.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        const body = await readBody(req);
        const wcaToken = String((body && body.wcaToken) || '').trim();
        if (!wcaToken) {
            const e = new Error('That WCA sign-in did not come through. Try again.');
            e.status = 400; e.code = 'no_wca_token';
            throw e;
        }

        // Verified through the same path the coach uses: the WCA is
        // asked who this token belongs to, and the answer is what gets
        // stored. requireUser reads the Authorization header, so the WCA
        // token is presented as one here rather than being passed down —
        // the alternative is a second, subtly different verifier.
        let wca;
        try {
            wca = await requireUser({ headers: { authorization: `Bearer ${wcaToken}` } });
        } catch (e) {
            if (e instanceof AuthError && e.status === 503) throw e;
            const err = new Error('That WCA sign-in is not valid. Try again.');
            err.status = 401; err.code = 'bad_wca_token';
            throw err;
        }

        if (!wca.wcaId) {
            const e = new Error('That WCA account has no WCA ID yet — compete once, then link it.');
            e.status = 400; e.code = 'no_wca_id';
            throw e;
        }

        const user = await accounts.linkWca({
            uid: me.uid,
            wcaId: accounts.normalizeWcaId(wca.wcaId),
            wcaName: wca.name,
            wcaAccountId: wca.accountId,
        });

        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
