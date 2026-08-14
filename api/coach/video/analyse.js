/* ============================================================
   POST /api/coach/video/analyse   -> SSE

   Takes a file the browser has already uploaded to Google and turns it
   into observations the Coach may treat as fact.

   This is the payoff for the evidence contract. Until now the Coach has
   had to say "I can't tell that from session data alone" about pauses,
   rotations, regrips, grip and turning quality. A camera genuinely sees
   all five, so those topics leave the unknown list — and the assessment
   that follows says more because it knows more.

   Recognition is the exception and stays inferred even here. See
   CATEGORY_COVERS in prompts.js for why.
   ============================================================ */
'use strict';

const { requireUser } = require('../../_lib/auth.js');
const rtdb = require('../../_lib/rtdb.js');
const { CoachModel } = require('../../_lib/model.js');
const { videoPrompt } = require('../../_lib/prompts.js');
const { VIDEO_ANALYSIS_SCHEMA } = require('../../_lib/schemas.js');
const { sendJson, sendError, methodGuard, readBody, openStream } = require('../../_lib/http.js');

// Google transcodes an upload before it can be used. Poll rather than
// guess, but bounded well inside the 300s function ceiling — a clip that
// is still processing after this is better handed back to the client to
// retry than held open on a function that will be killed mid-answer.
const POLL_INTERVAL_MS = parseInt(process.env.COACH_VIDEO_POLL_MS || '2000', 10);
const POLL_BUDGET_MS = parseInt(process.env.COACH_VIDEO_POLL_BUDGET_MS || '90000', 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

/**
 * Waits for the upload to become usable.
 * @returns {{ready: boolean, file?: object}} ready:false means still
 *   transcoding — the caller should ask again, not treat it as failure.
 */
async function waitForFile(fileName, onWait) {
    const deadline = Date.now() + POLL_BUDGET_MS;
    let waited = false;

    for (;;) {
        const file = await CoachModel.getVideoState(fileName);

        if (file.state === 'ACTIVE') return { ready: true, file };
        if (file.state === 'FAILED') {
            const e = new Error("Google couldn't read that video. Try a different file or format.");
            e.status = 422; e.code = 'video_failed';
            throw e;
        }
        if (Date.now() >= deadline) return { ready: false };

        if (!waited && typeof onWait === 'function') { waited = true; onWait(); }
        await sleep(POLL_INTERVAL_MS);
    }
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    let body;
    let user;
    try {
        // Verified before the stream opens, so an unauthenticated caller
        // gets a plain 401 rather than an error buried in an SSE frame.
        user = await requireUser(req);

        if (typeof CoachModel.analyseVideo !== 'function') {
            console.error('[video] provider has no video support — set COACH_PROVIDER=gemini');
            return sendJson(res, 501, {
                error: {
                    code: 'video_unavailable',
                    message: 'Video analysis is not switched on for this deployment.',
                },
            });
        }

        body = await readBody(req);
        if (!body || !body.fileName) throw badRequest('No uploaded video was named.');
    } catch (err) {
        return sendError(res, err);
    }

    const stream = openStream(res);
    try {
        const { fileName, event, profile, note } = body;

        stream.progress('checking', 'Checking your upload…');
        const { ready, file } = await waitForFile(fileName,
            () => stream.progress('processing', 'Google is still processing the video…'));

        if (!ready) {
            // Not an error: long clips legitimately take a while. The
            // client shows this and offers to try again.
            stream.result({ pending: true, fileName });
            return;
        }

        stream.progress('watching', 'Watching your solve…');

        const context = [
            'Analyse this solve video.',
            profile && profile.method ? `The solver says they use ${profile.method}.` : null,
            note ? `They added: ${String(note).slice(0, 400)}` : null,
            'Report only what the video shows.',
        ].filter(Boolean).join('\n');

        const analysis = await CoachModel.analyseVideo({
            system: videoPrompt(event || (profile && profile.primaryEvent)),
            fileUri: file.uri,
            mimeType: file.mimeType,
            schema: VIDEO_ANALYSIS_SCHEMA,
            context,
            onActivity: () => stream.progress('writing', 'Writing up what I saw…'),
        });

        // A clip that is not a solve must not become evidence.
        const observations = analysis.solveDetected
            ? (analysis.observations || []).map(o => ({
                category: o.category,
                observation: `${o.observation} (at ${o.timestamp})`,
                evidence: o.basis,
                confidence: o.confidence,
                evidenceType: o.evidenceType,
            }))
            : [];

        const record = {
            id: 'vid_' + Date.now().toString(36),
            createdAt: Date.now(),
            model: CoachModel.id,
            analysis,
            observations,
        };

        // The video itself is never stored — only what was seen. Google
        // expires the uploaded file on its own within about two days.
        if (user && rtdb.isConfigured()) {
            try {
                await rtdb.set(rtdb.coachPath(user.uid, 'videos', record.id), record);
            } catch (e) {
                console.error('[video] could not persist analysis', e);
            }
        }

        stream.result(record);
    } catch (err) {
        stream.fail(err);
    } finally {
        stream.close();
    }
};

module.exports._internal = { waitForFile, POLL_BUDGET_MS, POLL_INTERVAL_MS };
