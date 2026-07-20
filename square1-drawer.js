/* ============================================================
   CubingHQ — Square-1 scramble diagram (csTimer-style)
   ------------------------------------------------------------
   Draws the state reached by a WCA Square-1 scramble as two flat
   squares side by side — top layer (left, seen from above) and
   bottom layer (right, seen from below) — plus the middle-layer
   indicator, in the same visual language and default colors as
   csTimer's scramble image.

   State model = the cubing.js `square1` kpuzzle WEDGES orbit
   (the exact semantics of the scrambles we generate), verified
   against the official twisty renderer:
     - 24 wedge slots: 0-11 top layer, 12-23 bottom layer.
     - (x, y): top slot contents move i -> i+x (clockwise seen
       from above); bottom j -> j+y (clockwise seen from below).
     - "/" swaps top slots 6-11 with bottom slots 12-17 pairwise
       (6<->12 ... 11<->17) and toggles the middle-layer parity.
     - Solved: wedge k in slot k. Top corners occupy slot pairs
       (0,1),(3,4),(6,7),(9,10); bottom corners (13,14),(16,17),
       (19,20),(22,23); the rest are edges.

   Screen mapping (calibrated against cubing.js's own renderer):
     - Top slot i center angle  30° + i*30°   (0° = 12 o'clock,
       angles grow clockwise).
     - Bottom slot j center angle 180° + (j-12)*30°.
   Solved picture: left square yellow face with orange top /
   green right / red bottom / blue left; right square white face
   with red top / green right / orange bottom / blue left.

   Exposed as window.Square1Drawer:
     .render(container, scrambleStr)
     .stateFromScramble(str) -> { wedges[24], slashParity, legal }
     .formatCsTimer(str)     -> "(a,b)/ (c,d)/ ..." notation
   ============================================================ */
(function () {
    'use strict';

    // csTimer default Square-1 palette.
    const COL = {
        U: '#ff0', D: '#fff',
        ORG: '#f80', RED: '#f00', GRN: '#0f0', BLU: '#00f',
    };

    // Solved metadata per wedge index (0-23).
    const SIDE_TOP = ['ORG', 'GRN', 'GRN', 'GRN', 'RED', 'RED', 'RED', 'BLU', 'BLU', 'BLU', 'ORG', 'ORG'];
    const SIDE_BOT = ['ORG', 'ORG', 'BLU', 'BLU', 'BLU', 'RED', 'RED', 'RED', 'GRN', 'GRN', 'GRN', 'ORG'];
    // Corner twin of each wedge (or -1 for an edge wedge).
    const TWIN = new Array(24).fill(-1);
    [[0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23]]
        .forEach(([a, b]) => { TWIN[a] = b; TWIN[b] = a; });

    function sideColor(w) { return COL[w < 12 ? SIDE_TOP[w] : SIDE_BOT[w - 12]]; }
    function faceColor(w) { return w < 12 ? COL.U : COL.D; }

    // ---------- Parsing ----------
    // Accepts both "(a, b) / (c, d)" and csTimer's "(a,b)/ (c,d)/".
    function parseScramble(str) {
        const moves = [];
        const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
        let m;
        while ((m = re.exec(str || '')) !== null) {
            if (m[0] === '/') moves.push('/');
            else moves.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
        }
        return moves;
    }

    // ---------- State ----------
    function solvedState() {
        return {
            wedges: Array.from({ length: 24 }, (_, i) => i),
            slashParity: 0,
            legal: true,
        };
    }

    function twist(state, x, y) {
        const w = state.wedges;
        const top = w.slice(0, 12);
        const bot = w.slice(12);
        const a = ((x % 12) + 12) % 12;
        const b = ((y % 12) + 12) % 12;
        for (let i = 0; i < 12; i++) {
            w[(i + a) % 12] = top[i];
            w[12 + (i + b) % 12] = bot[i];
        }
    }

    // "/" is legal when no corner pair straddles a cut boundary:
    // top boundaries 11|0 and 5|6, bottom 23|12 and 17|18.
    function slashLegal(state) {
        const w = state.wedges;
        const cut = (a, b) => TWIN[w[a]] === w[b];
        return !(cut(11, 0) || cut(5, 6) || cut(23, 12) || cut(17, 18));
    }

    function slash(state) {
        if (!slashLegal(state)) {
            state.legal = false;
            console.warn('[Square1Drawer] Illegal "/" for state — drawing may be wrong.');
        }
        const w = state.wedges;
        for (let i = 0; i < 6; i++) {
            const t = w[6 + i];
            w[6 + i] = w[12 + i];
            w[12 + i] = t;
        }
        state.slashParity ^= 1;
    }

    function stateFromScramble(str) {
        const state = solvedState();
        for (const mv of parseScramble(str)) {
            if (mv === '/') slash(state);
            else twist(state, mv[0], mv[1]);
        }
        return state;
    }

    // ---------- csTimer notation ----------
    // "(0, 5) / (3, 0) / ... (6, 0)" -> "(0,5)/ (3,0)/ ... (6,0)"
    function formatCsTimer(str) {
        const moves = parseScramble(str);
        const out = [];
        for (let i = 0; i < moves.length; i++) {
            const mv = moves[i];
            if (mv === '/') {
                if (out.length && !out[out.length - 1].endsWith('/')) {
                    out[out.length - 1] += '/';
                } else {
                    out.push('/');
                }
            } else {
                out.push(`(${mv[0]},${mv[1]})`);
            }
        }
        return out.join(' ');
    }

    // ---------- Drawing ----------
    const SQA = 1 + Math.sqrt(3) / 2;      // half-side of a face square
    const SQB = SQA * Math.sqrt(2);        // half-size of a layer cell
    const FACE_SCALE = 0.66;               // inner face wedge scale (side band look)

    function poly(pts, fill) {
        const d = pts.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
        return `<polygon points="${d}" fill="${fill}" stroke="#000" stroke-width="0.06"/>`;
    }

    // ---- Intrinsic piece shapes (local coords, pointing up) ----
    // Pieces keep their own shape wherever they sit — an edge is a flat
    // 30° wedge of height SQA, a corner is a 60° wedge reaching out to
    // the square diagonal (radius SQB). Drawing them rotated (instead of
    // clipping to a fixed square outline) is what makes the actual
    // cubeshape visible: only cube-shaped layers look like squares.
    // Local angular spans: EDGE [-15°,15°]; CORNER [-75°,-15°], split
    // into its two 30° halves for the per-wedge side stickers.
    const EDGE_SHAPE = [[0, 0], [-0.5, -SQA], [0.5, -SQA]];
    const CORNER_SHAPE = [[0, 0], [-0.5, -SQA], [-SQA, -SQA], [-SQA, -0.5]];
    const CORNER_HALF_R = [[0, 0], [-0.5, -SQA], [-SQA, -SQA]];   // local [-45°,-15°]
    const CORNER_HALF_L = [[0, 0], [-SQA, -SQA], [-SQA, -0.5]];   // local [-75°,-45°]

    // Rotate (clockwise on screen for positive deg), scale about the
    // origin, then translate to (cx, cy).
    function place(shape, deg, scale, cx, cy) {
        const a = deg * Math.PI / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        return shape.map(([x, y]) => [
            cx + (x * cos - y * sin) * scale,
            cy + (x * sin + y * cos) * scale,
        ]);
    }

    function drawLayer(parts, state, isTop, cx, cy) {
        const base = isTop ? 0 : 12;
        const angle = s => (isTop ? 30 : 180) + s * 30;
        // Start so a corner pair wrapping the 11->0 slot boundary is
        // drawn as one piece.
        let s = 0;
        if (TWIN[state.wedges[base + 11]] === state.wedges[base + 0]) s = 1;
        let drawn = 0;
        while (drawn < 12) {
            const slot = s % 12;
            const w = state.wedges[base + slot];
            const isCorner = TWIN[w] !== -1
                && state.wedges[base + ((s + 1) % 12)] === TWIN[w];
            if (isCorner) {
                const w2 = state.wedges[base + ((s + 1) % 12)];
                // Corner spanning [angle-15°, angle+45°]: rotate the base
                // shape (local [-75°,-15°]) by angle+60°.
                const rot = angle(slot) + 60;
                parts.push(poly(place(CORNER_HALF_L, rot, 1, cx, cy), sideColor(w)));
                parts.push(poly(place(CORNER_HALF_R, rot, 1, cx, cy), sideColor(w2)));
                parts.push(poly(place(CORNER_SHAPE, rot, FACE_SCALE, cx, cy), faceColor(w)));
            } else {
                const rot = angle(slot);
                parts.push(poly(place(EDGE_SHAPE, rot, 1, cx, cy), sideColor(w)));
                parts.push(poly(place(EDGE_SHAPE, rot, FACE_SCALE, cx, cy), faceColor(w)));
            }
            s += isCorner ? 2 : 1;
            drawn += isCorner ? 2 : 1;
        }
    }

    // Middle-layer indicator, csTimer style: a strip whose left half is
    // always red; when the middle layer is offset (odd slashes) the
    // right half is drawn shorter and orange.
    function drawMiddle(parts, aligned, cx, cy) {
        const h = 0.7;
        const L = COL.RED, R = COL.ORG;
        parts.push(poly([[cx - SQA, cy], [cx - SQA, cy + h], [cx - 0.5, cy + h], [cx - 0.5, cy]], L));
        if (aligned) {
            parts.push(poly([[cx + SQA, cy], [cx + SQA, cy + h], [cx - 0.5, cy + h], [cx - 0.5, cy]], L));
        } else {
            const k = Math.sqrt(3) / 2;
            parts.push(poly([[cx + k, cy], [cx + k, cy + h], [cx - 0.5, cy + h], [cx - 0.5, cy]], R));
        }
    }

    function render(container, scrambleStr) {
        if (!container) return;
        const state = stateFromScramble(scrambleStr);
        const W = 4 * SQB, H = 2 * SQB + 1.2;
        const parts = [];
        parts.push(`<svg viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;margin:0 auto;">`);
        const cyMid = SQB;
        // Middle-layer indicators first so out-of-cubeshape pieces can
        // overlap them (same layering as csTimer).
        const aligned = state.slashParity === 0;
        drawMiddle(parts, aligned, SQB, cyMid + SQA + 0.25);        // under left square
        drawMiddle(parts, aligned, 3 * SQB, cyMid - SQA - 0.95);    // over right square
        drawLayer(parts, state, true, SQB, cyMid);          // top layer, left
        drawLayer(parts, state, false, 3 * SQB, cyMid);     // bottom layer, right
        parts.push('</svg>');
        container.innerHTML = parts.join('');
    }

    window.Square1Drawer = { render, stateFromScramble, formatCsTimer, parseScramble };
})();
