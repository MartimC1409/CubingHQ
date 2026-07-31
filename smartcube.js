/* ============================================================
   CubingHQ — Bluetooth Smart Cube Module (acubemy-style)
   ------------------------------------------------------------
   Connects GAN / GiiKER / GoCube smart cubes over Web Bluetooth
   using the official cubing.js `cubing/bluetooth` module
   (https://js.cubing.net/cubing/) — the same ecosystem that powers
   the scramble engine.

   Features:
     - Connect button next to the timer scramble bar (works on
       index.html#timer and timer.html — UI is injected, no markup).
     - Live 3D view that mirrors every physical turn.
     - Scramble tracking for 3x3 events: completed scramble moves
       turn green; when the scramble is done the timer arms.
     - Auto start on the first solving move, auto stop when the
       cube reaches the solved state (state tracked with kpuzzle).

   Assumes the cube starts solved, held white-top / green-front
   (same convention as acubemy / csTimer). "Mark as solved"
   re-syncs the internal state at any time.
   ============================================================ */
(function () {
    'use strict';

    const T = (key, fallback) => (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);

    // Same multi-CDN strategy as scramble-engine.js.
    const BLUETOOTH_CDNS = [
        'https://cdn.cubing.net/v0/js/cubing/bluetooth',
        'https://cdn.jsdelivr.net/npm/cubing@0/bluetooth/+esm',
        'https://esm.sh/cubing@0/bluetooth',
    ];

    // Bluetooth smart cubes are 3x3x3 — connecting is only allowed (and
    // the button only shown) while the timer is on a 3x3 event.
    const TRACKABLE_EVENTS = ['333', '333oh'];

    function currentEvent() {
        return window.TimerModule ? window.TimerModule.getCurrentEvent() : '333';
    }

    function isBtEvent(event) {
        return TRACKABLE_EVENTS.includes(event);
    }

    const S = {
        module: null,          // cubing/bluetooth module
        puzzle: null,          // BluetoothPuzzle instance
        connecting: false,
        solvedPattern: null,   // KPattern of the solved cube
        livePattern: null,     // dead-reckoned physical state
        moveCount: 0,
        recentMoves: [],       // last few move strings for display
        battery: null,
        // Scramble tracking
        trackingEvent: null,   // wca event id being tracked (or null)
        tokens: [],            // scramble split into moves
        prefixPatterns: [],    // pattern after tokens[0..i-1] (index 0 = solved)
        progress: 0,           // tokens correctly applied
        movesSinceMatch: 0,
        phase: 'idle',         // idle | scrambling | armed | solving | na
        // Solve recording (for the CFOP analysis panel)
        solveLog: [],          // [{ move, t }] with t in ms from first move
        solveStartT: 0,
        solveStartPattern: null, // physical state when the solve began
    };

    async function importFirstAvailable(urls) {
        let lastErr = null;
        for (const url of urls) {
            try {
                return await import(url);
            } catch (err) {
                lastErr = err;
                console.warn(`[SmartCube] could not load cubing/bluetooth from ${url}`, err);
            }
        }
        throw lastErr || new Error('No bluetooth module CDN reachable');
    }

    function $(sel) { return document.querySelector(sel); }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ---------- Connection ----------
    async function connect() {
        if (S.puzzle || S.connecting) return;
        if (!isBtEvent(currentEvent())) {
            alert(T('bt.only333Connect', 'The smart cube can only be connected in 3x3x3 events.'));
            return;
        }
        if (!navigator.bluetooth) {
            alert(T('bt.notSupported', 'Web Bluetooth is not supported in this browser. Use Chrome or Edge over HTTPS.'));
            return;
        }
        S.connecting = true;
        renderButton();
        try {
            if (!S.module) S.module = await importFirstAvailable(BLUETOOTH_CDNS);
            const puzzle = await S.module.connectSmartPuzzle();
            S.puzzle = puzzle;
            // Solved reference pattern (kpuzzle comes with the reported pattern).
            try {
                const reported = await puzzle.getPattern();
                S.solvedPattern = reported.kpuzzle.defaultPattern();
            } catch (e) {
                console.warn('[SmartCube] getPattern failed — tracking disabled', e);
                S.solvedPattern = null;
            }
            S.livePattern = S.solvedPattern;
            S.moveCount = 0;
            S.recentMoves = [];
            puzzle.addAlgLeafListener(onMove);
            readBattery();
            resetTracking();
            renderPanel();
        } catch (e) {
            console.warn('[SmartCube] connect failed', e);
            // NotFoundError = user closed the chooser — no need for an alert.
            if (!e || e.name !== 'NotFoundError') {
                alert(T('bt.connectFailed', 'Could not connect to the smart cube.'));
            }
            S.puzzle = null;
        } finally {
            S.connecting = false;
            renderButton();
            decorateScramble();
        }
    }

    function disconnect() {
        try { S.puzzle && S.puzzle.disconnect(); } catch (e) { /* already gone */ }
        S.puzzle = null;
        S.livePattern = S.solvedPattern = null;
        S.battery = null;
        S.phase = 'idle';
        renderPanel();
        renderButton();
        // Restore the plain scramble text.
        if (window.TimerModule) {
            const disp = $('#cs-scramble-text');
            if (disp) disp.textContent = window.TimerModule.getCurrentScramble() || '—';
        }
    }

    async function readBattery() {
        try {
            if (S.puzzle && typeof S.puzzle.getBattery === 'function') {
                S.battery = await S.puzzle.getBattery();
                renderPanel();
            }
        } catch (e) { /* not all cubes report battery */ }
    }

    // ---------- Scramble tracking ----------
    function resetTracking() {
        const tm = window.TimerModule;
        const event = tm ? tm.getCurrentEvent() : '333';
        const scramble = tm ? tm.getCurrentScramble() : '';
        S.progress = 0;
        S.movesSinceMatch = 0;
        if (!S.puzzle) { S.phase = 'idle'; return; }
        if (!TRACKABLE_EVENTS.includes(event) || !scramble || !S.solvedPattern) {
            S.trackingEvent = null;
            S.tokens = [];
            S.prefixPatterns = [];
            S.phase = 'na';
            return;
        }
        S.trackingEvent = event;
        S.tokens = scramble.trim().split(/\s+/).filter(Boolean);
        S.prefixPatterns = [S.solvedPattern];
        try {
            let p = S.solvedPattern;
            for (const tok of S.tokens) {
                p = p.applyMove(tok);
                S.prefixPatterns.push(p);
            }
        } catch (e) {
            console.warn('[SmartCube] could not precompute scramble patterns', e);
            S.trackingEvent = null;
            S.phase = 'na';
            return;
        }
        S.phase = 'scrambling';
    }

    // Re-sync: user holds the cube solved (white top, green front).
    function markSolved() {
        if (!S.solvedPattern) return;
        S.livePattern = S.solvedPattern;
        const twisty = $('#bt-twisty');
        if (twisty) twisty.alg = '';
        resetTracking();
        renderPanel();
        decorateScramble();
    }

    function onMove(e) {
        const leaf = e.latestAlgLeaf;
        const moveStr = leaf.toString();
        S.moveCount++;
        S.recentMoves.push(moveStr);
        if (S.recentMoves.length > 12) S.recentMoves.shift();

        // Mirror the move on the live 3D view.
        const twisty = $('#bt-twisty');
        if (twisty && typeof twisty.experimentalAddMove === 'function') {
            try { twisty.experimentalAddMove(leaf); } catch (err) { /* non-move leaf */ }
        }

        // Track physical state. Keep the pre-move pattern: when this move turns
        // out to be the first of a solve, that is the scrambled state the
        // analysis has to replay from.
        const patternBefore = S.livePattern;
        if (S.livePattern) {
            try {
                S.livePattern = S.livePattern.applyMove(moveStr);
            } catch (err) {
                // Unknown leaf (e.g. rotation) — state unknown from here on.
            }
        }

        const tm = window.TimerModule;
        const timerRunning = tm && tm.getPhase() === 'running';

        if (timerRunning || S.phase === 'solving') {
            recordSolveMove(moveStr);
            // Stop as soon as the cube is physically solved.
            if (isSolved()) {
                if (tm) tm.smartStop();
                S.phase = 'idle';
                publishSolveAnalysis();
                // rollScramble → 'cs-scramble-changed' will re-arm tracking.
            }
        } else if (S.phase === 'armed') {
            // First move after a completed scramble starts the timer.
            if (tm && tm.smartStart()) {
                S.phase = 'solving';
                beginSolveRecording(patternBefore);
                recordSolveMove(moveStr);
            }
        } else if (S.phase === 'scrambling') {
            updateScrambleProgress();
        }

        renderPanel();
        decorateScramble();
    }

    function isSolved() {
        if (!S.livePattern) return false;
        try {
            return S.livePattern.experimentalIsSolved({
                ignorePuzzleOrientation: true,
                ignoreCenterOrientation: true,
            });
        } catch (e) {
            return false;
        }
    }

    // ---------- Solve recording → CFOP analysis ----------

    function beginSolveRecording(startPattern) {
        S.solveLog = [];
        S.solveStartT = performance.now();
        S.solveStartPattern = startPattern || null;
    }

    function recordSolveMove(moveStr) {
        if (!S.solveStartT) return;
        S.solveLog.push({ move: moveStr, t: Math.round(performance.now() - S.solveStartT) });
    }

    // Replay the recorded solve and broadcast the phase breakdown. Everything
    // here is best-effort: if the analysis module or the start state is
    // missing, the solve simply isn't analysed.
    function publishSolveAnalysis() {
        const log = S.solveLog.slice();
        const start = S.solveStartPattern;
        S.solveLog = [];
        S.solveStartT = 0;
        S.solveStartPattern = null;

        if (!log.length || !start || !window.SolveAnalysis) return;

        let pattern = start;
        const puzzle = {
            applyMove(m) { pattern = pattern.applyMove(m); },
            getState() {
                const d = pattern.patternData;
                return { edges: d.EDGES, corners: d.CORNERS };
            },
        };

        let result;
        try {
            result = window.SolveAnalysis.analyze(log, puzzle);
        } catch (err) {
            console.warn('[SmartCube] solve analysis failed', err);
            return;
        }
        if (!result || !result.segments.length) return;

        document.dispatchEvent(new CustomEvent('cs-solve-analyzed', { detail: result }));
    }

    function updateScrambleProgress() {
        if (!S.livePattern || !S.prefixPatterns.length) return;
        // Scan for the deepest scramble prefix matching the physical state.
        // (Scanning is robust to double turns: the half-way state of an R2
        // simply matches nothing and progress stays put.)
        let matched = -1;
        for (let i = S.prefixPatterns.length - 1; i >= 0; i--) {
            try {
                if (S.livePattern.isIdentical(S.prefixPatterns[i])) { matched = i; break; }
            } catch (e) { break; }
        }
        if (matched >= 0) {
            S.progress = matched;
            S.movesSinceMatch = 0;
        } else {
            S.movesSinceMatch++;
        }
        if (S.progress >= S.tokens.length && S.tokens.length > 0) {
            S.phase = 'armed';
        }
    }

    // ---------- UI ----------
    function ensureUI() {
        const actions = $('.cs-scramble-actions');
        if (!actions || document.getElementById('bt-connect-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'bt-connect-btn';
        btn.className = 'cs-btn-secondary';
        btn.addEventListener('click', () => (S.puzzle ? disconnect() : connect()));
        actions.appendChild(btn);
        updateButtonVisibility();

        const panel = document.createElement('div');
        panel.id = 'bt-panel';
        panel.className = 'bt-panel';
        panel.style.display = 'none';
        const scrambleBar = $('.cs-scramble-bar');
        if (scrambleBar && scrambleBar.parentNode) {
            scrambleBar.parentNode.insertBefore(panel, scrambleBar.nextSibling);
        }

        // Solve breakdown, filled in after each smart-cube solve.
        if (!document.getElementById('bt-analysis')) {
            const analysis = document.createElement('div');
            analysis.id = 'bt-analysis';
            analysis.className = 'bt-analysis';
            analysis.style.display = 'none';
            const center = $('.cstimer-center');
            if (center) center.appendChild(analysis);
            else if (scrambleBar && scrambleBar.parentNode) {
                scrambleBar.parentNode.insertBefore(analysis, panel.nextSibling);
            }
        }
        renderButton();
    }

    // ---------- Analysis panel ----------

    // T() and esc() are already defined at the top of this module.
    const fmtSec = (ms) => (ms / 1000).toFixed(2);
    const escapeHtml = esc;

    const RATING_LABEL = {
        optimal: () => T('analysis.optimal', 'Optimal'),
        fumble: () => T('analysis.fumble', 'Fumble'),
        blunder: () => T('analysis.blunder', 'Blunder'),
    };

    function segmentRow(label, seg) {
        const rating = seg.rating || 'optimal';
        return `
            <div class="bt-an-row">
                <div class="bt-an-row-head">
                    <span class="bt-an-slot">${escapeHtml(label)}</span>
                    <span class="bt-an-badge bt-an-${rating}" title="${escapeHtml(seg.reason || '')}">
                        ${escapeHtml(RATING_LABEL[rating] ? RATING_LABEL[rating]() : rating)}
                    </span>
                    <span class="bt-an-meta">${fmtSec(seg.ms)}s · ${seg.moveCount}${T('analysis.movesShort', 'm')} · ${seg.tps} ${T('analysis.tps', 'TPS')}</span>
                </div>
                <div class="bt-an-moves">${escapeHtml(seg.moves.join(' '))}</div>
            </div>`;
    }

    function renderAnalysis(result) {
        const el = document.getElementById('bt-analysis');
        if (!el) return;
        if (!result || !result.segments.length) { el.style.display = 'none'; return; }

        const s = window.SolveAnalysis.summarize(result);
        const parts = [];

        parts.push(`<div class="bt-an-title">${T('analysis.title', 'Solve breakdown')}
            <span class="bt-an-total">${fmtSec(result.totalMs)}s · ${result.moveCount} ${T('analysis.moves', 'moves')}</span></div>`);

        if (s.cross) {
            parts.push(`<div class="bt-an-phase"><span class="bt-an-phase-name">${T('analysis.cross', 'CROSS')}</span>
                <span class="bt-an-phase-time">[${fmtSec(s.cross.ms)}]</span></div>`);
            parts.push(`<div class="bt-an-moves bt-an-moves-lead">${escapeHtml(s.cross.moves.join(' '))}</div>`);
        }

        if (s.f2l.slots.length) {
            parts.push(`<div class="bt-an-phase"><span class="bt-an-phase-name">${T('analysis.f2l', 'F2L')}</span>
                <span class="bt-an-phase-time">[${fmtSec(s.f2l.ms)}]</span></div>`);
            s.f2l.slots.forEach(seg => {
                parts.push(segmentRow(`${T('analysis.slot', 'SLOT')} ${seg.slot}`, seg));
            });
        }

        ['oll', 'pll'].forEach(k => {
            if (!s[k]) return;
            parts.push(`<div class="bt-an-phase"><span class="bt-an-phase-name">${k.toUpperCase()}</span>
                <span class="bt-an-phase-time">[${fmtSec(s[k].ms)}]</span></div>`);
            parts.push(segmentRow(k.toUpperCase(), s[k]));
        });

        if (!result.complete) {
            parts.push(`<div class="bt-an-note">${T('analysis.partial', 'Solve did not finish — showing what was tracked.')}</div>`);
        }

        el.innerHTML = parts.join('');
        el.style.display = 'block';
    }

    document.addEventListener('cs-solve-analyzed', (e) => renderAnalysis(e.detail));
    // A new scramble means a new attempt; clear the old breakdown.
    document.addEventListener('cs-scramble-changed', () => {
        const el = document.getElementById('bt-analysis');
        if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });

    const BT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>';

    // The connect button only exists for 3x3 events, and only where Web
    // Bluetooth exists at all — iOS Safari has no support whatsoever, so on
    // iPhone the button would be a control that can never work.
    function updateButtonVisibility() {
        const btn = document.getElementById('bt-connect-btn');
        if (!btn) return;
        const usable = !!navigator.bluetooth && isBtEvent(currentEvent());
        btn.style.display = usable ? '' : 'none';
    }

    function renderButton() {
        const btn = document.getElementById('bt-connect-btn');
        if (!btn) return;
        if (S.connecting) {
            btn.innerHTML = `${BT_ICON} ${esc(T('bt.connecting', 'Connecting…'))}`;
            btn.disabled = true;
        } else if (S.puzzle) {
            btn.innerHTML = `${BT_ICON} ${esc(T('bt.disconnect', 'Disconnect'))}`;
            btn.disabled = false;
            btn.classList.add('bt-connected');
        } else {
            btn.innerHTML = `${BT_ICON} ${esc(T('bt.connect', 'Smart Cube'))}`;
            btn.disabled = false;
            btn.classList.remove('bt-connected');
        }
    }

    function statusLine() {
        switch (S.phase) {
            case 'scrambling': return T('bt.followScramble', 'Follow the scramble on the cube — completed moves turn green.');
            case 'armed': return T('bt.scrambleDone', 'Scramble complete — start solving to start the timer!');
            case 'solving': return T('bt.solving', 'Solving…');
            case 'na': return T('bt.only333', 'Smart cube tracking works with 3x3x3 events only.');
            default: return '';
        }
    }

    function renderPanel() {
        const panel = document.getElementById('bt-panel');
        if (!panel) return;
        if (!S.puzzle) {
            panel.style.display = 'none';
            panel.innerHTML = '';
            delete panel.dataset.built;
            return;
        }
        panel.style.display = '';
        const name = S.puzzle.name ? (S.puzzle.name() || 'Smart Cube') : 'Smart Cube';
        const offScramble = (S.phase === 'scrambling' && S.movesSinceMatch >= 2)
            ? `<div class="bt-warn">${esc(T('bt.offScramble', 'Off scramble — undo the wrong move or click "Mark as solved" to restart.'))}</div>`
            : '';

        // Build the panel once; afterwards only update the dynamic bits so
        // the twisty-player element (and its WebGL context) is preserved.
        if (!panel.dataset.built) {
            panel.innerHTML = `
                <div class="bt-panel-info">
                    <div class="bt-panel-head">
                        <span class="bt-dot"></span>
                        <strong id="bt-name"></strong>
                        <span class="bt-meta" id="bt-meta"></span>
                    </div>
                    <div class="bt-status" id="bt-status"></div>
                    <div class="bt-warn-slot" id="bt-warn-slot"></div>
                    <div class="bt-moves" id="bt-moves"></div>
                    <div class="bt-actions">
                        <button class="cs-btn-ghost" id="bt-mark-solved"></button>
                    </div>
                </div>
                <twisty-player id="bt-twisty" puzzle="3x3x3" alg="" background="none" control-panel="none" viewer-link="none" class="bt-twisty"></twisty-player>
            `;
            panel.dataset.built = '1';
            const markBtn = document.getElementById('bt-mark-solved');
            markBtn.addEventListener('click', markSolved);
        }
        document.getElementById('bt-name').textContent = name;
        document.getElementById('bt-meta').textContent = `${T('bt.connected', 'Connected')} · ${T('bt.moves', 'Moves')}: ${S.moveCount}${S.battery !== null ? ` · ${T('bt.battery', 'Battery')}: ${S.battery}%` : ''}`;
        document.getElementById('bt-status').textContent = statusLine();
        document.getElementById('bt-warn-slot').innerHTML = offScramble;
        document.getElementById('bt-moves').textContent = S.recentMoves.join(' ');
        const markBtn = document.getElementById('bt-mark-solved');
        markBtn.textContent = T('bt.markSolved', 'Mark as solved');
        markBtn.title = T('bt.markSolvedHint', 'Hold the cube solved with WHITE on top and GREEN facing you, then click.');
    }

    // Re-render the scramble text as tokens with progress highlighting.
    // Called from timer.js renderScramble() and after every move.
    function decorateScramble() {
        if (!S.puzzle) return;
        const disp = $('#cs-scramble-text');
        if (!disp) return;
        if (!S.trackingEvent || !S.tokens.length) return; // plain text is fine
        disp.innerHTML = S.tokens.map((tok, i) => {
            const cls = i < S.progress ? 'bt-tok bt-tok-done' : (i === S.progress ? 'bt-tok bt-tok-next' : 'bt-tok');
            return `<span class="${cls}">${esc(tok)}</span>`;
        }).join(' ');
    }

    // ---------- Wiring ----------
    document.addEventListener('cs-scramble-changed', (e) => {
        updateButtonVisibility();
        if (!S.puzzle) return;
        // Switching away from 3x3 while connected drops the connection —
        // smart cubes only make sense on 3x3 events.
        const event = e.detail?.event || currentEvent();
        if (!isBtEvent(event)) {
            disconnect();
            return;
        }
        resetTracking();
        renderPanel();
        decorateScramble();
    });

    document.addEventListener('app-language-changed', () => {
        renderButton();
        renderPanel();
    });

    function init() {
        ensureUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SmartCube = { connect, disconnect, markSolved, decorateScramble, state: S };
})();
