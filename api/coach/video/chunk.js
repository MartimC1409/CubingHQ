/* ============================================================
   POST /api/coach/video/chunk

   Relays one slice of a resumable upload to Google.

   Headers:
     X-Upload-Token   the opaque session from /begin
     X-Upload-Offset  byte offset of this slice within the file
     X-Upload-Final   "1" on the last slice

   Body is the raw bytes. Not JSON, and not base64 — encoding would cost
   a third of the very request-body limit that makes chunking necessary
   in the first place.

   Nothing is stored. Each slice passes through this function to Google
   and is gone; only the finalising call returns anything, and that is a
   file reference rather than the file.
   ============================================================ */
'use strict';

const { requireUser } = require('../../_lib/auth.js');
const { CoachModel } = require('../../_lib/model.js');
const { open } = require('../../_lib/upload-token.js');
const { sendJson, sendError, methodGuard, readRawBody } = require('../../_lib/http.js');

// A little above the chunk size /begin advertises, so a slightly
// generous client is not rejected while a runaway one still is.
const MAX_CHUNK_BYTES = parseInt(process.env.COACH_VIDEO_MAX_CHUNK || String(4 * 1024 * 1024), 10);

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        await requireUser(req);

        if (typeof CoachModel.uploadVideoChunk !== 'function') {
            return sendJson(res, 501, {
                error: {
                    code: 'video_unavailable',
                    message: 'Video analysis is not switched on for this deployment.',
                },
            });
        }

        // Throws unless the signature verifies AND the URL is Google's.
        const uploadUrl = open(req.headers['x-upload-token']);

        const offset = Number(req.headers['x-upload-offset']);
        if (!Number.isInteger(offset) || offset < 0) {
            throw badRequest('That upload is out of step. Choose the video again.');
        }
        const isFinal = String(req.headers['x-upload-final'] || '') === '1';

        const chunk = await readRawBody(req, MAX_CHUNK_BYTES);
        if (!chunk.length) throw badRequest('That upload sent an empty piece.');

        const file = await CoachModel.uploadVideoChunk(uploadUrl, chunk, offset, isFinal);

        // Intermediate chunks have nothing to report but their success;
        // saying so explicitly beats an empty body the client has to
        // interpret.
        if (!isFinal) return sendJson(res, 200, { received: chunk.length, done: false });

        return sendJson(res, 200, {
            done: true,
            name: file.name,
            uri: file.uri,
            state: file.state,
        });
    } catch (err) {
        return sendError(res, err);
    }
};

module.exports._internal = { MAX_CHUNK_BYTES };
