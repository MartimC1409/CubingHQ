/* ============================================================
   Outbound email
   ------------------------------------------------------------
   One thing sends mail today: password reset. This is deliberately
   thin — a single REST call to Resend (https://resend.com), chosen
   for the same reason firebase-auth.js signs its own JWTs instead of
   pulling in a client library: one `fetch` call needs no dependency,
   and this project has exactly one (@anthropic-ai/sdk). An SMTP
   library would be a second.

   Requires a verified sending domain in the Resend dashboard — mail
   `from` an unverified domain is rejected or lands as spam, and no
   code here can paper over that. See .env.example.

   Failures are swallowed by design at the call site (request-reset),
   not here: this module reports success or throws, and it is the
   caller's job to decide that a mail failure must never look
   different from "no account at that address" to whoever asked.
   ============================================================ */
'use strict';

const RESEND_API = 'https://api.resend.com/emails';

class MailError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'MailError';
        this.code = code;
    }
}

function apiKey() { return (process.env.RESEND_API_KEY || '').trim(); }
function fromAddress() { return (process.env.MAIL_FROM || '').trim(); }

/** True when both the key and a from-address are set. Presence, not validity. */
function isConfigured() {
    return !!(apiKey() && fromAddress());
}

/**
 * Sends one email. Throws MailError on any failure — a bad key, a
 * rejected recipient, Resend being unreachable. Never called unless
 * isConfigured() is true; that check is the caller's job so a missing
 * key reads as "mail not configured" rather than "mail failed".
 */
async function sendMail({ to, subject, html, text }) {
    if (!isConfigured()) {
        throw new MailError('not_configured', 'Email is not set up on this deployment.');
    }

    let res;
    try {
        res = await fetch(RESEND_API, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text }),
            signal: AbortSignal.timeout(15000),
        });
    } catch (e) {
        throw new MailError('unreachable', 'Could not reach the email service.');
    }

    if (!res.ok) {
        // Never echoed to a caller — that would let a reset request's
        // response distinguish a real address that bounced from one
        // that never existed. This is a server log, not a user message.
        let detail = '';
        try { detail = (await res.text()).slice(0, 300); } catch (e) { /* nothing to add */ }
        console.error(`[mailer] Resend returned ${res.status}: ${detail}`);
        throw new MailError('send_failed', 'The email could not be sent.');
    }
}

module.exports = { sendMail, isConfigured, MailError };
