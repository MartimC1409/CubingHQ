/* ============================================================
   CubingHQ Coach — training runner
   ------------------------------------------------------------
   Turns a prescribed drill into solves actually done in the site's
   timer, then feeds the result back into the coaching loop.

   The handoff is a URL: coach.html sends the user to
   timer.html?coach=<drillId>&event=…&solves=…, coach-timer-bridge.js
   runs the drill there, and the finished session comes back through
   localStorage. That keeps the timer untouched apart from one event
   dispatch, rather than embedding a second timer in the Coach.

   Exposed as window.CoachTraining.
   ============================================================ */
(function () {
    'use strict';

    const HANDOFF_KEY = 'chq_coach_drill_result';
    const UI = () => window.CoachUI;
    const A = () => window.CoachAnalytics;
    const Store = () => window.CoachStore;

    /** Today's drills, from the plan, ensuring the day's record exists. */
    function today() {
        const day = Store().todayKey();
        let entry = Store().getTraining(day);
        if (entry) return entry;

        const plan = Store().getPlan();
        const todayPlan = plan && plan.plan && plan.plan.today;
        if (!todayPlan || !Array.isArray(todayPlan.drills) || !todayPlan.drills.length) return null;

        entry = {
            day,
            focus: todayPlan.focus,
            rationale: todayPlan.rationale,
            drills: todayPlan.drills,
            completedDrillIds: [],
            startedAt: null,
            solveIdsBefore: null,
        };
        Store().setTraining(day, entry);
        return entry;
    }

    /** Sends the user to the timer set up for this drill. */
    function start(drillId) {
        const entry = today();
        if (!entry) return;
        const drill = entry.drills.find(d => d.id === drillId) || entry.drills[0];
        if (!drill) return;

        const profile = Store().getProfile();
        const event = profile && profile.primaryEvent ? profile.primaryEvent : '333';

        // Record the baseline before the block, so "did this help?" is a
        // comparison rather than an impression.
        if (!entry.statsBefore) {
            const solves = Store().solvesForEvent(event);
            entry.statsBefore = A().computeMetrics(solves, {
                event, mo3: UI().isMo3(event),
                goal: profile ? profile.goal : null,
            });
            entry.startedAt = Date.now();
            Store().setTraining(entry.day, entry);
        }

        const params = new URLSearchParams({
            coach: drill.id,
            event,
            solves: String(drill.solveTarget || 0),
            title: drill.title || '',
            objective: drill.objective || '',
            mode: drill.mode || 'timed',
        });
        window.location.href = 'timer.html?' + params.toString();
    }

    /**
     * Picks up a finished drill on return from the timer.
     * Returns the ingested result, or null if there was nothing waiting.
     */
    function collectResult() {
        let payload = null;
        try {
            const raw = localStorage.getItem(HANDOFF_KEY);
            if (!raw) return null;
            payload = JSON.parse(raw);
            localStorage.removeItem(HANDOFF_KEY);
        } catch (e) {
            try { localStorage.removeItem(HANDOFF_KEY); } catch (e2) { }
            return null;
        }
        if (!payload || !Array.isArray(payload.solves) || !payload.solves.length) return null;

        // Save the solves FIRST. The handoff has already been cleared from
        // storage, so anything that bails before this point loses the
        // user's work — and the solves are worth keeping whether or not a
        // training record exists to attach them to.
        const day = Store().todayKey();
        Store().addSession({
            source: 'timer',
            name: `${payload.title || 'Training'} · ${day}`,
            event: payload.event || '333',
            solves: payload.solves,
        });
        Store().markTrained(day);
        checkMilestones();

        const entry = today();
        if (!entry) return { day, solveCount: payload.solves.length, orphaned: true };

        Store().completeDrill(payload.drillId, entry.day);

        const refreshed = Store().getTraining(entry.day);
        refreshed.lastResult = {
            drillId: payload.drillId,
            solveCount: payload.solves.length,
            at: Date.now(),
        };
        Store().setTraining(entry.day, refreshed);
        return refreshed;
    }

    function checkMilestones() {
        const profile = Store().getProfile();
        if (!profile) return [];
        const event = profile.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const metrics = A().computeMetrics(solves, {
            event, mo3: UI().isMo3(event), goal: profile.goal,
        });

        const state = Store().get();
        const history = state.progress.metricHistory || [];
        const previous = history.length > 1 ? history[history.length - 2] : null;

        const fresh = A().detectMilestones({
            solveCount: solves.length,
            streak: state.progress.streak ? state.progress.streak.current : 0,
            progress: metrics.goal,
            previous: previous ? { currentMs: previous.valueMs } : {},
        }, Store().seenMilestoneIds());

        if (metrics.goal && isFinite(metrics.goal.currentMs)) {
            Store().recordMetricPoint(profile.goal.metric, metrics.goal.currentMs);
        }
        if (fresh.length) {
            Store().addMilestones(fresh);
            UI().toast(fresh[0].label);
        }
        return fresh;
    }

    /**
     * Whether enough has changed to be worth asking the Coach to revise.
     *
     * This gate is deterministic on purpose. The model judges whether the
     * training worked; it does not get to decide when it is consulted,
     * which is what keeps this a feedback loop rather than a model
     * re-diagnosing itself in a circle.
     */
    function shouldRevise() {
        const plan = Store().getPlan();
        const profile = Store().getProfile();
        if (!plan || !profile || !profile.goal) return { revise: false, reason: 'no-plan' };

        const event = profile.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const state = Store().get();

        const lastRevisedAt = plan.revisedAt || plan.generatedAt || 0;
        const solvesSince = solves.filter(s => (s.timestamp || 0) > lastRevisedAt).length;

        // A block worth judging: enough solves to move a rolling average.
        if (solvesSince < 50) return { revise: false, reason: 'too-few', solvesSince };

        // Or the goal metric moved meaningfully in either direction.
        const history = state.progress.metricHistory || [];
        if (history.length >= 2) {
            const latest = history[history.length - 1].valueMs;
            const earlier = history[Math.max(0, history.length - 5)].valueMs;
            if (isFinite(latest) && isFinite(earlier) && earlier > 0) {
                const moved = Math.abs(latest - earlier) / earlier;
                if (moved >= 0.03) return { revise: true, reason: 'metric-moved', solvesSince };
            }
        }
        return { revise: true, reason: 'block-complete', solvesSince };
    }

    /** Asks the Coach to judge the block and set the next one. */
    async function revise(onProgress) {
        const profile = Store().getProfile();
        const plan = Store().getPlan();
        if (!profile || !plan) return null;

        const event = profile.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const mo3 = UI().isMo3(event);
        const after = A().computeMetrics(solves, { event, mo3, goal: profile.goal });

        const day = Store().todayKey();
        const entry = Store().getTraining(day);
        const before = entry && entry.statsBefore ? entry.statsBefore : null;

        const result = await window.CoachAPI.revise({
            before, after,
            plan: plan.plan,
            trainingSummary: entry ? {
                focus: entry.focus,
                drillsCompleted: (entry.completedDrillIds || []).length,
                drillsPlanned: (entry.drills || []).length,
            } : null,
            observations: window.CoachEvidence ? window.CoachEvidence.getObservations() : [],
        }, { onProgress });

        // Fold the revision into the stored plan: new focus for today,
        // and the phase the Coach says we're now in.
        const revision = result.revision;
        const updated = Object.assign({}, plan, {
            revisedAt: result.revisedAt,
            lastRevision: result,
        });
        if (revision && revision.today) {
            updated.plan = Object.assign({}, plan.plan, {
                today: revision.today,
                currentPhaseId: revision.newPhaseId || plan.plan.currentPhaseId,
            });
        }
        Store().setPlan(updated);

        // Today's drills are replaced, so start a fresh training record.
        Store().setTraining(day, {
            day,
            focus: revision.today.focus,
            rationale: revision.today.rationale,
            drills: revision.today.drills,
            completedDrillIds: [],
            statsBefore: after,
            startedAt: null,
        });

        return result;
    }

    window.CoachTraining = {
        today, start, collectResult, checkMilestones, shouldRevise, revise,
        HANDOFF_KEY,
    };
})();
