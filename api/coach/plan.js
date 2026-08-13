/* ============================================================
   POST /api/coach/plan   -> SSE

   Builds the roadmap from where the cuber is to the goal they set,
   plus today's session.

   Phase targets are sanity-checked after generation: a phase target
   that sits outside the corridor between current performance and the
   goal is clamped. The model is good at naming phases and choosing a
   focus; it should not be the thing deciding what number counts as
   progress.
   ============================================================ */
'use strict';

const { requireUser, AuthError } = require('../_lib/auth.js');
const rtdb = require('../_lib/rtdb.js');
const { CoachModel } = require('../_lib/model.js');
const { planPrompt } = require('../_lib/prompts.js');
const { sendError, methodGuard, readBody, openStream } = require('../_lib/http.js');

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

/**
 * Keeps generated phase targets inside the corridor between the current
 * value and the goal, and in order. A phase that "targets" a number the
 * cuber has already beaten, or one beyond the goal itself, would make
 * the progress bar nonsense — so this is arithmetic we own.
 */
function sanitisePhases(plan, currentMs, goalMs, goalMetric) {
    if (!plan || !Array.isArray(plan.phases) || !plan.phases.length) return plan;
    if (!isFinite(currentMs) || !isFinite(goalMs) || currentMs <= goalMs) return plan;

    const hi = currentMs, lo = goalMs;
    let previous = hi;

    plan.phases = plan.phases.map((p, i) => {
        let target = Number(p.targetMs);
        if (!isFinite(target)) {
            // Evenly spaced fallback only when the model gave us nothing usable.
            target = hi - ((hi - lo) * (i + 1)) / plan.phases.length;
        }
        target = Math.min(Math.max(target, lo), hi);
        // Each phase must be at least a little faster than the one before.
        if (target >= previous) target = Math.max(lo, previous - (hi - lo) * 0.05);
        previous = target;
        return {
            ...p,
            targetMs: Math.round(target),
            // The goal metric is the user's choice, not the model's.
            targetMetric: goalMetric || p.targetMetric,
        };
    });

    // The last phase is the goal itself.
    plan.phases[plan.phases.length - 1].targetMs = Math.round(lo);

    const ids = plan.phases.map(p => p.id);
    if (!ids.includes(plan.currentPhaseId)) plan.currentPhaseId = ids[0];
    return plan;
}

async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    let user = null;
    let body;
    try {
        body = await readBody(req);
        if (req.headers.authorization) {
            try { user = await requireUser(req); }
            catch (e) { if (!(e instanceof AuthError) || e.code === 'invalid_token') throw e; }
        }

        const { metrics, profile } = body || {};
        if (!metrics || typeof metrics !== 'object') throw badRequest('No statistics were provided.');
        if (!profile || !profile.goal || !isFinite(profile.goal.targetMs)) {
            throw badRequest('Set a goal before generating a plan.');
        }
    } catch (err) {
        return sendError(res, err);
    }

    const stream = openStream(res);
    try {
        const { metrics, profile, assessment } = body;
        const goal = profile.goal;

        stream.progress('reading', 'Reviewing where you are now…');
        stream.progress('goal', 'Mapping the distance to your goal…');

        const context = {
            known: {
                statistics: metrics,
                goal: {
                    metric: goal.metric,
                    targetMs: goal.targetMs,
                    targetDate: goal.targetDate || null,
                    currentOnThatMetric: metrics.goal ? metrics.goal.currentMs : null,
                    gapMs: metrics.goal ? metrics.goal.gapMs : null,
                },
                event: profile.primaryEvent || metrics.event,
                method: profile.method || null,
                practiceFrequency: profile.practiceFrequency || null,
            },
            priorAssessment: assessment || null,
            unknown: [],
        };

        stream.progress('planning', 'Building your roadmap…');
        let plan = await CoachModel.generatePlan({
            system: planPrompt(),
            context,
            onActivity: () => stream.progress('drills', "Choosing today's training…"),
        });

        plan = sanitisePhases(
            plan,
            metrics.goal ? metrics.goal.currentMs : null,
            goal.targetMs,
            goal.metric
        );

        const record = {
            generatedAt: Date.now(),
            model: CoachModel.id,
            goal,
            plan,
        };

        if (user && rtdb.isConfigured()) {
            try { await rtdb.set(rtdb.coachPath(user.uid, 'plan'), record); }
            catch (e) { console.error('[plan] could not persist plan', e); }
        }

        stream.result(record);
    } catch (err) {
        stream.fail(err);
    } finally {
        stream.close();
    }
}

module.exports = handler;
// Exposed so the phase arithmetic can be tested without a live model.
module.exports._internal = { sanitisePhases };
