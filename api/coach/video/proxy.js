/* ============================================================
   POST /api/coach/video/proxy

   The fallback when the browser cannot send the video to Google itself.

   Direct upload is the better path and stays the default: no bytes
   through us, nothing stored, no platform body limit. But it depends on
   Google accepting a cross-origin request that carries X-Goog-Upload-*
   headers against a session URL, and that has been refused for at least
   one real browser — measured, not assumed: the reachability probe
   confirmed the host was reachable while the upload itself got no
   response at all.

   So this exists for the case where the fast path fails. The bytes pass
   through the function and straight on to Google; nothing is written to
   disk or to the database, and the only lasting record is the analysis.

   The ceiling is the platform's, not ours: a serverless request body
   caps out a few megabytes up, which is fine for the short clip a single
   solve actually is and hopeless for anything longer. Being explicit
   about that beats a timeout the user has to interpret.
   ============================================================ */
'use strict';

const { requireUser } = require('../../_lib/auth.js');
const { CoachModel } = require('../../_lib/model.js');
const { sendJson, sendError, methodGuard, readRawBody } = require('../../_lib/http.js');

// Vercel rejects a serverless request body over ~4.5MB before our code
// ever runs, so refuse just under it — a limit we enforce produces a
// message we control, rather than a platform error page.
const MAX_PROXY_BYTES = parseInt(process.env.COACH_PROXY_MAX_BYTES || String(4 * 1024 * 1024), 10);

const ALLOWED_TYPES = [
    'video/mp4', 'video/quicktime', 'video/webm',
    'video/x-matroska', 'video/mpeg', 'video/3gpp',
];

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const user = await requireUser(req);

        if (typeof CoachModel.uploadVideoBytes !== 'function') {
            console.error('[video] provider cannot upload video — set COACH_PROVIDER=gemini');
            return sendJson(res, 501, {
                error: {
                    code: 'video_unavailable',
                    message: 'Video analysis is not switched on for this deployment.',
                },
            });
        }

        // Sent as a header rather than a field: the body is the file, and
        // wrapping it in JSON would cost a third of the size limit to
        // base64 for no benefit.
        const mimeType = String(req.headers['x-video-type'] || '').toLowerCase();
        if (!ALLOWED_TYPES.includes(mimeType)) {
            const e = new Error("That doesn't look like a video file. MP4 or MOV works best.");
            e.status = 400; e.code = 'bad_request';
            throw e;
        }

        const bytes = await readRawBody(req, MAX_PROXY_BYTES);
        if (!bytes.length) {
            const e = new Error('That file was empty.');
            e.status = 400; e.code = 'bad_request';
            throw e;
        }

        const file = await CoachModel.uploadVideoBytes(
            bytes, mimeType, `solve-${user.uid}-${Date.now()}`);

        return sendJson(res, 200, { name: file.name, uri: file.uri, state: file.state });
    } catch (err) {
        return sendError(res, err);
    }
};

module.exports._internal = { MAX_PROXY_BYTES, ALLOWED_TYPES };
