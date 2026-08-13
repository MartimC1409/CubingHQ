/* ============================================================
   POST /api/coach/assess   -> SSE

   Turns a metrics snapshot into a CoachAssessment.

   The client computes the metrics (coach-analytics.js) and sends them;
   this endpoint validates the shape, wraps them in the evidence
   envelope, and asks the model to interpret. The model receives only
   the evidence object — never raw solves — so there is nothing for it
   to miscount.

   Streams progress events because the call takes a while and a spinner
   tells the user nothing. Each event fires when a real step completes.
   ============================================================ */
'use strict';

const { requireUser, AuthError } = require('../_lib/auth.js');
const rtdb = require('../_lib/rtdb.js');
const { CoachModel } = require('../_lib/model.js');
const { assessmentPrompt, UNKNOWABLE_TOPICS, CATEGORY_COVERS } = require('../_lib/prompts.js');
const { sendError, methodGuard, readBody, openStream } = require('../_lib/http.js');

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

/**
 * The evidence envelope: the model's whole factual world.
 *
 * `unknown` is populated from what the evidence actually lacks. When
 * move-level observations exist, the corresponding topics move out of
 * `unknown` — so the Coach genuinely says more when it knows more,
 * rather than being permanently hedged.
 */
function buildEvidence({ metrics, profile, observations }) {
    const observed = Array.isArray(observations) ? observations.slice(0, 60) : [];

    // A topic leaves `unknown` only when an observation category explicitly
    // establishes it. Anything not named in CATEGORY_COVERS stays unknown,
    // so an unfamiliar category can never quietly widen what the Coach is
    // allowed to assert.
    const covered = new Set();
    for (const o of observed) {
        const cat = String((o && o.category) || '').toLowerCase();
        for (const topic of (CATEGORY_COVERS[cat] || [])) covered.add(topic);
    }

    const unknown = UNKNOWABLE_TOPICS
        .filter(t => !covered.has(t.key))
        .map(t => t.label);

    return {
        known: {
            statistics: metrics,
            statedByUser: profile ? {
                method: profile.method || null,
                experience: profile.experience || null,
                practiceFrequency: profile.practiceFrequency || null,
                knownAlgorithms: profile.knownAlgorithms || null,
                note: 'Self-reported. Treat as context, not as measurement.',
            } : null,
        },
        observed: observed.length ? {
            source: 'Bluetooth smart cube move data, analysed per solve.',
            items: observed,
        } : null,
        unknown,
        dataQuality: {
            solveCount: metrics.solveCount,
            enoughForTrend: metrics.trend && metrics.trend.direction !== 'insufficient_data',
            hasMoveLevelData: observed.length > 0,
        },
    };
}

async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    let user = null;
    let body;
    try {
        body = await readBody(req);
        // Signing in is optional for assessment: a guest can be coached,
        // their data just isn't stored. Only fail on a token that is
        // present and bad.
        if (req.headers.authorization) {
            try { user = await requireUser(req); }
            catch (e) { if (!(e instanceof AuthError) || e.code === 'invalid_token') throw e; }
        }

        const metrics = body && body.metrics;
        if (!metrics || typeof metrics !== 'object' || typeof metrics.solveCount !== 'number') {
            throw badRequest('No statistics were provided to assess.');
        }
        if (metrics.solveCount < 5) {
            throw badRequest('At least 5 solves are needed before an assessment means anything.');
        }
    } catch (err) {
        return sendError(res, err);
    }

    const stream = openStream(res);
    try {
        stream.progress('reading', 'Reading your solves…');
        const evidence = buildEvidence({
            metrics: body.metrics,
            profile: body.profile,
            observations: body.observations,
        });

        stream.progress('statistics', 'Checking your averages and trend…');
        if (evidence.dataQuality.hasMoveLevelData) {
            stream.progress('moves', 'Reviewing your smart-cube solve data…');
        }
        stream.progress('bottleneck', 'Working out what is holding you back…');

        const assessment = await CoachModel.analyseSession({
            system: assessmentPrompt(),
            evidence,
            onActivity: () => stream.progress('writing', 'Writing your assessment…'),
        });

        const record = {
            id: 'asmt_' + Date.now().toString(36),
            createdAt: Date.now(),
            model: CoachModel.id,
            metrics: body.metrics,
            assessment,
        };

        if (user && rtdb.isConfigured()) {
            try {
                await rtdb.set(rtdb.coachPath(user.uid, 'assessments', record.id), record);
            } catch (e) {
                // Losing the archive copy must not lose the assessment the
                // user is about to read; it lives client-side too.
                console.error('[assess] could not persist assessment', e);
            }
        }

        stream.result(record);
    } catch (err) {
        stream.fail(err);
    } finally {
        stream.close();
    }
}

module.exports = handler;
// Exposed so the evidence envelope can be tested without a live model.
module.exports._internal = { buildEvidence };
