/* ============================================================
   CubingHQ — Shared Scramble Engine
   ------------------------------------------------------------
   Single source of truth for scramble generation and puzzle ids.

   - Primary: official WCA random-state scrambles from the
     `cubing/scramble` program (cubing.js) — the browser build of
     the WCA scramble ecosystem, producing TNoodle-grade
     random-state scrambles for every WCA event (this is the same
     program that powers scramble.cubing.net). TNoodle itself is a
     JVM application and cannot run inside a browser; this is the
     official web equivalent.
   - Fallback: local random-move generators, used ONLY when the
     scramble program cannot be loaded at all (fully offline).

   Exposed as window.ScrambleEngine:
     .get(eventId)      -> Promise<string>  (scramble text)
     .puzzleId(eventId) -> string           (twisty-player `puzzle` attribute)
     .wcaEventId(id)    -> string           (normalized WCA event id)
     .prewarm(eventId)  -> void             (warm up the scramble worker)
   ============================================================ */
(function () {
    'use strict';

    // Normalize the various event-id vocabularies used across the app
    // (timer: '333', battle: '3x3', alg db: '3x3') to WCA event ids.
    const ALIASES = {
        '333': '333', '3x3': '333', '3x3x3': '333',
        '222': '222', '2x2': '222', '2x2x2': '222',
        '444': '444', '4x4': '444', '4x4x4': '444',
        '555': '555', '5x5': '555', '5x5x5': '555',
        '666': '666', '6x6': '666', '6x6x6': '666',
        '777': '777', '7x7': '777', '7x7x7': '777',
        '333oh': '333oh', 'oh': '333oh',
        '333bf': '333bf', '333fm': '333fm',
        'pyram': 'pyram', 'pyra': 'pyram', 'pyraminx': 'pyram',
        'minx': 'minx', 'mega': 'minx', 'megaminx': 'minx',
        'sq1': 'sq1', 'square-1': 'sq1', 'square1': 'sq1',
        'clock': 'clock',
        'skewb': 'skewb',
    };

    // twisty-player puzzle ids (https://js.cubing.net/cubing/twisty/)
    const PUZZLES = {
        '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3',
        '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
        '666': '6x6x6', '777': '7x7x7',
        'pyram': 'pyraminx', 'minx': 'megaminx', 'sq1': 'square1',
        'clock': 'clock', 'skewb': 'skewb',
    };

    function wcaEventId(id) {
        return ALIASES[String(id || '').toLowerCase()] || ALIASES[id] || '333';
    }

    function puzzleId(id) {
        return PUZZLES[wcaEventId(id)] || '3x3x3';
    }

    // twisty-player ignores visualization="2D" for Square-1 in practice
    // (falls back to 3D), so it must use 3D. Every other puzzle on the
    // site uses the flat 2D net.
    function vizFor(twistyPuzzleId) {
        return twistyPuzzleId === 'square1' ? '3D' : '2D';
    }

    // Apply the right visualization to a twisty-player element.
    // For Square-1 (3D) also enable the back view so the bottom layer
    // is visible — essential for reading scrambles/cases.
    function applyViz(el, twistyPuzzleId) {
        if (!el) return;
        const viz = vizFor(twistyPuzzleId);
        el.setAttribute('visualization', viz);
        if (viz === '3D') {
            el.setAttribute('back-view', 'top-right');
        } else {
            el.removeAttribute('back-view');
        }
    }

    // Normalize an alg string for twisty-player parsing.
    // Square-1: ensure canonical "(a, b)" tuple spacing and detach
    // slashes from tuples (we display csTimer's compact "(a,b)/ ..."
    // notation, which twisty's parser does not accept as-is).
    function normalizeAlgFor(twistyPuzzleId, alg) {
        if (!alg) return '';
        if (twistyPuzzleId === 'square1') {
            return alg
                .replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, '($1, $2)')
                .replace(/\)\s*\//g, ') /')
                .replace(/\/\s*\(/g, '/ (');
        }
        return alg;
    }

    // Reformat a Square-1 alg into csTimer's notation:
    // "(0, 5) / (3, 0) / ... (6, 0)" -> "(0,5)/ (3,0)/ ... (6,0)"
    function toCsTimerSq1(alg) {
        if (window.Square1Drawer && window.Square1Drawer.formatCsTimer) {
            return window.Square1Drawer.formatCsTimer(alg);
        }
        return alg;
    }

    // Break a Megaminx scramble into csTimer's layout: seven lines, each ten
    // alternating R/D moves followed by a single U or U'. That is the shape
    // the WCA generator already produces — it just arrives as one long line,
    // and a scramble that wraps wherever the box happens to end is much
    // harder to follow while turning.
    //
    // The grouping keys off the U moves rather than counting to eleven, so an
    // unexpected line length passes through untouched instead of being cut in
    // the wrong place.
    function toMegaminxLines(alg) {
        const tokens = String(alg).trim().split(/\s+/).filter(Boolean);
        if (!tokens.length) return alg;

        const lines = [];
        let line = [];
        for (const tok of tokens) {
            line.push(tok);
            if (/^U['2]?$/.test(tok)) {
                lines.push(line.join(' '));
                line = [];
            }
        }
        if (line.length) lines.push(line.join(' '));

        // Only reformat something that actually looks like a WCA megaminx
        // scramble; anything else is returned exactly as it came in.
        const wellFormed = lines.length >= 2
            && lines.every((l) => /\sU['2]?$/.test(l) || l === lines[lines.length - 1]);
        return wellFormed ? lines.join('\n') : alg;
    }

    // ---------- WCA scramble program loader (cached, multi-CDN) ----------
    // Primary CDN first; mirrors keep random-state scrambles available even
    // if one CDN is unreachable. Only a total failure of all three drops the
    // engine down to the local random-move fallback.
    const SCRAMBLE_PROGRAM_CDNS = [
        'https://cdn.cubing.net/v0/js/cubing/scramble',
        'https://cdn.jsdelivr.net/npm/cubing@0/scramble/+esm',
        'https://esm.sh/cubing@0/scramble',
    ];

    let scramblerModulePromise = null;
    let cdnIndex = 0;

    async function importFirstAvailable(urls) {
        let lastErr = null;
        for (const url of urls) {
            try {
                return await import(url);
            } catch (err) {
                lastErr = err;
                console.warn(`[ScrambleEngine] could not load scramble program from ${url}`, err);
            }
        }
        throw lastErr || new Error('No scramble program CDN reachable');
    }

    function loadScrambler() {
        if (!scramblerModulePromise) {
            scramblerModulePromise = importFirstAvailable(SCRAMBLE_PROGRAM_CDNS.slice(cdnIndex))
                .catch(err => {
                    scramblerModulePromise = null; // allow retry later
                    throw err;
                });
        }
        return scramblerModulePromise;
    }

    async function get(eventId) {
        const wcaId = wcaEventId(eventId);
        // Retry transient failures (worker hiccup, first-load race). A module
        // whose lazy solver chunk keeps failing will never succeed, so after
        // two failures on the same CDN roll over to the next one.
        const maxAttempts = 2 * SCRAMBLE_PROGRAM_CDNS.length;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { randomScrambleForEvent } = await loadScrambler();
                const alg = await randomScrambleForEvent(wcaId);
                // Square-1 is displayed in csTimer's compact notation, and
                // Megaminx in csTimer's seven-line layout.
                if (wcaId === 'sq1') return toCsTimerSq1(alg.toString());
                if (wcaId === 'minx') return toMegaminxLines(alg.toString());
                return alg.toString();
            } catch (e) {
                console.warn(`[ScrambleEngine] random-state scramble attempt ${attempt} failed for ${wcaId}`, e);
                if (attempt % 2 === 0 && cdnIndex < SCRAMBLE_PROGRAM_CDNS.length - 1) {
                    cdnIndex++;
                    scramblerModulePromise = null;
                }
            }
        }
        console.warn(`[ScrambleEngine] all random-state attempts failed for ${wcaId} — using local fallback (offline?)`);
        return fallbackScramble(wcaId);
    }

    function prewarm(eventId) {
        // Fire-and-forget: initializes the web worker + tables so the first
        // real scramble (esp. 4x4+ / sq1) appears quickly.
        get(eventId).catch(() => { /* ignored */ });
    }

    // Warm up the scramble program as soon as the page goes idle so the
    // first real scramble is instant and CDN problems surface early.
    const _idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
    _idle(() => prewarm('333'));

    // ---------- Local fallbacks (offline safe, WCA-shaped) ----------
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function isOppositeAxis(a, b) {
        const opp = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
        return opp[a] === b;
    }

    function baseFace(move) {
        // '3Uw' -> 'U', 'Rw' -> 'R', "U'" -> 'U'
        return move.replace(/^\d/, '').replace(/w$/, '')[0];
    }

    function nxnScramble(facePool, length, modifiers) {
        const mods = modifiers || ['', "'", '2'];
        const moves = [];
        let lastAxis = '', secondLastAxis = '';
        for (let i = 0; i < length; i++) {
            let face, axis;
            do {
                face = pick(facePool);
                axis = baseFace(face);
            } while (axis === lastAxis || (axis === secondLastAxis && isOppositeAxis(axis, lastAxis)));
            moves.push(face + pick(mods));
            secondLastAxis = lastAxis;
            lastAxis = axis;
        }
        return moves.join(' ');
    }

    function pyramScramble() {
        const moves = [];
        let lastFace = '';
        const mainCount = 8 + Math.floor(Math.random() * 2);
        for (let i = 0; i < mainCount; i++) {
            let face;
            do { face = pick(['U', 'R', 'L', 'B']); } while (face === lastFace);
            moves.push(face + pick(['', "'"]));
            lastFace = face;
        }
        ['u', 'r', 'l', 'b'].forEach(tip => {
            if (Math.random() < 0.5) moves.push(tip + pick(['', "'"]));
        });
        return moves.join(' ');
    }

    function skewbScramble() {
        const moves = [];
        let lastFace = '';
        for (let i = 0; i < 11; i++) {
            let face;
            do { face = pick(['U', 'R', 'L', 'B']); } while (face === lastFace);
            moves.push(face + pick(['', "'"]));
            lastFace = face;
        }
        return moves.join(' ');
    }

    function sq1Scramble() {
        // Random-move approximation (real random-state comes from the WCA
        // scramble program). Uses the Square1Drawer state machine — the
        // same wedge model as the kpuzzle behind real scrambles — so every
        // "/" is legal and the diagram can always be drawn.
        const D = window.Square1Drawer;
        if (!D || !D.stateFromScramble) return '(0,-1)/ (0,3)/ (0,-3)/ (0,3)/ (0,-3)/ (0,3)/';
        const AMOUNTS = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6];
        let scr = '';
        for (let i = 0; i < 12; i++) {
            const xs = AMOUNTS.slice().sort(() => Math.random() - 0.5);
            const ys = AMOUNTS.slice().sort(() => Math.random() - 0.5);
            let done = false;
            for (const x of xs) {
                if (done) break;
                for (const y of ys) {
                    if (i > 0 && x === 0 && y === 0) continue; // avoid null twists mid-scramble
                    const cand = `${scr} (${x},${y})/`;
                    if (D.stateFromScramble(cand).legal) {
                        scr = cand;
                        done = true;
                        break;
                    }
                }
            }
            if (!done) scr += ' (0,0)/'; // unreachable: (0,0) is always legal
        }
        return scr.trim();
    }

    function clockScramble() {
        const prePins = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
        const postPins = ['U', 'R', 'D', 'L', 'ALL'];
        const fmt = pin => {
            const v = Math.floor(Math.random() * 12) - 5; // -5..6
            return `${pin}${v >= 0 ? v + '+' : Math.abs(v) + '-'}`;
        };
        return [...prePins.map(fmt), 'y2', ...postPins.map(fmt)].join(' ');
    }

    function minxScramble() {
        // WCA-style: 7 lines of (R/D alternating with ++/--) x10 + U move.
        const moves = [];
        for (let line = 0; line < 7; line++) {
            for (let j = 0; j < 10; j++) {
                moves.push((j % 2 === 0 ? 'R' : 'D') + pick(['++', '--']));
            }
            moves.push('U' + pick(['', "'"]));
        }
        return toMegaminxLines(moves.join(' '));
    }

    const OUTER = ['U', 'D', 'R', 'L', 'F', 'B'];

    function fallbackScramble(wcaId) {
        switch (wcaId) {
            case '222': return nxnScramble(['U', 'R', 'F'], 11);
            case '444': return nxnScramble([...OUTER, 'Uw', 'Rw', 'Fw'], 44);
            case '555': return nxnScramble([...OUTER, 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw'], 60);
            case '666': return nxnScramble([...OUTER, 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', '3Uw', '3Rw', '3Fw'], 80);
            case '777': return nxnScramble([...OUTER, 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', '3Uw', '3Rw', '3Fw'], 100);
            case 'pyram': return pyramScramble();
            case 'skewb': return skewbScramble();
            case 'sq1': return sq1Scramble();
            case 'clock': return clockScramble();
            case 'minx': return minxScramble();
            case '333':
            case '333oh':
            case '333bf':
            case '333fm':
            default:
                return nxnScramble(OUTER, 20);
        }
    }

    window.ScrambleEngine = { get, puzzleId, wcaEventId, prewarm, fallbackScramble, vizFor, applyViz, normalizeAlgFor };
})();
