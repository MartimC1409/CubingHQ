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
    // Square-1: ensure canonical "(a, b)" tuple spacing.
    function normalizeAlgFor(twistyPuzzleId, alg) {
        if (!alg) return '';
        if (twistyPuzzleId === 'square1') {
            return alg.replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, '($1, $2)');
        }
        return alg;
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
        // scramble program). Tracks the actual piece layout of both layers so
        // every twist keeps the slice plane clear — no illegal moves.
        // Layers are arrays of piece widths in 30° units (corner=2, edge=1),
        // clockwise from the slice plane; widths always sum to 12. Solved
        // layers start with a corner at the slice plane (matches the WCA
        // solved state and Square1Drawer's model).
        let top = [2, 1, 2, 1, 2, 1, 2, 1];
        let bottom = [2, 1, 2, 1, 2, 1, 2, 1];

        function boundaries(layer) {
            const b = new Set();
            let acc = 0;
            for (const w of layer) { b.add(acc); acc += w; }
            return b;
        }

        // Rotations (in units) that leave piece boundaries at both slice
        // positions (0 and 6) so the following "/" is a legal move.
        function legalTurns(layer) {
            const b = boundaries(layer);
            const legal = [];
            for (let a = -5; a <= 6; a++) {
                if (b.has(((-a % 12) + 12) % 12) && b.has(((6 - a) % 12 + 12) % 12)) legal.push(a);
            }
            return legal;
        }

        function rotate(layer, a) {
            // Shift the layer so the piece boundary at position (-a mod 12)
            // becomes the new start (position 0 after turning by `a`).
            const start = ((-a % 12) + 12) % 12;
            let acc = 0, idx = 0;
            for (let i = 0; i < layer.length; i++) {
                if (acc === start) { idx = i; break; }
                acc += layer[i];
            }
            return layer.slice(idx).concat(layer.slice(0, idx));
        }

        function half(layer, fromStart) {
            // Split a layer (with boundaries at 0 and 6) into [0,6) / [6,12).
            const first = [];
            const second = [];
            let acc = 0;
            for (const w of layer) {
                (acc < 6 ? first : second).push(w);
                acc += w;
            }
            return fromStart ? first : second;
        }

        const moves = [];
        for (let i = 0; i < 12; i++) {
            const tOptions = legalTurns(top);
            const bOptions = legalTurns(bottom);
            let a = pick(tOptions);
            let b = pick(bOptions);
            if (a === 0 && b === 0) {
                const nzTop = tOptions.filter(v => v !== 0);
                const nzBot = bOptions.filter(v => v !== 0);
                if (Math.random() < 0.5 && nzTop.length) a = pick(nzTop);
                else if (nzBot.length) b = pick(nzBot);
                else if (nzTop.length) a = pick(nzTop);
            }
            moves.push(`(${a},${b})/`);
            top = rotate(top, a);
            bottom = rotate(bottom, b);
            // "/" swaps the right halves (each flipped 180°, reversing order).
            const newTop = half(top, true).concat(half(bottom, false).reverse());
            const newBottom = half(bottom, true).concat(half(top, false).reverse());
            top = newTop;
            bottom = newBottom;
        }
        return moves.join(' ');
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
        return moves.join(' ');
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
