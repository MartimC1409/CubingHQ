/* ============================================================
   POST /api/auth/reset-password   { uid, token, password }

   Spends a reset token for a new password and signs the person in —
   matching signup, which does the same rather than making someone
   type the password they just chose a second time on a login screen.

   `uid` is not a secret (see the note in accounts.resetPassword): it
   names an account the way a WCA ID names a competitor, and the raw
   token is what actually has to match a stored hash. Neither alone
   is enough to do anything.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');
const rate = require('../_lib/ratelimit.js');

// Token guessing is already infeasible — 256 bits of randomness — so
// this is defense in depth, not the thing actually stopping a guesser,
// the same posture the other write endpoints in this file take.
const PER_IP = { max: 20, windowMs: 60 * 60 * 1000 };

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        if (!session.isConfigured()) {
            const e = new Error('Accounts are not set up on this deployment yet.');
            e.status = 503; e.code = 'not_configured';
            throw e;
        }

        if (!rate.take(`reset-consume:${rate.clientIp(req)}`, PER_IP)) {
            const e = new Error('Too many attempts. Wait a while and try again.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        const body = await readBody(req);
        const uid = String((body && body.uid) || '');
        const token = String((body && body.token) || '');
        const password = accounts.checkPassword(body && body.password);

        const user = await accounts.resetPassword({ uid, token, password });
        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
