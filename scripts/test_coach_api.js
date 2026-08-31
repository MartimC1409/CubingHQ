/* Tests the server-side pure logic that runs around the model call —
   the evidence envelope and the phase arithmetic. No network, no SDK.
   Run: node scripts/test_coach_api.js */

// The handlers pull in the Anthropic SDK at require time, which isn't
// installed in a bare checkout. Stub it so these pure functions can be
// exercised without an npm install.
const Module = require('module');
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === '@anthropic-ai/sdk') return require.resolve('./_stub_anthropic.js');
    return realResolve.call(this, request, ...rest);
};
require('fs').writeFileSync(__dirname + '/_stub_anthropic.js',
    'module.exports = class Anthropic { constructor() {} };\n');

const { _internal: assessInternal } = require('../api/coach/_assess.js');
const { _internal: planInternal } = require('../api/coach/_plan.js');
const { UNKNOWABLE_TOPICS } = require('../api/_lib/prompts.js');
const { COACH_ASSESSMENT_SCHEMA, TRAINING_PLAN_SCHEMA, PLAN_REVISION_SCHEMA } = require('../api/_lib/schemas.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// ---------- evidence envelope ------------------------------------
const metrics = { solveCount: 120, trend: { direction: 'improving' }, current: { ao100: 11820 } };

const timingOnly = assessInternal.buildEvidence({ metrics, profile: null, observations: [] });
eq('timing-only has no observed', timingOnly.observed, null);
eq('timing-only flags no move data', timingOnly.dataQuality.hasMoveLevelData, false);
check('timing-only marks everything unknown',
    timingOnly.unknown.length === UNKNOWABLE_TOPICS.length,
    `unknown=${timingOnly.unknown.length} of ${UNKNOWABLE_TOPICS.length}`);
check('timing-only lists PLL as unknown',
    timingOnly.unknown.some(u => /PLL/i.test(u)));
check('timing-only lists pauses as unknown',
    timingOnly.unknown.some(u => /pause/i.test(u)));
eq('known carries the statistics', timingOnly.known.statistics.solveCount, 120);
eq('trend sufficiency surfaced', timingOnly.dataQuality.enoughForTrend, true);

// Self-reported profile is included but explicitly labelled as such, so
// the model doesn't quote a user's guess back as a measurement.
const withProfile = assessInternal.buildEvidence({
    metrics, profile: { method: 'CFOP', experience: '2 years' }, observations: [],
});
eq('profile method carried', withProfile.known.statedByUser.method, 'CFOP');
check('profile marked self-reported', /Self-reported/i.test(withProfile.known.statedByUser.note));

// With smart-cube observations, the covered topics leave `unknown`.
const withMoves = assessInternal.buildEvidence({
    metrics, profile: null,
    observations: [
        { category: 'pauses', observation: '3 pauses over 500ms in F2L', confidence: 0.9 },
        { category: 'rotations', observation: '4 cube rotations', confidence: 1 },
    ],
});
check('observed present', withMoves.observed && withMoves.observed.items.length === 2);
eq('move data flagged', withMoves.dataQuality.hasMoveLevelData, true);
check('pauses no longer unknown', !withMoves.unknown.some(u => /pause/i.test(u)));
check('rotations no longer unknown', !withMoves.unknown.some(u => /rotation/i.test(u)));
// Things the cube still cannot see stay unknown.
check('PLL recognition still unknown', withMoves.unknown.some(u => /PLL/i.test(u)));

// The line that matters most: knowing how long PLL took to EXECUTE says
// nothing about whether RECOGNITION was slow. An earlier substring match
// conflated the two, which is exactly the unfounded leap this mechanism
// exists to prevent.
const pllExec = assessInternal.buildEvidence({
    metrics, profile: null,
    observations: [{ category: 'pll_execution', observation: 'PLL took 1.8s', confidence: 1 }],
});
check('PLL execution does not clear PLL recognition',
    pllExec.unknown.some(u => /PLL recognition/i.test(u)));

// An unrecognised category must not widen what may be claimed.
const unknownCat = assessInternal.buildEvidence({
    metrics, profile: null,
    observations: [{ category: 'something_new', observation: 'x' }],
});
eq('unknown category clears nothing', unknownCat.unknown.length, UNKNOWABLE_TOPICS.length);

// phase_timing covers execution but leaves lookahead and recognition open.
const phaseTiming = assessInternal.buildEvidence({
    metrics, profile: null,
    observations: [{ category: 'phase_timing', observation: 'cross 1.9s, F2L 6.2s' }],
});
check('phase timing clears algorithm execution',
    !phaseTiming.unknown.some(u => /algorithm choice/i.test(u)));
check('phase timing leaves F2L lookahead unknown',
    phaseTiming.unknown.some(u => /F2L lookahead/i.test(u)));

// A flood of observations is capped rather than blowing up the prompt.
const many = assessInternal.buildEvidence({
    metrics, profile: null,
    observations: Array.from({ length: 200 }, () => ({ category: 'pauses', observation: 'x' })),
});
eq('observations capped', many.observed.items.length, 60);

// Trend that can't be computed is reported as such.
const thin = assessInternal.buildEvidence({
    metrics: { solveCount: 8, trend: { direction: 'insufficient_data' } },
    profile: null, observations: [],
});
eq('insufficient trend flagged', thin.dataQuality.enoughForTrend, false);

// ---------- phase arithmetic --------------------------------------
const S = planInternal.sanitisePhases;

// Current 11.82s, goal 10.00s. Phases must descend and land on the goal.
const good = S({
    currentPhaseId: 'p1',
    phases: [
        { id: 'p1', targetMs: 11200 },
        { id: 'p2', targetMs: 10700 },
        { id: 'p3', targetMs: 10000 },
    ],
}, 11820, 10000, 'ao100');
eq('phase 1 kept', good.phases[0].targetMs, 11200);
eq('final phase is the goal', good.phases[2].targetMs, 10000);
check('phases descend',
    good.phases[0].targetMs > good.phases[1].targetMs &&
    good.phases[1].targetMs > good.phases[2].targetMs);
eq('goal metric forced onto phases', good.phases[0].targetMetric, 'ao100');

// A target beyond the goal is clamped — otherwise the progress bar
// would show more than 100%.
const tooFar = S({
    currentPhaseId: 'p1',
    phases: [{ id: 'p1', targetMs: 5000 }, { id: 'p2', targetMs: 10000 }],
}, 11820, 10000, 'ao100');
check('over-ambitious target clamped', tooFar.phases[0].targetMs >= 10000,
    `got ${tooFar.phases[0].targetMs}`);

// A target slower than current is pulled back inside the corridor.
const backwards = S({
    currentPhaseId: 'p1',
    phases: [{ id: 'p1', targetMs: 15000 }, { id: 'p2', targetMs: 10000 }],
}, 11820, 10000, 'ao100');
check('slower-than-now target clamped', backwards.phases[0].targetMs <= 11820,
    `got ${backwards.phases[0].targetMs}`);

// Non-descending targets get separated.
const flat = S({
    currentPhaseId: 'p1',
    phases: [{ id: 'p1', targetMs: 11000 }, { id: 'p2', targetMs: 11000 }, { id: 'p3', targetMs: 10000 }],
}, 11820, 10000, 'ao100');
check('duplicate targets separated', flat.phases[1].targetMs < flat.phases[0].targetMs);

// Missing targetMs is filled in rather than left as NaN.
const missing = S({
    currentPhaseId: 'p1',
    phases: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
}, 12000, 10000, 'ao100');
check('missing targets filled', missing.phases.every(p => isFinite(p.targetMs)));
check('filled targets in range',
    missing.phases.every(p => p.targetMs >= 10000 && p.targetMs <= 12000));

// A bad currentPhaseId is corrected to a real phase.
const badCurrent = S({
    currentPhaseId: 'nope',
    phases: [{ id: 'p1', targetMs: 11000 }, { id: 'p2', targetMs: 10000 }],
}, 11820, 10000, 'ao100');
eq('bad currentPhaseId corrected', badCurrent.currentPhaseId, 'p1');

// Already at goal: leave the plan alone rather than dividing by zero.
const atGoal = S({ currentPhaseId: 'p1', phases: [{ id: 'p1', targetMs: 9000 }] }, 9500, 10000, 'ao100');
eq('already-at-goal untouched', atGoal.phases[0].targetMs, 9000);
// Missing inputs must not throw.
check('no phases survives', !!S({ phases: [] }, 11820, 10000, 'ao100'));
check('null plan survives', S(null, 1, 2, 'ao100') === null);

// ---------- schemas ------------------------------------------------
function assertStrict(schema, path = 'root') {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type === 'object') {
        check(`${path}: additionalProperties false`, schema.additionalProperties === false);
        check(`${path}: has required`, Array.isArray(schema.required));
        const props = Object.keys(schema.properties || {});
        const req = schema.required || [];
        check(`${path}: every property required`,
            props.every(p => req.includes(p)),
            `missing ${props.filter(p => !req.includes(p)).join(', ')}`);
        for (const [k, v] of Object.entries(schema.properties || {})) assertStrict(v, `${path}.${k}`);
    }
    if (schema.type === 'array') assertStrict(schema.items, `${path}[]`);
}
assertStrict(COACH_ASSESSMENT_SCHEMA, 'assessment');
assertStrict(TRAINING_PLAN_SCHEMA, 'plan');
assertStrict(PLAN_REVISION_SCHEMA, 'revision');

// The evidence tag is what makes the anti-hallucination rule structural
// rather than advisory — every finding must carry one.
const ev = COACH_ASSESSMENT_SCHEMA.properties.bottleneck.properties.evidenceType;
check('bottleneck has evidenceType enum', Array.isArray(ev.enum));
eq('evidence types', ev.enum.join(','), 'known,observed,inferred');
check('weakness items carry evidenceType',
    !!COACH_ASSESSMENT_SCHEMA.properties.weaknesses.items.properties.evidenceType);
check('assessment requires dataGaps',
    COACH_ASSESSMENT_SCHEMA.required.includes('dataGaps'));

require('fs').unlinkSync(__dirname + '/_stub_anthropic.js');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
