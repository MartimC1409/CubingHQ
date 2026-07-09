/* ============================================================
   SimulateCubing — csTimer-Compatible Timer Module
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

    // ========== SCRAMBLE GENERATION ==========
    // Returns an array of face tokens the scramble string can be built from.
    // For big cubes (random-state) we approximate by generating a long random
    // sequence with valid move rules. For full random-state we'd need a real
    // big-cube solver — we approximate with a long enough random sequence.
    function generateScramble(event) {
        const info = EVENT_INFO[event];
        if (!info) return generateStandardScramble('333');

        if (event === 'sq1') return generateSQ1();
        if (event === 'clock') return generateClock();
        if (event === 'pyram') return generatePyraminx();
        if (event === 'minx') return generateMinxScramble();

        if (info.useBigCube) return generateBigCube(info.length);
        return generateStandardScramble(event);
    }

    // WCA Pyraminx scrambles: 6–7 main moves on {U, R, L, B} with modifiers
    // ['', "'", '2'], then 0–4 tip moves (u, r, l, b) with ['', "'"] appended
    // at the end of the scramble. Tips never appear in the middle of the
    // main sequence, matching csTimer / WCA specification.
    function generatePyraminx() {
        const mainFaces = ['U', 'R', 'L', 'B'];
        const mainMods = ['', "'"];
        const tipFaces = ['u', 'r', 'l', 'b'];
        const tipMods = ['', "'"];
        const moves = [];
        let lastAxis = '';
        let secondLastAxis = '';
        // 6 or 7 main moves
        const mainCount = 6 + Math.floor(Math.random() * 2);
        for (let i = 0; i < mainCount; i++) {
            let face;
            do {
                face = mainFaces[Math.floor(Math.random() * mainFaces.length)];
            } while (
                face === lastAxis ||
                (face === secondLastAxis && isOppositeAxis(face, lastAxis))
            );
            const mod = mainMods[Math.floor(Math.random() * mainMods.length)];
            moves.push(face + mod);
            secondLastAxis = lastAxis;
            lastAxis = face;
        }
        // Tip moves (each tip has ~30% chance of being included, with a 50/50 ' modifier).
        // The first tip is additionally rejected if its face letter matches the last main face
        // (e.g. "U ... u" or "R ... r") to avoid same-letter "double" appearance.
        const lastMainFace = lastAxis;
        tipFaces.forEach(tip => {
            if (Math.random() < 0.3) {
                if (moves.length > mainCount && moves[moves.length - 1][0] === tip) return; // no same-letter tip in a row
                if (moves.length === mainCount && lastMainFace && lastMainFace.toLowerCase() === tip) return; // no same-letter main→tip at boundary
                const mod = tipMods[Math.floor(Math.random() * tipMods.length)];
                moves.push(tip + mod);
            }
        });
        return moves.join(' ');
    }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


    // WCA-spec Megaminx scrambles: 7 lines x 11 = 77 moves.
    // First 10 moves per line: alternating R/D with ++/--/empty/' (adjacent mods differ).
    // 11th move: U or U' (single turn ONLY). U alternates line-to-line.
    
    // WCA-style Megaminx scrambles: 7 lines x 11 = 77 moves.
    // Face pattern per line: R D R D R D R D R D U (alternating R/D, final U).
    // Modifiers: ++/-- alternating on R/D moves; U alternates between U/U' per line.
    // Output as a single space-separated line (twisty-player compatible).
    function generateMinxScramble() {
        const mods = ['++', '--'];
        const uMods = ['', "'"];
        const moves = [];
        let curMod = mods[Math.floor(Math.random() * mods.length)];
        let uMod = uMods[Math.floor(Math.random() * uMods.length)];
        for (let lineIdx = 0; lineIdx < 7; lineIdx++) {
            for (let j = 0; j < 10; j++) {
                const face = (j % 2 === 0) ? 'R' : 'D';
                moves.push(face + curMod);
                curMod = (curMod === '++') ? '--' : '++';
            }
            moves.push('U' + uMod);
            uMod = (uMod === '') ? "'" : '';
            curMod = (curMod === '++') ? '--' : '++';
        }
        return moves.join(' ');
    }


    function generateStandardScramble(event) {
        const info = EVENT_INFO[event];
        const faces = info.faces;
        const modifiers = info.modifiers || ['', "'", '2'];
        const length = info.length;
        const moves = [];
        let lastAxis = '';
        let secondLastAxis = '';
        for (let i = 0; i < length; i++) {
            let face;
            let axis;
            do {
                face = pick(faces);
                // Treat wide moves (Uw, Rw) as same axis as their base
                axis = face[0];
            } while (
                axis === lastAxis ||
                (axis === secondLastAxis && axis !== 'u' && axis !== 'r' && axis !== 'l' && axis !== 'b' && isOppositeAxis(axis, lastAxis))
            );
            const mod = pick(modifiers);
            moves.push(face + mod);
            secondLastAxis = lastAxis;
            lastAxis = axis;
        }
        return moves.join(' ');
    }

    function isOppositeAxis(a, b) {
        const opp = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
        return opp[a] === b;
    }

    function generateBigCube(length) {
        // Approx random-state: random mix of single and wide moves with proper anti-redundancy
        const moves = [];
        const facePool = [
            'U', 'D', 'R', 'L', 'F', 'B',
            'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', '3Uw', '3Rw', '3Fw'
        ];
        const modifiers = ['', "'", '2'];
        let lastAxis = '';
        let secondLastAxis = '';
        for (let i = 0; i < length; i++) {
            let face;
            let axis;
            do {
                face = pick(facePool);
                axis = face.replace(/^\d/, '')[0];
            } while (
                axis === lastAxis ||
                (axis === secondLastAxis && isOppositeAxis(axis, lastAxis))
            );
            moves.push(face + pick(modifiers));
            secondLastAxis = lastAxis;
            lastAxis = axis;
        }
        return moves.join(' ');
    }

    function generateSQ1() {
        const moves = [];
        for (let i = 0; i < 12; i++) {
            const top = Math.floor(Math.random() * 12) - 5;
            const bot = Math.floor(Math.random() * 12) - 5;
            moves.push(`(${top},${bot})`);
            if (i < 11) moves.push('/');
        }
        return moves.join(' ');
    }

    function generateClock() {
        const prePins  = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
        const postPins = ['U', 'R', 'D', 'L', 'ALL']; // after y2, corner pins don't exist
        const moves = [];
        prePins.forEach(pin => {
            const v = Math.floor(Math.random() * 12) - 5;
            moves.push(`${pin}${v >= 0 ? v + '+' : Math.abs(v) + '-'}`);
        });
        moves.push('y2');
        postPins.forEach(pin => {
            const v = Math.floor(Math.random() * 12) - 5;
            moves.push(`${pin}${v >= 0 ? v + '+' : Math.abs(v) + '-'}`);
        });
        return moves.join(' ');
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
                // Best-effort Firebase sync (background)
                syncToFirebase(data);
            } catch (e) { console.warn('Failed to save timer data', e); }
        }, debouncedMs);
    }

    async function syncToFirebase(data) {
        try {
            const uid = (window.getBattleUserId && window.getBattleUserId()) || localStorage.getItem('cstimer_uid') || 'guest_anonymous';
            localStorage.setItem('cstimer_uid', uid);
            await fetch(`https://simulatecubing-default-rtdb.firebaseio.com/timer_data/${uid}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) { /* offline ok */ }
    }

    // ========== SESSION HELPERS ==========
    function getSession() {
        return TSTATE.sessions[TSTATE.activeSession] || null;
    }

    function newSession(name = 'Session', event = DEFAULT_EVENT) {
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
        TSTATE.currentScramble = generateScramble(event);
        saveState();
        return session;
    }

    function switchSession(id) {
        if (!TSTATE.sessions[id]) return;
        TSTATE.activeSession = id;
        TSTATE.currentScramble = generateScramble(TSTATE.sessions[id].event);
        saveState();
        renderAll();
    }

    function deleteSession(id) {
        if (TSTATE.sessionOrder.length <= 1) return;
        delete TSTATE.sessions[id];
        TSTATE.sessionOrder = TSTATE.sessionOrder.filter(sid => sid !== id);
        if (TSTATE.activeSession === id) {
            TSTATE.activeSession = TSTATE.sessionOrder[0];
            TSTATE.currentScramble = generateScramble(TSTATE.sessions[TSTATE.activeSession].event);
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
    // Returns ms considered for the solve (null if DNF excluded).
    function effectiveMs(s) {
        if (!s) return null;
        if (s.penalty === 'DNF') return Infinity;
        const base = s.time;
        if (s.penalty === '+2') return base + 2000;
        return base;
    }

    function getBestSingle(solves) {
        let best = null;
        for (const s of solves) {
            const m = effectiveMs(s);
            if (m === null || m === Infinity) continue;
            if (best === null || m < best) best = m;
        }
        return best;
    }

    function getWorstSingle(solves) {
        let worst = null;
        for (const s of solves) {
            const m = effectiveMs(s);
            if (m === null || m === Infinity) continue;
            if (worst === null || m > worst) worst = m;
        }
        return worst;
    }

    function getMean(solves) {
        const filtered = solves.filter(s => s.penalty !== 'DNF');
        if (filtered.length === 0) return null;
        const sum = filtered.reduce((a, s) => a + s.time, 0);
        return sum / filtered.length;
    }

    function getAverage(solves, n, mo3 = false) {
        // n = 5 (Ao5), 12 (Ao12), 100 (Mo100) when mo3 = false.
        // When mo3 = true (WCA Mean-of-3 for 6x6 / 7x7 / FMC / etc.),
        // don't drop best & worst — average all 3.
        const end = solves.length;
        const start = Math.max(0, end - n);
        const window = solves.slice(start, end);
        if (window.length < n) return null;

        // Count DNFs
        let dnfCount = window.filter(s => s.penalty === 'DNF').length;
        if (mo3) {
            if (dnfCount >= 1) return Infinity;
        } else {
            if (n >= 5) {
                if (dnfCount >= 2) return Infinity;
            } else {
                if (dnfCount >= 1) return Infinity;
            }
        }

        // Convert times (with +2 penalty as +2s)
        const times = window.map(s => {
            if (s.penalty === 'DNF') return Infinity;
            return s.time + (s.penalty === '+2' ? 2000 : 0);
        });
        if (n === 1) return times[0];
        if (mo3) {
            const sum = times.reduce((a, b) => a + b, 0);
            return sum / times.length;
        }
        const sorted = [...times].sort((a, b) => a - b);
        // Drop best and worst
        const mid = sorted.slice(1, -1);
        const sum = mid.reduce((a, b) => a + b, 0);
        return sum / mid.length;
    }

    function getBestAverage(solves, n, mo3 = false) {
        let best = null;
        for (let i = n; i <= solves.length; i++) {
            const avg = getAverage(solves.slice(0, i), n, mo3);
            if (avg === null || avg === Infinity) continue;
            if (best === null || avg < best) best = avg;
        }
        return best;
    }

    function getStdDev(solves) {
        const filtered = solves.filter(s => s.penalty !== 'DNF');
        if (filtered.length < 2) return null;
        const mean = filtered.reduce((a, s) => a + s.time, 0) / filtered.length;
        const sq = filtered.reduce((a, s) => a + Math.pow(s.time - mean, 2), 0);
        return Math.sqrt(sq / (filtered.length - 1));
    }

    function getSuccessRate(solves) {
        if (solves.length === 0) return null;
        const success = solves.filter(s => s.penalty !== 'DNF').length;
        return success / solves.length;
    }

    function getTotalSolves(solves) {
        return solves.length;
    }

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

    function startInspection() {
        if (TSTATE.phase !== 'idle') return;
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
        const display = $('#timer-display-text');
        if (display) display.textContent = remaining > 0 ? remaining.toFixed(2) : '0.00';

        // Voice cues
        if (TSTATE.settings.voiceCues === 'on') {
            if (remaining <= 8 && remaining > 7 && !TSTATE.voiceSpokenAt[8]) {
                speak('8 seconds');
                TSTATE.voiceSpokenAt[8] = true;
            }
            if (remaining <= 12 && remaining > 11 && !TSTATE.voiceSpokenAt[12]) {
                speak('12 seconds');
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
        if (display) display.classList.add('cs-holding');

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
        const display = $('#timer-display-text');
        if (display) {
            display.classList.remove('cs-ready', 'cs-holding');
            display.classList.add('cs-running');
        }
        renderPhaseBadge();
        runningTick();
    }

    function runningTick() {
        const elapsed = performance.now() - TSTATE.timerStart;
        const display = $('#timer-display-text');
        if (display) display.textContent = fmt(elapsed);
        if (TSTATE.phase === 'running') {
            TSTATE.timerRaf = requestAnimationFrame(runningTick);
        }
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
            _lastStoppedSolveId = solve.id;
            if (typeof showStopOverlay === 'function') { showStopOverlay(elapsed); bindStopOverlayEvents(); }
            saveState(50);
            // Show finished display then move to last solve focus
            if (display) display.textContent = fmt(elapsed);

            // After short delay, roll next scramble and re-render list with focus on last solve
            setTimeout(() => {
                TSTATE.currentScramble = generateScramble(sess.event);
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
            display.classList.remove('cs-holding', 'cs-ready', 'cs-running');
            display.textContent = '0.00';
        }
        renderPhaseBadge();
    }

    function speak(text) {
        try {
            if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance(text);
                u.rate = 1.1;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            }
        } catch (e) { /* ignore */ }
    }

    function clearCurrentSession() {
        const sess = getSession();
        if (!sess || sess.solves.length === 0) return;
        if (confirm(`Clear all ${sess.solves.length} solves in "${sess.name}"?`)) {
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
            const wrap = $('.cs-timer-center');
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

        const wrap = $('.cs-timer-center');
        if (wrap && !wrap._csBtnBound) {
            wrap.addEventListener('mousedown', onPointerDown);
            wrap.addEventListener('touchstart', onPointerDown, { passive: false });
            wrap._csBtnBound = true;
        }
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
        // Don't capture clicks on actual buttons/inputs
        if (e.target.closest && e.target.closest('button')) return;
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

    function manualEntrySubmit() {
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
        TSTATE.currentScramble = generateScramble(sess.event);
        saveState(50);
        renderAll();
    }

    // ========== RENDERING ==========
    function renderAll() {
        renderSessionTabs();
        renderHeaderStats();
        renderSolveList();
        renderStatsPanel();
        renderScramble();
        renderTwisty();
        renderSettings();
    }

    function renderSessionTabs() {
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
                    alert('Cannot delete the only session.');
                    return;
                }
                if (confirm(`Delete session "${sess.name}"? This will remove all its solves.`) && (e.target.classList.contains('cs-session-tab-close') || true)) {
                    deleteSession(sid);
                }
            });
            // Close (X) button appears on hover
            const close = document.createElement('span');
            close.className = 'cs-session-tab-close';
            close.textContent = '×';
            close.title = 'Delete';
            close.addEventListener('click', (e) => {
                e.stopPropagation();
                if (TSTATE.sessionOrder.length <= 1) {
                    alert('Cannot delete the only session.');
                    return;
                }
                if (confirm(`Delete session "${sess.name}"? This will remove all its solves.`)) {
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
        add.title = 'New session';
        add.addEventListener('click', () => {
            const name = prompt('Session name:', `Session ${TSTATE.sessionOrder.length + 1}`);
            if (name && name.trim()) {
                const sess = getSession();
                newSession(name.trim(), sess ? sess.event : DEFAULT_EVENT);
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
            nameEl.textContent = (info && info.format === 'mo3') ? 'Mean of 3' : 'Average of 5';
        }
    }

    function renderScramble() {
        const disp = $('#cs-scramble-text');
        if (disp) disp.textContent = TSTATE.currentScramble || '...';
    }

    function renderTwisty() {
        const sess = getSession();
        const twisty = $('#cs-twisty');
        if (!twisty || !sess) return;
        const info = EVENT_INFO[sess.event];
        const puzzle = info?.puzzle || '3x3x3';
        twisty.setAttribute('puzzle', puzzle);
        twisty.setAttribute('alg', TSTATE.currentScramble || '');
    }

    function renderPhaseBadge(badgeText) {
        const el = $('#cs-status-text');
        if (!el) return;
        const phases = {
            idle: badgeText || 'Hold Space / Tap',
            inspecting: 'Inspecting',
            holding: 'Hold to ready',
            ready: 'READY',
            running: 'Solve!',
            stopped: 'Stopped',
            inspection_dnf: 'DNF (+2)',
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
            list.innerHTML = '<div class="cs-empty">No solves yet — press space to start!</div>';
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
            timeEl.title = 'Click to edit time (centiseconds)';
            timeEl.textContent = fmt(ms);
            div.appendChild(timeEl);

            const penEl = document.createElement('span');
            penEl.className = 'cs-solve-pen';
            penEl.dataset.solveId = solve.id;
            penEl.dataset.pen = solve.penalty || 'OK';
            penEl.title = 'Click to change penalty';
            penEl.textContent = solve.penalty || 'OK';
            div.appendChild(penEl);

            const scrambEl = document.createElement('span');
            scrambEl.className = 'cs-solve-scramb';
            scrambEl.title = scramble;
            scrambEl.textContent = trimScramble(scramble);
            div.appendChild(scrambEl);

            list.appendChild(div);
        }

        // Bind events on the rendered rows
        list.querySelectorAll('.cs-solve-del').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = b.closest('.cs-solve');
                if (row) deleteSolveById(row.dataset.solveId);
            });
        });
        list.querySelectorAll('.cs-solve-time').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const sid = b.dataset.solveId;
                const cur = sess.solves.find(x => x.id === sid);
                if (!cur) return;
                const ans = prompt(`Edit time for solve (centiseconds):`, Math.round(cur.time / 10));
                if (ans !== null) {
                    const v = parseInt(ans, 10);
                    if (!isNaN(v) && v > 0) setSolveTime(sid, v * 10);
                }
            });
        });
        list.querySelectorAll('.cs-solve-pen').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const sid = b.dataset.solveId;
                const cur = sess.solves.find(x => x.id === sid);
                if (!cur) return;
                // Cycle: OK -> +2 -> DNF -> OK
                const cycle = { '': '+2', '+2': 'DNF', 'DNF': '' };
                setSolvePenalty(sid, cycle[cur.penalty || ''] || '');
            });
        });
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
        const stdDev = getStdDev(solves);
        const success = getSuccessRate(solves);

        const avgLabel = info?.format === 'mo3' ? 'Mean-3' : 'Ao5';
        const sessionName = sess.name;

        statsEl.innerHTML = `
            <div class="cs-statline">
                <span class="cs-label">Solve count</span>
                <strong class="cs-val">${count}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Best single</span>
                <strong class="cs-val ${best === null ? 'cs-empty' : ''}">${best === null ? '—' : fmt(best)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Mean</span>
                <strong class="cs-val ${mean === null ? 'cs-empty' : ''}">${mean === null ? '—' : fmt(mean)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Std dev</span>
                <strong class="cs-val ${stdDev === null ? 'cs-empty' : ''}">${stdDev === null ? '—' : fmt(stdDev)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Best ${avgLabel}</span>
                <strong class="cs-val ${bestAo5 === null ? 'cs-empty' : ''}">${bestAo5 === null ? '—' : fmtMean(bestAo5)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Curr ${avgLabel}</span>
                <strong class="cs-val ${curAo5 === null ? 'cs-empty' : ''}">${curAo5 === null ? '—' : fmtMean(curAo5)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Best Ao12</span>
                <strong class="cs-val ${bestAo12 === null ? 'cs-empty' : ''}">${bestAo12 === null ? '—' : fmtMean(bestAo12)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Curr Ao12</span>
                <strong class="cs-val ${curAo12 === null ? 'cs-empty' : ''}">${curAo12 === null ? '—' : fmtMean(curAo12)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Best Ao100</span>
                <strong class="cs-val ${bestAo100 === null ? 'cs-empty' : ''}">${bestAo100 === null ? '—' : fmtMean(bestAo100)}</strong>
            </div>
            <div class="cs-statline">
                <span class="cs-label">Success</span>
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
            TSTATE.currentScramble = generateScramble(sess.event);
            saveState();
            renderAll();
        });

        // Action buttons
        on('cs-btn-new-scramble', 'click', () => {
            const sess = getSession();
            if (!sess) return;
            TSTATE.currentScramble = generateScramble(sess.event);
            saveState();
            renderScramble();
            renderTwisty();
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
            const n = prompt('Rename session:', sess.name);
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
            app: 'SimulateCubing/csTimer-Clone v1'
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

    function importJSON(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (data.sessions) {
                    if (confirm('Replace all current data with imported data?')) {
                        TSTATE.sessions = data.sessions;
                        TSTATE.sessionOrder = data.sessionOrder || Object.keys(data.sessions);
                        TSTATE.activeSession = data.activeSession || TSTATE.sessionOrder[0];
                        if (data.settings) Object.assign(TSTATE.settings, data.settings);
                        saveState();
                        TSTATE.currentScramble = generateScramble(TSTATE.sessions[TSTATE.activeSession].event);
                        renderAll();
                        alert('Import successful!');
                    }
                } else {
                    alert('Invalid file: missing sessions data.');
                }
            } catch (err) {
                alert('Failed to parse JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ========== PUBLIC API / INIT ==========
    function init() {
        if (TSTATE.loaded) {
            // Already inited — just ensure state is current
            TSTATE.currentScramble = generateScramble(getSession()?.event || DEFAULT_EVENT);
            renderAll();
            applyOverlayStates();
            toggleManualMode();
            return;
        }
        TSTATE.loaded = true;
        if (!loadState() || TSTATE.sessionOrder.length === 0) {
            // First time — create default session
            const s = newSession('Session 1', DEFAULT_EVENT);
        } else {
            const sess = getSession();
            TSTATE.currentScramble = sess ? generateScramble(sess.event) : generateScramble(DEFAULT_EVENT);
        }
        bindEvents();
        bindSettingsEvents();
        renderAll();
        applyOverlayStates();
        toggleManualMode();
    }

    function onEnter() {
        // Called every time user navigates to timer view
        TSTATE.currentScramble = generateScramble(getSession()?.event || DEFAULT_EVENT);
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
    };
})();
