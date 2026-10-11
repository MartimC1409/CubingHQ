/* ============================================================
   CubingHQ — solve timer core
   ------------------------------------------------------------
   The part of a speedcubing timer that is the same everywhere:
   inspection, the hold-to-arm delay, start, stop, and the WCA
   penalty rules that fall out of inspection. No DOM, no storage,
   no clock of its own — the caller passes timestamps in, so the
   same object can run the solo timer, two players side by side on
   one screen, or a timer synced to a server clock.

   timer.js drives its display from one of these; Cube Fights runs
   one per player.

   Phases:
     idle            nothing happening
     inspecting      15s inspection running
     holding         pressed, waiting out the hold delay
     ready           held long enough — release to start
     running         solving
     stopped         solve finished, result available
     inspection_dnf  inspection ran out before the solve started

   Inspection rules:
     'wca'     WCA Regulation A3: starting after 15s is +2, after
               17s is DNF.
     'strict'  DNF the moment 15s is up. What the solo timer has
               always done, kept so its behaviour does not change.

   Exposed as window.TimerCore, and as a CommonJS module for tests
   and for the server, which validates fight results with the same
   penalty rules.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TimerCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const INSPECTION_MS = 15000;
    const INSPECTION_DNF_MS = 17000;
    // A press this soon after inspection starts is the same finger that
    // started it, not a decision to solve.
    const INSPECTION_GUARD_MS = 500;

    /** 12.34, 1:02.34, or DNF. Milliseconds in. */
    function fmt(ms) {
        if (ms === Infinity || ms === null || ms === undefined || Number.isNaN(ms)) return 'DNF';
        if (ms >= 60000) {
            const totalSec = ms / 1000;
            const m = Math.floor(totalSec / 60);
            const s = (totalSec % 60).toFixed(2);
            return `${m}:${s.padStart(5, '0')}`;
        }
        return (ms / 1000).toFixed(2);
    }

    const SEVERITY = { '': 0, '+2': 1, 'DNF': 2 };
    function normPenalty(p) {
        return p === '+2' || p === 'DNF' ? p : '';
    }
    /** The more severe of two penalties. */
    function worsePenalty(a, b) {
        const pa = normPenalty(a), pb = normPenalty(b);
        return SEVERITY[pa] >= SEVERITY[pb] ? pa : pb;
    }

    /** The penalty earned by starting a solve `usedMs` into inspection. */
    function inspectionPenalty(usedMs, rule) {
        if (!(usedMs > INSPECTION_MS)) return '';
        if (rule === 'strict') return 'DNF';
        return usedMs > INSPECTION_DNF_MS ? 'DNF' : '+2';
    }

    /** The time a solve counts as: +2 adds two seconds, DNF is Infinity. */
    function effectiveMs(ms, penalty) {
        const p = normPenalty(penalty);
        if (p === 'DNF' || typeof ms !== 'number' || !isFinite(ms)) return Infinity;
        return p === '+2' ? ms + 2000 : ms;
    }

    function value(v) { return typeof v === 'function' ? v() : v; }

    /**
     * One timer.
     *
     * opts.holdMs          hold delay before 'ready' (number or getter), default 300
     * opts.inspection      whether pressing from idle starts inspection (bool or getter)
     * opts.inspectionRule  'wca' (default) or 'strict'
     * opts.now             clock, default performance.now
     * opts.schedule/cancel timer functions for the hold delay (tests swap these)
     * opts.onChange        (phase, previous, info) on every transition; `info`
     *                      carries { ms, penalty } on 'stopped'
     */
    function createSolveTimer(opts = {}) {
        const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
        const schedule = opts.schedule || ((fn, ms) => setTimeout(fn, ms));
        const cancel = opts.cancel || ((id) => clearTimeout(id));
        const rule = opts.inspectionRule || 'wca';

        const s = {
            phase: 'idle',
            inspectionStart: null,   // null when this solve has no inspection
            holdStart: 0,
            holdTimer: null,
            runStart: 0,
            startPenalty: '',
            result: null,            // { ms, penalty } once stopped
        };

        function set(phase, info) {
            const prev = s.phase;
            s.phase = phase;
            if (opts.onChange) opts.onChange(phase, prev, info || null);
        }

        function clearHold() {
            if (s.holdTimer !== null) cancel(s.holdTimer);
            s.holdTimer = null;
        }

        function inspectionUsed(t) {
            return s.inspectionStart === null ? 0 : t - s.inspectionStart;
        }

        /** Out of inspection time? Moves to inspection_dnf and says so. */
        function checkInspection(t) {
            if (s.inspectionStart === null) return false;
            if (!['inspecting', 'holding', 'ready'].includes(s.phase)) return false;
            const limit = rule === 'strict' ? INSPECTION_MS : INSPECTION_DNF_MS;
            if (inspectionUsed(t) < limit) return false;
            clearHold();
            s.result = { ms: null, penalty: 'DNF' };
            set('inspection_dnf');
            return true;
        }

        function holdLength() {
            return Math.max(0, Number(value(opts.holdMs === undefined ? 300 : opts.holdMs)) || 0);
        }

        /** Held long enough? Decided from timestamps, not from the timer firing. */
        function heldEnough(t) {
            return s.phase === 'holding' && t - s.holdStart >= holdLength();
        }

        function beginHold(t) {
            s.holdStart = t;
            set('holding');
            const hold = holdLength();
            if (hold <= 0) { set('ready'); return; }
            s.holdTimer = schedule(() => {
                s.holdTimer = null;
                if (s.phase !== 'holding') return;
                if (checkInspection(now())) return;
                set('ready');
            }, hold);
        }

        function startRun(t) {
            s.startPenalty = inspectionPenalty(inspectionUsed(t), rule);
            s.runStart = t;
            set('running');
        }

        const api = {
            get phase() { return s.phase; },
            get result() { return s.result; },
            get runStart() { return s.runStart; },
            get inspectionStart() { return s.inspectionStart; },
            get startPenalty() { return s.startPenalty; },

            /** Begin inspection now, or at a scheduled time (a synced round start). */
            startInspection(t = now()) {
                if (s.phase !== 'idle') return false;
                s.result = null;
                s.inspectionStart = t;
                set('inspecting');
                return true;
            },

            /** Space down / finger down. */
            press(t = now()) {
                if (checkInspection(t)) return;
                switch (s.phase) {
                    case 'idle':
                        s.result = null;
                        if (value(opts.inspection)) api.startInspection(t);
                        else { s.inspectionStart = null; beginHold(t); }
                        break;
                    case 'inspecting':
                        if (inspectionUsed(t) < INSPECTION_GUARD_MS) return;
                        beginHold(t);
                        break;
                    case 'running':
                        api.stop(t);
                        break;
                    default:
                        break;   // holding, ready, stopped, inspection_dnf: nothing to do
                }
            },

            /** Space up / finger up. */
            release(t = now()) {
                if (checkInspection(t)) return;
                // A throttled background tab can fire the hold timer late;
                // the hold itself is measured, so a full hold still counts.
                if (heldEnough(t)) { clearHold(); set('ready'); }
                if (s.phase === 'holding') {
                    // Let go too early: back to inspection if it is still
                    // running, otherwise back to rest.
                    clearHold();
                    set(s.inspectionStart === null ? 'idle' : 'inspecting');
                } else if (s.phase === 'ready') {
                    startRun(t);
                }
            },

            /** Call from an animation frame: catches inspection running out. */
            tick(t = now()) {
                if (checkInspection(t)) return s.phase;
                if (heldEnough(t)) { clearHold(); set('ready'); }
                return s.phase;
            },

            stop(t = now()) {
                if (s.phase !== 'running') return null;
                const ms = Math.max(0, Math.round(t - s.runStart));
                s.result = { ms, penalty: s.startPenalty };
                set('stopped', s.result);
                return s.result;
            },

            /** Straight to running, no hold or inspection (a smart cube's first move). */
            forceStart(t = now()) {
                if (s.phase !== 'idle') return false;
                s.result = null;
                s.inspectionStart = null;
                startRun(t);
                return true;
            },

            reset() {
                clearHold();
                s.inspectionStart = null;
                s.startPenalty = '';
                if (s.phase !== 'idle') set('idle');
            },

            elapsed(t = now()) {
                if (s.phase === 'running') return t - s.runStart;
                if (s.phase === 'stopped' && s.result) return s.result.ms;
                return 0;
            },

            /** Inspection milliseconds left (may go negative into the +2 window). */
            inspectionLeft(t = now()) {
                return s.inspectionStart === null ? INSPECTION_MS : INSPECTION_MS - inspectionUsed(t);
            },

            /** The penalty a start right now would earn. */
            pendingPenalty(t = now()) {
                return inspectionPenalty(inspectionUsed(t), rule);
            },
        };
        return api;
    }

    return {
        INSPECTION_MS,
        INSPECTION_DNF_MS,
        INSPECTION_GUARD_MS,
        fmt,
        normPenalty,
        worsePenalty,
        inspectionPenalty,
        effectiveMs,
        createSolveTimer,
    };
});
