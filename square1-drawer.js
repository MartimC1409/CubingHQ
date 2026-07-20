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

    // Point on the axis-aligned square boundary at screen angle deg
    // (0° = up, clockwise), for a square of half-side s.
    function sqPoint(cx, cy, s, deg) {
        const a = deg * Math.PI / 180;
        const dx = Math.sin(a), dy = -Math.cos(a);
        const k = s / Math.max(Math.abs(dx), Math.abs(dy));
        return [cx + dx * k, cy + dy * k];
    }

    function poly(pts, fill) {
        const d = pts.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
        return `<polygon points="${d}" fill="${fill}" stroke="#000" stroke-width="0.06"/>`;
    }

    // Boundary walk from a1 to a2 (clockwise, degrees) inserting the
    // square corners (45+90k) crossed along the way.
    function boundary(cx, cy, s, a1, a2) {
        const pts = [sqPoint(cx, cy, s, a1)];
        for (let c = Math.ceil((a1 - 45) / 90) * 90 + 45; c < a2; c += 90) {
            if (c > a1) pts.push(sqPoint(cx, cy, s, c));
        }
        pts.push(sqPoint(cx, cy, s, a2));
        return pts;
    }

    function drawLayer(parts, state, isTop, cx, cy) {
        const base = isTop ? 0 : 12;
        const angle = s => isTop ? 30 + s * 30 : 180 + s * 30;
        // Side sticker bands: one triangle per slot, full size.
        for (let s = 0; s < 12; s++) {
            const w = state.wedges[base + s];
            const a1 = angle(s) - 15, a2 = angle(s) + 15;
            const pts = [[cx, cy]].concat(boundary(cx, cy, SQA, a1, a2));
            parts.push(poly(pts, sideColor(w)));
        }
        // Face wedges (scaled): merge corner twins into one polygon.
        let s = 0;
        // If a corner pair wraps the 11->0 boundary start at slot 1..
        const wrapPair = TWIN[state.wedges[base + 11]] === state.wedges[base + 0];
        if (wrapPair) s = 1;
        let drawn = 0;
        while (drawn < 12) {
            const w = state.wedges[base + (s % 12)];
            const isCorner = TWIN[w] !== -1 && state.wedges[base + ((s + 1) % 12)] === TWIN[w];
            const span = isCorner ? 60 : 30;
            const a1 = angle(s % 12) - 15;
            const pts = [[cx, cy]].concat(
                boundary(cx, cy, SQA * FACE_SCALE, a1, a1 + span));
            parts.push(poly(pts, faceColor(w)));
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
        drawLayer(parts, state, true, SQB, cyMid);          // top layer, left
        drawLayer(parts, state, false, 3 * SQB, cyMid);     // bottom layer, right
        const aligned = state.slashParity === 0;
        drawMiddle(parts, aligned, SQB, cyMid + SQA + 0.25);        // under left square
        drawMiddle(parts, aligned, 3 * SQB, cyMid - SQA - 0.95);    // over right square
        parts.push('</svg>');
        container.innerHTML = parts.join('');
    }

    window.Square1Drawer = { render, stateFromScramble, formatCsTimer, parseScramble };
})();
