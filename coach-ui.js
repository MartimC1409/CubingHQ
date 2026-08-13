/* ============================================================
   CubingHQ Coach — shared render helpers
   ------------------------------------------------------------
   Small pieces used by every panel. Two things here carry weight:

   1. esc(). Everything rendered is either model output or user
      input. All of it is escaped before it reaches innerHTML.
   2. The evidence chip. It is the visible half of the rule that an
      inferred claim must never be mistaken for an observed one.

   Exposed as window.CoachUI.
   ============================================================ */
(function () {
    'use strict';

    const T = (key, fallback) => (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);
    const A = () => window.CoachAnalytics;

    function esc(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const fmt = (ms) => (A() ? A().fmtMs(ms) : '—');

    /** "11.82s" / "1:02.50" with a unit only where it reads naturally. */
    function fmtWithUnit(ms) {
        const s = fmt(ms);
        return s === '—' ? s : (s.includes(':') ? s : s + 's');
    }

    /** Signed delta: negative (faster) is the good direction. */
    function fmtDelta(ms) {
        if (!isFinite(ms) || ms === 0) return '—';
        const sign = ms < 0 ? '−' : '+';
        return sign + fmt(Math.abs(ms)) + 's';
    }

    /* ---- icons ------------------------------------------------- */
    const ICON = {
        warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
        empty: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };

    /* ---- blocks ------------------------------------------------ */

    function alert(kind, title, body, actionsHtml) {
        return `<div class="coach-alert coach-alert--${esc(kind)}" role="${kind === 'error' ? 'alert' : 'status'}">
            <span class="coach-alert-icon">${kind === 'error' || kind === 'warn' ? ICON.warn : ICON.info}</span>
            <div>
                ${title ? `<strong>${esc(title)}</strong>` : ''}
                <div>${esc(body)}</div>
                ${actionsHtml ? `<div class="coach-alert-actions">${actionsHtml}</div>` : ''}
            </div>
        </div>`;
    }

    function empty(message, actionsHtml) {
        return `<div class="coach-empty">
            ${ICON.empty}
            <p class="coach-sub">${esc(message)}</p>
            ${actionsHtml ? `<div style="margin-top:14px">${actionsHtml}</div>` : ''}
        </div>`;
    }

    function stat(label, value, small) {
        return `<div class="coach-stat">
            <div class="coach-stat-label">${esc(label)}</div>
            <div class="coach-stat-value${small ? ' is-small' : ''}">${esc(value)}</div>
        </div>`;
    }

    const statRow = (items) => `<div class="coach-stat-row">${items.join('')}</div>`;

    /**
     * The evidence chip.
     *
     * "known" and "observed" are facts and read as such. "inferred" is
     * deliberately styled as an outline rather than a solid chip, and
     * labelled so nobody can mistake a hypothesis for a measurement.
     */
    function evidenceChip(type) {
        const t = String(type || '').toLowerCase();
        if (t === 'observed') {
            return `<span class="coach-evidence coach-evidence--observed"
                title="${esc(T('coach.evidence.observedTip', 'Seen directly in your smart-cube move data.'))}">${esc(T('coach.evidence.observed', 'Observed'))}</span>`;
        }
        if (t === 'inferred') {
            return `<span class="coach-evidence coach-evidence--inferred"
                title="${esc(T('coach.evidence.inferredTip', 'A likely explanation, not something the data confirms.'))}">${esc(T('coach.evidence.inferred', 'Inferred'))}</span>`;
        }
        return `<span class="coach-evidence coach-evidence--known"
            title="${esc(T('coach.evidence.knownTip', 'Calculated from your actual solves.'))}">${esc(T('coach.evidence.known', 'Measured'))}</span>`;
    }

    function finding(item, kind) {
        if (!item) return '';
        const mark = kind === 'strength' ? '+' : '−';
        return `<div class="coach-finding coach-finding--${kind === 'strength' ? 'strength' : 'weakness'}">
            <span class="coach-finding-mark" aria-hidden="true">${mark}</span>
            <div style="min-width:0">
                <div class="coach-finding-title">${esc(item.title)}${evidenceChip(item.evidenceType)}</div>
                <div class="coach-finding-detail">${esc(item.detail)}</div>
                ${item.basis ? `<div class="coach-finding-basis">${esc(item.basis)}</div>` : ''}
            </div>
        </div>`;
    }

    /** The "I can't tell you this yet" block — required by the evidence rule. */
    function dataGaps(gaps) {
        if (!gaps || !gaps.length) return '';
        return `<div class="coach-gaps">
            <strong style="font-size:13.5px">${esc(T('coach.gaps.title', "What I can't tell from this data"))}</strong>
            <ul>${gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
            <p class="coach-sub" style="font-size:12.5px;margin-top:8px">
                ${esc(T('coach.gaps.hint', 'Solve times show how long a solve took, not what your hands and eyes were doing. Connect a Bluetooth smart cube in the timer and I can see more.'))}
            </p>
        </div>`;
    }

    function goalBar(progress) {
        if (!progress) return '';
        const pct = Math.round((progress.pct || 0) * 100);
        const reached = progress.reached;
        const metricLabel = String(progress.metric || '').toUpperCase();
        return `<div>
            <div class="coach-goal-head">
                <div>
                    <div class="coach-eyebrow" style="margin-bottom:2px">${esc(metricLabel)} ${esc(T('coach.goal.journey', 'journey'))}</div>
                    <div class="coach-stat-value">${esc(fmtWithUnit(progress.currentMs))}</div>
                </div>
                <div style="text-align:right">
                    <div class="coach-eyebrow" style="margin-bottom:2px">${esc(T('coach.goal.target', 'Target'))}</div>
                    <div class="coach-stat-value is-small">${esc(fmtWithUnit(progress.targetMs))}</div>
                </div>
            </div>
            <div class="coach-goal-track" role="progressbar" aria-valuenow="${pct}"
                 aria-valuemin="0" aria-valuemax="100"
                 aria-label="${esc(T('coach.goal.aria', 'Progress toward your goal'))}">
                <div class="coach-goal-fill${reached ? ' is-reached' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="coach-goal-ends">
                <span>${pct}%</span>
                <span>${reached
                    ? esc(T('coach.goal.reached', 'Goal reached'))
                    : (isFinite(progress.gapMs) ? esc(fmtWithUnit(progress.gapMs)) + ' ' + esc(T('coach.goal.toGo', 'to go')) : '')}</span>
            </div>
        </div>`;
    }

    /* ---- text ---------------------------------------------------- */

    /**
     * Minimal markdown for chat: paragraphs, **bold**, `code` and simple
     * lists. Escaping happens first, so no markup in the model's output
     * or the user's message can reach the DOM as HTML.
     */
    function richText(text) {
        const safe = esc(text || '');
        const blocks = safe.split(/\n{2,}/);
        return blocks.map(block => {
            const lines = block.split('\n');
            const isList = lines.every(l => /^\s*([-*]|\d+\.)\s+/.test(l)) && lines.length > 0;
            if (isList) {
                const ordered = /^\s*\d+\./.test(lines[0]);
                const items = lines.map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('');
                return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
            }
            return `<p>${inline(block.replace(/\n/g, '<br>'))}</p>`;
        }).join('');
    }

    function inline(s) {
        return s
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    /* ---- misc ---------------------------------------------------- */

    function greeting(name) {
        const h = new Date().getHours();
        const key = h < 12 ? 'morning' : (h < 18 ? 'afternoon' : 'evening');
        const label = {
            morning: T('coach.greet.morning', 'Good morning'),
            afternoon: T('coach.greet.afternoon', 'Good afternoon'),
            evening: T('coach.greet.evening', 'Good evening'),
        }[key];
        return name ? `${label}, ${name}.` : `${label}.`;
    }

    const EVENT_LABELS = {
        '333': '3x3', '222': '2x2', '444': '4x4', '555': '5x5',
        '666': '6x6', '777': '7x7', '333oh': 'One-Handed',
        'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1',
        'minx': 'Megaminx', 'clock': 'Clock',
    };
    const eventLabel = (e) => EVENT_LABELS[e] || e || '3x3';

    /** Mo3 events don't trim best and worst — the stats need to know. */
    const MO3_EVENTS = new Set(['666', '777', 'clock']);
    const isMo3 = (event) => MO3_EVENTS.has(event);

    /** Parses "12.34" or "1:02.5" into ms. Null when it isn't a time. */
    function parseTimeInput(value) {
        if (!window.CoachImport) return null;
        const parsed = window.CoachImport.parseTimeToken(String(value || '').trim());
        return parsed && parsed.penalty !== 'DNF' ? parsed.ms : null;
    }

    function toast(message, kind) {
        // The SPA's toast lives in app.js and isn't loaded here, so fall
        // back to a lightweight one rather than shipping a second system.
        let host = document.getElementById('coach-toast');
        if (!host) {
            host = document.createElement('div');
            host.id = 'coach-toast';
            host.setAttribute('role', 'status');
            host.setAttribute('aria-live', 'polite');
            host.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);' +
                'z-index:2000;display:flex;flex-direction:column;gap:8px;align-items:center;' +
                'pointer-events:none;padding:0 16px;max-width:min(92vw,420px)';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = 'background:var(--clr-bg-card);border:1px solid ' +
            (kind === 'error' ? 'var(--clr-danger)' : 'var(--clr-border)') +
            ';color:var(--clr-text);padding:11px 16px;border-radius:10px;font-size:14px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .2s ease';
        host.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 250);
        }, kind === 'error' ? 5200 : 3200);
    }

    window.CoachUI = {
        esc, fmt, fmtWithUnit, fmtDelta,
        alert, empty, stat, statRow, evidenceChip, finding, dataGaps, goalBar,
        richText, greeting, eventLabel, isMo3, parseTimeInput, toast, T, ICON,
        EVENT_LABELS,
    };
})();
