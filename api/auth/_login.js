/* ============================================================
   POST /api/auth/login   { email, password }

   Checks an email and password and issues a session token.

   Rate limited twice over: by address, so one account cannot be
   guessed at from many machines, and by IP, so one machine cannot
   work through many accounts. Both are per instance and in memory —
   a speed bump, not a wall, which is why the password hash is the
   thing actually standing between a leak and an account.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');
const rate = require('../_lib/ratelimit.js');

const PER_ACCOUNT = { max: 10, windowMs: 15 * 60 * 1000 };
const PER_IP = { max: 30, windowMs: 15 * 60 * 1000 };

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        if (!session.isConfigured()) {
            const e = new Error('Accounts are not set up on this deployment yet.');
            e.status = 503; e.code = 'not_configured';
            throw e;
        }

        const body = await readBody(req);
        const email = accounts.normalizeEmail(body && body.email);
        const password = String((body && body.password) || '');

        const ipKey = `login-ip:${rate.clientIp(req)}`;
        const acctKey = `login-acct:${accounts.uidFor(email)}`;
        if (!rate.take(ipKey, PER_IP) || !rate.take(acctKey, PER_ACCOUNT)) {
            const e = new Error('Too many sign-in attempts. Wait a few minutes and try again.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        const user = await accounts.authenticate({ email, password });
        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
