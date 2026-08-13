/* Fixture tests for the Coach's deterministic analytics.
   Run: node scripts/test_coach_analytics.js */
const A = require('../coach-analytics.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function near(label, got, want, tol = 1e-6) {
    check(label, typeof got === 'number' && Math.abs(got - want) < tol, `got ${got}, want ~${want}`);
}

const ok = (t, ts = 0) => ({ time: t, penalty: '', timestamp: ts });
const dnf = (t, ts = 0) => ({ time: t, penalty: 'DNF', timestamp: ts });

// Build a run of n solves around `base` ms with a per-solve drift.
function run(n, base, drift = 0, jitter = 0) {
    return Array.from({ length: n }, (_, i) =>
        ok(Math.round(base + drift * i + (jitter ? ((i % 5) - 2) * jitter : 0)), 1700000000000 + i * 60000));
}

// ---------- rolling averages -------------------------------------
const five = [10, 11, 12, 13, 14].map(n => ok(n * 1000));
const roll = A.rollingAverage(five, 5);
eq('rolling nulls before window', roll[3], null);
eq('rolling final value', roll[4], 12000);
eq('rolling length', roll.length, 5);

// ---------- PB markers -------------------------------------------
const pbRun = [12000, 11000, 13000, 10500, 10600].map(t => ok(t));
const pbs = A.pbMarkers(pbRun);
eq('pb count', pbs.length, 3);
eq('pb indexes', pbs.map(p => p.index).join(','), '0,1,3');
eq('pb ignores DNF', A.pbMarkers([dnf(1000), ok(12000)]).length, 1);

// ---------- session boundaries -----------------------------------
const t0 = 1700000000000;
const spaced = [ok(10000, t0), ok(10000, t0 + 60000), ok(10000, t0 + 10 * 3600 * 1000)];
eq('boundary detected', A.sessionBoundaries(spaced).join(','), '2');
eq('no timestamps no boundaries', A.sessionBoundaries([ok(1), ok(2)]).length, 0);

// ---------- regression -------------------------------------------
const lr = A.linearRegression([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
near('regression slope', lr.slope, 2);
near('regression r2 perfect', lr.r2, 1);

// ---------- trend ------------------------------------------------
eq('trend needs data', A.analyseTrend(run(10, 12000)).direction, 'insufficient_data');
eq('trend reports need', A.analyseTrend(run(10, 12000)).solvesNeeded, 30);

// 100 solves falling from 13.0s to ~11.0s -> improving
const improving = A.analyseTrend(run(100, 13000, -20));
eq('trend improving', improving.direction, 'improving');
check('trend change negative', improving.changeMs < 0, `changeMs ${improving.changeMs}`);

// Flat run -> plateau
eq('trend plateau', A.analyseTrend(run(100, 12000, 0, 200)).direction, 'plateau');

// Rising times -> regressing
eq('trend regressing', A.analyseTrend(run(100, 11000, 20)).direction, 'regressing');

// A tiny drift under the significance floor still reads as plateau,
// so the Coach doesn't announce progress that is really just noise.
eq('trend sub-threshold is plateau', A.analyseTrend(run(100, 12000, -1)).direction, 'plateau');

// ---------- consistency ------------------------------------------
// Wide jitter first half, tight second half -> improving consistency.
const loose = run(50, 12000, 0, 1500);
const tight = run(50, 12000, 0, 100);
eq('consistency improving', A.analyseConsistency([...loose, ...tight]).direction, 'improving');
eq('consistency worsening', A.analyseConsistency([...tight, ...loose]).direction, 'worsening');
eq('consistency needs data', A.analyseConsistency(run(10, 12000)).direction, 'insufficient_data');

// ---------- spread -----------------------------------------------
const spread = A.analyseSpread(run(100, 12000, 0, 1000));
check('spread has percentiles', spread && spread.p10 < spread.p50 && spread.p50 < spread.p90);
eq('spread needs 12', A.analyseSpread(run(5, 12000)), null);

// ---------- goal progress ----------------------------------------
// The headline product rule: a fast single must NOT drive a goal
// measured on Ao100.
const mixed = [...run(99, 11820, 0, 50), ok(9420)];
const g = A.goalProgress(mixed, { metric: 'ao100', targetMs: 10000, startMs: 12500 });
eq('goal metric respected', g.metric, 'ao100');
check('goal uses ao100 not single', g.currentMs > 11000,
    `currentMs ${g.currentMs} — should be the Ao100 (~11.8s), not the 9.42 single`);
eq('goal not reached', g.reached, false);
check('goal gap positive', g.gapMs > 1000, `gapMs ${g.gapMs}`);
check('goal pct partial', g.pct > 0 && g.pct < 1, `pct ${g.pct}`);

// Same solves, goal on the single -> reached.
const gs = A.goalProgress(mixed, { metric: 'single', targetMs: 10000 });
eq('single goal reached', gs.reached, true);

// Not enough solves for the chosen metric is stated, not faked.
const thin = A.goalProgress(run(5, 12000), { metric: 'ao100', targetMs: 10000 });
eq('goal insufficient', thin.reason, 'not_enough_solves');
eq('goal insufficient pct', thin.pct, 0);
eq('goal invalid metric', A.goalProgress(run(5, 12000), { metric: 'nonsense', targetMs: 1 }), null);

// A DNF-heavy window is NOT the same problem as too few solves, and
// telling someone with 140 solves to "do more solves" is useless advice.
const dnfWindow = [...run(60, 12000), ...Array.from({ length: 60 }, (_, i) =>
    (i % 2 ? dnf(12000) : ok(12000)))];
const dnfGoal = A.goalProgress(dnfWindow, { metric: 'ao100', targetMs: 10000 });
eq('dnf window reason', dnfGoal.reason, 'dnf_average');
eq('dnf window reports count', dnfGoal.solveCount, 120);
eq('dnf window needed', dnfGoal.solvesNeeded, 100);
// Genuinely too few solves still says so, with the shortfall.
const fewGoal = A.goalProgress(run(20, 12000), { metric: 'ao100', targetMs: 10000 });
eq('few solves reason', fewGoal.reason, 'not_enough_solves');
eq('few solves count', fewGoal.solveCount, 20);

// ---------- streak -----------------------------------------------
const today = Date.now();
const d = (n) => new Date(today - n * 86400000).toISOString().slice(0, 10);
eq('streak 3 days', A.computeStreak([d(0), d(1), d(2)], today).current, 3);
// Missing today but trained yesterday -> streak alive.
eq('streak grace today', A.computeStreak([d(1), d(2)], today).current, 2);
// Missing yesterday too -> broken.
eq('streak broken', A.computeStreak([d(3), d(4)], today).current, 0);
eq('streak longest', A.computeStreak([d(10), d(9), d(8), d(1), d(0)], today).longest, 3);
eq('streak empty', A.computeStreak([], today).current, 0);

// ---------- milestones -------------------------------------------
const ms1 = A.detectMilestones({ solveCount: 550, streak: 8 });
const ids = ms1.map(m => m.id);
check('milestone 100 solves', ids.includes('solves_100'));
check('milestone 500 solves', ids.includes('solves_500'));
check('milestone not 1000', !ids.includes('solves_1000'));
check('milestone streak 7', ids.includes('streak_7'));
check('milestone not streak 14', !ids.includes('streak_14'));
// Already-shown milestones are not repeated.
eq('milestone dedupe', A.detectMilestones({ solveCount: 550, streak: 8 }, ids).length, 0);
// Goal reached fires a milestone.
const goalMs = A.detectMilestones({ progress: { reached: true, metric: 'ao100', targetMs: 10000 } });
check('milestone goal', goalMs.some(m => m.type === 'goal'));

// ---------- metrics snapshot -------------------------------------
const m = A.computeMetrics(run(120, 11800, -2, 400), {
    event: '333', goal: { metric: 'ao100', targetMs: 10000, startMs: 12500 },
});
eq('metrics event', m.event, '333');
eq('metrics count', m.solveCount, 120);
check('metrics has ao100', m.current.ao100 !== null);
check('metrics has best single', m.best.single > 0);
check('metrics has trend', !!m.trend.direction);
check('metrics has goal', m.goal && m.goal.metric === 'ao100');
check('metrics has span', m.span && m.span.firstSolveAt < m.span.lastSolveAt);
eq('metrics success rate', m.successRate, 1);

// A DNF-heavy session must not produce a bogus average.
const dnfHeavy = Array.from({ length: 20 }, (_, i) => i % 2 ? dnf(10000) : ok(10000));
const dm = A.computeMetrics(dnfHeavy, {});
eq('dnf-heavy ao5 is null', dm.current.ao5, null);
eq('dnf-heavy success rate', dm.successRate, 0.5);
eq('dnf-heavy count', dm.dnfCount, 10);

// Empty input must not throw.
const em = A.computeMetrics([], {});
eq('empty solveCount', em.solveCount, 0);
eq('empty ao5', em.current.ao5, null);
eq('empty span', em.span, null);

// ---------- formatting -------------------------------------------
eq('fmt seconds', A.fmtMs(12345), '12.35');
eq('fmt minutes', A.fmtMs(62500), '1:02.50');
eq('fmt pads seconds', A.fmtMs(65000), '1:05.00');
eq('fmt null', A.fmtMs(null), '—');
eq('fmt infinity', A.fmtMs(Infinity), '—');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
