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
const mailer = require('../_lib/mailer.js');
const rate = require('../_lib/ratelimit.js');

// Creating accounts is not something a person does repeatedly.
const LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

function welcomeEmail(name) {
    const safeName = String(name || 'there').replace(/[<>&]/g, '');
    const text = `Hi ${safeName},\n\n`
        + `Welcome to CubingHQ! Your account is ready — the timer, the competition `
        + `simulator, stats and records are all there waiting.\n\n`
        + `If you have a WCA ID, you can link it any time from your account panel to `
        + `pull in your official results and add friends to compare with. Not required, `
        + `and nothing about signing up needed it.\n\n`
        + `Have a good session.`;
    const html = `<p>Hi ${safeName},</p>`
        + `<p>Welcome to CubingHQ! Your account is ready — the timer, the competition `
        + `simulator, stats and records are all there waiting.</p>`
        + `<p>If you have a WCA ID, you can link it any time from your account panel to `
        + `pull in your official results and add friends to compare with. Not required, `
        + `and nothing about signing up needed it.</p>`
        + `<p>Have a good session.</p>`;
    return { text, html };
}

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

        // Best-effort, and awaited rather than fired-and-forgotten: a
        // serverless instance can freeze the moment the response goes
        // out, so a send started but not waited on may simply never
        // finish. Unlike request-reset.js there is no anti-enumeration
        // reason to hide a failure here — signup already tells the
        // caller their account exists, being the one who just made it
        // — so a mail problem is only logged, never worth failing the
        // signup itself over.
        if (mailer.isConfigured()) {
            const { text, html } = welcomeEmail(user.name);
            try {
                await mailer.sendMail({ to: user.email, subject: 'Welcome to CubingHQ', text, html });
            } catch (e) {
                console.error('[auth] welcome email failed to send:', e.message);
            }
        }

        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
