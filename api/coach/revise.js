/* ============================================================
   POST /api/coach/revise   -> SSE

   Closes the training loop: given the numbers from before and after a
   block of training, decide whether it worked and what comes next.

   The client only calls this when a DETERMINISTIC threshold has been
   crossed (objective metric moved, or enough solves have accumulated
   without movement). The model judges; it does not decide when to be
   asked. That keeps this a real feedback loop rather than continuous
   autonomous re-diagnosis.
   ============================================================ */
'use strict';

const { requireUser, AuthError } = require('../_lib/auth.js');
const rtdb = require('../_lib/rtdb.js');
const { CoachModel } = require('../_lib/model.js');
const { revisionPrompt } = require('../_lib/prompts.js');
const { sendError, methodGuard, readBody, openStream } = require('../_lib/http.js');

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    let user = null;
    let body;
    try {
        body = await readBody(req);
        if (req.headers.authorization) {
            try { user = await requireUser(req); }
            catch (e) { if (!(e instanceof AuthError) || e.code === 'invalid_token') throw e; }
        }
        if (!body || !body.after || typeof body.after !== 'object') {
            throw badRequest('No post-training statistics were provided.');
        }
    } catch (err) {
        return sendError(res, err);
    }

    const stream = openStream(res);
    try {
        const { before, after, plan, trainingSummary, observations } = body;

        stream.progress('comparing', 'Comparing this block with the last one…');

        // The verdict-relevant deltas are computed here, not by the model,
        // so "did it improve" is arithmetic rather than an impression.
        const delta = (a, b) => (isFinite(a) && isFinite(b)) ? b - a : null;
        const movement = before && after ? {
            ao12Ms: delta(before.current && before.current.ao12, after.current && after.current.ao12),
            ao50Ms: delta(before.current && before.current.ao50, after.current && after.current.ao50),
            ao100Ms: delta(before.current && before.current.ao100, after.current && after.current.ao100),
            stdDevMs: delta(before.current && before.current.stdDev, after.current && after.current.stdDev),
            goalGapMs: delta(before.goal && before.goal.gapMs, after.goal && after.goal.gapMs),
            note: 'Negative means faster or tighter — an improvement.',
        } : null;

        stream.progress('judging', 'Working out whether the training moved the number…');

        const context = {
            known: {
                before: before || null,
                after,
                movement,
                training: trainingSummary || null,
                currentPlan: plan || null,
            },
            observed: Array.isArray(observations) && observations.length
                ? { source: 'Bluetooth smart cube move data.', items: observations.slice(0, 60) }
                : null,
            unknown: [],
        };

        const revision = await CoachModel.adaptPlan({
            system: revisionPrompt(),
            context,
            onActivity: () => stream.progress('adapting', 'Adjusting your training…'),
        });

        const record = {
            revisedAt: Date.now(),
            model: CoachModel.id,
            movement,
            revision,
        };

        if (user && rtdb.isConfigured()) {
            try {
                await rtdb.patch(rtdb.coachPath(user.uid, 'plan'), {
                    revisedAt: record.revisedAt,
                    lastRevision: record,
                });
            } catch (e) { console.error('[revise] could not persist revision', e); }
        }

        stream.result(record);
    } catch (err) {
        stream.fail(err);
    } finally {
        stream.close();
    }
};
