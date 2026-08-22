/* ============================================================
   POST /api/auth/request-reset   { email }

   Starts a password reset. Always answers 200 { sent: true } —
   whether the address has an account, a typo, or belongs to someone
   else entirely — because the alternative lets this endpoint answer
   "does an account exist here" a guess at a time, the same reasoning
   login.js and social.js's friend requests already keep.

   A mail failure must not leak that difference either: if the
   address IS registered but Resend rejects the send, that still
   answers 200. The failure is logged for whoever runs this
   deployment to notice, never returned to whoever asked.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const mailer = require('../_lib/mailer.js');
const rate = require('../_lib/ratelimit.js');

const PER_ACCOUNT = { max: 5, windowMs: 60 * 60 * 1000 };
const PER_IP = { max: 20, windowMs: 60 * 60 * 1000 };

const SITE_URL = (process.env.COACH_SITE_URL || 'https://www.cubinghq.online').replace(/\/$/, '');

function resetLink(uid, token) {
    // A hash fragment, not a query string: it never reaches this
    // server's own access logs or a Referer header on the page it
    // lands on, the same reason the WCA's own OAuth token arrives the
    // same way (see checkOAuthCallback in app.js).
    const frag = new URLSearchParams({ reset_uid: uid, reset_token: token }).toString();
    return `${SITE_URL}/#${frag}`;
}

function emailBody(name, link) {
    const safeName = String(name || 'there').replace(/[<>&]/g, '');
    const text = `Hi ${safeName},\n\n`
        + `Someone asked to reset the password on your CubingHQ account. `
        + `If that was you, set a new one here — this link works once and expires in 30 minutes:\n\n`
        + `${link}\n\n`
        + `If you didn't ask for this, you can ignore this email — your password hasn't changed.`;
    const html = `<p>Hi ${safeName},</p>`
        + `<p>Someone asked to reset the password on your CubingHQ account. `
        + `If that was you, set a new one below — this link works once and expires in 30 minutes.</p>`
        + `<p><a href="${link}">Reset your password</a></p>`
        + `<p style="color:#666;font-size:0.9em">If you didn't ask for this, you can ignore this `
        + `email — your password hasn't changed.</p>`;
    return { text, html };
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const body = await readBody(req);
        const email = accounts.normalizeEmail(body && body.email);

        const ipKey = `reset-ip:${rate.clientIp(req)}`;
        const acctKey = `reset-acct:${accounts.uidFor(email)}`;
        if (!rate.take(ipKey, PER_IP) || !rate.take(acctKey, PER_ACCOUNT)) {
            const e = new Error('Too many reset attempts. Wait a while and try again.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        // Every branch below converges on the same response. Read that
        // as the point, not an accident of control flow.
        if (mailer.isConfigured()) {
            try {
                const started = await accounts.requestPasswordReset(email);
                if (started) {
                    const { text, html } = emailBody(started.name, resetLink(started.uid, started.token));
                    await mailer.sendMail({
                        to: started.email, subject: 'Reset your CubingHQ password', text, html,
                    });
                }
            } catch (e) {
                console.error('[auth] password reset request failed:', e.message);
            }
        } else {
            console.error('[auth] a password reset was requested but email is not configured '
                + '(set RESEND_API_KEY and MAIL_FROM)');
        }

        sendJson(res, 200, { sent: true });
    } catch (err) {
        sendError(res, err);
    }
};
