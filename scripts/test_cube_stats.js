/* Verifies cube-stats.js against the WCA rules and against the exact
   behaviour timer.js had before the extraction. Run: node scripts/test_cube_stats.js */
const S = require('../cube-stats.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
    const ok = Object.is(got, want) || (typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) < 1e-6);
    if (ok) { pass++; } else { fail++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
}

const ok = (t) => ({ time: t, penalty: '' });
const p2 = (t) => ({ time: t, penalty: '+2' });
const dnf = (t) => ({ time: t, penalty: 'DNF' });

// --- effectiveMs -------------------------------------------------
eq('effectiveMs ok', S.effectiveMs(ok(10000)), 10000);
eq('effectiveMs +2', S.effectiveMs(p2(10000)), 12000);
eq('effectiveMs DNF', S.effectiveMs(dnf(10000)), Infinity);

// --- singles: +2 counts, DNF never does --------------------------
eq('best ignores DNF', S.getBestSingle([dnf(5000), ok(9000), ok(11000)]), 9000);
eq('best counts +2', S.getBestSingle([p2(8000), ok(9500)]), 9500);
eq('worst ignores DNF', S.getWorstSingle([dnf(99000), ok(9000), ok(11000)]), 11000);
eq('best all-DNF is null', S.getBestSingle([dnf(1), dnf(2)]), null);

// --- Ao5: drops best and worst -----------------------------------
// [10,11,12,13,14] -> drop 10 and 14 -> (11+12+13)/3 = 12
eq('ao5 trims', S.getAverage([10, 11, 12, 13, 14].map(n => ok(n * 1000)), 5), 12000);
// One DNF is allowed in an Ao5 and becomes the dropped worst.
eq('ao5 one DNF ok', S.getAverage([ok(10000), ok(11000), ok(12000), ok(13000), dnf(1)], 5), 12000);
// Two DNFs make it a DNF average.
eq('ao5 two DNF', S.getAverage([ok(10000), ok(11000), ok(12000), dnf(1), dnf(1)], 5), Infinity);
// +2 is included at the penalised time: 12000 becomes the worst and is dropped.
eq('ao5 with +2', S.getAverage([ok(10000), ok(11000), p2(10000), ok(13000), ok(9000)], 5), 11000);
// Not enough solves yet.
eq('ao5 too few', S.getAverage([ok(1), ok(2)], 5), null);
// Uses the LAST n, not the first.
eq('ao5 uses tail', S.getAverage([ok(99000), ...[10, 11, 12, 13, 14].map(n => ok(n * 1000))], 5), 12000);

// --- Mo3: no trimming, any DNF kills it --------------------------
eq('mo3 means all', S.getAverage([ok(10000), ok(11000), ok(12000)], 3, true), 11000);
eq('mo3 one DNF', S.getAverage([ok(10000), ok(11000), dnf(1)], 3, true), Infinity);

// --- Ao12 --------------------------------------------------------
const twelve = Array.from({ length: 12 }, (_, i) => ok((10 + i) * 1000));
// drop 10 and 21 -> mean of 11..20 = 15.5
eq('ao12 trims', S.getAverage(twelve, 12), 15500);

// --- best rolling average ----------------------------------------
// Best Ao5 across a run where the last 5 are fastest.
const run = [20, 20, 20, 20, 20, 9, 10, 11, 12, 13].map(n => ok(n * 1000));
eq('bestAverage ao5', S.getBestAverage(run, 5), 11000);

// --- mean / stddev / success rate --------------------------------
eq('mean skips DNF', S.getMean([ok(10000), ok(20000), dnf(99000)]), 15000);
eq('mean empty', S.getMean([]), null);
eq('stddev needs 2', S.getStdDev([ok(10000)]), null);
eq('stddev sample', S.getStdDev([ok(10000), ok(20000)]), Math.sqrt(50000000));
eq('successRate', S.getSuccessRate([ok(1), ok(1), dnf(1), ok(1)]), 0.75);
eq('successRate empty', S.getSuccessRate([]), null);
eq('totalSolves counts DNF', S.getTotalSolves([ok(1), dnf(1)]), 2);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
