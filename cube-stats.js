/* ============================================================
   CubingHQ — shared solve statistics
   ------------------------------------------------------------
   The WCA-correct averaging rules, lifted out of timer.js so the
   AI Coach computes its numbers with exactly the same code the
   timer displays. Two implementations would drift, and the Coach
   quoting a different Ao100 than the timer shows is the fastest
   way to lose a user's trust in it.

   Pure logic — no DOM, no network, no state. Directly testable in
   plain Node, same UMD wrapper as solve-analysis.js.

   A solve is { time: <ms>, penalty: '' | '+2' | 'DNF', ... }.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CubeStats = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Milliseconds this solve counts for. Infinity for a DNF so it
    // sorts last and can be counted without special-casing.
    function effectiveMs(s) {
        if (!s) return null;
        if (s.penalty === 'DNF') return Infinity;
        const base = s.time;
        if (s.penalty === '+2') return base + 2000;
        return base;
    }

    function getBestSingle(solves) {
        let best = null;
        for (const s of solves) {
            const m = effectiveMs(s);
            if (m === null || m === Infinity) continue;
            if (best === null || m < best) best = m;
        }
        return best;
    }

    function getWorstSingle(solves) {
        let worst = null;
        for (const s of solves) {
            const m = effectiveMs(s);
            if (m === null || m === Infinity) continue;
            if (worst === null || m > worst) worst = m;
        }
        return worst;
    }

    function getMean(solves) {
        const filtered = solves.filter(s => s.penalty !== 'DNF');
        if (filtered.length === 0) return null;
        const sum = filtered.reduce((a, s) => a + s.time, 0);
        return sum / filtered.length;
    }

    /**
     * Average of the last `n` solves.
     * n = 5 (Ao5), 12 (Ao12), 100 (Mo100) when mo3 = false.
     * When mo3 = true (WCA Mean-of-3 for 6x6 / 7x7 / FMC / etc.),
     * don't drop best & worst — average all 3.
     * Returns null when there aren't n solves yet, Infinity for a DNF average.
     */
    function getAverage(solves, n, mo3 = false) {
        const end = solves.length;
        const start = Math.max(0, end - n);
        const window = solves.slice(start, end);
        if (window.length < n) return null;

        let dnfCount = window.filter(s => s.penalty === 'DNF').length;
        if (mo3) {
            if (dnfCount >= 1) return Infinity;
        } else {
            if (n >= 5) {
                if (dnfCount >= 2) return Infinity;
            } else {
                if (dnfCount >= 1) return Infinity;
            }
        }

        const times = window.map(s => {
            if (s.penalty === 'DNF') return Infinity;
            return s.time + (s.penalty === '+2' ? 2000 : 0);
        });
        if (n === 1) return times[0];
        if (mo3) {
            const sum = times.reduce((a, b) => a + b, 0);
            return sum / times.length;
        }
        const sorted = [...times].sort((a, b) => a - b);
        const mid = sorted.slice(1, -1);   // drop best and worst
        const sum = mid.reduce((a, b) => a + b, 0);
        return sum / mid.length;
    }

    function getBestAverage(solves, n, mo3 = false) {
        let best = null;
        for (let i = n; i <= solves.length; i++) {
            const avg = getAverage(solves.slice(0, i), n, mo3);
            if (avg === null || avg === Infinity) continue;
            if (best === null || avg < best) best = avg;
        }
        return best;
    }

    function getStdDev(solves) {
        const filtered = solves.filter(s => s.penalty !== 'DNF');
        if (filtered.length < 2) return null;
        const mean = filtered.reduce((a, s) => a + s.time, 0) / filtered.length;
        const sq = filtered.reduce((a, s) => a + Math.pow(s.time - mean, 2), 0);
        return Math.sqrt(sq / (filtered.length - 1));
    }

    function getSuccessRate(solves) {
        if (solves.length === 0) return null;
        const success = solves.filter(s => s.penalty !== 'DNF').length;
        return success / solves.length;
    }

    function getTotalSolves(solves) {
        return solves.length;
    }

    return {
        effectiveMs,
        getBestSingle,
        getWorstSingle,
        getMean,
        getAverage,
        getBestAverage,
        getStdDev,
        getSuccessRate,
        getTotalSolves,
    };
});
