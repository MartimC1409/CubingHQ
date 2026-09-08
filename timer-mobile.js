/* ============================================================
   CubingHQ — Mobile layout for the timer view
   ------------------------------------------------------------
   Below 850px the three-column desktop layout is folded into a
   single fixed screen: event/session/settings in a compact top
   bar, the scramble above a full-height timer, and the cube
   preview beside the four headline averages at the bottom.

   Nothing is duplicated. The panels that no longer fit — the
   time list, the full stats, the settings and the session tabs
   — are MOVED into two bottom sheets and moved back, exactly
   the way mobile-nav.js relocates #nav-links. That keeps one
   source of truth, so timer.js's renderers keep working
   without knowing which layout is active.
   ============================================================ */
(function () {
    'use strict';

    const BREAKPOINT = 850;

    let applied = false;
    let sheets = null;              // { times, settings, backdrop }
    let openSheetEl = null;
    let lastFocused = null;

    // Original DOM position of every node we relocate, so unapply() can put
    // each one back exactly where it was rather than guessing.
    const anchors = new Map();

    function T(key, fallback) {
        return window.AppI18N ? window.AppI18N.t(key, fallback) : fallback;
    }

    const $ = (sel) => document.querySelector(sel);

    function remember(node) {
        if (!node || anchors.has(node)) return;
        anchors.set(node, { parent: node.parentNode, next: node.nextSibling });
    }

    function restore(node) {
        const a = anchors.get(node);
        if (!a || !a.parent) return;
        a.parent.insertBefore(node, a.next && a.next.parentNode === a.parent ? a.next : null);
    }

    function move(node, into) {
        if (!node || !into) return;
        remember(node);
        into.appendChild(node);
    }

    // ---------- sheets ----------

    function buildSheets() {
        if (sheets) return sheets;

        const backdrop = document.createElement('div');
        backdrop.className = 'cs-sheet-backdrop';
        backdrop.hidden = true;
        backdrop.addEventListener('click', closeSheet);

        const make = (id, titleKey, titleFallback) => {
            const el = document.createElement('div');
            el.className = 'cs-sheet';
            el.id = id;
            el.hidden = true;
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            el.tabIndex = -1;

            const head = document.createElement('div');
            head.className = 'cs-sheet-head';
            const grip = document.createElement('div');
            grip.className = 'cs-sheet-grip';
            const title = document.createElement('h3');
            title.className = 'cs-sheet-title';
            title.dataset.i18n = titleKey;
            title.textContent = T(titleKey, titleFallback);
            el.setAttribute('aria-label', title.textContent);
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'cs-sheet-close';
            close.setAttribute('aria-label', T('aria.close', 'Close'));
            close.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            close.addEventListener('click', closeSheet);

            head.appendChild(grip);
            head.appendChild(title);
            head.appendChild(close);

            const body = document.createElement('div');
            body.className = 'cs-sheet-body';

            el.appendChild(head);
            el.appendChild(body);
            el._body = body;
            return el;
        };

        const times = make('cs-sheet-times', 'timer.timeList', 'Time List');
        const settings = make('cs-sheet-settings', 'timer.settings', 'Settings');

        document.body.appendChild(backdrop);
        document.body.appendChild(times);
        document.body.appendChild(settings);

        sheets = { times, settings, backdrop };
        return sheets;
    }

    function openSheet(el) {
        if (!el || openSheetEl) return;
        lastFocused = document.activeElement;
        openSheetEl = el;
        sheets.backdrop.hidden = false;
        el.hidden = false;
        void el.offsetHeight;                     // reflow, so the slide-in runs
        sheets.backdrop.classList.add('open');
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
        el.focus({ preventScroll: true });
        document.addEventListener('keydown', onSheetKeydown, true);
    }

    function closeSheet() {
        const el = openSheetEl;
        if (!el) return;
        openSheetEl = null;
        el.classList.remove('open');
        sheets.backdrop.classList.remove('open');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onSheetKeydown, true);
        setTimeout(() => { el.hidden = true; sheets.backdrop.hidden = true; }, 260);
        if (lastFocused && document.contains(lastFocused)) {
            lastFocused.focus({ preventScroll: true });
        }
        lastFocused = null;
    }

    // The timer listens for space and for taps on its own surface; while a
    // sheet is up neither should fire, so swallow keys here first.
    function onSheetKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeSheet();
            return;
        }
        if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // ---------- top bar ----------

    // The chip mirrors the settings <select>, but the SESSION is what
    // actually decides the event and the scramble on screen. Those two
    // disagree for one render on load: renderAll() announces the session
    // list before renderSettings() has pushed the session's event into
    // the select, so mirroring the select alone left the chip showing
    // 3x3x3 over a 4x4 scramble. Read the session first, and fall back
    // to the select only when the timer module is not up yet.
    function syncEventSelect() {
        const mine = $('#cs-mtop-event');
        const theirs = $('#cs-setting-event');
        if (!mine || !theirs) return;
        if (mine.options.length !== theirs.options.length) {
            mine.innerHTML = theirs.innerHTML;
        }
        const M = window.TimerModule;
        const event = (M && typeof M.getCurrentEvent === 'function')
            ? M.getCurrentEvent()
            : theirs.value;
        mine.value = event;
        // Keep the settings sheet honest too, for the same reason.
        if (theirs.value !== event) theirs.value = event;
    }

    function syncSessionSelect() {
        const sel = $('#cs-mtop-session');
        const st = window.TimerModule && window.TimerModule.state;
        if (!sel || !st) return;
        const order = st.sessionOrder || [];
        sel.innerHTML = '';
        order.forEach(id => {
            const s = st.sessions[id];
            if (!s) return;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = s.name;
            sel.appendChild(opt);
        });
        const add = document.createElement('option');
        add.value = '__new__';
        add.textContent = '＋ ' + T('timer.newSession', 'New session');
        sel.appendChild(add);
        if (st.activeSession) sel.value = st.activeSession;
    }

    function bindTopBar() {
        const ev = $('#cs-mtop-event');
        if (ev && !ev._csBound) {
            ev._csBound = true;
            ev.addEventListener('change', () => {
                const theirs = $('#cs-setting-event');
                if (!theirs) return;
                theirs.value = ev.value;
                theirs.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        const ses = $('#cs-mtop-session');
        if (ses && !ses._csBound) {
            ses._csBound = true;
            ses.addEventListener('change', async () => {
                const M = window.TimerModule;
                if (!M) return;
                if (ses.value === '__new__') {
                    const name = prompt(T('prompt.sessionName', 'Session name:'),
                        T('timer.sessionN', 'Session {n}').replace('{n}', (M.state.sessionOrder || []).length + 1));
                    if (name && name.trim()) {
                        await M.newSession(name.trim(), (M.state.sessions[M.state.activeSession] || {}).event);
                    }
                } else {
                    M.switchSession(ses.value);
                }
                syncSessionSelect();
                syncEventSelect();
            });
        }
        const gear = $('#cs-mtop-settings');
        if (gear && !gear._csBound) {
            gear._csBound = true;
            gear.addEventListener('click', () => openSheet(sheets.settings));
        }
        const stats = $('#cs-mstats');
        if (stats && !stats._csBound) {
            stats._csBound = true;
            stats.addEventListener('click', () => openSheet(sheets.times));
        }
    }

    // ---------- sizing ----------
    // The available height depends on the header spacer, the safe-area inset
    // and the tab bar, which differ per device and per install mode. Measuring
    // beats arithmetic on magic numbers, so the timer screen ends exactly
    // where the tab bar begins on every phone.
    function sizeLayout() {
        const layout = $('.cstimer-layout');
        if (!layout || !applied) return;
        layout.style.height = '';                     // measure the natural top
        const top = layout.getBoundingClientRect().top;
        const bar = document.getElementById('nav-links');
        const barH = bar && getComputedStyle(bar).position === 'fixed'
            ? bar.getBoundingClientRect().height
            : 0;
        const h = window.innerHeight - top - barH;
        layout.style.height = Math.max(320, Math.floor(h)) + 'px';
    }

    // ---------- apply / unapply ----------

    function apply() {
        if (applied) return;
        const centre = $('.cstimer-center');
        if (!centre || !$('#cs-mcards')) return;
        applied = true;
        buildSheets();

        // The cube preview belongs beside the averages down here.
        const cube = $('#cs-mcube');
        move($('#cs-twisty'), cube);
        move($('#cs-sq1-diagram'), cube);

        // Time list + the full stats panel go into the times sheet.
        move($('.cs-solve-list-panel'), sheets.times._body);
        move($('.cstimer-left .cs-panel'), sheets.times._body);

        // Sessions, settings and the data buttons go into the settings sheet.
        move($('.cs-session-tabs'), sheets.settings._body);
        move($('.cs-settings-panel'), sheets.settings._body);
        move($('.cs-bottom-bar'), sheets.settings._body);

        document.body.classList.add('cs-mobile-timer');
        bindTopBar();
        syncEventSelect();
        syncSessionSelect();
        syncStats();
        sizeLayout();
        // The tab bar and web fonts can settle a frame or two later.
        requestAnimationFrame(sizeLayout);
        setTimeout(sizeLayout, 300);
    }

    function unapply() {
        if (!applied) return;
        applied = false;
        const layout = $('.cstimer-layout');
        if (layout) layout.style.height = '';
        closeSheet();
        anchors.forEach((_, node) => restore(node));
        anchors.clear();
        document.body.classList.remove('cs-mobile-timer');
    }

    function evaluate() {
        if (window.innerWidth <= BREAKPOINT) { apply(); sizeLayout(); }
        else unapply();
    }

    // ---------- stats card ----------
    // timer.js publishes its computed averages; mirroring them here keeps a
    // single source of truth for the numbers.
    function syncStats(detail) {
        const d = detail || (window.TimerModule && window.TimerModule.getHeadlineStats
            ? window.TimerModule.getHeadlineStats()
            : null);
        if (!d) return;
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = v === null || v === undefined ? '—' : v;
        };
        set('cs-mstat-ao5', d.ao5);
        set('cs-mstat-ao12', d.ao12);
        set('cs-mstat-ao100', d.ao100);
        set('cs-mstat-mean', d.mean);
    }

    // ---------- init ----------

    function init() {
        if (!document.querySelector('.cstimer-center')) return;
        evaluate();
        window.addEventListener('resize', evaluate);
        window.addEventListener('orientationchange', evaluate);
        document.addEventListener('cs-stats-updated', e => syncStats(e.detail));
        document.addEventListener('cs-sessions-changed', () => { syncSessionSelect(); syncEventSelect(); });
        document.addEventListener('app-language-changed', () => {
            if (!applied) return;
            syncSessionSelect();
            if (sheets) {
                [sheets.times, sheets.settings].forEach(s => {
                    const t = s.querySelector('.cs-sheet-title');
                    if (t && t.dataset.i18n) {
                        t.textContent = T(t.dataset.i18n, t.textContent);
                        s.setAttribute('aria-label', t.textContent);
                    }
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TimerMobile = {
        isApplied: () => applied,
        openTimes: () => sheets && openSheet(sheets.times),
        openSettings: () => sheets && openSheet(sheets.settings),
        close: closeSheet,
        refresh: evaluate,
    };
})();
