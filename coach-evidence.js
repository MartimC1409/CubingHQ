/* ============================================================
   CubingHQ Coach — evidence collection
   ------------------------------------------------------------
   Assembles what the Coach is allowed to treat as fact.

   Timing data gives statistics. Move-level data from a Bluetooth
   smart cube gives genuine observations — when moves happened, so
   where the gaps fell and how fast the turning was. solve-analysis.js
   already computes that per solve; this listens for it and keeps a
   rolling buffer.

   The categories emitted here are deliberately narrow. A pause before
   the last layer is a measured fact. Calling that pause "poor PLL
   recognition" is a hypothesis, and the server keeps recognition in
   the unknown list so the Coach has to label it as one.

   Exposed as window.CoachEvidence.
   ============================================================ */
(function () {
    'use strict';

    const KEY = 'chq_coach_observations_v1';
    const MAX_SOLVES = 40;          // rolling window of analysed solves
    const PAUSE_MS = 500;           // matches SolveAnalysis.FUMBLE_PAUSE_MS

    let buffer = [];

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (Array.isArray(parsed)) buffer = parsed.slice(-MAX_SOLVES);
        } catch (e) { buffer = []; }
    }

    function persist() {
        try { localStorage.setItem(KEY, JSON.stringify(buffer.slice(-MAX_SOLVES))); }
        catch (e) { /* observations are a bonus; never break a solve over them */ }
    }

    const PHASE_LABEL = { cross: 'cross', f2l: 'F2L', oll: 'OLL', pll: 'PLL', extra: 'after the solve' };
    const fmtS = (ms) => (ms / 1000).toFixed(2);

    /**
     * Turns one CFOP breakdown into observations.
     * Every item states what was measured and in which phase, so the
     * model can quote it without needing to interpret raw segments.
     */
    function observationsFor(result) {
        const out = [];
        if (!result || !Array.isArray(result.segments) || !result.segments.length) return out;

        const at = new Date().toISOString();
        const phaseOf = (seg) => PHASE_LABEL[seg.phase] || seg.phase;
        const where = (seg) => seg.phase === 'f2l' && seg.slot
            ? `F2L pair ${seg.slot}` : phaseOf(seg);

        // Phase timings — measured directly from the move log.
        const summary = window.SolveAnalysis
            ? window.SolveAnalysis.summarize(result) : null;
        if (summary) {
            const parts = [];
            if (summary.cross) parts.push(`cross ${fmtS(summary.cross.ms)}s`);
            if (summary.f2l && summary.f2l.ms) parts.push(`F2L ${fmtS(summary.f2l.ms)}s`);
            if (summary.oll) parts.push(`OLL ${fmtS(summary.oll.ms)}s`);
            if (summary.pll) parts.push(`PLL ${fmtS(summary.pll.ms)}s`);
            if (parts.length) {
                out.push({
                    category: 'phase_timing',
                    observation: `Phase split: ${parts.join(', ')} (total ${fmtS(result.totalMs)}s, ${result.moveCount} moves).`,
                    confidence: 1,
                    evidence: 'Timed from the cube\'s own move log.',
                    at,
                });
            }
        }

        // Pauses — the single most useful thing move data adds, because
        // solve times alone can never say where the time went.
        for (const seg of result.segments) {
            if (seg.longestPause && seg.longestPause > PAUSE_MS) {
                out.push({
                    category: 'pauses',
                    observation: `A ${fmtS(seg.longestPause)}s gap between moves during ${where(seg)}.`,
                    confidence: 1,
                    evidence: `Measured between consecutive moves; anything over ${PAUSE_MS}ms is longer than normal execution spacing.`,
                    at,
                });
            }
        }

        // Undone moves — measured, not inferred.
        for (const seg of result.segments) {
            if (seg.rating === 'blunder' && seg.undos) {
                out.push({
                    category: 'wasted_moves',
                    observation: `${seg.undos} move${seg.undos > 1 ? 's' : ''} made and immediately undone during ${where(seg)}.`,
                    confidence: 1,
                    evidence: 'A move followed by its inverse in the move log.',
                    at,
                });
            }
        }

        // Turn rate per phase — knowable only with move-level data.
        const tps = result.segments
            .filter(s => s.tps > 0 && s.moveCount >= 4)
            .map(s => `${where(s)} ${s.tps}`);
        if (tps.length) {
            out.push({
                category: 'tps',
                observation: `Turns per second by phase: ${tps.join(', ')}.`,
                confidence: 1,
                evidence: 'Move count divided by elapsed time within each phase.',
                at,
            });
        }

        if (result.crossFace) {
            out.push({
                category: 'phase_timing',
                observation: `Cross solved on the ${result.crossFace} face.`,
                confidence: 1,
                evidence: 'Detected from the cube state, not assumed.',
                at,
            });
        }

        return out;
    }

    /**
     * Stores what an analysed solve video showed.
     *
     * Kept in the same buffer as smart-cube observations, because from
     * the assessment's point of view they are the same kind of thing: a
     * measured fact about a specific solve rather than a statistic. The
     * `source` tag survives so the Coach can say where it saw something —
     * "in your video" and "from your cube's move log" are different
     * claims and a reader is entitled to know which one they are getting.
     */
    function recordVideo(observations) {
        if (!Array.isArray(observations) || !observations.length) return 0;

        const at = new Date().toISOString();
        const items = observations
            // A model that ignored the schema and labelled a guess about
            // recognition as "observed" must not have it treated as fact.
            .filter(o => o && o.category && o.observation)
            .map(o => ({
                category: String(o.category),
                observation: String(o.observation),
                confidence: typeof o.confidence === 'number' ? o.confidence : 0.8,
                evidence: o.evidence || 'Seen in an uploaded solve video.',
                evidenceType: o.evidenceType === 'observed' ? 'observed' : 'inferred',
                source: 'video',
                at,
            }));
        if (!items.length) return 0;

        buffer.push({ at: Date.now(), source: 'video', complete: true, items });
        if (buffer.length > MAX_SOLVES) buffer = buffer.slice(-MAX_SOLVES);
        persist();
        document.dispatchEvent(new CustomEvent('coach-evidence-added', {
            detail: { count: buffer.length, source: 'video' },
        }));
        return items.length;
    }

    function record(result) {
        const items = observationsFor(result);
        if (!items.length) return;
        buffer.push({ at: Date.now(), complete: !!result.complete, items });
        if (buffer.length > MAX_SOLVES) buffer = buffer.slice(-MAX_SOLVES);
        persist();
        document.dispatchEvent(new CustomEvent('coach-evidence-added', {
            detail: { count: buffer.length },
        }));
    }

    /**
     * Flattened observations for the API payload, newest first.
     * Aggregated where repetition is the point: "a pause in 7 of 12
     * analysed solves" is a stronger and more honest statement than
     * seven separate one-solve notes.
     */
    function getObservations(limit = 40) {
        if (!buffer.length) return [];

        const solves = buffer.slice(-12);
        const byCategory = new Map();
        for (const entry of solves) {
            for (const item of entry.items) {
                if (!byCategory.has(item.category)) byCategory.set(item.category, []);
                byCategory.get(item.category).push(item);
            }
        }

        const out = [];

        // The "in N of the last M solves" summary only makes sense for
        // smart-cube data, where every solve was tracked the same way and
        // the denominator means something. A video is one clip: counting
        // it into that ratio would state a frequency nobody measured, and
        // attributing it to a move log would credit hardware the athlete
        // may not even own.
        const cubeSolves = solves.filter(s => s.source !== 'video');
        const cubePauses = cubeSolves.filter(s => s.items.some(i => i.category === 'pauses')).length;
        if (cubePauses) {
            out.push({
                category: 'pauses',
                observation: `Gaps over ${PAUSE_MS}ms between moves appeared in ${cubePauses} of the last ${cubeSolves.length} tracked solves.`,
                confidence: 1,
                evidence: 'Aggregated from smart-cube move logs.',
                evidenceType: 'observed',
                source: 'cube',
            });
        }

        // Everything else passes through carrying its own source and
        // evidenceType, so the server can attribute each claim correctly.
        for (const [, items] of byCategory) out.push(...items.slice(-6));

        return out.slice(0, limit);
    }

    const count = () => buffer.length;
    const hasData = () => buffer.length > 0;

    function clear() {
        buffer = [];
        try { localStorage.removeItem(KEY); } catch (e) { }
        document.dispatchEvent(new CustomEvent('coach-evidence-added', { detail: { count: 0 } }));
    }

    load();
    // smartcube.js broadcasts this after replaying each finished solve.
    document.addEventListener('cs-solve-analyzed', (e) => {
        try { record(e.detail); } catch (err) { console.warn('[Coach] evidence capture failed', err); }
    });

    window.CoachEvidence = {
        getObservations, count, hasData, clear, recordVideo,
        _internal: { observationsFor, PAUSE_MS },
    };
})();
