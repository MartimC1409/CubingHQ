/* ============================================================
   CubingHQ Coach — deterministic analytics
   ------------------------------------------------------------
   Everything the Coach states as fact is computed here, in plain
   JavaScript, from the user's actual solves. The language model is
   given the OUTPUT of this file and never the raw solve list, so it
   has nothing to compute and therefore nothing to get wrong.

   Built on cube-stats.js — the same averaging code the timer uses.

   Pure logic — no DOM, no network. Testable in plain Node.
   ============================================================ */
(function (root, factory) {
    const stats = (typeof module === 'object' && module.exports)
        ? require('./cube-stats.js')
        : root.CubeStats;
    const api = factory(stats);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CoachAnalytics = api;
})(typeof self !== 'undefined' ? self : this, function (S) {
    'use strict';

    const DAY_MS = 24 * 60 * 60 * 1000;

    // Below this, a trend line is noise. Stated rather than guessed at:
    // the Coach says "not enough data" instead of reading tea leaves.
    const MIN_SOLVES_FOR_TREND = 30;
    // A change smaller than this across the window isn't distinguishable
    // from normal session-to-session variation.
    const TREND_SIGNIFICANCE = 0.02;   // 2% of the mean

    const isReal = (v) => v !== null && v !== undefined && isFinite(v);

    // ---------- rolling series ------------------------------------
    /**
     * Rolling average at every index, so the chart can draw a line and
     * the trend maths has a series to regress on.
     * Returns an array the same length as `solves`; entries before the
     * window is full are null.
     */
    function rollingAverage(solves, n, mo3 = false) {
        const out = new Array(solves.length).fill(null);
        for (let i = n - 1; i < solves.length; i++) {
            const avg = S.getAverage(solves.slice(0, i + 1), n, mo3);
            out[i] = (avg === Infinity) ? null : avg;
        }
        return out;
    }

    /** Index of each solve that set a new personal best at the time. */
    function pbMarkers(solves) {
        const out = [];
        let best = null;
        solves.forEach((s, i) => {
            const ms = S.effectiveMs(s);
            if (!isReal(ms) || ms === Infinity) return;
            if (best === null || ms < best) { best = ms; out.push({ index: i, timeMs: ms }); }
        });
        return out;
    }

    /**
     * Indexes where a new session starts, for chart dividers.
     * A gap longer than `gapHours` is treated as a new sitting; solves
     * without timestamps produce no boundaries rather than fake ones.
     */
    function sessionBoundaries(solves, gapHours = 6) {
        const gap = gapHours * 60 * 60 * 1000;
        const out = [];
        for (let i = 1; i < solves.length; i++) {
            const a = solves[i - 1].timestamp, b = solves[i].timestamp;
            if (a && b && (b - a) > gap) out.push(i);
        }
        return out;
    }

    // ---------- trend ---------------------------------------------
    /** Least-squares fit over [{x,y}]. Returns slope, intercept, r2. */
    function linearRegression(points) {
        const n = points.length;
        if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
        let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
        for (const p of points) {
            sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; syy += p.y * p.y;
        }
        const denom = n * sxx - sx * sx;
        if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 };
        const slope = (n * sxy - sx * sy) / denom;
        const intercept = (sy - slope * sx) / n;
        const rDenom = Math.sqrt(denom * (n * syy - sy * sy));
        const r = rDenom === 0 ? 0 : (n * sxy - sx * sy) / rDenom;
        return { slope, intercept, r2: r * r };
    }

    /**
     * Direction of travel over the most recent `window` solves.
     * direction: improving | regressing | plateau | insufficient_data
     * Negative slope means times are falling, which is improvement.
     */
    function analyseTrend(solves, window = 100) {
        const recent = solves.slice(-window);
        const usable = recent.filter(s => s.penalty !== 'DNF');
        if (usable.length < MIN_SOLVES_FOR_TREND) {
            return {
                direction: 'insufficient_data',
                solvesAnalysed: usable.length,
                solvesNeeded: MIN_SOLVES_FOR_TREND,
                slopeMsPerSolve: null, changeMs: null, changePct: null, r2: null,
            };
        }

        const points = usable.map((s, i) => ({ x: i, y: S.effectiveMs(s) }));
        const { slope, r2 } = linearRegression(points);
        const mean = points.reduce((a, p) => a + p.y, 0) / points.length;
        const changeMs = slope * (points.length - 1);
        const changePct = mean === 0 ? 0 : changeMs / mean;

        let direction;
        if (Math.abs(changePct) < TREND_SIGNIFICANCE) direction = 'plateau';
        else if (changePct < 0) direction = 'improving';
        else direction = 'regressing';

        return {
            direction,
            solvesAnalysed: usable.length,
            slopeMsPerSolve: slope,
            changeMs,                      // negative = got faster
            changePct,
            r2,                            // how well a straight line fits
        };
    }

    /**
     * Consistency measured as coefficient of variation (stddev / mean),
     * comparing the older half of the window against the newer half.
     * Lower CV means tighter, more repeatable solves.
     */
    function analyseConsistency(solves, window = 100) {
        const recent = solves.slice(-window).filter(s => s.penalty !== 'DNF');
        if (recent.length < MIN_SOLVES_FOR_TREND) {
            return { direction: 'insufficient_data', cv: null, earlierCv: null, laterCv: null };
        }
        const cvOf = (list) => {
            const mean = S.getMean(list);
            const sd = S.getStdDev(list);
            if (!isReal(mean) || !isReal(sd) || mean === 0) return null;
            return sd / mean;
        };
        const mid = Math.floor(recent.length / 2);
        const earlierCv = cvOf(recent.slice(0, mid));
        const laterCv = cvOf(recent.slice(mid));
        const cv = cvOf(recent);

        let direction = 'stable';
        if (isReal(earlierCv) && isReal(laterCv)) {
            const delta = (laterCv - earlierCv) / earlierCv;
            if (delta < -0.08) direction = 'improving';
            else if (delta > 0.08) direction = 'worsening';
        } else direction = 'insufficient_data';

        return { direction, cv, earlierCv, laterCv };
    }

    /**
     * How far the fastest solves sit from the typical ones. A large gap
     * means the raw speed is already there and consistency is the limit —
     * the single most useful structural fact the Coach can be handed.
     */
    function analyseSpread(solves, window = 100) {
        const recent = solves.slice(-window).filter(s => s.penalty !== 'DNF')
            .map(s => S.effectiveMs(s)).sort((a, b) => a - b);
        if (recent.length < 12) return null;
        const at = (q) => recent[Math.min(recent.length - 1, Math.floor(q * recent.length))];
        const p10 = at(0.10), p50 = at(0.50), p90 = at(0.90);
        return {
            p10, p50, p90,
            spreadMs: p90 - p10,
            spreadPct: p50 === 0 ? 0 : (p90 - p10) / p50,
            // How much faster the good solves are than the median.
            upsidePct: p50 === 0 ? 0 : (p50 - p10) / p50,
        };
    }

    // ---------- goal ----------------------------------------------
    const GOAL_METRICS = ['single', 'ao5', 'ao12', 'ao50', 'ao100'];

    function metricValue(solves, metric, mo3 = false) {
        switch (metric) {
            case 'single': return S.getBestSingle(solves);
            case 'ao5': return S.getAverage(solves, 5, mo3);
            case 'ao12': return S.getAverage(solves, 12, mo3);
            case 'ao50': return S.getAverage(solves, 50, mo3);
            case 'ao100': return S.getAverage(solves, 100, mo3);
            default: return null;
        }
    }

    /**
     * Progress toward the goal, measured on the goal's OWN metric.
     *
     * Deliberately never uses the best single unless the user's goal
     * metric IS the single. A 9.42 PB alongside an 11.82 Ao100 is not
     * "basically sub-10", and the product rule is that we never imply
     * it is. `startMs` anchors the bar so progress reflects distance
     * travelled rather than an arbitrary fraction.
     */
    function goalProgress(solves, goal, mo3 = false) {
        if (!goal || !isReal(goal.targetMs) || !GOAL_METRICS.includes(goal.metric)) return null;

        const current = metricValue(solves, goal.metric, mo3);
        if (!isReal(current) || current === Infinity) {
            return {
                metric: goal.metric, targetMs: goal.targetMs,
                currentMs: null, gapMs: null, pct: 0, reached: false,
                reason: 'not_enough_solves',
            };
        }

        const start = isReal(goal.startMs) ? goal.startMs : current;
        const gapMs = current - goal.targetMs;
        const total = start - goal.targetMs;
        let pct;
        if (total <= 0) pct = current <= goal.targetMs ? 1 : 0;
        else pct = Math.max(0, Math.min(1, (start - current) / total));

        return {
            metric: goal.metric,
            targetMs: goal.targetMs,
            currentMs: current,
            startMs: start,
            gapMs,                                  // >0 = still to go
            pct,
            reached: current <= goal.targetMs,
            daysRemaining: goal.targetDate
                ? Math.ceil((Date.parse(goal.targetDate) - Date.now()) / DAY_MS)
                : null,
        };
    }

    // ---------- streak & milestones -------------------------------
    const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

    /** Consecutive days with at least one solve, counting back from today. */
    function computeStreak(trainedDays, nowMs = Date.now()) {
        const days = new Set(trainedDays);
        if (!days.size) return { current: 0, longest: 0, lastTrained: null };

        let current = 0;
        let cursor = nowMs;
        // Today not yet trained doesn't break the streak until tomorrow.
        if (!days.has(dayKey(cursor))) cursor -= DAY_MS;
        while (days.has(dayKey(cursor))) { current++; cursor -= DAY_MS; }

        const sorted = [...days].sort();
        let longest = 0, run = 0, prev = null;
        for (const d of sorted) {
            if (prev && (Date.parse(d) - Date.parse(prev)) === DAY_MS) run++;
            else run = 1;
            longest = Math.max(longest, run);
            prev = d;
        }
        return { current, longest, lastTrained: sorted[sorted.length - 1] };
    }

    const SOLVE_MILESTONES = [100, 500, 1000, 5000, 10000];
    const STREAK_MILESTONES = [3, 7, 14, 30];

    /**
     * Milestones newly reached. `already` is the set of ids the user has
     * been shown, so nothing is celebrated twice.
     */
    function detectMilestones({ solveCount = 0, streak = 0, progress = null, previous = {} }, already = []) {
        const have = new Set(already);
        const out = [];
        const add = (id, type, label, value) => {
            if (!have.has(id)) out.push({ id, type, label, value, at: Date.now() });
        };

        for (const m of SOLVE_MILESTONES) {
            if (solveCount >= m) add(`solves_${m}`, 'solves', `${m.toLocaleString()} solves`, m);
        }
        for (const m of STREAK_MILESTONES) {
            if (streak >= m) add(`streak_${m}`, 'streak', `${m}-day training streak`, m);
        }
        if (progress && isReal(progress.currentMs) && isReal(previous.currentMs)) {
            const gained = previous.currentMs - progress.currentMs;
            for (const half of [500, 1000, 2000, 3000]) {
                if (gained >= half) {
                    add(`improve_${progress.metric}_${half}`, 'improvement',
                        `${(half / 1000).toFixed(1)}s off your ${progress.metric.toUpperCase()}`, half);
                }
            }
        }
        if (progress && progress.reached) {
            add(`goal_${progress.metric}_${progress.targetMs}`, 'goal',
                `Reached your ${progress.metric.toUpperCase()} goal`, progress.targetMs);
        }
        return out;
    }

    // ---------- the snapshot handed to the model ------------------
    /**
     * The complete deterministic picture. This object — and nothing else —
     * is what the language model receives as fact.
     *
     * @param {Array} solves oldest-first
     * @param {{event?:string, goal?:object, mo3?:boolean}} opts
     */
    function computeMetrics(solves, opts = {}) {
        const list = Array.isArray(solves) ? solves : [];
        const mo3 = !!opts.mo3;
        const trend = analyseTrend(list);
        const consistency = analyseConsistency(list);
        const spread = analyseSpread(list);
        const progress = goalProgress(list, opts.goal, mo3);

        const timestamps = list.map(s => s.timestamp).filter(Boolean);

        return {
            event: opts.event || '333',
            solveCount: list.length,
            dnfCount: list.filter(s => s.penalty === 'DNF').length,
            plusTwoCount: list.filter(s => s.penalty === '+2').length,
            successRate: S.getSuccessRate(list),

            best: {
                single: S.getBestSingle(list),
                ao5: S.getBestAverage(list, 5, mo3),
                ao12: S.getBestAverage(list, 12, mo3),
                ao100: S.getBestAverage(list, 100, mo3),
            },
            current: {
                mean: S.getMean(list),
                ao5: nullIfInf(S.getAverage(list, 5, mo3)),
                ao12: nullIfInf(S.getAverage(list, 12, mo3)),
                ao50: nullIfInf(S.getAverage(list, 50, mo3)),
                ao100: nullIfInf(S.getAverage(list, 100, mo3)),
                stdDev: S.getStdDev(list),
            },
            trend,
            consistency,
            spread,
            goal: progress,
            span: timestamps.length
                ? { firstSolveAt: Math.min(...timestamps), lastSolveAt: Math.max(...timestamps) }
                : null,
        };
    }

    function nullIfInf(v) { return v === Infinity ? null : v; }

    // ---------- formatting (shared by UI and prompt) --------------
    /** 12345 -> "12.35"; 62500 -> "1:02.50". Never returns NaN. */
    function fmtMs(ms) {
        if (!isReal(ms) || ms === Infinity) return '—';
        const total = ms / 1000;
        if (total < 60) return total.toFixed(2);
        const m = Math.floor(total / 60);
        const s = total - m * 60;
        return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
    }

    return {
        rollingAverage, pbMarkers, sessionBoundaries,
        linearRegression, analyseTrend, analyseConsistency, analyseSpread,
        goalProgress, metricValue, computeStreak, detectMilestones,
        computeMetrics, fmtMs,
        GOAL_METRICS, MIN_SOLVES_FOR_TREND, SOLVE_MILESTONES, STREAK_MILESTONES,
    };
});
