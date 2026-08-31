/* ============================================================
   POST /api/auth/unlink-wca

     Authorization: Bearer <session token>

   Detaches a linked WCA account, freeing that WCA ID to be claimed
   again — by this account or another one.

   It exists because linking the wrong account is an easy mistake to
   make (sign in to the WCA as the wrong person once) and, without
   this, an unrecoverable one. Nothing is deleted but the link itself:
   the account, its email and its password are untouched.
   ============================================================ */
'use strict';

const { sendJson, sendError, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const header = req.headers.authorization || req.headers.Authorization || '';
        const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
        const me = match && session.verify(match[1].trim());
        if (!me) {
            const e = new Error('Sign in again to change your WCA link.');
            e.status = 401; e.code = 'invalid_session';
            throw e;
        }

        const user = await accounts.unlinkWca(me.uid);
        sendJson(res, 200, { token: session.issue(user), user });
    } catch (err) {
        sendError(res, err);
    }
};
