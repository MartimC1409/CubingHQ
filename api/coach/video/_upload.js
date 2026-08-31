/* ============================================================
   POST /api/coach/video/upload

   Mints a resumable upload URL and hands it to the browser, which then
   sends the video bytes straight to Google.

   The file never passes through this server. That is partly privacy —
   we do not receive, store or back up video of anyone's hands — and
   partly the only design that works: a Vercel function caps its request
   body at a few megabytes and a phone video is far larger.

   Sign-in is required here, unlike the rest of the Coach. Video is the
   most expensive thing the product does and the model quota is shared
   across every visitor, so an anonymous caller could exhaust it for
   everyone in a few minutes.
   ============================================================ */
'use strict';

const { requireUser } = require('../../_lib/auth.js');
const { CoachModel } = require('../../_lib/model.js');
const { sendJson, sendError, methodGuard, readBody } = require('../../_lib/http.js');

// Formats a phone or screen recorder will actually produce.
const ALLOWED_TYPES = [
    'video/mp4', 'video/quicktime', 'video/webm',
    'video/x-matroska', 'video/mpeg', 'video/3gpp',
];

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const user = await requireUser(req);

        if (typeof CoachModel.startVideoUpload !== 'function') {
            // Only the Gemini provider can do this. Say which knob is
            // wrong rather than failing as a generic 500.
            console.error('[video] provider has no video support — set COACH_PROVIDER=gemini');
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
            throw badRequest("That doesn't look like a video file. MP4 or MOV works best.");
        }

        const { uploadUrl } = await CoachModel.startVideoUpload({
            // Names the athlete, not the file they chose, so nothing from
            // their filesystem is echoed back into Google's metadata.
            displayName: `solve-${user.uid}-${Date.now()}`,
            mimeType,
            sizeBytes,
        });

        return sendJson(res, 200, {
            uploadUrl,
            mimeType,
            // The browser needs these verbatim to finish the upload.
            headers: {
                'Content-Length': String(sizeBytes),
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
            },
        });
    } catch (err) {
        return sendError(res, err);
    }
};
