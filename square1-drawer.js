/* ============================================================
   CubingHQ — Standalone Square-1 scramble diagram
   ------------------------------------------------------------
   Independent of cubing.js / twisty-player. Draws a flat, two-
   layer diagram (csTimer-style: two squares with side-sticker
   tabs + equator bar) from a WCA Square-1 scramble string,
   e.g. "(3,0) / (-1,1) / (0,-3) /".

   Model:
   - Each layer is 12 angular "units" of 30 degrees each.
   - A corner piece permanently occupies 2 ADJACENT units and is
     always drawn as ONE merged 60-degree piece (never split into
     two separately-outlined pieces) — this is what fixes the
     "looks like 2x too many pieces" problem.
   - An edge piece occupies 1 unit (30 degrees), drawn as its own
     small piece.
   - A twist "(a,b)" rotates the top layer's contents by `a`
     units and the bottom layer's by `b` units (no color/flip
     change — twisting never changes what's facing up).
   - A slice "/" is only legal when neither layer has a piece
     straddling the unit-0/11 or unit-5/6 boundary. It exchanges
     the "back half" (units 6..11) of top and bottom, with each
     moved piece's layer-facing color toggled (pole <-> sides)
     and its position mirrored within the half (this matches the
     physical 180-degree hinge flip).

   Exposed as window.Square1Drawer.render(container, scrambleStr)
   ============================================================ */
(function () {
    'use strict';

    const COLORS = ['green', 'red', 'blue', 'orange']; // 4 side colors, cycle order
    const WHITE = '#f5f5f5';
    const YELLOW = '#ffd400';

    // ---------- Build the solved state ----------
    // 4 corners + 4 edges per layer, alternating C,E around the ring.
    // Corner side colors follow the standard cycle (green/red/blue/orange).
    function makeSolvedLayer(poleColor, isTop) {
        // units[i] = { piece } ; piece is shared object reference for both
        // units of a corner (subSlot 0/1 distinguishes which half).
        // Color offset puts green (front) on the edge facing the equator
        // bar: the bottom edge for the top layer, top edge for the bottom.
        const off = isTop ? 2 : 0;
        const units = new Array(12);
        let unitIdx = 0;
        for (let c = 0; c < 4; c++) {
            const sideA = COLORS[(c + off) % 4];
            const sideB = COLORS[(c + off + 1) % 4];
            const corner = { type: 'corner', pole: poleColor, sideA, sideB, flipped: false };
            units[unitIdx] = { piece: corner, subSlot: 0 };
            units[unitIdx + 1] = { piece: corner, subSlot: 1 };
            unitIdx += 2;
            const edge = { type: 'edge', pole: poleColor, side: sideB, flipped: false };
            units[unitIdx] = { piece: edge, subSlot: 0 };
            unitIdx += 1;
        }
        return units;
    }

    function makeSolvedState() {
        return {
            top: makeSolvedLayer(WHITE, true),
            bottom: makeSolvedLayer(YELLOW, false),
            middleFlipped: false
        };
    }

    // ---------- Parsing ----------
    // Accepts tokens like "(3,0)", "(-1, 1)", and "/".
    function parseScramble(str) {
        const moves = [];
        const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
        let m;
        while ((m = re.exec(str)) !== null) {
            if (m[0] === '/') moves.push({ type: 'slice' });
            else moves.push({ type: 'twist', top: parseInt(m[1], 10), bottom: parseInt(m[2], 10) });
        }
        return moves;
    }

    // ---------- Move application ----------
    function rotateLayer(units, amount) {
        const n = 12;
        const shifted = new Array(n);
        const a = ((amount % n) + n) % n;
        for (let i = 0; i < n; i++) {
            shifted[(i + a) % n] = units[i];
        }
        return shifted;
    }

    // A slice is legal only if no piece straddles the 11/0 or 5/6 boundary
    // in either layer (i.e. unit 0 and unit 6 must each start a new piece).
    // Detect the straddle by shared piece reference, not subSlot: a slice
    // can reverse which corner half (subSlot 0 vs 1) lands first, so a
    // reversed corner legitimately starting AT the cut has subSlot 1 there.
    function sliceIsLegal(units) {
        return units[0].piece !== units[11].piece && units[6].piece !== units[5].piece;
    }

    function applySlice(state) {
        if (!sliceIsLegal(state.top) || !sliceIsLegal(state.bottom)) {
            console.warn('[Square1Drawer] Illegal slice (a piece straddles the cut) — skipping.');
            return;
        }
        const newTop = state.top.slice();
        const newBottom = state.bottom.slice();
        // Units 6..11 swap between layers, mirrored: new[i] = old[17-i]
        for (let i = 6; i <= 11; i++) {
            const mirror = 17 - i;
            const fromBottom = state.bottom[mirror];
            const fromTop = state.top[mirror];
            newTop[i] = fromBottom;
            newBottom[i] = fromTop;
        }
        // Toggle facing for every piece that just changed layers (dedupe
        // shared corner references so we don't double-toggle).
        const touched = new Set();
        for (let i = 6; i <= 11; i++) {
            [state.bottom[17 - i].piece, state.top[17 - i].piece].forEach(p => {
                if (!touched.has(p)) { touched.add(p); }
            });
        }
        touched.forEach(p => { p.flipped = !p.flipped; });
        state.top = newTop;
        state.bottom = newBottom;
        state.middleFlipped = !state.middleFlipped;
    }

    function applyMoves(state, moves) {
        for (const mv of moves) {
            if (mv.type === 'twist') {
                state.top = rotateLayer(state.top, mv.top);
                state.bottom = rotateLayer(state.bottom, mv.bottom);
            } else if (mv.type === 'slice') {
                applySlice(state);
            }
        }
        return state;
    }

    // ---------- Color lookup ----------
    // The layer-facing sticker of a piece is ALWAYS its pole sticker: when
    // a slice moves a piece to the other layer the piece is inverted, so
    // its pole sticker faces that layer's outside. `flipped` only mirrors
    // the left/right order of a corner's two side stickers.
    function faceColor(unit) {
        return unit.piece.pole;
    }

    function sideColor(unit) {
        const p = unit.piece;
        if (p.type === 'edge') return p.side;
        if (unit.subSlot === 0) return p.flipped ? p.sideB : p.sideA;
        return p.flipped ? p.sideA : p.sideB;
    }

    // ---------- Drawing (csTimer-style squares) ----------
    // Each layer is a square viewed from its pole. A piece spanning
    // angles [a1,a2] (30° units, 0° at 12 o'clock, clockwise) is a wedge
    // from the center to the square's boundary; side stickers are drawn
    // as tabs just outside the square edge.
    function squarePoint(cx, cy, size, angleDeg) {
        const a = angleDeg * Math.PI / 180;
        const dx = Math.sin(a), dy = -Math.cos(a);
        const k = size / Math.max(Math.abs(dx), Math.abs(dy));
        return [cx + dx * k, cy + dy * k];
    }

    // Boundary points from a1 to a2 including any square corners
    // (45°, 135°, 225°, 315°) crossed along the way.
    function boundaryPoints(cx, cy, size, a1, a2) {
        const pts = [squarePoint(cx, cy, size, a1)];
        for (let c = 45; c < 720; c += 90) {
            if (c > a1 && c < a2) pts.push(squarePoint(cx, cy, size, c));
        }
        pts.push(squarePoint(cx, cy, size, a2));
        return pts;
    }

    function polyAttr(pts) {
        return pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    }

    function drawLayer(svgParts, units, cx, cy, size) {
        const TAB_GAP = 1.5, TAB_W = 8;
        // Side-sticker tabs (one per unit, outside the square edge).
        for (let i = 0; i < 12; i++) {
            const a1 = i * 30, a2 = a1 + 30;
            const inner = boundaryPoints(cx, cy, size + TAB_GAP, a1, a2);
            const outer = boundaryPoints(cx, cy, size + TAB_GAP + TAB_W, a1, a2).reverse();
            svgParts.push(`<polygon points="${polyAttr(inner.concat(outer))}" fill="${sideColor(units[i])}" stroke="#222" stroke-width="1"/>`);
        }
        // Piece bodies (corner pair = one merged wedge). A corner may
        // straddle the 12 o'clock boundary in the final state (units 11+0):
        // skip unit 0 and let the merge at i=11 wrap past 360°.
        let i = 0;
        if (units[0].piece.type === 'corner' && units[0].piece === units[11].piece) i = 1;
        while (i < 12) {
            const unit = units[i];
            // A corner's two halves always occupy adjacent array slots, but
            // a slice can reverse WHICH half (subSlot 0 vs 1) lands first —
            // so detect the pair by shared piece reference, not by subSlot.
            const isCornerStart = unit.piece.type === 'corner'
                && units[(i + 1) % 12].piece === unit.piece;
            const a1 = i * 30;
            const a2 = a1 + (isCornerStart ? 60 : 30);
            const pts = [[cx, cy]].concat(boundaryPoints(cx, cy, size, a1, a2));
            svgParts.push(`<polygon points="${polyAttr(pts)}" fill="${faceColor(unit)}" stroke="#222" stroke-width="1.5"/>`);
            i += isCornerStart ? 2 : 1;
        }
    }

    function render(container, scrambleStr) {
        if (!container) return;
        const state = makeSolvedState();
        applyMoves(state, parseScramble(scrambleStr || ''));

        const W = 220, topCY = 82, botCY = 248, S = 56;
        const parts = [];
        parts.push(`<svg viewBox="0 0 ${W} 330" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:260px;display:block;margin:0 auto;">`);
        drawLayer(parts, state.top, W / 2, topCY, S);
        // Equator bar: shows middle-slice alignment. The front of the
        // middle layer is green when square; after an odd number of
        // slices the right half shows the back color instead.
        const barY = (topCY + botCY) / 2 - 7;
        const offset = state.middleFlipped ? 12 : 0;
        parts.push(`<rect x="${W / 2 - 40}" y="${barY}" width="40" height="14" fill="green" stroke="#222" stroke-width="1"/>`);
        parts.push(`<rect x="${W / 2 + offset}" y="${barY}" width="40" height="14" fill="${state.middleFlipped ? 'blue' : 'green'}" stroke="#222" stroke-width="1"/>`);
        drawLayer(parts, state.bottom, W / 2, botCY, S);
        parts.push(`</svg>`);

        container.innerHTML = parts.join('');
    }

    window.Square1Drawer = { render, parseScramble, makeSolvedState, applyMoves };
})();
