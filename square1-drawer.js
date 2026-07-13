/* ============================================================
   SimulateCubing — Standalone Square-1 scramble diagram
   ------------------------------------------------------------
   Independent of cubing.js / twisty-player. Draws a flat, two-
   layer diagram (top ring + bottom ring + equator bar) from a
   WCA Square-1 scramble string, e.g. "(3,0) / (-1,1) / (0,-3) /".

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
        const units = new Array(12);
        let unitIdx = 0;
        for (let c = 0; c < 4; c++) {
            const sideA = COLORS[c];
            const sideB = COLORS[(c + 1) % 4];
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
    function sliceIsLegal(units) {
        return units[0].subSlot !== 1 && units[6].subSlot !== 1;
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
    function unitColor(unit) {
        const p = unit.piece;
        if (p.type === 'edge') return p.flipped ? p.side : p.pole;
        // corner
        if (!p.flipped) return p.pole;
        return unit.subSlot === 0 ? p.sideA : p.sideB;
    }

    // ---------- Drawing ----------
    function polar(cx, cy, r, angleDeg) {
        const a = (angleDeg - 90) * Math.PI / 180;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }

    function wedgePath(cx, cy, r, startAngle, endAngle) {
        const [x1, y1] = polar(cx, cy, r, startAngle);
        const [x2, y2] = polar(cx, cy, r, endAngle);
        const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
        return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    }

    function drawLayer(svgParts, units, cx, cy, r) {
        let i = 0;
        while (i < 12) {
            const unit = units[i];
            // A corner's two halves always occupy adjacent array slots, but
            // a slice can reverse WHICH half (subSlot 0 vs 1) lands first —
            // so detect the pair by shared piece reference, not by subSlot.
            const isCornerStart = unit.piece.type === 'corner'
                && units[(i + 1) % 12].piece === unit.piece;
            const startAngle = i * 30;
            if (isCornerStart) {
                const endAngle = startAngle + 60;
                const midAngle = startAngle + 30;
                const outlineColor = unitColor(unit); // first half color (or merged pole)
                svgParts.push(`<path d="${wedgePath(cx, cy, r, startAngle, endAngle)}" fill="${outlineColor}" stroke="#222" stroke-width="1.5"/>`);
                if (unit.piece.flipped) {
                    // overlay the second half in its own color, no stroke,
                    // so the pair still reads as ONE merged piece.
                    const secondColor = unitColor(units[(i + 1) % 12]);
                    svgParts.push(`<path d="${wedgePath(cx, cy, r, midAngle, endAngle)}" fill="${secondColor}" stroke="none"/>`);
                    svgParts.push(`<line x1="${cx}" y1="${cy}" x2="${polar(cx, cy, r, midAngle)[0].toFixed(2)}" y2="${polar(cx, cy, r, midAngle)[1].toFixed(2)}" stroke="#222" stroke-width="0.4" stroke-opacity="0.35"/>`);
                }
                i += 2;
            } else {
                const endAngle = startAngle + 30;
                svgParts.push(`<path d="${wedgePath(cx, cy, r, startAngle, endAngle)}" fill="${unitColor(unit)}" stroke="#222" stroke-width="1.5"/>`);
                i += 1;
            }
        }
    }

    function render(container, scrambleStr) {
        if (!container) return;
        const state = makeSolvedState();
        applyMoves(state, parseScramble(scrambleStr || ''));

        const W = 220, topCY = 95, botCY = 235, R = 80;
        const parts = [];
        parts.push(`<svg viewBox="0 0 ${W} 330" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:260px;display:block;margin:0 auto;">`);
        drawLayer(parts, state.top, W / 2, topCY, R);
        // equator bar: small rect showing alignment, colored from the
        // boundary units on each side.
        const barY = topCY + R + 8;
        const leftColor = unitColor(state.top[11]);
        const rightColor = unitColor(state.top[0]);
        const offset = state.middleFlipped ? 14 : 0;
        parts.push(`<rect x="${W / 2 - 40 + offset}" y="${barY}" width="40" height="14" fill="${leftColor}" stroke="#222" stroke-width="1"/>`);
        parts.push(`<rect x="${W / 2 + offset}" y="${barY}" width="40" height="14" fill="${rightColor}" stroke="#222" stroke-width="1"/>`);
        drawLayer(parts, state.bottom, W / 2, botCY, R);
        parts.push(`</svg>`);

        container.innerHTML = parts.join('');
    }

    window.Square1Drawer = { render, parseScramble, makeSolvedState, applyMoves };
})();
