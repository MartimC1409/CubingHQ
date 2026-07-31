/* ============================================================
   CubingHQ — CFOP solve analysis
   ------------------------------------------------------------
   Splits a smart-cube solve into CFOP phases (cross, the four F2L
   slots, OLL, PLL), times each one and flags where time was lost.

   Pure logic — no DOM, no network. The caller supplies a state object
   with applyMove()/getState(), backed by the cubing.js kpuzzle, so this
   file is directly testable in plain Node.

   Phases are detected from the cube state, not from move counts: we
   replay the solve and watch for the moment each milestone first holds.
   The cross face is detected rather than assumed, so colour-neutral
   solves are analysed correctly.

   Piece indices below were derived empirically from the cubing.js
   3x3x3 kpuzzle (which pieces each face turn moves), not guessed.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SolveAnalysis = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // A gap longer than this inside a phase reads as hesitation; normal
    // execution spacing is well under it.
    const FUMBLE_PAUSE_MS = 500;

    // Pieces touched by each face turn (cubing.js EDGES/CORNERS orbits).
    const FACE_EDGES = {
        U: [0, 1, 2, 3], D: [4, 5, 6, 7],
        R: [1, 5, 8, 10], L: [3, 7, 9, 11],
        F: [0, 4, 8, 9], B: [2, 6, 10, 11],
    };
    const FACE_CORNERS = {
        U: [0, 1, 2, 3], D: [4, 5, 6, 7],
        R: [0, 1, 4, 7], L: [2, 3, 5, 6],
        F: [0, 3, 4, 5], B: [1, 2, 6, 7],
    };
    const OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];

    const facesOfCorner = (c) => FACES.filter(f => FACE_CORNERS[f].includes(c));
    const inter = (a, b) => a.filter(x => b.includes(x));

    // For a cross on `face`, the four F2L pairs: each corner of that face plus
    // the edge shared by the corner's two *other* faces.
    function slotsFor(face) {
        return FACE_CORNERS[face].map(corner => {
            const [a, b] = facesOfCorner(corner).filter(f => f !== face);
            const edge = inter(FACE_EDGES[a], FACE_EDGES[b])[0];
            return { corner, edge, faces: a + b };
        });
    }
    const SLOTS_BY_FACE = {};
    FACES.forEach(f => { SLOTS_BY_FACE[f] = slotsFor(f); });

    const edgeSolved = (st, i) => st.edges.pieces[i] === i && st.edges.orientation[i] === 0;
    const cornerSolved = (st, i) => st.corners.pieces[i] === i && st.corners.orientation[i] === 0;
    const crossDoneOn = (st, face) => FACE_EDGES[face].every(i => edgeSolved(st, i));
    const slotDone = (st, slot) => cornerSolved(st, slot.corner) && edgeSolved(st, slot.edge);

    // Last layer (opposite the cross) fully oriented.
    function ollDone(st, crossFace) {
        const ll = OPPOSITE[crossFace];
        return FACE_CORNERS[ll].every(i => st.corners.orientation[i] === 0) &&
               FACE_EDGES[ll].every(i => st.edges.orientation[i] === 0);
    }
    function isSolved(st) {
        for (let i = 0; i < 12; i++) if (!edgeSolved(st, i)) return false;
        for (let i = 0; i < 8; i++) if (!cornerSolved(st, i)) return false;
        return true;
    }

    // ---- Quality assessment --------------------------------------------
    // Both signals come from the log itself: a long gap means hesitation, a
    // move immediately undone means wasted turns.
    function assess(moves, times) {
        let longestPause = 0;
        for (let i = 1; i < times.length; i++) {
            longestPause = Math.max(longestPause, times[i] - times[i - 1]);
        }
        let undos = 0;
        const fam = m => m.replace(/['2]/g, '');
        for (let i = 1; i < moves.length; i++) {
            const a = moves[i - 1], b = moves[i];
            if (fam(a) !== fam(b)) continue;
            const aP = a.endsWith("'"), bP = b.endsWith("'");
            const aH = a.endsWith('2'), bH = b.endsWith('2');
            if (!aH && !bH && aP !== bP) undos++;     // X then X'
        }
        if (undos > 0) {
            return { rating: 'blunder', reason: `${undos} move${undos > 1 ? 's' : ''} undone`, longestPause, undos };
        }
        if (longestPause > FUMBLE_PAUSE_MS) {
            return { rating: 'fumble', reason: `${(longestPause / 1000).toFixed(2)}s pause`, longestPause, undos };
        }
        return { rating: 'optimal', reason: 'no hesitation', longestPause, undos };
    }

    /**
     * @param {Array<{move:string,t:number}>} log moves with ms offsets from start
     * @param {{applyMove:Function,getState:Function}} puzzle replay adapter;
     *        getState() -> { edges:{pieces,orientation}, corners:{pieces,orientation} }
     */
    function analyze(log, puzzle) {
        if (!Array.isArray(log) || !log.length || !puzzle) {
            return { segments: [], totalMs: 0, moveCount: 0, complete: false, crossFace: null };
        }

        const segments = [];
        let phaseMoves = [], phaseTimes = [], phaseStart = 0;
        let stage = 'cross', crossFace = null, pendingSlots = null;

        const close = (phase, endT, slot) => {
            const seg = {
                phase, slot: slot || null,
                moves: phaseMoves.slice(),
                ms: Math.max(0, endT - phaseStart),
                moveCount: phaseMoves.length,
            };
            const q = assess(seg.moves, phaseTimes);
            seg.rating = q.rating; seg.reason = q.reason; seg.longestPause = q.longestPause;
            seg.tps = seg.ms > 0 ? +(seg.moveCount / (seg.ms / 1000)).toFixed(2) : 0;
            segments.push(seg);
            phaseMoves = []; phaseTimes = []; phaseStart = endT;
        };

        for (const entry of log) {
            try { puzzle.applyMove(entry.move); } catch (e) { continue; } // rotation/unknown
            phaseMoves.push(entry.move);
            phaseTimes.push(entry.t);
            const st = puzzle.getState();
            if (!st || !st.edges || !st.corners) continue;

            if (stage === 'cross') {
                const face = FACES.find(f => crossDoneOn(st, f));
                if (face) {
                    crossFace = face;
                    pendingSlots = SLOTS_BY_FACE[face].slice();
                    close('cross', entry.t);
                    stage = 'f2l';
                }
                continue;
            }
            if (stage === 'f2l') {
                let idx;
                // Several slots can complete on one move (rare but possible).
                while ((idx = pendingSlots.findIndex(s => slotDone(st, s))) !== -1) {
                    const slot = pendingSlots.splice(idx, 1)[0];
                    close('f2l', entry.t, SLOTS_BY_FACE[crossFace].indexOf(slot) + 1);
                }
                if (!pendingSlots.length) stage = 'oll';
                continue;
            }
            if (stage === 'oll') {
                if (isSolved(st)) { close('pll', entry.t); stage = 'done'; break; }
                if (ollDone(st, crossFace)) { close('oll', entry.t); stage = 'pll'; }
                continue;
            }
            if (stage === 'pll') {
                if (isSolved(st)) { close('pll', entry.t); stage = 'done'; break; }
            }
        }

        if (phaseMoves.length) close(stage === 'done' ? 'extra' : stage, log[log.length - 1].t);

        return {
            segments,
            totalMs: log[log.length - 1].t,
            moveCount: log.length,
            complete: stage === 'done',
            crossFace,
        };
    }

    // Group segments for display: cross, f2l (+ its slots), oll, pll.
    function summarize(result) {
        const out = { cross: null, f2l: { ms: 0, moveCount: 0, slots: [] }, oll: null, pll: null };
        for (const s of result.segments) {
            if (s.phase === 'f2l') {
                out.f2l.ms += s.ms;
                out.f2l.moveCount += s.moveCount;
                out.f2l.slots.push(s);
            } else if (out[s.phase] === null || out[s.phase] === undefined) {
                out[s.phase] = s;
            }
        }
        return out;
    }

    return {
        analyze, summarize, assess, FUMBLE_PAUSE_MS,
        _internal: { FACE_EDGES, FACE_CORNERS, SLOTS_BY_FACE, crossDoneOn, slotDone, ollDone, isSolved },
    };
});
