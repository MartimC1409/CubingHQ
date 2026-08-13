/* ============================================================
   CubingHQ Coach — timer bridge
   ------------------------------------------------------------
   Loaded on timer.html. Dormant unless the URL carries ?coach=…,
   so the timer behaves exactly as before for everyone else.

   When a drill is running it:
     - puts the timer on the drill's event, in its own session
     - shows what the drill is and how many solves are left
     - hands the finished solves back to the Coach

   It reads the timer through window.TimerModule and listens for the
   cs-solve-recorded event, rather than reaching into its internals.
   ============================================================ */
(function () {
    'use strict';

    const HANDOFF_KEY = 'chq_coach_drill_result';

    const params = new URLSearchParams(window.location.search);
    const drillId = params.get('coach');
    if (!drillId) return;   // not a coaching session — stay out of the way

    const drill = {
        id: drillId,
        event: params.get('event') || '333',
        target: parseInt(params.get('solves') || '0', 10) || 0,
        title: params.get('title') || 'Training',
        objective: params.get('objective') || '',
        mode: params.get('mode') || 'timed',
    };

    const MODE_HINT = {
        slow: 'Solve deliberately slowly. Keep the cube turning without stopping — the point is continuous motion, not a fast time.',
        controlled: 'Solve at about 80% of your normal speed, keeping your eyes ahead of your hands.',
        timed: 'Solve normally, at full speed.',
        untimed: 'Take as long as you need; the time is not what matters here.',
        algorithm: 'Repeat the algorithm set until execution feels automatic.',
    };

    let sessionId = null;
    let collected = [];
    let banner = null;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function styles() {
        if (document.getElementById('coach-drill-styles')) return;
        const el = document.createElement('style');
        el.id = 'coach-drill-styles';
        el.textContent = `
        .coach-drill-banner{
            position:sticky;top:0;z-index:60;
            background:var(--clr-bg-card);border-bottom:1px solid var(--clr-primary);
            padding:12px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;
        }
        .coach-drill-banner .cdb-main{flex:1;min-width:180px}
        .coach-drill-banner .cdb-eyebrow{
            font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:var(--clr-primary-hover);margin-bottom:2px;
        }
        .coach-drill-banner .cdb-title{font-weight:650;font-size:15px;color:var(--clr-text)}
        .coach-drill-banner .cdb-obj{font-size:13px;color:var(--clr-text-secondary);margin-top:2px;line-height:1.5}
        .coach-drill-banner .cdb-count{
            font-family:var(--font-mono,monospace);font-size:20px;font-weight:600;
            color:var(--clr-text);font-variant-numeric:tabular-nums;white-space:nowrap;
        }
        .coach-drill-banner .cdb-actions{display:flex;gap:8px;flex-wrap:wrap}
        .coach-drill-banner button{
            font:inherit;font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:8px;
            border:1px solid var(--clr-border);background:transparent;color:var(--clr-text);cursor:pointer;
        }
        .coach-drill-banner button.is-primary{
            background:var(--clr-primary);border-color:var(--clr-primary);color:#fff;
        }
        .coach-drill-banner button:disabled{opacity:.5;cursor:not-allowed}
        @media (max-width:640px){
            .coach-drill-banner{padding:10px 14px;gap:10px}
            .coach-drill-banner .cdb-obj{display:none}
            .coach-drill-banner .cdb-actions{width:100%}
            .coach-drill-banner .cdb-actions button{flex:1}
        }`;
        document.head.appendChild(el);
    }

    function render() {
        if (!banner) return;
        const done = collected.length;
        const target = drill.target;
        const complete = target > 0 && done >= target;

        banner.innerHTML = `
            <div class="cdb-main">
                <div class="cdb-eyebrow">Coach · today's training</div>
                <div class="cdb-title">${esc(drill.title)}</div>
                ${drill.objective ? `<div class="cdb-obj">${esc(drill.objective)}${
                    MODE_HINT[drill.mode] ? ' — ' + esc(MODE_HINT[drill.mode]) : ''}</div>` : ''}
            </div>
            <div class="cdb-count">${done}${target ? ' / ' + target : ''}</div>
            <div class="cdb-actions">
                <button type="button" id="cdb-finish" class="${complete ? 'is-primary' : ''}" ${done ? '' : 'disabled'}>
                    ${complete ? 'Finish &amp; return to Coach' : 'Finish early'}
                </button>
                <button type="button" id="cdb-cancel">Cancel</button>
            </div>`;

        banner.querySelector('#cdb-finish').addEventListener('click', () => finish(false));
        banner.querySelector('#cdb-cancel').addEventListener('click', cancel);
    }

    function mount() {
        styles();
        banner = document.createElement('div');
        banner.className = 'coach-drill-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Coach training session');
        const main = document.getElementById('app-main');
        if (main && main.firstChild) main.insertBefore(banner, main.firstChild);
        else if (main) main.appendChild(banner);
        else document.body.appendChild(banner);
        render();
    }

    function finish(auto) {
        // Hand the solves back through localStorage: the Coach page picks
        // them up on load. A URL would not survive this many solves.
        try {
            localStorage.setItem(HANDOFF_KEY, JSON.stringify({
                drillId: drill.id,
                event: drill.event,
                title: drill.title,
                mode: drill.mode,
                auto: !!auto,
                finishedAt: Date.now(),
                solves: collected,
            }));
        } catch (e) {
            console.error('[Coach] could not hand the drill back', e);
            alert('Your solves are saved in the timer, but the Coach could not pick them up. Import this session from the Coach\'s Your data tab.');
        }
        window.location.href = 'coach.html';
    }

    function cancel() {
        const done = collected.length;
        if (done && !confirm(`Discard this drill? Your ${done} solve${done > 1 ? 's' : ''} stay in the timer, but today's training won't be marked as done.`)) {
            return;
        }
        window.location.href = 'coach.html';
    }

    async function begin() {
        const TM = window.TimerModule;
        if (!TM) { console.warn('[Coach] timer not available'); return; }

        // A dedicated session keeps drill solves from being mixed into
        // whatever the user was already working on.
        const label = `Coach · ${drill.title}`.slice(0, 24);
        try {
            const session = await TM.newSession(label, drill.event);
            sessionId = session && session.id;
        } catch (e) {
            console.warn('[Coach] could not create a drill session', e);
        }

        mount();

        document.addEventListener('cs-solve-recorded', (e) => {
            const detail = e.detail || {};
            if (sessionId && detail.sessionId !== sessionId) return;
            collected.push(detail.solve);
            render();

            if (drill.target > 0 && collected.length >= drill.target) {
                // Let the last time stay on screen for a beat before leaving.
                setTimeout(() => finish(true), 1400);
            }
        });
    }

    // The timer initialises on DOMContentLoaded; queue behind it.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(begin, 0));
    } else {
        setTimeout(begin, 0);
    }
})();
