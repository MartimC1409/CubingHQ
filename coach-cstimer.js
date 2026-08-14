/* ============================================================
   CubingHQ Coach — session import
   ------------------------------------------------------------
   Parses a solve history into CubingHQ's own solve shape so the
   Coach analyses real data instead of self-reported averages.

   Handles four sources, detected by sniffing rather than by file
   extension (people rename exports):

     1. csTimer JSON export      — the main path
     2. CubingHQ timer export    — our own backup format
     3. csTimer CSV export       — semicolon or comma separated
     4. Plain times, one/line    — last-resort fallback

   Pure logic — no DOM, no network. Testable in plain Node.

   ---- On the csTimer time/penalty ambiguity -------------------
   A csTimer solve is [[penalty, time], scramble, comment, date].
   Whether `time` is the raw time (with `penalty` still to be added)
   or already includes the penalty is genuinely inconsistent between
   third-party parsers. We treat it as RAW and add the penalty, which
   matches csTimer's own CSV output. PENALTY_IS_ADDITIVE below is the
   single switch if a real export ever proves otherwise — and the
   import UI shows a preview of the parsed numbers before anything is
   saved, so a wrong reading is visible rather than silent.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CoachImport = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PENALTY_IS_ADDITIVE = true;

    // csTimer's scramble-type codes -> CubingHQ EVENT_INFO keys.
    // Matched longest-prefix-first, because csTimer has many variants
    // per puzzle (444wca, 444m, 444o ...).
    const SCRTYPE_MAP = [
        ['333oh', '333oh'], ['333ni', '333'], ['333fm', '333'], ['333mbf', '333'],
        ['333ft', '333'], ['333bf', '333'], ['333', '333'],
        ['222', '222'],
        ['444bf', '444'], ['444', '444'],
        ['555bf', '555'], ['555', '555'],
        ['666', '666'], ['777', '777'],
        ['pyr', 'pyram'],
        ['skb', 'skewb'],
        ['sq1', 'sq1'], ['sqrs', 'sq1'],
        ['mgm', 'minx'], ['minx', 'minx'],
        ['clk', 'clock'],
    ];

    const VALID_EVENTS = ['333', '222', '444', '555', '666', '777',
        '333oh', 'pyram', 'skewb', 'sq1', 'minx', 'clock'];

    function eventFromScrType(scrType) {
        if (!scrType || typeof scrType !== 'string') return null;
        const s = scrType.toLowerCase();
        for (const [prefix, ev] of SCRTYPE_MAP) {
            if (s.startsWith(prefix)) return ev;
        }
        return null;
    }

    // Guess the event from a session name when csTimer gave us no scrType.
    function eventFromName(name) {
        if (!name) return null;
        const n = String(name).toLowerCase();
        if (/\boh\b|one.?hand/.test(n)) return '333oh';
        if (/2\s*x\s*2|\b222\b/.test(n)) return '222';
        if (/4\s*x\s*4|\b444\b/.test(n)) return '444';
        if (/5\s*x\s*5|\b555\b/.test(n)) return '555';
        if (/6\s*x\s*6|\b666\b/.test(n)) return '666';
        if (/7\s*x\s*7|\b777\b/.test(n)) return '777';
        if (/pyra/.test(n)) return 'pyram';
        if (/skewb/.test(n)) return 'skewb';
        if (/sq\s*-?\s*1|square/.test(n)) return 'sq1';
        if (/mega|minx/.test(n)) return 'minx';
        if (/clock/.test(n)) return 'clock';
        if (/3\s*x\s*3|\b333\b/.test(n)) return '333';
        return null;
    }

    class ImportError extends Error {
        constructor(code, message) {
            super(message);
            this.name = 'ImportError';
            this.code = code;   // stable key so the UI can translate
        }
    }

    let _seq = 0;
    function uid() {
        _seq += 1;
        return 'imp_' + Date.now().toString(36) + '_' + _seq.toString(36) +
            Math.random().toString(36).slice(2, 6);
    }

    // ---------- normalisation -------------------------------------
    // Everything below funnels into this shape, identical to the one
    // timer.js writes, so imported solves are indistinguishable from
    // solves done on the site.
    function makeSolve(timeMs, penalty, scramble, timestamp) {
        return {
            id: uid(),
            time: Math.round(timeMs),
            scramble: scramble || '',
            penalty: penalty || '',
            timestamp: timestamp || 0,
        };
    }

    // Guards against a column-order mix-up putting a unix timestamp (~1.7e12)
    // in the time column. Two hours is far above any real timed solve while
    // still being many orders of magnitude below a date, and it leaves room
    // for slow big-cube and beginner solves rather than cutting them at 1h.
    const PLAUSIBLE_MAX_MS = 2 * 60 * 60 * 1000;
    function plausible(ms) {
        return typeof ms === 'number' && isFinite(ms) && ms > 0 && ms <= PLAUSIBLE_MAX_MS;
    }

    // ---------- 1. csTimer JSON -----------------------------------
    function looksLikeCsTimer(obj) {
        if (!obj || typeof obj !== 'object') return false;
        return Object.keys(obj).some(k => /^session\d+$/.test(k));
    }

    function parseSessionMeta(obj) {
        // properties.sessionData is a JSON *string* mapping "1" -> {name, opt:{scrType}}
        const meta = {};
        try {
            const raw = obj.properties && obj.properties.sessionData;
            if (!raw) return meta;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            for (const key of Object.keys(parsed || {})) {
                const entry = parsed[key] || {};
                meta[key] = {
                    name: entry.name || null,
                    scrType: (entry.opt && entry.opt.scrType) || null,
                };
            }
        } catch (e) {
            // Corrupt sessionData is not fatal — we fall back to name guessing.
        }
        return meta;
    }

    function parseCsTimerSolve(entry) {
        if (!Array.isArray(entry) || entry.length < 2) return null;
        const timePair = entry[0];
        if (!Array.isArray(timePair) || timePair.length < 2) return null;

        const rawPenalty = Number(timePair[0]);
        const rawTime = Number(timePair[1]);
        if (!isFinite(rawTime)) return null;

        let penalty = '';
        let ms = rawTime;
        if (rawPenalty === -1) {
            penalty = 'DNF';
        } else if (rawPenalty === 2000) {
            penalty = '+2';
            if (PENALTY_IS_ADDITIVE) ms = rawTime + 2000;
        } else if (rawPenalty > 0 && PENALTY_IS_ADDITIVE) {
            // Unexpected non-zero penalty; add it and mark as +2 so the
            // time shown is at least not understated.
            penalty = '+2';
            ms = rawTime + rawPenalty;
        }

        // timer.js stores the RAW time and applies +2 at read time, so
        // hand back the raw value and let the penalty flag do the work.
        if (penalty === '+2' && PENALTY_IS_ADDITIVE) ms = rawTime;

        if (!plausible(ms)) return null;

        const scramble = typeof entry[1] === 'string' ? entry[1] : '';
        // Date is unix SECONDS in csTimer; ours are milliseconds.
        const rawDate = entry.length >= 4 ? Number(entry[3]) : 0;
        const timestamp = isFinite(rawDate) && rawDate > 0 ? rawDate * 1000 : 0;

        return makeSolve(ms, penalty, scramble, timestamp);
    }

    function parseCsTimerJSON(obj) {
        const meta = parseSessionMeta(obj);
        const sessions = [];

        const keys = Object.keys(obj)
            .filter(k => /^session\d+$/.test(k))
            .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));

        for (const key of keys) {
            const list = obj[key];
            if (!Array.isArray(list) || list.length === 0) continue;

            const idx = key.slice(7);
            const m = meta[idx] || {};
            const name = m.name || ('Session ' + idx);
            const event = eventFromScrType(m.scrType) || eventFromName(name) || '333';

            const solves = [];
            let skipped = 0;
            for (const entry of list) {
                const s = parseCsTimerSolve(entry);
                if (s) solves.push(s); else skipped += 1;
            }
            if (solves.length === 0) continue;

            // csTimer stores oldest-first; make that explicit rather than
            // assuming it, because every rolling average depends on order.
            solves.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            sessions.push({ name, event, solves, skipped });
        }

        if (sessions.length === 0) {
            throw new ImportError('empty', 'The file parsed, but contained no usable solves.');
        }
        return { source: 'cstimer', sessions };
    }

    // ---------- 2. CubingHQ's own export --------------------------
    function looksLikeCubingHQ(obj) {
        return !!(obj && typeof obj === 'object' && obj.sessions &&
            typeof obj.sessions === 'object' && !Array.isArray(obj.sessions));
    }

    function parseCubingHQ(obj) {
        const order = Array.isArray(obj.sessionOrder) && obj.sessionOrder.length
            ? obj.sessionOrder
            : Object.keys(obj.sessions);
        const sessions = [];
        for (const id of order) {
            const sess = obj.sessions[id];
            if (!sess || !Array.isArray(sess.solves) || sess.solves.length === 0) continue;
            const solves = sess.solves
                .filter(s => s && plausible(Number(s.time)))
                .map(s => makeSolve(
                    Number(s.time),
                    s.penalty === 'DNF' || s.penalty === '+2' ? s.penalty : '',
                    s.scramble,
                    Number(s.timestamp) || 0
                ));
            if (!solves.length) continue;
            sessions.push({
                name: sess.name || 'Session',
                event: VALID_EVENTS.includes(sess.event) ? sess.event : '333',
                solves,
                skipped: sess.solves.length - solves.length,
            });
        }
        if (!sessions.length) throw new ImportError('empty', 'No usable solves in this backup.');
        return { source: 'cubinghq', sessions };
    }

    // ---------- 3. CSV --------------------------------------------
    // csTimer's CSV: "No.";"Time";"Comment";"Scramble";"Date";"P.1"
    // Also tolerates comma separation and a missing header row.
    function splitCsvLine(line, sep) {
        const out = [];
        let cur = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === sep && !inQuotes) {
                out.push(cur); cur = '';
            } else cur += ch;
        }
        out.push(cur);
        return out.map(c => c.trim());
    }

    // "12.34", "1:02.34", "DNF(11.20)", "11.20+", "1:02:03.45"
    function parseTimeToken(tok) {
        if (typeof tok !== 'string') return null;
        let t = tok.trim();
        if (!t) return null;
        let penalty = '';

        const dnfMatch = /^DNF\s*\(([^)]+)\)$/i.exec(t);
        if (dnfMatch) { penalty = 'DNF'; t = dnfMatch[1]; }
        else if (/^DNF$/i.test(t)) return { ms: 0, penalty: 'DNF' };
        else if (/^DNS$/i.test(t)) return null;

        // Parenthesised best/worst markers in an average listing.
        const paren = /^\(([^)]+)\)$/.exec(t);
        if (paren) t = paren[1];

        if (/\+$/.test(t)) { penalty = penalty || '+2'; t = t.slice(0, -1); }
        if (/\[.*\]$/.test(t)) t = t.replace(/\[.*\]$/, '').trim();

        const parts = t.split(':').map(p => p.trim());
        if (parts.some(p => !/^\d*\.?\d+$/.test(p))) return null;

        let ms = 0;
        if (parts.length === 1) ms = parseFloat(parts[0]) * 1000;
        else if (parts.length === 2) ms = (parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000;
        else if (parts.length === 3) ms = (parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])) * 1000;
        else return null;

        if (!isFinite(ms)) return null;
        // A +2 shown in a listing already includes the two seconds; store raw.
        if (penalty === '+2') ms -= 2000;
        if (penalty !== 'DNF' && !plausible(ms)) return null;
        return { ms, penalty };
    }

    function parseCSV(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) throw new ImportError('empty', 'The file is empty.');

        const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
        let header = null, startIdx = 0;
        const firstCells = splitCsvLine(lines[0], sep).map(c => c.replace(/^"|"$/g, '').toLowerCase());
        if (firstCells.some(c => c === 'time' || c === 'time(s)' || c === 'time(ms)')) {
            header = firstCells;
            startIdx = 1;
        }

        const timeIdx = header ? header.findIndex(c => c.startsWith('time')) : 1;
        const scrIdx = header ? header.findIndex(c => c.startsWith('scramble')) : 3;
        const dateIdx = header ? header.findIndex(c => c.startsWith('date')) : 4;
        const isMs = header && header[timeIdx] === 'time(ms)';

        const solves = [];
        let skipped = 0;
        for (let i = startIdx; i < lines.length; i++) {
            const cells = splitCsvLine(lines[i], sep).map(c => c.replace(/^"|"$/g, ''));
            const rawTime = cells[timeIdx >= 0 ? timeIdx : 1];
            let parsed;
            if (isMs && /^\d+$/.test((rawTime || '').trim())) {
                parsed = { ms: parseInt(rawTime, 10), penalty: '' };
                if (!plausible(parsed.ms)) parsed = null;
            } else {
                parsed = parseTimeToken(rawTime);
            }
            if (!parsed) { skipped += 1; continue; }

            // A trailing penalty column ("P.1") of 2000 / -1 overrides.
            const pen = cells[cells.length - 1];
            let penalty = parsed.penalty;
            if (pen === '-1') penalty = 'DNF';
            else if (pen === '2000' && penalty !== 'DNF') penalty = '+2';

            const ts = dateIdx >= 0 && cells[dateIdx] ? Date.parse(cells[dateIdx]) : 0;
            solves.push(makeSolve(parsed.ms, penalty,
                scrIdx >= 0 ? cells[scrIdx] : '', isFinite(ts) ? ts : 0));
        }

        if (!solves.length) throw new ImportError('unsupported', 'No solve times found in this file.');
        return {
            source: 'csv',
            sessions: [{ name: 'Imported session', event: '333', solves, skipped }],
        };
    }

    // ---------- 4. Plain times ------------------------------------
    function parsePlain(text) {
        const solves = [];
        let skipped = 0;
        for (const line of text.split(/\r?\n/)) {
            let t = line.trim();
            if (!t) continue;
            // Strip a leading "12." index used by csTimer's text export.
            t = t.replace(/^\d+\.\s+/, '');
            // Keep only the first whitespace-delimited token (the time);
            // anything after it is usually the scramble.
            const firstSpace = t.search(/\s/);
            const timeTok = firstSpace === -1 ? t : t.slice(0, firstSpace);
            const rest = firstSpace === -1 ? '' : t.slice(firstSpace).trim();
            const parsed = parseTimeToken(timeTok);
            if (!parsed) { skipped += 1; continue; }
            solves.push(makeSolve(parsed.ms, parsed.penalty, rest, 0));
        }
        if (solves.length < 3) {
            throw new ImportError('unsupported',
                "This doesn't look like a supported export. Try exporting your session from csTimer again.");
        }
        return {
            source: 'plain',
            sessions: [{ name: 'Imported session', event: '333', solves, skipped }],
        };
    }

    // ---------- entry point ---------------------------------------
    /**
     * @param {string} text raw file contents
     * @returns {{source:string, sessions:Array<{name,event,solves,skipped}>}}
     * @throws {ImportError} with a stable `.code`: empty | unsupported | malformed
     */
    function parse(text) {
        if (typeof text !== 'string' || !text.trim()) {
            throw new ImportError('empty', 'The file is empty.');
        }
        const trimmed = text.trim();

        if (trimmed[0] === '{' || trimmed[0] === '[') {
            let obj;
            try {
                obj = JSON.parse(trimmed);
            } catch (e) {
                throw new ImportError('malformed',
                    "This file looks like JSON but couldn't be read. It may be incomplete.");
            }
            if (looksLikeCsTimer(obj)) return parseCsTimerJSON(obj);
            if (looksLikeCubingHQ(obj)) return parseCubingHQ(obj);
            throw new ImportError('unsupported',
                "That JSON file isn't a csTimer export. In csTimer, use Export → Export to file.");
        }

        if (/[;,]/.test(trimmed.split(/\r?\n/)[0])) {
            try { return parseCSV(trimmed); } catch (e) {
                if (e.code === 'unsupported') return parsePlain(trimmed);
                throw e;
            }
        }
        return parsePlain(trimmed);
    }

    /** Drops solves already present in `existing` (same time + timestamp). */
    function dedupe(solves, existing) {
        if (!existing || !existing.length) return { solves, removed: 0 };
        const seen = new Set(existing.map(s => `${s.time}|${s.timestamp || 0}`));
        const out = solves.filter(s => !seen.has(`${s.time}|${s.timestamp || 0}`));
        return { solves: out, removed: solves.length - out.length };
    }

    return {
        parse, dedupe, ImportError,
        eventFromScrType, eventFromName, parseTimeToken,
        VALID_EVENTS,
        _internal: { parseCsTimerSolve, parseCSV, parsePlain, PENALTY_IS_ADDITIVE },
    };
});
