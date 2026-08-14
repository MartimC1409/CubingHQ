/* ============================================================
   CubingHQ Coach — bootstrap
   ------------------------------------------------------------
   Decides between onboarding and the dashboard, wires the tabs,
   picks up a finished drill on return from the timer, and owns the
   long-running AI actions the dashboard triggers.

   Exposed as window.CoachApp.
   ============================================================ */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const UI = () => window.CoachUI;
    const A = () => window.CoachAnalytics;
    const Store = () => window.CoachStore;

    let busy = false;

    /* ---------- view switching ---------------------------------- */

    function showBoot(on) {
        const el = $('#coach-boot');
        if (el) el.hidden = !on;
    }

    function enterOnboarding() {
        showBoot(false);
        $('#coach-app').hidden = true;
        $('#coach-onboarding').hidden = false;
        window.CoachOnboarding.init();
    }

    function enterApp() {
        showBoot(false);
        $('#coach-onboarding').hidden = true;
        $('#coach-app').hidden = false;
        window.CoachDashboard.renderAll();
        window.CoachChat.init();
        updateSyncBadge();
    }

    function activatePanel(name) {
        $$('.coach-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.panel === name)));
        $$('.coach-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === name));
        // The chart can't size itself while its panel is display:none, so
        // draw it once the panel is actually visible.
        if (name === 'progress') window.CoachDashboard.renderTrend(window.CoachDashboard.snapshot());
        try { history.replaceState(null, '', '#' + name); } catch (e) { }
    }

    function wireTabs() {
        $$('.coach-tab').forEach(tab => {
            tab.addEventListener('click', () => activatePanel(tab.dataset.panel));
        });
        const hash = (window.location.hash || '').replace('#', '');
        if (hash && $(`.coach-panel[data-panel="${CSS.escape(hash)}"]`)) activatePanel(hash);
    }

    /* ---------- reactive re-render -------------------------------- */

    /**
     * Redraws the dashboard whenever the store changes.
     *
     * coach-store.js has emitted `coach-changed` on every mutation since
     * it was written, and until now nothing listened to it: renderAll()
     * was called only at a handful of explicit points, so deleting a
     * session removed it from the store and left it on screen until the
     * page was reloaded. Subscribing once fixes deletion and every other
     * mutation together, rather than patching each call site as it is
     * noticed.
     *
     * Debounced because a single user action can write several times, and
     * renderTrend destroys and rebuilds the Chart.js instance — a burst
     * should cost one redraw, not one per write.
     */
    function wireReactiveRender() {
        let pending = null;
        document.addEventListener('coach-changed', () => {
            // Onboarding owns the screen until it hands over; redrawing a
            // dashboard that is still hidden would be wasted work.
            if ($('#coach-app') && $('#coach-app').hidden) return;
            clearTimeout(pending);
            pending = setTimeout(() => {
                try { window.CoachDashboard.renderAll(); }
                catch (e) { console.warn('[Coach] re-render failed', e); }
            }, 80);
        });
    }

    /* ---------- sync badge --------------------------------------- */

    function updateSyncBadge() {
        const el = $('#coach-sync');
        if (!el) return;
        const state = Store().syncState;
        const label = {
            idle: UI().T('coach.sync.idle', 'Synced'),
            pending: UI().T('coach.sync.pending', 'Saving…'),
            syncing: UI().T('coach.sync.syncing', 'Saving…'),
            error: UI().T('coach.sync.error', "Couldn't sync"),
            'local-only': Store().isSignedIn()
                ? UI().T('coach.sync.localOnly', 'Saved on this device')
                : UI().T('coach.sync.signIn', 'Sign in to sync'),
        }[state] || '';
        el.dataset.state = state;
        el.querySelector('span').textContent = label;
    }

    /* ---------- long-running AI actions -------------------------- */

    /**
     * Runs an AI action behind a modal-free progress state on the given
     * button, so the page stays usable and the user can see progress.
     */
    async function withProgress(button, work) {
        if (busy) return null;
        busy = true;
        const original = button ? button.innerHTML : null;
        if (button) { button.disabled = true; button.textContent = UI().T('coach.working', 'Working…'); }

        const onProgress = (stage, label) => {
            if (button && label) button.textContent = label;
        };

        try {
            const result = await work(onProgress);
            return result;
        } catch (err) {
            UI().toast(err.message, 'error');
            return null;
        } finally {
            busy = false;
            if (button) { button.disabled = false; button.innerHTML = original; }
        }
    }

    function currentMetrics() {
        const profile = Store().getProfile();
        const event = (profile && profile.primaryEvent) || '333';
        const solves = Store().solvesForEvent(event);
        return {
            profile, solves,
            metrics: A().computeMetrics(solves, {
                event, mo3: UI().isMo3(event), goal: profile && profile.goal,
            }),
        };
    }

    async function reassess() {
        const { profile, solves, metrics } = currentMetrics();
        if (solves.length < 5) {
            UI().toast(UI().T('coach.needSolves', 'Add some solves and I can assess your level.'));
            return;
        }
        const btn = $('#coach-reassess');
        const record = await withProgress(btn, (onProgress) =>
            window.CoachAPI.assess({
                metrics, profile,
                observations: window.CoachEvidence ? window.CoachEvidence.getObservations() : [],
            }, { onProgress }));

        if (record) {
            Store().addAssessment(record);
            window.CoachDashboard.renderAll();
            UI().toast(UI().T('coach.reassessed', 'Assessment updated'));
        }
    }

    async function regeneratePlan() {
        const { profile, solves, metrics } = currentMetrics();
        if (!profile || !profile.goal) {
            UI().toast(UI().T('coach.needGoal', 'Set a goal first.'));
            return;
        }
        if (!solves.length) {
            UI().toast(UI().T('coach.needSolves', 'Add some solves and I can assess your level.'));
            return;
        }

        const btn = $('#coach-make-plan') || $('#coach-make-plan-2') || $('#coach-rebuild-plan');
        const latest = Store().latestAssessment();
        const record = await withProgress(btn, (onProgress) =>
            window.CoachAPI.plan({
                metrics, profile,
                assessment: latest ? latest.assessment : null,
            }, { onProgress }));

        if (record) {
            Store().setPlan(record);
            // A new plan means a new day's drills; clear today's record
            // so the dashboard picks the fresh ones up.
            Store().setTraining(Store().todayKey(), null);
            window.CoachDashboard.renderAll();
            UI().toast(UI().T('coach.planReady', 'Your plan is ready'));
        }
    }

    async function reviewProgress() {
        const btn = $('#coach-review-now');
        const result = await withProgress(btn, (onProgress) =>
            window.CoachTraining.revise(onProgress));
        if (result) {
            window.CoachDashboard.renderAll();
            UI().toast(UI().T('coach.reviewed', 'Training reviewed'));
        }
    }

    /* ---------- returning from a drill ---------------------------- */

    function ingestDrillResult() {
        let result = null;
        try {
            result = window.CoachTraining.collectResult();
        } catch (e) {
            console.error('[Coach] could not take in the drill result', e);
        }
        if (!result) return;

        UI().toast(UI().T('coach.drillDone', 'Training recorded'));

        // Only offer a review when the deterministic gate says a block is
        // genuinely finished, so the Coach isn't re-diagnosing constantly.
        const gate = window.CoachTraining.shouldRevise();
        if (gate.revise) {
            const host = $('#coach-today-card');
            if (host) {
                const note = document.createElement('div');
                note.style.marginTop = '16px';
                note.innerHTML = UI().alert('info',
                    UI().T('coach.reviewReadyTitle', 'Enough solves for a review'),
                    UI().T('coach.reviewReadyBody', "You've done a full block since the last check. I can look at whether it moved the number and set the next focus."),
                    `<button class="coach-btn coach-btn--primary" id="coach-review-prompt">${UI().esc(UI().T('coach.roadmap.review', 'Review my progress now'))}</button>`);
                host.appendChild(note);
                const btn = $('#coach-review-prompt');
                if (btn) btn.addEventListener('click', () => {
                    note.remove();
                    reviewProgress();
                });
            }
        }
    }

    /* ---------- data management ----------------------------------- */

    function wireDataActions() {
        const addSession = $('#coach-add-session');
        if (addSession) addSession.addEventListener('click', () => {
            // Re-enter onboarding at the import step; the profile is kept.
            $('#coach-app').hidden = true;
            $('#coach-onboarding').hidden = false;
            window.CoachOnboarding.init();
            window.CoachOnboarding.show('import');
        });

        const delHistory = $('#coach-delete-history');
        if (delHistory) delHistory.addEventListener('click', async () => {
            if (!confirm(UI().T('coach.data.confirmHistory',
                'Delete your assessments and plan? Your imported solves and goal are kept.'))) return;
            try {
                await Store().reset('assessments');
                await Store().reset('plan');
                window.CoachDashboard.renderAll();
                UI().toast(UI().T('coach.data.historyDeleted', 'Coaching history deleted'));
            } catch (e) {
                UI().toast(e.message || UI().T('coach.data.deleteFailed', "Deleted locally, but couldn't reach the server."), 'error');
            }
        });

        const resetAll = $('#coach-reset-all');
        if (resetAll) resetAll.addEventListener('click', async () => {
            if (!confirm(UI().T('coach.data.confirmReset',
                'Reset everything? This deletes your coaching profile, goal, imported solves, plan and history. Solves recorded in the timer itself are not affected.'))) return;
            try {
                await Store().reset('all');
                if (window.CoachEvidence) window.CoachEvidence.clear();
                window.CoachChat.clear();
                UI().toast(UI().T('coach.data.reset', 'Coaching data reset'));
                window.location.reload();
            } catch (e) {
                UI().toast(e.message || UI().T('coach.data.deleteFailed', "Deleted locally, but couldn't reach the server."), 'error');
            }
        });
    }

    /* ---------- boot ---------------------------------------------- */

    async function boot() {
        wireTabs();
        wireDataActions();

        wireReactiveRender();

        document.addEventListener('coach-sync', updateSyncBadge);
        document.addEventListener('coach-storage-full', () => {
            UI().toast(UI().T('coach.storageFull',
                "This device is out of storage space for the Coach. Delete an old session from Your data."), 'error');
        });

        // Theme changes repaint every chart colour.
        document.addEventListener('coach-chart-needs-redraw', () => {
            if (!$('#coach-app').hidden) window.CoachDashboard.renderTrend(window.CoachDashboard.snapshot());
        });

        // Pull server state before deciding what to show, so a user who
        // onboarded on another device doesn't get sent through it again.
        if (Store().isSignedIn()) {
            try { await Store().pull(); } catch (e) { /* handled by the badge */ }
        }

        if (Store().hasOnboarded()) {
            enterApp();
            ingestDrillResult();
        } else {
            // Any pending drill result stays in storage untouched and is
            // picked up once there is a profile to attach it to.
            enterOnboarding();
        }
    }

    window.CoachApp = {
        enterApp, enterOnboarding, activatePanel,
        reassess, regeneratePlan, reviewProgress,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
