/* ============================================================
   GET /api/auth/health

   What is configured for accounts, as booleans. Same reasoning as
   /api/coach/health and GET /api/battle: "requests reset password /
   nothing happens" has an invisible cause from the browser — no mail
   provider configured — and request-reset.js deliberately never says
   so in its own response, because doing that would answer "does this
   address have an account" for anyone willing to also check whether
   mail arrived. This is the honest version of that answer, for
   whoever runs the deployment rather than whoever is guessing at it.

   Presence only: never a key, never a fragment of one, never the
   sending address. Unauthenticated on purpose, the same as the other
   health checks — one that needed a working config to answer would be
   useless exactly when it is needed.
   ============================================================ */
'use strict';

const rtdb = require('../_lib/rtdb.js');
const session = require('../_lib/session.js');
const mailer = require('../_lib/mailer.js');
const { sendJson, methodGuard } = require('../_lib/http.js');

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['GET'])) return;

    const hasStorage = rtdb.isConfigured();
    const hasSessionSecret = session.isConfigured();
    const hasMailer = mailer.isConfigured();

    let diagnosis;
    if (!hasStorage) {
        diagnosis = 'No database credential is configured, so accounts cannot be created at '
            + 'all yet — see FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_DB_SECRET in .env.example.';
    } else if (!hasMailer) {
        diagnosis = 'Signing up and signing in work. Two things depend on mail and silently do '
            + 'not happen without it: a new account gets no welcome email, and password reset '
            + 'requests always answer success (so the endpoint cannot be used to test which '
            + 'emails have accounts) without anything actually being sent. Set RESEND_API_KEY '
            + 'and MAIL_FROM to fix both at once — check the server logs for "[auth] welcome '
            + 'email failed" or "[auth] a password reset was requested" to confirm this is what '
            + 'is happening.';
    } else {
        diagnosis = 'Configuration looks complete. If a welcome or reset email still does not '
            + 'arrive, check the Resend dashboard for the delivery — a rejected or bounced send '
            + 'is logged there and in this deployment\'s own logs under "[mailer]", never in '
            + 'this response.';
    }

    sendJson(res, 200, {
        ok: hasStorage && hasSessionSecret,
        hasStorage,
        hasSessionSecret,
        hasMailer,
        diagnosis,
    });
};
