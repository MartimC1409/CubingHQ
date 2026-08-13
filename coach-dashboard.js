/* ============================================================
   CubingHQ Coach — dashboard
   ------------------------------------------------------------
   The daily surface: one clear action, the goal, the trend, and
   enough evidence that the user can see why the Coach said what
   it said.

   Every figure here comes from coach-analytics.js. Nothing on this
   page is a number the model produced.

   Exposed as window.CoachDashboard.
   ============================================================ */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const UI = () => window.CoachUI;
    const A = () => window.CoachAnalytics;
    const Store = () => window.CoachStore;
    const Training = () => window.CoachTraining;

    let chartWindow = 200;

    /** The one snapshot every card renders from. */
    function snapshot() {
        const profile = Store().getProfile();
        const event = (profile && profile.primaryEvent) || '333';
        const solves = Store().solvesForEvent(event);
        const mo3 = UI().isMo3(event);
        return {
            profile, event, solves, mo3,
            metrics: A().computeMetrics(solves, { event, mo3, goal: profile && profile.goal }),
            state: Store().get(),
        };
    }

    /* ---------- today ------------------------------------------ */

    function renderToday(snap) {
        const host = $('#coach-today-card');
        if (!host) return;

        const entry = Training().today();

        if (!entry) {
            host.innerHTML = `<h2 class="coach-h2">${UI().esc(UI().T('coach.today.title', "Today's training"))}</h2>
                ${UI().empty(
                    UI().T('coach.today.none', "There's no plan yet. Once the Coach has assessed your solves it'll set a focus for each day."),
                    `<button class="coach-btn coach-btn--primary" id="coach-make-plan">${UI().esc(UI().T('coach.today.build', 'Build my plan'))}</button>`
                )}`;
            const btn = $('#coach-make-plan');
            if (btn) btn.addEventListener('click', () => window.CoachApp.regeneratePlan());
            return;
        }

        const done = new Set(entry.completedDrillIds || []);
        const allDone = entry.drills.length > 0 && entry.drills.every(d => done.has(d.id));
        const nextDrill = entry.drills.find(d => !done.has(d.id));

        const drills = entry.drills.map(d => {
            const isDone = done.has(d.id);
            return `<div class="coach-drill${isDone ? ' is-done' : ''}">
                <span class="coach-drill-check">${UI().ICON.check}</span>
                <div style="flex:1;min-width:0">
                    <div class="coach-drill-title">${UI().esc(d.title)}</div>
                    <div class="coach-drill-objective">${UI().esc(d.objective)}</div>
                    ${d.instructions ? `<div class="coach-drill-objective" style="color:var(--clr-text-muted)">${UI().esc(d.instructions)}</div>` : ''}
                    <div class="coach-drill-meta">
                        ${d.solveTarget ? `${d.solveTarget} ${UI().esc(UI().T('coach.solves', 'solves'))}` : ''}
                        ${d.solveTarget && d.mode ? ' · ' : ''}${UI().esc(d.mode || '')}
                    </div>
                </div>
                ${isDone ? '' : `<button class="coach-btn coach-btn--ghost" data-start-drill="${UI().esc(d.id)}">
                    ${UI().esc(UI().T('coach.today.start', 'Start'))}</button>`}
            </div>`;
        }).join('');

        host.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
                <h2 class="coach-h2">${UI().esc(UI().T('coach.today.title', "Today's training"))}</h2>
                <span class="coach-sub" style="font-size:13px">${done.size}/${entry.drills.length} ${UI().esc(UI().T('coach.today.done', 'done'))}</span>
            </div>
            <p class="coach-eyebrow" style="margin-top:14px">${UI().esc(UI().T('coach.today.focus', 'Main focus'))}</p>
            <p style="font-size:17px;font-weight:620;color:var(--clr-text)">${UI().esc(entry.focus)}</p>
            ${entry.rationale ? `<p class="coach-sub" style="margin-top:6px">${UI().esc(entry.rationale)}</p>` : ''}
            <div style="margin-top:16px">${drills}</div>
            ${allDone
                ? `<div style="margin-top:16px">${UI().alert('info',
                    UI().T('coach.today.completeTitle', "Today's training is done"),
                    UI().T('coach.today.completeBody', 'Your solves are already counted. Come back tomorrow for the next block.'))}</div>`
                : (nextDrill ? `<div style="margin-top:18px">
                    <button class="coach-btn coach-btn--primary coach-btn--lg" data-start-drill="${UI().esc(nextDrill.id)}">
                        ${UI().esc(UI().T('coach.today.startTraining', "Start today's training"))}
                    </button></div>` : '')}`;

        host.querySelectorAll('[data-start-drill]').forEach(btn => {
            btn.addEventListener('click', () => Training().start(btn.dataset.startDrill));
        });
    }

    /* ---------- coach insight ---------------------------------- */

    function renderInsight(snap) {
        const host = $('#coach-insight-card');
        if (!host) return;

        const record = Store().latestAssessment();
        if (!record || !record.assessment) {
            host.innerHTML = `<h2 class="coach-h2">${UI().esc(UI().T('coach.insight.title', 'Coach insight'))}</h2>
                ${UI().empty(UI().T('coach.insight.none', 'Import some solves and the Coach will tell you what it sees.'))}`;
            return;
        }

        const a = record.assessment;
        const confidence = isFinite(a.confidence) ? Math.round(a.confidence * 100) : null;

        host.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
                <h2 class="coach-h2">${UI().esc(UI().T('coach.insight.title', 'Coach insight'))}</h2>
                ${confidence !== null ? `<span class="coach-sub" style="font-size:12.5px">
                    ${UI().esc(UI().T('coach.insight.confidence', 'Confidence'))} ${confidence}%</span>` : ''}
            </div>
            <p class="coach-sub" style="margin-top:12px;color:var(--clr-text);font-size:15px">${UI().esc(a.summary)}</p>

            ${a.bottleneck ? `<div class="coach-bottleneck" style="margin-top:18px">
                <div class="coach-eyebrow" style="margin-bottom:4px">${UI().esc(UI().T('coach.insight.bottleneck', 'Biggest limit right now'))}</div>
                <div class="coach-finding-title">${UI().esc(a.bottleneck.title)}${UI().evidenceChip(a.bottleneck.evidenceType)}</div>
                <div class="coach-finding-detail">${UI().esc(a.bottleneck.detail)}</div>
                ${a.bottleneck.basis ? `<div class="coach-finding-basis">${UI().esc(a.bottleneck.basis)}</div>` : ''}
            </div>` : ''}

            ${a.rationale ? `<p class="coach-sub" style="margin-top:4px">${UI().esc(a.rationale)}</p>` : ''}

            <details style="margin-top:16px">
                <summary style="cursor:pointer;font-size:13.5px;font-weight:600;color:var(--clr-text-secondary)">
                    ${UI().esc(UI().T('coach.insight.more', 'Strengths and weaknesses'))}
                </summary>
                <div style="margin-top:10px">
                    ${(a.strengths || []).map(s => UI().finding(s, 'strength')).join('')}
                    ${(a.weaknesses || []).map(w => UI().finding(w, 'weakness')).join('')}
                </div>
            </details>

            ${UI().dataGaps(a.dataGaps)}

            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
                <button class="coach-btn coach-btn--quiet" id="coach-reassess">
                    ${UI().esc(UI().T('coach.insight.reassess', 'Re-assess with my latest solves'))}
                </button>
            </div>`;

        const btn = $('#coach-reassess');
        if (btn) btn.addEventListener('click', () => window.CoachApp.reassess());
    }

    /* ---------- goal ------------------------------------------- */

    function renderGoal(snap) {
        const host = $('#coach-goal-card');
        if (!host) return;

        const goal = snap.profile && snap.profile.goal;
        if (!goal) {
            host.innerHTML = UI().empty(UI().T('coach.goal.none', 'No goal set yet.'));
            return;
        }

        const progress = snap.metrics.goal;
        const label = `${UI().T('coach.goal.sub', 'Sub')}-${UI().fmt(goal.targetMs)} ${UI().eventLabel(snap.event)}`;

        let deadline = '';
        if (progress && isFinite(progress.daysRemaining)) {
            const d = progress.daysRemaining;
            deadline = d < 0
                ? `<p class="coach-sub" style="font-size:12.5px;margin-top:10px">${UI().esc(UI().T('coach.goal.past', 'Your target date has passed. Set a new one when you are ready.'))}</p>`
                : `<p class="coach-sub" style="font-size:12.5px;margin-top:10px">${d} ${UI().esc(UI().T('coach.goal.daysLeft', 'days to your target date'))}</p>`;
        }

        host.innerHTML = `
            <div class="coach-eyebrow">${UI().esc(UI().T('coach.goal.heading', 'Your goal'))}</div>
            <h2 class="coach-h2" style="margin-bottom:14px">${UI().esc(label)}</h2>
            ${progress && progress.reason === 'not_enough_solves'
                ? UI().alert('info', '', `${UI().T('coach.goal.needSolves', 'Not enough solves yet to measure your')} ${goal.metric.toUpperCase()}.`)
                : UI().goalBar(progress)}
            ${deadline}`;
    }

    /* ---------- streak ----------------------------------------- */

    function renderStreak(snap) {
        const host = $('#coach-streak-card');
        if (!host) return;
        const streak = snap.state.progress.streak || { current: 0, longest: 0 };
        host.innerHTML = `
            <div class="coach-eyebrow">${UI().esc(UI().T('coach.streak.title', 'Training streak'))}</div>
            <div class="coach-streak">
                <span class="coach-streak-num">${streak.current}</span>
                <span class="coach-sub">${UI().esc(streak.current === 1
                    ? UI().T('coach.streak.day', 'day')
                    : UI().T('coach.streak.days', 'days'))}</span>
            </div>
            <p class="coach-sub" style="font-size:12.5px;margin-top:8px">
                ${streak.longest > streak.current
                    ? `${UI().esc(UI().T('coach.streak.best', 'Your best is'))} ${streak.longest}.`
                    : UI().esc(UI().T('coach.streak.keep', 'Train today to keep it going.'))}
            </p>`;
    }

    /* ---------- milestones -------------------------------------- */

    function renderMilestones(snap) {
        const host = $('#coach-milestones-card');
        if (!host) return;
        const list = (snap.state.progress.milestones || []).slice(-6).reverse();
        host.innerHTML = `
            <div class="coach-eyebrow">${UI().esc(UI().T('coach.milestones.title', 'Recent milestones'))}</div>
            ${list.length
                ? list.map(m => `<div class="coach-milestone">
                        <span class="coach-milestone-dot"></span>
                        <span>${UI().esc(m.label)}</span>
                    </div>`).join('')
                : `<p class="coach-sub" style="font-size:13.5px;margin-top:8px">
                    ${UI().esc(UI().T('coach.milestones.none', 'Nothing yet — they start arriving as you train.'))}</p>`}`;
    }

    /* ---------- trend & stats ----------------------------------- */

    function trendSentence(metrics) {
        const t = metrics.trend;
        if (!t || t.direction === 'insufficient_data') {
            const need = (t && t.solvesNeeded) || 30;
            const have = (t && t.solvesAnalysed) || 0;
            return `${UI().T('coach.trend.needMore', 'Not enough solves to call a trend yet')} — ${have}/${need}.`;
        }
        const change = UI().fmtWithUnit(Math.abs(t.changeMs));
        const over = `${t.solvesAnalysed} ${UI().T('coach.solves', 'solves')}`;
        if (t.direction === 'improving') return `${UI().T('coach.trend.improving', 'Getting faster')} — ${change} ${UI().T('coach.trend.over', 'over the last')} ${over}.`;
        if (t.direction === 'regressing') return `${UI().T('coach.trend.regressing', 'Times have drifted up')} ${change} ${UI().T('coach.trend.over', 'over the last')} ${over}.`;
        return `${UI().T('coach.trend.plateau', 'Flat')} ${UI().T('coach.trend.over', 'over the last')} ${over}.`;
    }

    function renderTrend(snap) {
        const summary = $('#coach-trend-summary');
        if (summary) summary.textContent = trendSentence(snap.metrics);

        const controls = $('#coach-chart-controls');
        if (controls) {
            const options = [
                [100, UI().T('coach.chart.last100', 'Last 100')],
                [200, UI().T('coach.chart.last200', 'Last 200')],
                [500, UI().T('coach.chart.last500', 'Last 500')],
                [0, UI().T('coach.chart.all', 'All')],
            ];
            controls.innerHTML = options
                .filter(([n]) => n === 0 || n <= Math.max(100, snap.solves.length))
                .map(([n, label]) => `<button type="button" class="coach-chip" data-window="${n}"
                        aria-pressed="${chartWindow === n}">${UI().esc(label)}</button>`).join('');
            controls.querySelectorAll('[data-window]').forEach(b => {
                b.addEventListener('click', () => {
                    chartWindow = Number(b.dataset.window);
                    renderTrend(snapshot());
                });
            });
        }

        const canvas = $('#coach-chart');
        if (!canvas) return;
        if (!snap.solves.length) {
            const wrap = canvas.parentElement;
            if (wrap) wrap.innerHTML = UI().empty(UI().T('coach.chart.none', 'No solves yet. Import a session to see your trend.'));
            return;
        }

        const goal = snap.profile && snap.profile.goal;
        window.CoachChart.render(canvas, snap.solves, {
            window: chartWindow,
            mo3: snap.mo3,
            goalMs: goal ? goal.targetMs : undefined,
            goalLabel: goal ? `${UI().T('coach.goal.target', 'Target')} ${UI().fmt(goal.targetMs)}` : undefined,
        });
    }

    function renderStats(snap) {
        const host = $('#coach-stats-card');
        if (!host) return;
        const m = snap.metrics;

        const consistency = {
            improving: UI().T('coach.consistency.improving', 'tightening'),
            worsening: UI().T('coach.consistency.worsening', 'spreading out'),
            stable: UI().T('coach.consistency.stable', 'steady'),
            insufficient_data: UI().T('coach.consistency.unknown', 'not enough data'),
        }[m.consistency.direction] || '—';

        host.innerHTML = `
            <h2 class="coach-h2" style="margin-bottom:16px">${UI().esc(UI().T('coach.stats.title', 'Where you are'))}</h2>
            ${UI().statRow([
                UI().stat(UI().T('coach.stat.solves', 'Solves'), String(m.solveCount)),
                UI().stat(UI().T('coach.stat.mean', 'Mean'), UI().fmt(m.current.mean)),
                UI().stat('Ao5', UI().fmt(m.current.ao5)),
                UI().stat('Ao12', UI().fmt(m.current.ao12)),
                UI().stat('Ao50', UI().fmt(m.current.ao50)),
                UI().stat('Ao100', UI().fmt(m.current.ao100)),
            ])}
            <div style="height:1px;background:var(--clr-border);margin:18px 0"></div>
            ${UI().statRow([
                UI().stat(UI().T('coach.stat.bestSingle', 'Best single'), UI().fmt(m.best.single)),
                UI().stat(UI().T('coach.stat.bestAo5', 'Best Ao5'), UI().fmt(m.best.ao5)),
                UI().stat(UI().T('coach.stat.bestAo12', 'Best Ao12'), UI().fmt(m.best.ao12)),
                UI().stat(UI().T('coach.stat.spread', 'Consistency'), consistency, true),
            ])}
            ${m.spread ? `<p class="coach-sub" style="font-size:13px;margin-top:16px">
                ${UI().esc(UI().T('coach.stats.spreadNote', 'Your fastest solves are'))}
                ${UI().esc(UI().fmtWithUnit(m.spread.p50 - m.spread.p10))}
                ${UI().esc(UI().T('coach.stats.spreadNote2', 'quicker than your typical one. A big gap here usually means consistency, not raw speed, is the limit.'))}
            </p>` : ''}
            ${m.dnfCount ? `<p class="coach-sub" style="font-size:12.5px;margin-top:8px">
                ${m.dnfCount} ${UI().esc(UI().T('coach.stats.dnfs', 'DNFs'))} · ${m.plusTwoCount} +2
            </p>` : ''}`;
    }

    /* ---------- roadmap ----------------------------------------- */

    function renderRoadmap(snap) {
        const host = $('#coach-roadmap-card');
        if (!host) return;

        const record = Store().getPlan();
        const plan = record && record.plan;
        if (!plan || !Array.isArray(plan.phases) || !plan.phases.length) {
            host.innerHTML = `<h2 class="coach-h2">${UI().esc(UI().T('coach.roadmap.title', 'Roadmap'))}</h2>
                ${UI().empty(UI().T('coach.roadmap.none', 'No roadmap yet.'),
                    `<button class="coach-btn coach-btn--primary" id="coach-make-plan-2">${UI().esc(UI().T('coach.today.build', 'Build my plan'))}</button>`)}`;
            const btn = $('#coach-make-plan-2');
            if (btn) btn.addEventListener('click', () => window.CoachApp.regeneratePlan());
            return;
        }

        const currentIdx = plan.phases.findIndex(p => p.id === plan.currentPhaseId);
        const phases = plan.phases.map((p, i) => {
            const cls = i < currentIdx ? 'is-done' : (i === currentIdx ? 'is-current' : '');
            return `<div class="coach-phase ${cls}">
                <div class="coach-phase-rail">
                    <span class="coach-phase-node"></span>
                    <span class="coach-phase-line"></span>
                </div>
                <div style="flex:1;min-width:0;padding-bottom:6px">
                    <div class="coach-phase-name">${UI().esc(p.name)}
                        ${i === currentIdx ? `<span class="coach-evidence coach-evidence--known">${UI().esc(UI().T('coach.roadmap.now', 'Now'))}</span>` : ''}</div>
                    <div class="coach-phase-goal">${UI().esc(p.goalLabel)}</div>
                    ${p.rationale ? `<div class="coach-phase-focus">${UI().esc(p.rationale)}</div>` : ''}
                    ${Array.isArray(p.focus) && p.focus.length
                        ? `<div class="coach-phase-focus">${UI().esc(p.focus.join(' · '))}</div>` : ''}
                </div>
            </div>`;
        }).join('');

        const revision = record.lastRevision && record.lastRevision.revision;

        host.innerHTML = `
            <h2 class="coach-h2">${UI().esc(plan.title || UI().T('coach.roadmap.title', 'Roadmap'))}</h2>
            ${plan.overview ? `<p class="coach-sub" style="margin-top:8px">${UI().esc(plan.overview)}</p>` : ''}
            <div style="margin-top:18px">${phases}</div>
            ${revision ? `<div style="margin-top:18px">${UI().alert('info',
                UI().T('coach.roadmap.lastReview', 'Last review'), revision.assessment)}</div>` : ''}
            <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
                <button class="coach-btn coach-btn--ghost" id="coach-review-now">
                    ${UI().esc(UI().T('coach.roadmap.review', 'Review my progress now'))}
                </button>
                <button class="coach-btn coach-btn--quiet" id="coach-rebuild-plan">
                    ${UI().esc(UI().T('coach.roadmap.rebuild', 'Rebuild the plan'))}
                </button>
            </div>`;

        const review = $('#coach-review-now');
        if (review) review.addEventListener('click', () => window.CoachApp.reviewProgress());
        const rebuild = $('#coach-rebuild-plan');
        if (rebuild) rebuild.addEventListener('click', () => window.CoachApp.regeneratePlan());
    }

    /* ---------- data & privacy ---------------------------------- */

    function renderData(snap) {
        const host = $('#coach-sessions-list');
        if (host) {
            const sessions = Store().listSessions();
            host.innerHTML = sessions.length
                ? sessions.map(s => `<div class="coach-session">
                        <div class="coach-session-main">
                            <div class="coach-session-name">${UI().esc(s.name)}</div>
                            <div class="coach-session-meta">${UI().esc(UI().eventLabel(s.event))} ·
                                ${s.solveCount} ${UI().esc(UI().T('coach.solves', 'solves'))} ·
                                ${UI().esc(new Date(s.importedAt).toLocaleDateString())}</div>
                        </div>
                        <button class="coach-btn coach-btn--quiet" data-delete-session="${UI().esc(s.id)}"
                                aria-label="${UI().esc(UI().T('coach.data.delete', 'Delete'))} ${UI().esc(s.name)}">
                            ${UI().esc(UI().T('coach.data.delete', 'Delete'))}
                        </button>
                    </div>`).join('')
                : `<p class="coach-sub" style="font-size:13.5px">${UI().esc(UI().T('coach.data.noSessions', 'No sessions imported yet.'))}</p>`;

            host.querySelectorAll('[data-delete-session]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.deleteSession;
                    const sess = Store().get().sessions[id];
                    if (!sess) return;
                    if (!confirm(`${UI().T('coach.data.confirmDelete', 'Delete')} "${sess.name}"? ${UI().T('coach.data.confirmDelete2', 'This removes those solves from your coaching data.')}`)) return;
                    Store().removeSession(id);
                    UI().toast(UI().T('coach.data.deleted', 'Session deleted'));
                });
            });
        }

        const note = $('#coach-privacy-note');
        if (note) {
            note.textContent = Store().isSignedIn()
                ? UI().T('coach.privacy.signedIn', 'Your coaching data is stored against your WCA account and is only readable by you. It is never shown to other users.')
                : UI().T('coach.privacy.guest', "You're not signed in, so everything here is stored only on this device. Sign in with WCA to sync it across devices.");
        }
    }

    /* ---------- entry point -------------------------------------- */

    function renderAll() {
        const snap = snapshot();
        if (!snap.profile) return;

        const greetTitle = $('#coach-greeting-title');
        const greetSub = $('#coach-greeting-sub');
        if (greetTitle) greetTitle.textContent = UI().greeting();
        if (greetSub) {
            const entry = Training().today();
            greetSub.textContent = entry
                ? `${UI().T('coach.greet.focus', "Today's focus:")} ${entry.focus}`
                : UI().T('coach.greet.noFocus', "Here's where you stand.");
        }

        renderToday(snap);
        renderInsight(snap);
        renderGoal(snap);
        renderStreak(snap);
        renderMilestones(snap);
        renderTrend(snap);
        renderStats(snap);
        renderRoadmap(snap);
        renderData(snap);
    }

    window.CoachDashboard = { renderAll, snapshot, renderTrend };
})();
