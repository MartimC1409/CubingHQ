/* ============================================================
   POST /api/auth/signup   { email, password, name? }

   Creates an email + password account and signs the person in, so
   they do not have to type the same credentials again immediately.

   Sign-in with a WCA account still exists and is unchanged; this is
   for people who do not have one, or do not want to connect it.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');
const rate = require('../_lib/ratelimit.js');

// Creating accounts is not something a person does repeatedly.
const LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        if (!session.isConfigured()) {
            const e = new Error('Accounts are not set up on this deployment yet.');
            e.status = 503; e.code = 'not_configured';
            throw e;
        }

        const ip = rate.clientIp(req);
        if (!rate.take(`signup:${ip}`, LIMIT)) {
            const e = new Error('Too many accounts from here. Try again later.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        const body = await readBody(req);
        const email = accounts.normalizeEmail(body && body.email);
        const password = accounts.checkPassword(body && body.password);

        const user = await accounts.create({ email, password, name: body && body.name });
        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
