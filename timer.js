/* ============================================================
   CubingHQ — csTimer-Compatible Timer Module
   ============================================================ */

(function () {
    'use strict';

    // ========== EVENT / PUZZLE DEFINITIONS ==========
    const EVENT_INFO = {
        '333':    { name: '3x3x3',    faces: ['U','D','R','L','F','B'], length: 20, format: 'ao5', puzzle: '3x3x3' },
        '222':    { name: '2x2x2',    faces: ['U','R','F'],              length: 11, format: 'ao5', puzzle: '2x2x2' },
        '444':    { name: '4x4x4',    useBigCube: true,                 length: 40, format: 'ao5', puzzle: '4x4x4' },
        '555':    { name: '5x5x5',    useBigCube: true,                 length: 60, format: 'ao5', puzzle: '5x5x5' },
        '666':    { name: '6x6x6',    useBigCube: true,                 length: 80, format: 'mo3', puzzle: '6x6x6' },
        '777':    { name: '7x7x7',    useBigCube: true,                 length: 100, format: 'mo3', puzzle: '7x7x7' },
        '333oh':  { name: '3x3 OH',   faces: ['U','D','R','L','F','B'], length: 20, format: 'ao5', puzzle: '3x3x3' },
        'pyram':  { name: 'Pyraminx', faces: ['U','R','L','B','u','r','l','b'], modifiers: ['', "'"], length: 11, format: 'ao5', puzzle: 'pyraminx' },
        'skewb':  { name: 'Skewb',    faces: ['U','R','L','B'],         modifiers: ['', "'"], length: 11, format: 'ao5', puzzle: 'skewb' },
        'sq1':    { name: 'Square-1', puzzle: 'square1', format: 'ao5' },
        'minx':   { name: 'Megaminx', faces: ['R','D','U'],     modifiers: ['', "'", '++', '--'], length: 77, format: 'ao5', puzzle: 'megaminx' },
        'clock':  { name: 'Clock',    puzzle: 'clock', format: 'mo3' },
    };

    const ALL_EVENT_IDS = ['333','222','444','555','666','777','333oh','pyram','skewb','sq1','minx','clock'];
    const DEFAULT_EVENT = '333';

    // i18n helper — falls back to the English default when i18n.js
    // isn't loaded (e.g. embedded uses of this module).
    function T(key, fallback) {
        return window.AppI18N ? window.AppI18N.t(key, fallback) : fallback;
    }

    // ========== SCRAMBLE GENERATION ==========
    // All scrambles come from the shared ScrambleEngine (scramble-engine.js):
    // official cubing.js random-state scrambles with local offline fallbacks.
    async function generateScramble(event) {
        if (window.ScrambleEngine) return window.ScrambleEngine.get(event);
        // Extremely defensive fallback if engine script failed to load.
        return 'R U R\' U\'';
    }

    // Roll a fresh scramble for the given event and (safely) publish it.
    // A token guards against out-of-order async completion when the user
    // switches events/sessions quickly.
    let _scrambleToken = 0;
    async function rollScramble(event) {
        const token = ++_scrambleToken;
        TSTATE.currentScramble = '';
        renderScramble();
        renderTwisty();
        const scramble = await generateScramble(event);
        if (token !== _scrambleToken) return; // superseded by a newer request
        TSTATE.currentScramble = scramble;
        renderScramble();
        renderTwisty();
        // Let listeners (e.g. the smart cube module) react to a new scramble.
        document.dispatchEvent(new CustomEvent('cs-scramble-changed', {
            detail: { scramble, event },
        }));
    }

    // ========== UTILITIES ==========
    function fmt(ms) {
        if (ms === Infinity || ms === null || ms === undefined) return 'DNF';
        if (ms >= 60000) {
            const totalSec = ms / 1000;
            const m = Math.floor(totalSec / 60);
            const s = (totalSec % 60).toFixed(2);
            return `${m}:${s.padStart(5, '0')}`;
        }
        return (ms / 1000).toFixed(2);
    }

    function fmtMean(msAvg) {
        if (msAvg === Infinity || isNaN(msAvg)) return 'DNF';
        return fmt(msAvg);
    }

    function trimScramble(s) {
        if (!s) return '';
        // Show ~14 chars for compact display
        return s.length > 14 ? s.slice(0, 13) + '…' : s;
    }    function uid() { return Math.random().toString(36).slice(2, 11); }

    function nowIso() { return new Date().toISOString(); }

    function $ (s){return document.querySelector(s);}
    function $$ (s){return document.querySelectorAll(s);}

    // Escape any user-controlled string so it's safe to interpolate into innerHTML.
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========== STATE ==========
    const TSTATE = {
        // Sessions: indexed by session id
        sessions: {},
        activeSession: null,
        // Order of session ids for tab display
        sessionOrder: [],
        // Settings (global + per-session overrides handled inside session)
        settings: {
            spacebarHold: 300,        // ms, 0 = none
            inspection: 'off',        // 'off' | 'on'
            voiceCues: 'off',         // 'off' | 'on'
            hideTimeDuring: false,
            hideScrambleDuring: false,
            useManualEntry: false,
            showAllSolves: 0,         // 0 = all; >0 = last N
            manualAvgInBg: false,
            timerFont: 'normal',      // 'normal' | 'large' | 'huge'
            // Theme is handled by body[data-theme] attribute (shared with app)
        },
        // Live runtime
        phase: 'idle',               // idle | inspecting | holding | ready | running | stopped
        timerRaf: null,
        timerStart: 0,
        currentScramble: '',
        inspectionStart: 0,
        inspectionRemaining: 15,
        inspectionRaf: null,
        holdTimeout: null,
        holdStart: 0,
        voiceSpokenAt: {},           // second -> true if spoken this session
        loaded: false,
    };

    // ========== STORAGE ==========
    const STORAGE_KEY = 'cstimer_data_v2';

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data && data.sessions) {
                TSTATE.sessions = data.sessions;
                TSTATE.sessionOrder = data.sessionOrder || Object.keys(data.sessions);
                if (data.settings) Object.assign(TSTATE.settings, data.settings);
                if (data.activeSession && TSTATE.sessions[data.activeSession]) {
                    TSTATE.activeSession = data.activeSession;
                } else if (TSTATE.sessionOrder.length) {
                    TSTATE.activeSession = TSTATE.sessionOrder[0];
                }
                return true;
            }
        } catch (e) { console.warn('Failed to load timer data', e); }
        return false;
    }

    let saveTimer = null;

    // Sessions are saved to this browser and nowhere else.
    //
    // There used to be a second write here: every save was also PUT to
    // timer_data/<uid> in the public Realtime Database, keyed on the
    // signed-in person's WCA id — so a whole solve history sat at a
    // guessable path. Nothing ever read it back; no code in this repo,
    // client or server, fetched that subtree. It was a copy of everyone's
    // practice history taken for no feature, which is the definition of
    // data collected without a purpose. Removed rather than documented.
    //
    // If cross-device sync is wanted later it needs the opposite shape:
    // authenticated writes under the account's own id, rules that let
    // only that account read it, and a switch the person controls.
    function saveState(debouncedMs = 0) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                const data = {
                    sessions: TSTATE.sessions,
                    sessionOrder: TSTATE.sessionOrder,
                    settings: TSTATE.settings,
                    activeSession: TSTATE.activeSession,
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) { console.warn('Failed to save timer data', e); }
        }, debouncedMs);
    }

    // ========== SESSION HELPERS ==========
    function getSession() {
        return TSTATE.sessions[TSTATE.activeSession] || null;
    }

    async function newSession(name = 'Session', event = DEFAULT_EVENT) {
        const id = 'sess_' + uid();
        const session = {
            id,
            name,
            event,
            createdAt: Date.now(),
            solves: [],
            // Per-session settings overrides can go here later
        };
        TSTATE.sessions[id] = session;
        TSTATE.sessionOrder.push(id);
        TSTATE.activeSession = id;
        rollScramble(event);
        saveState();
        return session;
    }

    async function switchSession(id) {
        if (!TSTATE.sessions[id]) return;
        TSTATE.activeSession = id;
        rollScramble(TSTATE.sessions[id].event);
        saveState();
        renderAll();
    }

    async function deleteSession(id) {
        if (TSTATE.sessionOrder.length <= 1) return;
        delete TSTATE.sessions[id];
        TSTATE.sessionOrder = TSTATE.sessionOrder.filter(sid => sid !== id);
        if (TSTATE.activeSession === id) {
            TSTATE.activeSession = TSTATE.sessionOrder[0];
            rollScramble(TSTATE.sessions[TSTATE.activeSession].event);
        }
        saveState();
        renderAll();
    }

    function renameSession(id, name) {
        if (!TSTATE.sessions[id] || !name.trim()) return;
        TSTATE.sessions[id].name = name.trim().slice(0, 24);
        saveState();
        renderSessionTabs();
    }

    // ========== STATISTICS ==========
    // The maths lives in cube-stats.js so the AI Coach computes its
    // numbers with exactly this code rather than a second copy that
    // could drift. Local aliases keep every call site below unchanged.
    // The inline fallbacks only fire if cube-stats.js failed to load;
    // they return empty rather than wrong values, so a missing script
    // shows dashes instead of a plausible-looking lie.
    const _stats = (typeof window !== 'undefined' && window.CubeStats) || null;
    const _noStats = () => null;

    const effectiveMs     = _stats ? _stats.effectiveMs     : _noStats;
    const getBestSingle   = _stats ? _stats.getBestSingle   : _noStats;
    const getWorstSingle  = _stats ? _stats.getWorstSingle  : _noStats;
    const getMean         = _stats ? _stats.getMean         : _noStats;
    const getAverage      = _stats ? _stats.getAverage      : _noStats;
    const getBestAverage  = _stats ? _stats.getBestAverage  : _noStats;
    const getStdDev       = _stats ? _stats.getStdDev       : _noStats;
    const getSuccessRate  = _stats ? _stats.getSuccessRate  : _noStats;
    const getTotalSolves  = _stats ? _stats.getTotalSolves  : (s => (s ? s.length : 0));

    if (!_stats) console.error('[Timer] cube-stats.js did not load — statistics disabled.');

    // ========== PHASE / TIMER LOGIC ==========
    function exitAnyPhase() {
        if (TSTATE.inspectionRaf) cancelAnimationFrame(TSTATE.inspectionRaf);
        TSTATE.inspectionRaf = null;
        if (TSTATE.timerRaf) cancelAnimationFrame(TSTATE.timerRaf);
        TSTATE.timerRaf = null;
        if (TSTATE.holdTimeout) clearTimeout(TSTATE.holdTimeout);
        TSTATE.holdTimeout = null;
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function resetPhaseToIdle() {
        exitAnyPhase();
        TSTATE.phase = 'idle';
        TSTATE.voiceSpokenAt = {};
    }

    // Cache display element to avoid DOM queries inside rAF loops
    let _timerDisplayEl = null;
    function getTimerDisplay() {
        if (!_timerDisplayEl || !_timerDisplayEl.isConnected) {
            _timerDisplayEl = $('#timer-display-text');
        }
        return _timerDisplayEl;
    }

    function startInspection() {
        if (TSTATE.phase !== 'idle') return;
        hideSolveActions();
        if (TSTATE.settings.inspection !== 'on') {
            // Skip inspection — go straight to hold
            beginHold();
            return;
        }
        TSTATE.phase = 'inspecting';
        TSTATE.inspectionStart = performance.now();
        TSTATE.inspectionRemaining = 15;
        TSTATE.voiceSpokenAt = {};
        renderPhaseBadge();
        inspectionTick();
    }

    function inspectionTick() {
        const elapsedSec = (performance.now() - TSTATE.inspectionStart) / 1000;
        const remaining = Math.max(0, 15 - elapsedSec);
        TSTATE.inspectionRemaining = remaining;
        const display = getTimerDisplay();
        if (display) display.textContent = remaining > 0 ? remaining.toFixed(2) : '0.00';

        // Voice cues
        if (TSTATE.settings.voiceCues === 'on') {
            if (remaining <= 8 && remaining > 7 && !TSTATE.voiceSpokenAt[8]) {
                speak(T('voice.8s', '8 seconds'));
                TSTATE.voiceSpokenAt[8] = true;
            }
            if (remaining <= 12 && remaining > 11 && !TSTATE.voiceSpokenAt[12]) {
                speak(T('voice.12s', '12 seconds'));
                TSTATE.voiceSpokenAt[12] = true;
            }
        }

        if (remaining <= 0) {
            // DNF
            cancelAnimationFrame(TSTATE.inspectionRaf);
            TSTATE.inspectionRaf = null;
            TSTATE.phase = 'inspection_dnf';
            renderPhaseBadge('DNF');
            if (display) display.textContent = 'DNF';
            return;
        }
        TSTATE.inspectionRaf = requestAnimationFrame(inspectionTick);
    }

    function beginHold() {
        // Start hold OR go straight to ready if hold=0
        TSTATE.phase = 'holding';
        TSTATE.holdStart = performance.now();
        renderPhaseBadge();

        const display = $('#timer-display-text');
        if (display) {
            display.classList.add('cs-holding');
            // The previous solve's time has been on screen until now; this is
            // the moment the next solve begins, so clear it.
            display.textContent = '0.00';
        }

        if (TSTATE.settings.spacebarHold <= 0) {
            goReady();
        } else {
            // Use raf to color red during hold, then transition at holdDelay
            TSTATE.holdTimeout = setTimeout(() => {
                if (TSTATE.phase === 'holding') goReady();
            }, TSTATE.settings.spacebarHold);
        }
    }

    function goReady() {
        TSTATE.phase = 'ready';
        const display = $('#timer-display-text');
        if (display) {
            display.classList.remove('cs-holding');
            display.classList.add('cs-ready');
        }
        renderPhaseBadge('READY');
    }

    function startRunning() {
        TSTATE.phase = 'running';
        TSTATE.timerStart = performance.now();
        const display = getTimerDisplay();
        if (display) {
            display.classList.remove('cs-ready', 'cs-holding');
            display.classList.add('cs-running');
        }
        renderPhaseBadge();
        runningTick();
    }

    function runningTick() {
        const elapsed = performance.now() - TSTATE.timerStart;
        const display = getTimerDisplay();
        if (display) display.textContent = fmt(elapsed);
        if (TSTATE.phase === 'running') {
            TSTATE.timerRaf = requestAnimationFrame(runningTick);
        }
    }

    // ---------- Post-solve actions ----------
    // The solve is recorded the moment the timer stops, with no penalty. This
    // bar only exists for the times a +2 or a DNF is needed, so it sits inline
    // under the display and never blocks the page.
    let _lastStoppedSolveId = null;

    function showSolveActions(solveId) {
        _lastStoppedSolveId = solveId;
        const bar = $('#cs-solve-actions');
        if (!bar) return;
        bindSolveActionEvents();
        bar.style.display = 'flex';
        syncSolveActions();
    }

    function hideSolveActions() {
        const bar = $('#cs-solve-actions');
        if (bar) bar.style.display = 'none';
    }

    // Reflect the solve's current penalty, so the buttons read as toggles
    // rather than fire-and-forget.
    function syncSolveActions() {
        const sess = getSession();
        const solve = sess && _lastStoppedSolveId
            ? sess.solves.find(x => x.id === _lastStoppedSolveId)
            : null;
        const pen = solve ? (solve.penalty || '') : '';
        const p2 = $('#cs-act-plus2');
        const dnf = $('#cs-act-dnf');
        if (p2) p2.classList.toggle('is-active', pen === '+2');
        if (dnf) dnf.classList.toggle('is-active', pen === 'DNF');
    }

    let _solveActionsBound = false;
    function bindSolveActionEvents() {
        if (_solveActionsBound) return;
        const bar = $('#cs-solve-actions');
        if (!bar) return;
        _solveActionsBound = true;

        // Pressing the penalty that is already set clears it back to OK.
        const toggle = pen => {
            if (!_lastStoppedSolveId) return;
            const sess = getSession();
            const solve = sess && sess.solves.find(x => x.id === _lastStoppedSolveId);
            if (!solve) return;
            setSolvePenalty(_lastStoppedSolveId, (solve.penalty || '') === pen ? '' : pen);
            syncSolveActions();
        };
        const p2 = $('#cs-act-plus2');
        const dnf = $('#cs-act-dnf');
        const del = $('#cs-act-delete');
        if (p2) p2.addEventListener('click', () => toggle('+2'));
        if (dnf) dnf.addEventListener('click', () => toggle('DNF'));
        if (del) del.addEventListener('click', () => {
            if (_lastStoppedSolveId) deleteSolveById(_lastStoppedSolveId);
            _lastStoppedSolveId = null;
            hideSolveActions();
            const display = $('#timer-display-text');
            if (display) display.textContent = '0.00';
        });
    }

    function stopTimer() {
        if (TSTATE.phase !== 'running') return;
        TSTATE.phase = 'stopped';
        cancelAnimationFrame(TSTATE.timerRaf);
        TSTATE.timerRaf = null;
        const elapsed = performance.now() - TSTATE.timerStart;
        const display = $('#timer-display-text');
        if (display) display.classList.remove('cs-running');

        // Determine penalty default:
        // If inspection was used and timer started after 15s inspection -> no penalty recorded yet
        // If inspection was started and not finished: DNF
        // If started without inspection: no penalty
        let defaultPenalty = '';
        const inspected = TSTATE.settings.inspection === 'on';
        if (inspected) {
            // If we successfully reached 'ready' from inspection, no penalty default
            // If inspection timed out, would have gone to inspection_dnf.
            defaultPenalty = '';
        }

        // Record solve
        const sess = getSession();
        if (sess) {
            const solve = {
                id: uid(),
                time: Math.round(elapsed),
                scramble: TSTATE.currentScramble,
                event: sess.event,
                penalty: defaultPenalty,
                timestamp: Date.now(),
            };
            sess.solves.push(solve);
            // Let listeners (the AI Coach's drill runner) react to a finished
            // solve without polling the session array.
            document.dispatchEvent(new CustomEvent('cs-solve-recorded', {
                detail: { solve, sessionId: sess.id, solveCount: sess.solves.length },
            }));
            showSolveActions(solve.id);
            saveState(50);
            // The solve is in. Leave the time on the display — it stays until
            // the next solve starts, so it can actually be read.
            if (display) display.textContent = fmt(elapsed);

            // After short delay, roll next scramble and re-render list with focus on last solve
            setTimeout(() => {
                rollScramble(sess.event);
                renderAll();
                resetToIdleForNext();
            }, 50);
        } else {
            resetPhaseToIdle();
            renderPhaseBadge();
        }
    }

    function resetToIdleForNext() {
        resetPhaseToIdle();
        const display = $('#timer-display-text');
        if (display) {
            // Classes only — the time itself stays put and is cleared by
            // beginHold() when the next solve actually starts.
            display.classList.remove('cs-holding', 'cs-ready', 'cs-running');
        }
        renderPhaseBadge();
    }

    function speak(text) {
        try {
            if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance(text);
                u.rate = 1.1;
                // The inspection cues are translated, so the voice has to
                // match — an English voice reading "8 segundos" is unusable.
                u.lang = (window.AppI18N && window.AppI18N.getLang() === 'pt') ? 'pt-PT' : 'en-US';
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            }
        } catch (e) { /* ignore */ }
    }

    function clearCurrentSession() {
        const sess = getSession();
        if (!sess || sess.solves.length === 0) return;
        if (confirm(T('confirm.clearSolves', 'Clear all {n} solves in "{name}"?')
            .replace('{n}', sess.solves.length).replace('{name}', sess.name))) {
            sess.solves = [];
            saveState();
            renderSolveList();
            renderStatsPanel();
        }
    }

    // ========== EVENT BINDINGS ==========
    // Bind only once per page lifetime to prevent listener accumulation on
    // repeated navigations to #timer-view (initTimerView calls us via onEnter).
    let _globalListenersBound = false;
    function bindEvents() {
        if (_globalListenersBound) {
            // Re-attach only the per-view pointer handlers (safe to redo).
            const wrap = timerTapSurface();
            if (wrap && !wrap._csBtnBound) {
                wrap.addEventListener('mousedown', onPointerDown);
                wrap.addEventListener('touchstart', onPointerDown, { passive: false });
                wrap._csBtnBound = true;
            }
            return;
        }
        _globalListenersBound = true;
        document.addEventListener('keydown', onGlobalKeydown, true);
        document.addEventListener('keyup', onGlobalKeyup, true);
        document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchend', onPointerUp);

        const wrap = timerTapSurface();
        if (wrap && !wrap._csBtnBound) {
            wrap.addEventListener('mousedown', onPointerDown);
            wrap.addEventListener('touchstart', onPointerDown, { passive: false });
            wrap._csBtnBound = true;
        }
    }

    // Only the area between the scramble and the stats starts a solve. Binding
    // the whole centre column meant a tap on the event or session picker ran
    // preventDefault() — which is exactly what stops a native <select> from
    // opening — and started the timer instead of showing the list.
    function timerTapSurface() {
        return $('#cs-timer-display-area') || $('.cstimer-center');
    }

    function isTypingTarget(t) {
        if (!t) return false;
        if (t.closest && t.closest('input')) return true; // any <input> (text, number, etc.)
        if (t.tagName === 'TEXTAREA') return true;
        if (t.isContentEditable) return true;
        return false;
    }

    function onGlobalKeydown(e) {
        // Only handle when on timer view
        const timerView = $('#timer-view');
        if (!timerView || !timerView.classList.contains('active')) return;
        // Don't intercept typing
        if (isTypingTarget(e.target)) return;
        // Block inspection time handlers we'll set up first
        if (TSTATE.settings.useManualEntry) return;

        if (e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            spaceAction('down');
        } else if (['Digit1','Numpad1'].includes(e.code) || e.key === '1') {
            e.preventDefault(); markLastSolvePenalty('OK');
        } else if (['Digit2','Numpad2'].includes(e.code) || e.key === '2') {
            e.preventDefault(); markLastSolvePenalty('+2');
        } else if (['Digit3','Numpad3'].includes(e.code) || e.key === '3') {
            e.preventDefault(); markLastSolvePenalty('DNF');
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault(); deleteLastSolve();
        } else if (e.key === 'Escape') {
            hideSolveActions();
        } else if (e.key === 'Backspace' && e.shiftKey) {
            // Shift+Backspace deletes the just-stopped solve (stop overlay hint)
            if (TSTATE.phase === 'idle' || TSTATE.phase === 'stopped') {
                e.preventDefault();
                deleteLastSolve();
                hideSolveActions();
            }
        } else if (e.key === 'Backspace') {
            // csTimer removes the last solve on Backspace when timer is idle
            if (TSTATE.phase === 'idle') {
                e.preventDefault();
                deleteLastSolve();
            }
        }
    }

    function onGlobalKeyup(e) {
        const timerView = $('#timer-view');
        if (!timerView || !timerView.classList.contains('active')) return;
        if (isTypingTarget(e.target)) return;
        if (TSTATE.settings.useManualEntry) return;
        if (e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            spaceAction('up');
        }
    }

    function onPointerDown(e) {
        const timerView = $('#timer-view');
        if (!timerView || !timerView.classList.contains('active')) return;
        if (TSTATE.settings.useManualEntry) return;
        // Don't capture presses on anything interactive.
        if (e.target.closest && e.target.closest('button, select, a[href], label, [role="button"]')) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        spaceAction('down');
    }

    function onPointerUp(e) {
        const timerView = $('#timer-view');
        if (!timerView || !timerView.classList.contains('active')) return;
        if (TSTATE.settings.useManualEntry) return;
        if (TSTATE.phase === 'holding' || TSTATE.phase === 'ready') {
            spaceAction('up');
        }
    }

    function spaceAction(type) {
        if (type === 'down') {
            if (TSTATE.phase === 'idle') {
                startInspection();
            } else if (TSTATE.phase === 'inspecting') {
                // Skip inspection on early start (after 1s)
                const elapsed = (performance.now() - TSTATE.inspectionStart) / 1000;
                cancelAnimationFrame(TSTATE.inspectionRaf);
                TSTATE.inspectionRaf = null;
                if (elapsed < 0.5) return; // ignore accidental press
                beginHold();
            } else if (TSTATE.phase === 'inspection_dnf') {
                // Already DNF, ignore
                return;
            } else if (TSTATE.phase === 'running') {
                stopTimer();
            }
        } else if (type === 'up') {
            if (TSTATE.phase === 'holding') {
                // Released too early (within hold window)
                if (TSTATE.holdTimeout) clearTimeout(TSTATE.holdTimeout);
                TSTATE.holdTimeout = null;
                // Reset to inspection or idle
                resetPhaseToIdle();
                renderPhaseBadge();
                const display = $('#timer-display-text');
                if (display) {
                    display.classList.remove('cs-holding');
                    display.textContent = '0.00';
                }
            } else if (TSTATE.phase === 'ready') {
                startRunning();
            }
        }
    }

    // ========== SOLVE MUTATIONS ==========
    function markLastSolvePenalty(penalty) {
        const sess = getSession();
        if (!sess || sess.solves.length === 0) return;
        const last = sess.solves[sess.solves.length - 1];
        if (penalty === 'OK') {
            last.penalty = '';
        } else {
            last.penalty = penalty;
        }
        hideSolveActions();
        saveState(50);
        renderSolveList();
        renderStatsPanel();
    }

    function deleteLastSolve() {
        const sess = getSession();
        if (!sess || sess.solves.length === 0) return;
        if (TSTATE.phase !== 'idle') return;
        sess.solves.pop();
        saveState(50);
        renderSolveList();
        renderStatsPanel();
    }

    function deleteSolveById(solveId) {
        const sess = getSession();
        if (!sess) return;
        sess.solves = sess.solves.filter(s => s.id !== solveId);
        saveState(50);
        renderSolveList();
        renderStatsPanel();
    }

    function setSolveTime(solveId, newTimeMs) {
        const sess = getSession();
        if (!sess) return;
        const s = sess.solves.find(x => x.id === solveId);
        if (!s) return;
        s.time = Math.max(0, Math.round(newTimeMs));
        saveState(50);
        renderSolveList();
        renderStatsPanel();
    }

    function setSolvePenalty(solveId, penalty) {
        const sess = getSession();
        if (!sess) return;
        const s = sess.solves.find(x => x.id === solveId);
        if (!s) return;
        s.penalty = penalty;
        saveState(50);
        renderSolveList();
        renderStatsPanel();
    }

    async function manualEntrySubmit() {
        const input = $('#cs-manual-input');
        if (!input) return;
        const raw = input.value.trim();
        if (!raw) return;
        // Accept formats: "1234" = 12.34s, "1.23", "12:34.5"
        let ms = null;
        if (raw.includes(':')) {
            const parts = raw.split(':');
            const m = parseInt(parts[0], 10) || 0;
            const s = parseFloat(parts[1]) || 0;
            ms = m * 60000 + Math.round(s * 1000);
        } else if (raw.includes('.')) {
            const s = parseFloat(raw);
            ms = Math.round(s * 1000);
        } else {
            // Treat as raw centiseconds input like csTimer manual: "1234" -> 12.34
            const v = parseInt(raw, 10);
            ms = Math.round(v * 10); // treating as centiseconds -> 100ms increments
            // Actually interpret as X[Y.Z] style — see below fallback
            // If 4+ digits, treat last 2 as decimal
            ms = null;
            if (raw.length >= 4) {
                // 4+ digits: SS.CC (e.g. "1234" = 12.34s)
                const whole = raw.slice(0, -2);
                const cents = raw.slice(-2);
                ms = parseInt(whole, 10) * 1000 + parseInt(cents, 10) * 10;
            } else if (raw.length === 3) {
                // 3 digits: X.YY (e.g. "455" = 4.55s, "123" = 1.23s)
                const whole = raw.slice(0, 1);
                const cents = raw.slice(1);
                ms = parseInt(whole, 10) * 1000 + parseInt(cents, 10) * 10;
            } else {
                // 1-2 digits: whole seconds (e.g. "4" = 4.00s, "45" = 45.00s)
                ms = parseInt(raw, 10) * 1000;
            }
        }
        if (!ms || ms <= 0) {
            input.value = '';
            input.placeholder = 'Invalid';
            return;
        }
        const sess = getSession();
        if (!sess) return;
        sess.solves.push({
            id: uid(),
            time: ms,
            scramble: TSTATE.currentScramble,
            event: sess.event,
            penalty: '',
            timestamp: Date.now(),
        });
        input.value = '';
        rollScramble(sess.event);
        saveState(50);
        renderAll();
    }

    // ========== RENDERING ==========
    function renderAll() {
        // Settings first: renderSessionTabs() announces the session list to
        // the mobile top bar, which mirrors these controls. Announcing before
        // they hold the current session's event published a stale one.
        renderSettings();
        renderSessionTabs();
        renderHeaderStats();
        renderSolveList();
        renderStatsPanel();
        renderScramble();
        renderTwisty();
        // The idle badge ships as static English in the markup; render it so
        // the first paint is in the chosen language, not just after a solve.
        renderPhaseBadge();
    }

    function renderSessionTabs() {
        // Runs on every renderAll(), so it covers create / switch / rename /
        // delete for anything mirroring the session list (the mobile picker).
        document.dispatchEvent(new CustomEvent('cs-sessions-changed'));
        const wrap = $('#cs-session-tabs');
        if (!wrap) return;
        wrap.innerHTML = '';
        TSTATE.sessionOrder.forEach((sid, idx) => {
            const sess = TSTATE.sessions[sid];
            const btn = document.createElement('button');
            btn.className = 'cs-session-tab' + (sid === TSTATE.activeSession ? ' active' : '');
            btn.dataset.sessionId = sid;
            btn.title = `${sess.name} — ${EVENT_INFO[sess.event]?.name || sess.event}`;
            btn.innerHTML = `
                <span class="cs-session-tab-num">${idx + 1}</span>
                <span class="cs-session-tab-name"></span>
            `;
            // Use textContent for user-controlled session name (avoid XSS from imported JSON)
            btn.querySelector('.cs-session-tab-name').textContent = sess.name;
            btn.addEventListener('click', (e) => {
                if (e.target.classList.contains('cs-session-tab-close')) return;
                switchSession(sid);
            });
            // Long press / right-click to delete
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (TSTATE.sessionOrder.length <= 1) {
                    alert(T('alert.lastSession', 'Cannot delete the only session.'));
                    return;
                }
                if (confirm(T('confirm.deleteSession', 'Delete session "{name}"? This will remove all its solves.').replace('{name}', sess.name)) && (e.target.classList.contains('cs-session-tab-close') || true)) {
                    deleteSession(sid);
                }
            });
            // Close (X) button appears on hover
            const close = document.createElement('span');
            close.className = 'cs-session-tab-close';
            close.textContent = '×';
            close.title = T('timer.deleteSession', 'Delete');
            close.addEventListener('click', (e) => {
                e.stopPropagation();
                if (TSTATE.sessionOrder.length <= 1) {
                    alert(T('alert.lastSession', 'Cannot delete the only session.'));
                    return;
                }
                if (confirm(T('confirm.deleteSession', 'Delete session "{name}"? This will remove all its solves.').replace('{name}', sess.name))) {
                    deleteSession(sid);
                }
            });
            btn.appendChild(close);
            wrap.appendChild(btn);
        });
        // Add (+) button
        const add = document.createElement('button');
        add.className = 'cs-session-tab-add';
        add.textContent = '+';
        add.title = T('timer.newSession', 'New session');
        add.addEventListener('click', async () => {
            const name = prompt(T('prompt.sessionName', 'Session name:'),
                T('timer.sessionN', 'Session {n}').replace('{n}', TSTATE.sessionOrder.length + 1));
            if (name && name.trim()) {
                const sess = getSession();
                await newSession(name.trim(), sess ? sess.event : DEFAULT_EVENT);
                renderAll();
            }
        });
        wrap.appendChild(add);
    }

    function renderHeaderStats() {
        const sess = getSession();
        const titleEl = $('#cs-session-title');
        if (titleEl) {
            titleEl.textContent = sess ? sess.name : '—';
        }
        const eventEl = $('#cs-event-label');
        if (eventEl) {
            const info = sess ? EVENT_INFO[sess.event] : null;
            eventEl.textContent = info ? info.name : (sess ? sess.event : '');
        }
        const nameEl = $('#cs-event-naming');
        if (nameEl) {
            const info = sess ? EVENT_INFO[sess.event] : null;
            nameEl.textContent = (info && info.format === 'mo3')
                ? T('timer.meanOf3', 'Mean of 3')
                : T('timer.avgOf5', 'Average of 5');
        }
    }

    function renderScramble() {
        const disp = $('#cs-scramble-text');
        if (!disp) return;
        disp.textContent = TSTATE.currentScramble || T('timer.generating', 'Generating scramble…');
        // With a smart cube connected, the module re-renders the scramble
        // as per-move tokens so progress can be highlighted.
        if (window.SmartCube && window.SmartCube.decorateScramble) window.SmartCube.decorateScramble();
    }

    function renderTwisty() {
        const sess = getSession();
        const twisty = $('#cs-twisty');
        const sq1Diagram = $('#cs-sq1-diagram');
        if (!twisty || !sess) return;
        const info = EVENT_INFO[sess.event];
        const puzzle = info?.puzzle || '3x3x3';

        // Square-1: csTimer-style flat diagram instead of the 3D player.
        if (sess.event === 'sq1' && sq1Diagram && window.Square1Drawer) {
            twisty.style.display = 'none';
            sq1Diagram.style.display = '';
            window.Square1Drawer.render(sq1Diagram, TSTATE.currentScramble || '');
            return;
        }
        if (sq1Diagram) sq1Diagram.style.display = 'none';
        twisty.style.display = '';

        const engine = window.ScrambleEngine;
        const alg = engine ? engine.normalizeAlgFor(puzzle, TSTATE.currentScramble || '') : (TSTATE.currentScramble || '');
        twisty.setAttribute('puzzle', puzzle);
        if (engine) engine.applyViz(twisty, puzzle);
        twisty.setAttribute('alg', alg);
    }

    function renderPhaseBadge(badgeText) {
        const el = $('#cs-status-text');
        if (!el) return;
        const phases = {
            idle: badgeText || T('timer.phase.idle', 'Hold Space / Tap'),
            inspecting: T('timer.phase.inspecting', 'Inspecting'),
            holding: T('timer.phase.holding', 'Hold to ready'),
            ready: T('timer.phase.ready', 'READY'),
            running: T('timer.phase.running', 'Solve!'),
            stopped: T('timer.phase.stopped', 'Stopped'),
            inspection_dnf: T('timer.phase.dnf', 'DNF (+2)'),
        };
        el.textContent = phases[TSTATE.phase] || TSTATE.phase;
        el.className = 'cs-status-text cs-phase-' + TSTATE.phase;
    }

    function renderSolveList() {
        const sess = getSession();
        const list = $('#cs-solve-list');
        if (!list || !sess) return;
        const visible = TSTATE.settings.showAllSolves > 0
            ? sess.solves.slice(-TSTATE.settings.showAllSolves)
            : sess.solves;

        if (visible.length === 0) {
            list.innerHTML = `<div class="cs-empty">${esc(T('timer.noSolves', 'No solves yet — press space to start!'))}</div>`;
            return;
        }

        const bestSingle = getBestSingle(sess.solves);
        const worstSingle = getWorstSingle(sess.solves);

        // Per-solve status: PB, session best, worst
        list.innerHTML = '';

        // Reverse for top-down display (newest first). Build rows defensively
        // (using textContent for user data) to avoid XSS from imported JSON.
        const reversed = [...visible].reverse();
        for (const solve of reversed) {
            const div = document.createElement('div');
            const ms = effectiveMs(solve);
            const classes = ['cs-solve'];
            if (ms === Infinity) classes.push('cs-solve-dnf');
            if (ms !== Infinity && ms === bestSingle) classes.push('cs-solve-best');
            if (ms !== Infinity && ms === worstSingle && sess.solves.length > 1) classes.push('cs-solve-worst');
            div.className = classes.join(' ');
            div.dataset.solveId = solve.id;

            const num = sess.solves.length - sess.solves.indexOf(solve);
            const scramble = solve.scramble || '';

            const del = document.createElement('button');
            del.className = 'cs-solve-del';
            del.title = 'Delete';
            del.textContent = '×';
            div.appendChild(del);

            const numEl = document.createElement('span');
            numEl.className = 'cs-solve-num';
            numEl.textContent = String(num);
            div.appendChild(numEl);

            const timeEl = document.createElement('span');
            timeEl.className = 'cs-solve-time';
            timeEl.dataset.solveId = solve.id;
            timeEl.title = T('title.editTime', 'Click to edit time (centiseconds)');
            timeEl.textContent = fmt(ms);
            div.appendChild(timeEl);

            const penEl = document.createElement('span');
            penEl.className = 'cs-solve-pen';
            penEl.dataset.solveId = solve.id;
            penEl.dataset.pen = solve.penalty || 'OK';
            penEl.title = T('title.changePenalty', 'Click to change penalty');
            penEl.textContent = solve.penalty || 'OK';
            div.appendChild(penEl);

            const scrambEl = document.createElement('span');
            scrambEl.className = 'cs-solve-scramb';
            scrambEl.title = scramble;
            scrambEl.textContent = trimScramble(scramble);
            div.appendChild(scrambEl);

            list.appendChild(div);
        }

        // Bind events on the rendered rows using delegation
        if (!list._csSolveListBound) {
            list.addEventListener('click', (e) => {
                const target = e.target;
                if (target.classList.contains('cs-solve-del') || target.closest('.cs-solve-del')) {
                    e.stopPropagation();
                    const row = target.closest('.cs-solve');
                    if (row) deleteSolveById(row.dataset.solveId);
                    return;
                }
                const timeEl = target.closest('.cs-solve-time');
                if (timeEl) {
                    e.stopPropagation();
                    const sid = timeEl.dataset.solveId;
                    const cur = getSession()?.solves.find(x => x.id === sid);
                    if (!cur) return;
                    const ans = prompt(`Edit time for solve (centiseconds):`, Math.round(cur.time / 10));
                    if (ans !== null) {
                        const v = parseInt(ans, 10);
                        if (!isNaN(v) && v > 0) setSolveTime(sid, v * 10);
                    }
                    return;
                }
                const penEl = target.closest('.cs-solve-pen');
                if (penEl) {
                    e.stopPropagation();
                    const sid = penEl.dataset.solveId;
                    const cur = getSession()?.solves.find(x => x.id === sid);
                    if (!cur) return;
                    // Cycle: OK -> +2 -> DNF -> OK
                    const cycle = { '': '+2', '+2': 'DNF', 'DNF': '' };
                    setSolvePenalty(sid, cycle[cur.penalty || ''] || '');
                }
            });
            list._csSolveListBound = true;
        }
    }

    // The four headline averages the mobile layout shows. Kept here so the
    // numbers have exactly one source, whichever layout is on screen.
    let _headlineStats = { ao5: null, ao12: null, ao100: null, mean: null };
    function publishHeadlineStats(stats) {
        _headlineStats = stats;
        document.dispatchEvent(new CustomEvent('cs-stats-updated', { detail: stats }));
    }

    function renderStatsPanel() {
        const sess = getSession();
        const statsEl = $('#cs-stats-summary');
        if (!statsEl || !sess) return;
        const solves = sess.solves;
        const info = EVENT_INFO[sess.event];
        // Mo3 events (6x6, 7x7, FMC, BLD...) use plain average of 3,
        // not the Ao5-style "drop best & worst".
        const isMo3 = info && info.format === 'mo3';

        const count = getTotalSolves(solves);
        const mean = getMean(solves);
        const best = getBestSingle(solves);
        const bestAo5 = getBestAverage(solves, 5, isMo3);
        const bestAo12 = getBestAverage(solves, 12, isMo3);
        const bestAo100 = getBestAverage(solves, 100, isMo3);
        const curAo5 = getAverage(solves, 5, isMo3);
        const curAo12 = getAverage(solves, 12, isMo3);
        const curAo100 = getAverage(solves, 100, isMo3);
        const stdDev = getStdDev(solves);
        const success = getSuccessRate(solves);

        const avgLabel = info?.format === 'mo3' ? 'Mean-3' : 'Ao5';
        const sessionName = sess.name;

        publishHeadlineStats({
            ao5: curAo5 === null ? null : fmtMean(curAo5),
            ao12: curAo12 === null ? null : fmtMean(curAo12),
            ao100: curAo100 === null ? null : fmtMean(curAo100),
            mean: mean === null ? null : fmt(mean),
        });

        const L = {
            count: T('stats.count', 'Solve count'),
            best: T('stats.best', 'Best single'),
            mean: T('stats.mean', 'Mean'),
            std: T('stats.std', 'Std dev'),
            bestPfx: T('stats.bestPrefix', 'Best'),
            currPfx: T('stats.currPrefix', 'Curr'),
            success: T('stats.success', 'Success'),
        };
        statsEl.innerHTML = `
            <div class="cs-statline">
                <span class="cs-label">${L.count}</span>
                <strong class="cs-val">${count}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.best}</span>
                <strong class="cs-val ${best === null ? 'cs-empty' : ''}">${best === null ? '—' : fmt(best)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.mean}</span>
                <strong class="cs-val ${mean === null ? 'cs-empty' : ''}">${mean === null ? '—' : fmt(mean)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.std}</span>
                <strong class="cs-val ${stdDev === null ? 'cs-empty' : ''}">${stdDev === null ? '—' : fmt(stdDev)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.bestPfx} ${avgLabel}</span>
                <strong class="cs-val ${bestAo5 === null ? 'cs-empty' : ''}">${bestAo5 === null ? '—' : fmtMean(bestAo5)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.currPfx} ${avgLabel}</span>
                <strong class="cs-val ${curAo5 === null ? 'cs-empty' : ''}">${curAo5 === null ? '—' : fmtMean(curAo5)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.bestPfx} Ao12</span>
                <strong class="cs-val ${bestAo12 === null ? 'cs-empty' : ''}">${bestAo12 === null ? '—' : fmtMean(bestAo12)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.currPfx} Ao12</span>
                <strong class="cs-val ${curAo12 === null ? 'cs-empty' : ''}">${curAo12 === null ? '—' : fmtMean(curAo12)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.bestPfx} Ao100</span>
                <strong class="cs-val ${bestAo100 === null ? 'cs-empty' : ''}">${bestAo100 === null ? '—' : fmtMean(bestAo100)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">${L.success}</span>
                <strong class="cs-val ${success === null ? 'cs-empty' : ''}">${success === null ? '—' : (success * 100).toFixed(1) + '%'}</strong>
            </div>
        `;
    }

    function renderSettings() {
        // Sync DOM input states to current settings
        const s = TSTATE.settings;
        if ($('#cs-setting-hold-delay')) $('#cs-setting-hold-delay').value = s.spacebarHold;
        if ($('#cs-setting-inspection')) $('#cs-setting-inspection').value = s.inspection;
        if ($('#cs-setting-voice')) $('#cs-setting-voice').value = s.voiceCues;
        if ($('#cs-setting-hide-time')) $('#cs-setting-hide-time').checked = s.hideTimeDuring;
        if ($('#cs-setting-hide-scramble')) $('#cs-setting-hide-scramble').checked = s.hideScrambleDuring;
        if ($('#cs-setting-manual-mode')) $('#cs-setting-manual-mode').checked = s.useManualEntry;
        if ($('#cs-setting-show-last')) $('#cs-setting-show-last').value = s.showAllSolves;
        if ($('#cs-setting-event')) {
            const sess = getSession();
            if (sess) $('#cs-setting-event').value = sess.event;
        }
    }

    let _settingsBound = false;
    function bindSettingsEvents() {
        if (_settingsBound) return;
        _settingsBound = true;
        const on = (id, evt, fn) => { const el = $('#' + id); if (el) el.addEventListener(evt, fn); };
        on('cs-setting-hold-delay', 'change', e => {
            TSTATE.settings.spacebarHold = parseInt(e.target.value, 10) || 0;
            saveState();
        });
        on('cs-setting-inspection', 'change', e => {
            TSTATE.settings.inspection = e.target.value;
            saveState();
        });
        on('cs-setting-voice', 'change', e => {
            TSTATE.settings.voiceCues = e.target.value;
            saveState();
        });
        on('cs-setting-hide-time', 'change', e => {
            TSTATE.settings.hideTimeDuring = e.target.checked;
            applyOverlayStates();
            saveState();
        });
        on('cs-setting-hide-scramble', 'change', e => {
            TSTATE.settings.hideScrambleDuring = e.target.checked;
            applyOverlayStates();
            saveState();
        });
        on('cs-setting-manual-mode', 'change', e => {
            TSTATE.settings.useManualEntry = e.target.checked;
            toggleManualMode();
            saveState();
        });
        on('cs-setting-show-last', 'change', e => {
            TSTATE.settings.showAllSolves = parseInt(e.target.value, 10);
            saveState();
            renderSolveList();
        });
        on('cs-setting-event', 'change', e => {
            const sess = getSession();
            if (!sess) return;
            sess.event = e.target.value;
            rollScramble(sess.event);
            saveState();
            renderAll();
        });

        // Action buttons
        on('cs-btn-new-scramble', 'click', () => {
            const sess = getSession();
            if (!sess) return;
            rollScramble(sess.event);
            saveState();
        });
        on('cs-btn-clear-session', 'click', () => clearCurrentSession());
        on('cs-btn-clear-session-2', 'click', () => clearCurrentSession());
        on('cs-btn-delete-last', 'click', () => deleteLastSolve());
        on('cs-btn-export', 'click', exportJSON);
        on('cs-btn-import', 'click', () => {
            const input = $('#cs-import-file');
            if (input) input.click();
        });
        on('cs-import-file', 'change', importJSON);
        on('cs-btn-rename-session', 'click', () => {
            const sess = getSession();
            if (!sess) return;
            const n = prompt(T('prompt.renameSession', 'Rename session:'), sess.name);
            if (n && n.trim()) renameSession(TSTATE.activeSession, n.trim());
        });
        on('cs-btn-fullscreen', 'click', () => {
            const tv = $('#timer-view');
            if (!tv) return;
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                tv.requestFullscreen?.();
            }
        });
        // Manual entry submit
        on('cs-manual-submit', 'click', manualEntrySubmit);
        on('cs-manual-input', 'keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); manualEntrySubmit(); }
            if (e.key === 'Escape') { e.target.value = ''; }
        });
    }

    function toggleManualMode() {
        const m = $('#cs-manual-entry');
        const k = $('#cs-timer-display-area');
        if (m) m.style.display = TSTATE.settings.useManualEntry ? 'flex' : 'none';
        if (k) k.style.display = TSTATE.settings.useManualEntry ? 'none' : 'flex';
    }

    function applyOverlayStates() {
        const tv = $('#timer-view');
        if (!tv) return;
        if (TSTATE.settings.hideTimeDuring) tv.classList.add('cs-hide-time'); else tv.classList.remove('cs-hide-time');
        if (TSTATE.settings.hideScrambleDuring) tv.classList.add('cs-hide-scramble'); else tv.classList.remove('cs-hide-scramble');
    }

    // ========== EXPORT / IMPORT ==========
    function exportJSON() {
        const dataStr = JSON.stringify({
            sessions: TSTATE.sessions,
            sessionOrder: TSTATE.sessionOrder,
            settings: TSTATE.settings,
            activeSession: TSTATE.activeSession,
            exportedAt: nowIso(),
            app: 'CubingHQ/csTimer-Clone v1'
        }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cstimer-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportCSV() {
        const sess = getSession();
        if (!sess) return;
        const rows = [['Index', 'Time(ms)', 'Time(s)', 'Penalty', 'Scramble', 'Date']];
        sess.solves.forEach((s, i) => {
            rows.push([
                String(i + 1),
                String(s.time),
                (s.time / 1000).toFixed(3),
                s.penalty || 'OK',
                s.scramble || '',
                new Date(s.timestamp).toISOString()
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cstimer-${sess.name}-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function importJSON(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const data = JSON.parse(reader.result);
                if (data.sessions) {
                    if (confirm(T('confirm.replaceData', 'Replace all current data with imported data?'))) {
                        TSTATE.sessions = data.sessions;
                        TSTATE.sessionOrder = data.sessionOrder || Object.keys(data.sessions);
                        TSTATE.activeSession = data.activeSession || TSTATE.sessionOrder[0];
                        if (data.settings) Object.assign(TSTATE.settings, data.settings);
                        saveState();
                        rollScramble(TSTATE.sessions[TSTATE.activeSession].event);
                        renderAll();
                        alert(T('alert.importOk', 'Import successful!'));
                    }
                } else {
                    alert(T('alert.importBad', 'Invalid file: missing sessions data.'));
                }
            } catch (err) {
                alert(T('alert.importParse', 'Failed to parse JSON:') + ' ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ========== PUBLIC API / INIT ==========
    async function init() {
        if (TSTATE.loaded) {
            // Already inited — just ensure state is current
            rollScramble(getSession()?.event || DEFAULT_EVENT);
            renderAll();
            applyOverlayStates();
            toggleManualMode();
            return;
        }
        TSTATE.loaded = true;
        if (!loadState() || TSTATE.sessionOrder.length === 0) {
            // First time — create default session
            await newSession(T('timer.sessionN', 'Session {n}').replace('{n}', 1), DEFAULT_EVENT);
        } else {
            const sess = getSession();
            rollScramble(sess ? sess.event : DEFAULT_EVENT);
        }
        bindEvents();
        bindSettingsEvents();
        renderAll();
        applyOverlayStates();
        toggleManualMode();
    }

    async function onEnter() {
        // Called every time user navigates to timer view
        rollScramble(getSession()?.event || DEFAULT_EVENT);
        renderAll();
        applyOverlayStates();
        toggleManualMode();
        // Re-attach listeners in case views changed
        bindEvents();
    }

    function onExit() {
        resetPhaseToIdle();
        const display = $('#timer-display-text');
        if (display) {
            display.classList.remove('cs-holding', 'cs-ready', 'cs-running');
            display.textContent = '0.00';
        }
    }

    // Re-render translated UI when the language changes.
    document.addEventListener('app-language-changed', () => {
        if (!TSTATE.loaded) return;
        renderAll();
        renderPhaseBadge();
    });

    // ---------- Smart cube hooks (used by smartcube.js) ----------
    // Start the timer directly (no hold/inspection) — first move of a
    // physical solve. No-op unless the timer is idle.
    function smartStart() {
        if (TSTATE.phase !== 'idle') return false;
        hideSolveActions();
        exitAnyPhase();
        startRunning();
        return true;
    }

    // Stop the timer — the physical cube reached the solved state.
    function smartStop() {
        if (TSTATE.phase !== 'running') return false;
        stopTimer();
        return true;
    }

    // Expose to global scope
    window.TimerModule = {
        init,
        onEnter,
        onExit,
        state: TSTATE,
        EVENT_INFO,
        // Helper functions for callers/testers
        fmt,
        newSession,
        switchSession,
        deleteSession,
        exportJSON,
        exportCSV,
        getHeadlineStats: () => _headlineStats,
        // Smart cube integration
        smartStart,
        smartStop,
        getPhase: () => TSTATE.phase,
        getCurrentScramble: () => TSTATE.currentScramble,
        getCurrentEvent: () => getSession()?.event || DEFAULT_EVENT,
        // Used by the AI Coach bridge to read/attach a drill session.
        getSession,
        getSessionById: (id) => TSTATE.sessions[id] || null,
        saveState,
    };
})();
