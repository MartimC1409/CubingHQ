/* Tests for the round-3 changes: units reaching the model, per-event
   blind spots, and the plan unit-sanity repair.
   Run: node scripts/test_coach_round3.js */

'use strict';

const Module = require('module');
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === '@anthropic-ai/sdk') return require.resolve('./_stub_anthropic.js');
    return realResolve.call(this, request, ...rest);
};
require('fs').writeFileSync(__dirname + '/_stub_anthropic.js',
    'module.exports = class Anthropic { constructor() {} };\n');

const A = require('../coach-analytics.js');
const { topicsForEvent, UNKNOWABLE_TOPICS, EVENT_TOPICS } = require('../api/_lib/prompts.js');
const { _internal: planInternal } = require('../api/coach/_plan.js');
const { _internal: assessInternal } = require('../api/coach/_assess.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ============ durations reaching the model ====================== */

const raw = A.computeMetrics(
    Array.from({ length: 120 }, (_, i) => ({
        id: 'S' + i, time: 11000 + (i % 17) * 180, penalty: '', timestamp: 1700000000000 + i * 60000,
    })),
    { event: '333', goal: { metric: 'ao100', targetMs: 10000 } });

const shown = A.formatMetricsForModel(raw);

// The bug this exists to prevent: the model quoting "11820".
const asText = JSON.stringify(shown);
check('no bare millisecond integers survive', !/:\s*\d{4,}(\.\d+)?[,}]/.test(asText), asText.slice(0, 200));
check('durations carry a unit', /^\d+\.\d\ds$/.test(shown.current.ao100), shown.current.ao100);
check('best single formatted', /s$/.test(shown.best.single), shown.best.single);
eq('raw currentMs is gone from the goal block', shown.goal.currentMs, undefined);
check('goal current is formatted', /s$/.test(shown.goal.current), shown.goal.current);

// A coefficient of variation rendered as "0.076" was the reported symptom.
check('variability is a percentage', /%$/.test(shown.consistency.variability), shown.consistency.variability);
eq('raw cv is gone', shown.consistency.cv, undefined);
check('success rate is a percentage', /%$/.test(shown.successRate), shown.successRate);

// A signed millisecond delta is the easiest value here to read backwards.
const improving = A.formatMetricsForModel({
    ...raw, trend: { direction: 'improving', solvesAnalysed: 100, changeMs: -1210, changePct: -0.1, r2: 0.4 },
});
eq('improvement reads as faster', improving.trend.changeOverWindow, '1.21s faster');
const worsening = A.formatMetricsForModel({
    ...raw, trend: { direction: 'worsening', solvesAnalysed: 100, changeMs: 640, changePct: 0.05, r2: 0.3 },
});
eq('regression reads as slower', worsening.trend.changeOverWindow, '0.64s slower');

// Long events must not gain a stray "s" after m:ss.
const big = A.formatMetricsForModel({ ...raw, current: { ...raw.current, ao100: 185000 } });
eq('minutes render without a trailing s', big.current.ao100, '3:05.00');

eq('null durations stay null', A.formatMetricsForModel({ ...raw, best: { ...raw.best, ao12: null } }).best.ao12, null);
eq('null metrics object is tolerated', A.formatMetricsForModel(null), null);
check('the model is told the values are display-ready', /Quote them exactly/i.test(shown.note));

/* ============ per-event blind spots ============================= */

const EVENTS = ['333', '222', '444', '555', '666', '777', '333oh', 'pyram', 'skewb', 'sq1', 'minx', 'clock'];

for (const ev of EVENTS) {
    const keys = topicsForEvent(ev).map(t => t.key);
    check(`${ev}: has blind spots`, keys.length > 0);
    check(`${ev}: no duplicate topics`, new Set(keys).size === keys.length);
    check(`${ev}: still cannot see finger tricks`, keys.includes('finger_tricks'));
}

// The point of the change: stop telling a Clock solver about F2L.
const clock = topicsForEvent('clock').map(t => t.key);
check('clock is not told about F2L lookahead', !clock.includes('f2l_lookahead'));
check('clock is not told about PLL recognition', !clock.includes('pll_recognition'));
check('clock has no cube rotations', !clock.includes('rotations'));
check('clock gets its own topic', clock.includes('pin_sequence_planning'));

const twoByTwo = topicsForEvent('222').map(t => t.key);
check('2x2 is not told about F2L', !twoByTwo.includes('f2l_lookahead'));
check('2x2 gets CLL/EG recognition', twoByTwo.includes('cll_eg_recognition'));

const four = topicsForEvent('444').map(t => t.key);
check('4x4 keeps the 3x3 stage topics', four.includes('f2l_lookahead'));
check('4x4 adds parity', four.includes('parity_handling'));
check('5x5 mirrors 4x4', topicsForEvent('555').length === four.length);

check('sq1 gets cubeshape', topicsForEvent('sq1').some(t => t.key === 'cubeshape_efficiency'));
check('pyram gets L4E', topicsForEvent('pyram').some(t => t.key === 'l4e_recognition'));

// Unchanged default keeps the existing evidence-contract tests honest.
eq('unknown event falls back to 3x3', topicsForEvent('nonsense').length, topicsForEvent('333').length);
eq('the exported default is the 3x3 list', UNKNOWABLE_TOPICS.length, topicsForEvent('333').length);
check('every event has a guide entry or the CFOP default',
    EVENTS.every(e => EVENT_TOPICS[e] !== undefined));

// buildEvidence must honour the event it is given.
const clockEvidence = assessInternal.buildEvidence({
    metrics: { solveCount: 60, event: 'clock' }, profile: null, observations: [],
});
check('evidence for clock omits F2L', !clockEvidence.unknown.some(u => /F2L/i.test(u)));
check('evidence for clock names pin planning', clockEvidence.unknown.some(u => /pin sequence/i.test(u)));

const threeEvidence = assessInternal.buildEvidence({
    metrics: { solveCount: 60, event: '333' }, profile: null, observations: [],
});
check('evidence for 3x3 still lists PLL', threeEvidence.unknown.some(u => /PLL/i.test(u)));

/* ============ plan unit sanity ================================== */

const phases = (targets) => ({
    phases: targets.map((t, i) => ({ id: 'p' + i, targetMs: t })),
    currentPhaseId: 'p0',
});

// The model reads seconds everywhere else, so this is where it can slip.
const repaired = planInternal.sanitisePhases(phases([11.5, 10.8, 10.0]), 11820, 10000, 'ao100');
check('seconds mistaken for ms are rescaled',
    repaired.phases[0].targetMs > 10000 && repaired.phases[0].targetMs <= 11820,
    JSON.stringify(repaired.phases.map(p => p.targetMs)));

const normal = planInternal.sanitisePhases(phases([11500, 10800, 10000]), 11820, 10000, 'ao100');
eq('correct millisecond targets are left alone', normal.phases[0].targetMs, 11500);
eq('the last phase is the goal', normal.phases[2].targetMs, 10000);

// Inside the corridor, which is the §10 protection: a roadmap may never
// promise a phase faster than the goal or slower than today.
const clamped = planInternal.sanitisePhases(phases([99999, 500, 10400]), 11820, 10000, 'ao100');
const targets = clamped.phases.map(p => p.targetMs);
check('nonsense targets stay within current..goal',
    targets.every(t => t >= 10000 && t <= 11820), JSON.stringify(targets));
// Non-increasing rather than strictly decreasing: a phase clamped to the
// goal cannot be beaten by the next one, and the goal is the floor.
check('nonsense targets never get slower',
    targets.every((t, i) => i === 0 || t <= targets[i - 1]), JSON.stringify(targets));

const sensible = planInternal.sanitisePhases(phases([11400, 10900, 10300]), 11820, 10000, 'ao100')
    .phases.map(p => p.targetMs);
check('sensible targets get strictly faster',
    sensible.every((t, i) => i === 0 || t < sensible[i - 1]), JSON.stringify(sensible));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
