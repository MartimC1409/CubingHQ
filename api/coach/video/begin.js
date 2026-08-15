/* ============================================================
   POST /api/coach/video/begin

   Opens a resumable upload session and hands the client an opaque
   token for it. Paired with /api/coach/video/chunk.

   This is the fallback route, used when the browser cannot send the
   file to Google itself. Direct upload remains the default and remains
   better — no bytes through us at all — but it has been refused for at
   least one real browser, measured rather than assumed.

   Sign-in is required, as it is on the direct route: video is the most
   expensive thing the product does and the model quota is shared across
   every visitor.
   ============================================================ */
'use strict';

const { requireUser } = require('../../_lib/auth.js');
const { CoachModel } = require('../../_lib/model.js');
const { issue } = require('../../_lib/upload-token.js');
const { sendJson, sendError, methodGuard, readBody } = require('../../_lib/http.js');

// Comfortably under a serverless request body limit once headers are
// counted. The number is ours, not Google's — the resumable protocol
// itself does not care.
const CHUNK_BYTES = parseInt(process.env.COACH_VIDEO_CHUNK_BYTES || String(3 * 1024 * 1024), 10);

const ALLOWED_TYPES = [
    'video/mp4', 'video/quicktime', 'video/webm',
    'video/x-matroska', 'video/mpeg', 'video/3gpp',
];

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const user = await requireUser(req);

        if (typeof CoachModel.startVideoUpload !== 'function') {
            console.error('[video] provider cannot upload video — set COACH_PROVIDER=gemini');
            return sendJson(res, 501, {
                error: {
                    code: 'video_unavailable',
                    message: 'Video analysis is not switched on for this deployment.',
                },
            });
        }

        const body = await readBody(req);
        const mimeType = String((body && body.mimeType) || '').toLowerCase();
        const sizeBytes = Number(body && body.sizeBytes);

        if (!ALLOWED_TYPES.includes(mimeType)) {
            const e = new Error("That doesn't look like a video file. MP4 or MOV works best.");
            e.status = 400; e.code = 'bad_request';
            throw e;
        }

        // startVideoUpload enforces the product-level size ceiling, so a
        // file too large is refused here rather than after the user has
        // waited through several chunks.
        const { uploadUrl } = await CoachModel.startVideoUpload({
            displayName: `solve-${user.uid}-${Date.now()}`,
            mimeType,
            sizeBytes,
        });

        return sendJson(res, 200, {
            // Opaque on purpose: see upload-token.js.
            token: issue(uploadUrl),
            chunkBytes: CHUNK_BYTES,
        });
    } catch (err) {
        return sendError(res, err);
    }
};

module.exports._internal = { CHUNK_BYTES, ALLOWED_TYPES };
