/* ============================================================
   GET    /api/coach/profile          read this user's coaching data
   PUT    /api/coach/profile          replace the supplied top-level keys
   DELETE /api/coach/profile?scope=…  all | sessions | assessments | plan | training

   The only storage endpoint. Everything under /coach/<uid> is written
   here, after the caller's WCA token has been verified, so the browser
   never holds a credential that can reach the database.

   PUT replaces each key it is given rather than deep-merging, which is
   what makes "delete one imported session" work: the client sends the
   sessions map without it. Keys that are not supplied are untouched.
   ============================================================ */
'use strict';

const { requireUser } = require('../_lib/auth.js');
const rtdb = require('../_lib/rtdb.js');
const { sendJson, sendError, methodGuard, readBody } = require('../_lib/http.js');

// Only these may be written. Anything else in the body is ignored, so a
// crafted request cannot stash arbitrary data under a user's node.
const WRITABLE = ['profile', 'sessions', 'assessments', 'plan', 'training', 'progress'];

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['GET', 'PUT', 'DELETE'])) return;

    try {
        const user = await requireUser(req);

        if (!rtdb.isConfigured()) {
            // Not an error the user caused. Tell the client plainly so it
            // can stay in local-only mode instead of retrying forever.
            return sendJson(res, 501, {
                error: {
                    code: 'sync_unavailable',
                    message: 'Cloud sync is not set up on this deployment. Your coaching data is saved on this device.',
                },
            });
        }

        const base = rtdb.coachPath(user.uid);

        if (req.method === 'GET') {
            const data = await rtdb.get(base);
            return sendJson(res, 200, {
                uid: user.uid,
                name: user.name,
                wcaId: user.wcaId,
                data: data || null,
            });
        }

        if (req.method === 'PUT') {
            const body = await readBody(req);
            const keys = WRITABLE.filter(k => Object.prototype.hasOwnProperty.call(body, k));
            if (!keys.length) {
                return sendJson(res, 400, {
                    error: { code: 'nothing_to_write', message: 'No recognised fields to save.' },
                });
            }
            for (const key of keys) {
                await rtdb.set(`${base}/${key}`, body[key] === undefined ? null : body[key]);
            }
            await rtdb.set(`${base}/updatedAt`, Date.now());
            return sendJson(res, 200, { ok: true, written: keys });
        }

        // DELETE — §39: users can remove their coaching data.
        const scope = (req.query && req.query.scope) || 'all';
        if (scope === 'all') {
            await rtdb.del(base);
            return sendJson(res, 200, { ok: true, deleted: 'all' });
        }
        if (!WRITABLE.includes(scope)) {
            return sendJson(res, 400, {
                error: { code: 'bad_scope', message: 'Unknown thing to delete.' },
            });
        }
        await rtdb.del(`${base}/${scope}`);
        return sendJson(res, 200, { ok: true, deleted: scope });

    } catch (err) {
        return sendError(res, err);
    }
};
