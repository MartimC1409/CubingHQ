/* ============================================================
   CubingHQ Coach — onboarding
   ------------------------------------------------------------
   Event → current level → import solves → goal → assessment → plan.

   Two design points worth stating:

   1. The import preview. Nothing is saved until the user has seen the
      parsed numbers. csTimer's export format is ambiguous enough that
      a silent mis-parse is a real risk, and showing the numbers turns
      that from a silent corruption into an obvious one.

   2. The goal reality check. If someone sets a sub-10 Ao100 goal off
      the back of one fast single, we say so before generating a plan
      rather than cheerfully pretending they're nearly there.

   Exposed as window.CoachOnboarding.
   ============================================================ */
(function () {
    'use strict';

    const $ = (s, root) => (root || document).querySelector(s);
    const $$ = (s, root) => Array.from((root || document).querySelectorAll(s));

    const UI = () => window.CoachUI;
    const A = () => window.CoachAnalytics;
    const Store = () => window.CoachStore;

    const STEPS = ['welcome', 'event', 'level', 'import', 'goal', 'analysing'];
    let index = 0;

    // Draft state, only committed to the store at the end.
    const draft = {
        primaryEvent: null,
        method: '', experience: '', practiceFrequency: '',
        statedAverageMs: null,
        goal: { metric: 'ao100', targetMs: null, targetDate: null },
        pendingImport: null,
    };

    const EVENTS = ['333', '222', '444', '555', '666', '777',
        '333oh', 'pyram', 'skewb', 'sq1', 'minx', 'clock'];

    // Sensible ladders per event, so the goal step offers real targets
    // rather than making everyone type a number.
    const GOAL_LADDER = {
        '333': [60, 30, 20, 15, 12, 10, 8],
        '222': [15, 10, 7, 5, 4, 3],
        '444': [120, 90, 70, 60, 50, 40],
        '555': [180, 150, 120, 100, 80],
        '666': [300, 240, 200, 160, 130],
        '777': [420, 360, 300, 240, 200],
        '333oh': [60, 40, 30, 22, 18, 15],
        'pyram': [20, 12, 8, 6, 4, 3],
        'skewb': [20, 12, 8, 6, 5, 4],
        'sq1': [60, 30, 20, 15, 12, 10],
        'minx': [180, 120, 90, 70, 60, 50],
        'clock': [30, 20, 15, 10, 8, 6],
    };

    /* ---------- step machinery -------------------------------- */

    function renderDots() {
        const host = $('#coach-step-dots');
        if (!host) return;
        // The welcome and working screens aren't user-facing "steps".
        const shown = STEPS.slice(1, -1);
        host.innerHTML = shown.map((_, i) => {
            const at = index - 1;
            const cls = i < at ? 'is-done' : (i === at ? 'is-active' : '');
            return `<span class="coach-step-dot ${cls}"></span>`;
        }).join('');
        host.style.visibility = (index === 0 || index === STEPS.length - 1) ? 'hidden' : 'visible';
    }

    function show(step) {
        const target = typeof step === 'number' ? step : STEPS.indexOf(step);
        if (target < 0 || target >= STEPS.length) return;
        index = target;
        $$('#coach-onboarding .coach-step').forEach(el => {
            el.classList.toggle('is-active', el.dataset.step === STEPS[index]);
        });
        renderDots();
        // Keep the top of the step in view on mobile, where the previous
        // step may have scrolled well down the page.
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (STEPS[index] === 'goal') refreshGoalStep();
    }

    const next = () => show(Math.min(index + 1, STEPS.length - 1));
    const back = () => show(Math.max(index - 1, 0));

    /* ---------- step 2: event --------------------------------- */

    function renderEventChips() {
        const host = $('#coach-event-chips');
        if (!host) return;
        host.innerHTML = EVENTS.map(e => `
            <button type="button" class="coach-chip" data-event="${UI().esc(e)}"
                    aria-pressed="${draft.primaryEvent === e}">${UI().esc(UI().eventLabel(e))}</button>
        `).join('');
        host.querySelectorAll('[data-event]').forEach(btn => {
            btn.addEventListener('click', () => {
                draft.primaryEvent = btn.dataset.event;
                renderEventChips();
                const cont = $('#coach-onboarding .coach-step[data-step="event"] [data-next]');
                if (cont) cont.disabled = false;
            });
        });
    }

    /* ---------- step 4: import -------------------------------- */

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('read-failed'));
            reader.readAsText(file);
        });
    }

    async function handleFile(file) {
        const errorHost = $('#coach-import-error');
        errorHost.innerHTML = '';

        if (!file) return;
        // 25MB is far beyond any real export and stops the tab dying on
        // an accidental video or archive.
        if (file.size > 25 * 1024 * 1024) {
            errorHost.innerHTML = UI().alert('error', UI().T('coach.import.tooBigTitle', "That file's too large"),
                UI().T('coach.import.tooBig', 'Solve exports are small — a few hundred kilobytes at most. Check you picked the right file.'));
            return;
        }

        let text;
        try {
            text = await readFile(file);
        } catch (e) {
            errorHost.innerHTML = UI().alert('error', UI().T('coach.import.readTitle', "Couldn't read that file"),
                UI().T('coach.import.readBody', 'Try choosing it again.'));
            return;
        }

        let parsed;
        try {
            parsed = window.CoachImport.parse(text);
        } catch (err) {
            const messages = {
                empty: UI().T('coach.import.errEmpty', 'That file is empty.'),
                malformed: UI().T('coach.import.errMalformed', "That file looks like a csTimer export but couldn't be read — it may have been truncated. Try exporting it again."),
                unsupported: UI().T('coach.import.errUnsupported', "That doesn't look like a supported export. In csTimer, use Export → Export to file."),
            };
            errorHost.innerHTML = UI().alert('error',
                UI().T('coach.import.errTitle', "We couldn't analyse this session"),
                messages[err.code] || err.message);
            return;
        }

        showPreview(parsed);
    }

    /**
     * The safeguard. Shows exactly what was parsed — counts, averages,
     * and the first few times — so a wrong reading is caught by eye
     * before it becomes the basis of a coaching plan.
     */
    function showPreview(parsed) {
        const host = $('#coach-import-preview');
        const idle = $('#coach-import-idle');
        if (!host) return;

        // Prefer the session matching the chosen event; otherwise the biggest.
        const sessions = parsed.sessions.slice().sort((a, b) => {
            const aMatch = a.event === draft.primaryEvent ? 1 : 0;
            const bMatch = b.event === draft.primaryEvent ? 1 : 0;
            if (aMatch !== bMatch) return bMatch - aMatch;
            return b.solves.length - a.solves.length;
        });

        draft.pendingImport = { parsed, sessions, selected: sessions.map((_, i) => i) };

        const cards = sessions.map((sess, i) => {
            const mo3 = UI().isMo3(sess.event);
            const m = A().computeMetrics(sess.solves, { event: sess.event, mo3 });
            const sample = sess.solves.slice(0, 8).map(s => {
                const cls = s.penalty === 'DNF' ? ' class="is-dnf"'
                    : (s.penalty === '+2' ? ' class="is-plus2"' : '');
                const label = s.penalty === 'DNF' ? 'DNF'
                    : UI().fmt(s.time) + (s.penalty === '+2' ? '+' : '');
                return `<span${cls}>${UI().esc(label)}</span>`;
            }).join('');

            return `<div class="coach-preview" style="margin-bottom:14px">
                <div class="coach-preview-head" style="display:flex;align-items:center;gap:12px;justify-content:space-between">
                    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0">
                        <input type="checkbox" data-session-index="${i}" checked>
                        <span style="min-width:0">
                            <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI().esc(sess.name)}</strong>
                            <span class="coach-sub" style="font-size:12.5px">${UI().esc(UI().eventLabel(sess.event))} · ${sess.solves.length} ${UI().esc(UI().T('coach.solves', 'solves'))}</span>
                        </span>
                    </label>
                    <select class="coach-select" data-session-event="${i}" style="width:auto;padding:6px 10px;font-size:13px">
                        ${EVENTS.map(e => `<option value="${UI().esc(e)}"${e === sess.event ? ' selected' : ''}>${UI().esc(UI().eventLabel(e))}</option>`).join('')}
                    </select>
                </div>
                <div class="coach-preview-body">
                    ${UI().statRow([
                        UI().stat(UI().T('coach.stat.solves', 'Solves'), String(m.solveCount)),
                        UI().stat(UI().T('coach.stat.mean', 'Mean'), UI().fmt(m.current.mean)),
                        UI().stat(UI().T('coach.stat.best', 'Best'), UI().fmt(m.best.single)),
                        UI().stat('Ao5', UI().fmt(m.current.ao5)),
                        UI().stat('Ao12', UI().fmt(m.current.ao12)),
                        UI().stat('Ao100', UI().fmt(m.current.ao100)),
                    ])}
                    <div class="coach-sample">${sample}${sess.solves.length > 8 ? '<span>…</span>' : ''}</div>
                    ${sess.skipped ? `<p class="coach-sub" style="font-size:12.5px;margin-top:10px">
                        ${UI().esc(UI().T('coach.import.skipped', 'Skipped'))} ${sess.skipped}
                        ${UI().esc(UI().T('coach.import.skippedSuffix', "entries that didn't look like solve times."))}
                    </p>` : ''}
                </div>
            </div>`;
        }).join('');

        host.innerHTML = `
            ${UI().alert('info', UI().T('coach.import.checkTitle', 'Check these numbers before we continue'),
                UI().T('coach.import.checkBody', 'They should match what your timer shows. If they look wrong, the file may have exported in an unexpected format — tell us and pick a different export.'))}
            <div style="margin-top:16px">${cards}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
                <button class="coach-btn coach-btn--primary" id="coach-confirm-import">
                    ${UI().esc(UI().T('coach.import.confirm', 'These look right — continue'))}
                </button>
                <button class="coach-btn coach-btn--quiet" id="coach-cancel-import">
                    ${UI().esc(UI().T('coach.import.cancel', 'Choose a different file'))}
                </button>
            </div>`;

        host.hidden = false;
        if (idle) idle.hidden = true;

        host.querySelectorAll('[data-session-event]').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = Number(sel.dataset.sessionEvent);
                draft.pendingImport.sessions[i].event = sel.value;
            });
        });
        host.querySelectorAll('[data-session-index]').forEach(box => {
            box.addEventListener('change', () => {
                const i = Number(box.dataset.sessionIndex);
                const sel = draft.pendingImport.selected;
                const at = sel.indexOf(i);
                if (box.checked && at === -1) sel.push(i);
                if (!box.checked && at !== -1) sel.splice(at, 1);
                $('#coach-confirm-import').disabled = sel.length === 0;
            });
        });

        $('#coach-confirm-import').addEventListener('click', commitImport);
        $('#coach-cancel-import').addEventListener('click', resetImport);
    }

    function resetImport() {
        draft.pendingImport = null;
        const host = $('#coach-import-preview');
        const idle = $('#coach-import-idle');
        if (host) { host.hidden = true; host.innerHTML = ''; }
        if (idle) idle.hidden = false;
        const input = $('#coach-file');
        if (input) input.value = '';
    }

    function commitImport() {
        const pending = draft.pendingImport;
        if (!pending) return;

        let imported = 0;
        for (const i of pending.selected) {
            const sess = pending.sessions[i];
            if (!sess || !sess.solves.length) continue;
            Store().addSession({
                source: pending.parsed.source,
                name: sess.name,
                event: sess.event,
                solves: sess.solves,
            });
            imported += sess.solves.length;
            // Adopt the event of the largest imported session if the user
            // skipped the event step.
            if (!draft.primaryEvent) draft.primaryEvent = sess.event;
        }

        UI().toast(`${imported} ${UI().T('coach.import.done', 'solves imported')}`);
        resetImport();
        next();
    }

    /** Pulls sessions straight out of the on-site timer's storage. */
    function importFromTimer() {
        let data = null;
        try {
            const raw = localStorage.getItem('cstimer_data_v2');
            data = raw ? JSON.parse(raw) : null;
        } catch (e) { /* handled below */ }

        const sessions = data && data.sessions ? Object.values(data.sessions) : [];
        const usable = sessions.filter(s => s && Array.isArray(s.solves) && s.solves.length);
        if (!usable.length) {
            $('#coach-import-error').innerHTML = UI().alert('info',
                UI().T('coach.import.noTimerTitle', 'No timer sessions yet'),
                UI().T('coach.import.noTimerBody', "You haven't recorded any solves in the CubingHQ timer on this device. Upload a csTimer export instead, or skip and come back once you've done some solves."));
            return;
        }
        showPreview({
            source: 'cubinghq',
            sessions: usable.map(s => ({
                name: s.name || 'Session',
                event: s.event || '333',
                solves: s.solves,
                skipped: 0,
            })),
        });
    }

    /* ---------- step 5: goal ---------------------------------- */

    function refreshGoalStep() {
        const host = $('#coach-goal-chips');
        const event = draft.primaryEvent || '333';
        const ladder = GOAL_LADDER[event] || GOAL_LADDER['333'];

        if (host) {
            host.innerHTML = ladder.map(sec => {
                const ms = sec * 1000;
                const label = sec >= 60
                    ? `Sub-${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
                    : `Sub-${sec}`;
                return `<button type="button" class="coach-chip" data-goal="${ms}"
                        aria-pressed="${draft.goal.targetMs === ms}">${UI().esc(label)}</button>`;
            }).join('');
            host.querySelectorAll('[data-goal]').forEach(btn => {
                btn.addEventListener('click', () => {
                    draft.goal.targetMs = Number(btn.dataset.goal);
                    $('#coach-goal-custom').value = '';
                    refreshGoalStep();
                });
            });
        }
        updateGoalReality();
    }

    /**
     * The honesty check.
     *
     * A user with a 9.42 single and an 11.82 Ao100 who picks "Sub-10 on
     * Ao100" is a long way off, and saying so now is far better than a
     * progress bar that quietly reads 8%.
     */
    function updateGoalReality() {
        const host = $('#coach-goal-reality');
        const finish = $('#coach-finish');
        if (!host) return;

        const targetMs = draft.goal.targetMs;
        finish.disabled = !targetMs || !isFinite(targetMs);
        if (!targetMs) { host.innerHTML = ''; return; }

        const event = draft.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const mo3 = UI().isMo3(event);

        if (!solves.length) {
            host.innerHTML = UI().alert('info', '',
                UI().T('coach.goal.noData', "I'll track this goal as soon as you've done some solves. Without a baseline I can't say how far off you are."));
            return;
        }

        const metric = draft.goal.metric;
        const current = A().metricValue(solves, metric, mo3);
        const best = window.CubeStats.getBestSingle(solves);

        if (!isFinite(current) || current === null) {
            const needed = { ao100: 100, ao50: 50, ao12: 12, ao5: 5, single: 1 }[metric] || 5;
            host.innerHTML = UI().alert('warn', '',
                `${UI().T('coach.goal.needMore', 'You need at least')} ${needed} ${UI().T('coach.goal.needMoreSuffix', 'solves for this measure. Import more, or pick a shorter average.')}`);
            return;
        }

        if (current <= targetMs) {
            host.innerHTML = UI().alert('info', UI().T('coach.goal.alreadyTitle', "You're already there"),
                `${UI().T('coach.goal.already', 'Your')} ${metric.toUpperCase()} ${UI().T('coach.goal.alreadyIs', 'is already')} ${UI().fmtWithUnit(current)}. ${UI().T('coach.goal.alreadyPick', 'Pick a faster target so the plan has somewhere to go.')}`);
            finish.disabled = true;
            return;
        }

        const gap = current - targetMs;
        let note = `${metric.toUpperCase()} ${UI().T('coach.goal.nowAt', 'is currently')} ${UI().fmtWithUnit(current)} — ${UI().fmtWithUnit(gap)} ${UI().T('coach.goal.toGo', 'to go')}.`;

        // The single-vs-average trap, stated plainly.
        if (metric !== 'single' && isFinite(best) && best <= targetMs) {
            note += ` ${UI().T('coach.goal.singleWarning', "Your best single is already under this, but a single isn't the same as an average — that gap is exactly what the training is for.")}`;
        }

        host.innerHTML = UI().alert('info', '', note);
    }

    /* ---------- finish: assess + plan ------------------------- */

    const STAGE_FALLBACK = {
        reading: 'Reading your solves…',
        statistics: 'Checking your averages and trend…',
        moves: 'Reviewing your smart-cube solve data…',
        bottleneck: 'Working out what is holding you back…',
        writing: 'Writing your assessment…',
        goal: 'Mapping the distance to your goal…',
        planning: 'Building your roadmap…',
        drills: "Choosing today's training…",
    };

    function stage(key, label) {
        const el = $('#coach-stage');
        const log = $('#coach-stage-log');
        const text = label || UI().T('coach.stage.' + key, STAGE_FALLBACK[key] || '');
        if (!text) return;
        if (el) {
            // Move the previous stage into the log so the user can see
            // what has already happened, not just what's happening.
            if (el.textContent && log) {
                const done = document.createElement('span');
                done.textContent = el.textContent;
                log.appendChild(done);
                while (log.children.length > 4) log.removeChild(log.firstChild);
            }
            el.textContent = text;
        }
    }

    async function finish() {
        // Commit the profile first, so a failure part-way through leaves
        // the user with their settings and solves rather than nothing.
        Store().setProfile({
            primaryEvent: draft.primaryEvent || '333',
            method: draft.method,
            experience: draft.experience,
            practiceFrequency: draft.practiceFrequency,
            statedAverageMs: draft.statedAverageMs,
        });

        const event = draft.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const mo3 = UI().isMo3(event);
        const startMs = A().metricValue(solves, draft.goal.metric, mo3);

        Store().setGoal({
            metric: draft.goal.metric,
            targetMs: draft.goal.targetMs,
            targetDate: draft.goal.targetDate || null,
            startMs: isFinite(startMs) ? startMs : null,
        });

        show('analysing');
        $('#coach-analysing-error').innerHTML = '';
        $('#coach-stage-log').innerHTML = '';
        $('#coach-stage').textContent = '';

        // Without enough solves there is nothing honest to assess, so
        // skip straight to the dashboard rather than inventing a reading.
        if (solves.length < 5) {
            UI().toast(UI().T('coach.needSolves', 'Add some solves and I can assess your level.'));
            window.CoachApp.enterApp();
            return;
        }

        const profile = Store().getProfile();
        const metrics = A().computeMetrics(solves, { event, mo3, goal: profile.goal });
        const observations = window.CoachEvidence ? window.CoachEvidence.getObservations() : [];

        try {
            const assessment = await window.CoachAPI.assess(
                { metrics, profile, observations },
                { onProgress: stage }
            );
            Store().addAssessment(assessment);

            const plan = await window.CoachAPI.plan(
                { metrics, profile, assessment: assessment.assessment },
                { onProgress: stage }
            );
            Store().setPlan(plan);

            Store().recordMetricPoint(profile.goal.metric,
                metrics.goal ? metrics.goal.currentMs : null);

            window.CoachApp.enterApp();
        } catch (err) {
            // Onboarding is complete even if the AI step failed — the
            // profile, goal and solves are saved. Offer a retry and a
            // way through rather than trapping the user here.
            $('#coach-analysing-error').innerHTML = UI().alert('error',
                UI().T('coach.assessFailedTitle', "The Coach couldn't finish that"),
                err.message,
                `<button class="coach-btn coach-btn--primary" id="coach-retry-assess">${UI().esc(UI().T('coach.retry', 'Try again'))}</button>
                 <button class="coach-btn coach-btn--ghost" id="coach-skip-assess">${UI().esc(UI().T('coach.skipToDash', 'Go to my dashboard'))}</button>`);
            $('#coach-retry-assess').addEventListener('click', finish);
            $('#coach-skip-assess').addEventListener('click', () => window.CoachApp.enterApp());
        }
    }

    /* ---------- wiring ---------------------------------------- */

    function init() {
        renderEventChips();

        $$('#coach-onboarding [data-next]').forEach(b => b.addEventListener('click', next));
        $$('#coach-onboarding [data-back]').forEach(b => b.addEventListener('click', back));

        const bind = (sel, key) => {
            const el = $(sel);
            if (el) el.addEventListener('change', () => { draft[key] = el.value; });
        };
        bind('#coach-method', 'method');
        bind('#coach-experience', 'experience');
        bind('#coach-frequency', 'practiceFrequency');

        const avg = $('#coach-current-avg');
        if (avg) avg.addEventListener('change', () => {
            draft.statedAverageMs = UI().parseTimeInput(avg.value);
            if (avg.value.trim() && draft.statedAverageMs === null) {
                UI().toast(UI().T('coach.badTime', "I couldn't read that as a time — try something like 14.5 or 1:02.3"), 'error');
            }
        });

        // Import: click, keyboard, drag-and-drop, and file input.
        const drop = $('#coach-drop');
        const file = $('#coach-file');
        if (drop && file) {
            drop.addEventListener('click', () => file.click());
            drop.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
            });
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
                e.preventDefault(); drop.classList.add('is-over');
            }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => {
                e.preventDefault(); drop.classList.remove('is-over');
            }));
            drop.addEventListener('drop', (e) => {
                const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) handleFile(f);
            });
            file.addEventListener('change', () => handleFile(file.files && file.files[0]));
        }

        const fromTimer = $('#coach-import-from-timer');
        if (fromTimer) fromTimer.addEventListener('click', importFromTimer);

        const custom = $('#coach-goal-custom');
        if (custom) custom.addEventListener('input', () => {
            const ms = UI().parseTimeInput(custom.value);
            if (ms) {
                draft.goal.targetMs = ms;
                $$('#coach-goal-chips .coach-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
            }
            updateGoalReality();
        });

        const metric = $('#coach-goal-metric');
        if (metric) metric.addEventListener('change', () => {
            draft.goal.metric = metric.value;
            updateGoalReality();
        });

        const date = $('#coach-goal-date');
        if (date) date.addEventListener('change', () => { draft.goal.targetDate = date.value || null; });

        const finishBtn = $('#coach-finish');
        if (finishBtn) finishBtn.addEventListener('click', finish);

        show(0);
    }

    window.CoachOnboarding = { init, show, get draft() { return draft; } };
})();
