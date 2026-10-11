/* ============================================================
   CubingHQ — Cube Fights engine
   ------------------------------------------------------------
   The rules of a head-to-head fight, and nothing else: two seats,
   the same scramble, best of N, WCA inspection penalties, ties,
   penalties agreed between the players, disconnects and rematches.

   It is a pure state machine. reduce(state, action, now) returns the
   next state; tick(state, now) applies whatever the passage of time
   decides (a countdown finishing, inspection running out, a player
   gone too long). There is no DOM, no network and no clock in here —
   the caller supplies `now` — so exactly the same code runs:

     - in the browser, for two players on one device (local mode),
       where the page owns the state;
     - on the server, for online fights, where /api/fight owns the
       state and `now` is the server's clock, so neither player's
       device decides when a round starts or whether a time counts.

   Phases:
     lobby       online only: waiting for the opponent to join
     prepare     the round's scramble is shown; each player scrambles
                 their cube and marks themselves ready
     countdown   both ready: 3-2-1 to a scheduled instant (startAt)
     inspection  15s WCA inspection, from startAt, for both at once
     solving     timers running (straight here when inspection is off)
     review      both finished: times, winner, penalties, continue
     ended       someone won the match (or forfeited); rematch from here
     expired     an online room nobody joined in time

   State is plain JSON with no numeric keys and no arrays that can
   have holes, because the online copy lives in Firebase, which turns
   both into something else. normalize() puts back what Firebase
   drops (nulls, empty objects).

   Exposed as window.FightEngine, and as a CommonJS module for the
   server and the tests.
   ============================================================ */
(function (root, factory) {
    const core = (typeof module === 'object' && module.exports)
        ? require('./timer-core.js')
        : root.TimerCore;
    const api = factory(core);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FightEngine = api;
})(typeof self !== 'undefined' ? self : this, function (TimerCore) {
    'use strict';

    const SEATS = ['p1', 'p2'];
    const EVENTS = ['333', '222', '444', '555', '666', '777', '333oh', 'pyram', 'skewb', 'sq1', 'minx', 'clock'];
    const BEST_OF = [1, 3, 5, 7];

    const T = {
        COUNTDOWN_MS: 3000,
        // Online, the round is scheduled a little further out so a device
        // that hears about it a poll late still sees the whole 3-2-1.
        LEAD_MS: { local: 600, online: 1500 },
        INSPECTION_MS: TimerCore.INSPECTION_MS,
        INSPECTION_DNF_MS: TimerCore.INSPECTION_DNF_MS,
        // Network slack when the server judges a time it did not see start.
        START_TOLERANCE_MS: 1500,
        SUBMIT_TOLERANCE_MS: 2500,
        MIN_SOLVE_MS: 100,
        MAX_SOLVE_MS: 15 * 60 * 1000,
        // Online review moves on by itself so one idle player cannot hold
        // the other hostage. Locally both players are at the same screen.
        REVIEW_AUTO_MS: 20000,
        // A device checks in every few seconds. Silent this long and it
        // shows as disconnected; silent this much longer and it forfeits.
        AWAY_MS: 12000,
        GRACE_MS: 30000,
        LOBBY_TTL_MS: 10 * 60 * 1000,
        HISTORY_KEEP: 10,
    };

    const ACTIVE = ['prepare', 'countdown', 'inspection', 'solving', 'review'];

    /* ---------------- helpers ---------------- */

    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function other(seat) { return seat === 'p1' ? 'p2' : 'p1'; }
    function roundKey(n) { return 'r' + n; }
    function winsNeeded(bestOf) { return Math.floor(bestOf / 2) + 1; }

    function cleanName(name, fallback) {
        const s = String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
        return s || fallback;
    }

    function normalizeSettings(input) {
        const s = input || {};
        return {
            event: EVENTS.includes(s.event) ? s.event : '333',
            bestOf: BEST_OF.includes(Number(s.bestOf)) ? Number(s.bestOf) : 3,
            inspection: s.inspection === undefined ? true : !!s.inspection,
        };
    }

    function makePlayer(p, fallback, now) {
        return {
            name: cleanName(p && p.name, fallback),
            wcaId: (p && typeof p.wcaId === 'string' && /^\d{4}[A-Z]{4}\d{2}$/.test(p.wcaId)) ? p.wcaId : null,
            ready: false,
            seen: now,
        };
    }

    function current(s) { return s.rounds[roundKey(s.round)] || null; }

    function solveOf(round, seat) {
        return (round && round.solves && round.solves[seat]) || null;
    }

    function effective(solve) {
        if (!solve) return Infinity;
        return TimerCore.effectiveMs(solve.ms, solve.penalty);
    }

    /**
     * Who won a round: 'p1', 'p2' or 'tie'. Compared at the centisecond, as
     * the WCA records times, so 9.991 and 9.999 are the same 9.99. Two DNFs
     * are a tie.
     */
    function roundWinner(round) {
        const a = effective(solveOf(round, 'p1'));
        const b = effective(solveOf(round, 'p2'));
        const ca = a === Infinity ? Infinity : Math.floor(a / 10);
        const cb = b === Infinity ? Infinity : Math.floor(b / 10);
        if (ca === cb) return 'tie';
        return ca < cb ? 'p1' : 'p2';
    }

    /** Puts back everything Firebase drops: nulls and empty objects. */
    function normalize(state) {
        const s = state || {};
        s.settings = normalizeSettings(s.settings);
        s.players = s.players || {};
        SEATS.forEach(seat => {
            const p = s.players[seat];
            if (!p) { s.players[seat] = null; return; }
            p.ready = !!p.ready;
            if (typeof p.seen !== 'number') p.seen = 0;
            if (p.wcaId === undefined) p.wcaId = null;
        });
        s.score = s.score || {};
        SEATS.forEach(seat => { s.score[seat] = Number(s.score[seat]) || 0; });
        s.rounds = s.rounds || {};
        Object.values(s.rounds).forEach(r => {
            r.solves = r.solves || {};
            r.started = r.started || {};
            r.startPenalty = r.startPenalty || {};
            r.proposals = r.proposals || {};
            r.cont = r.cont || {};
            if (r.scramble === undefined) r.scramble = null;
            if (r.startAt === undefined) r.startAt = null;
            if (r.winner === undefined) r.winner = null;
            r.final = !!r.final;
            Object.values(r.solves).forEach(sv => {
                if (sv.ms === undefined) sv.ms = null;
                sv.penalty = TimerCore.normPenalty(sv.penalty);
                sv.auto = TimerCore.normPenalty(sv.auto);
            });
        });
        s.round = Number(s.round) || 0;
        s.match = Number(s.match) || 1;
        s.rematch = s.rematch || {};
        s.history = Array.isArray(s.history) ? s.history : [];
        if (s.result === undefined) s.result = null;
        if (s.nextScramble === undefined) s.nextScramble = null;
        if (s.expiresAt === undefined) s.expiresAt = null;
        s.seq = Number(s.seq) || 0;
        return s;
    }

    /* ---------------- transitions ---------------- */

    function startPrepare(s, now) {
        s.round += 1;
        s.rounds[roundKey(s.round)] = {
            n: s.round,
            scramble: s.nextScramble || null,
            startAt: null,
            phaseAt: now,
            solves: {}, started: {}, startPenalty: {}, proposals: {}, cont: {},
            winner: null,
            final: false,
        };
        s.nextScramble = null;
        SEATS.forEach(seat => { if (s.players[seat]) s.players[seat].ready = false; });
        s.phase = 'prepare';
    }

    function end(s, winner, reason, now) {
        s.phase = 'ended';
        s.result = { winner: winner || null, reason, at: now, match: s.match, score: clone(s.score) };
        s.rematch = {};
    }

    function enterReview(s, round, now) {
        s.phase = 'review';
        round.phaseAt = now;
        round.winner = roundWinner(round);
        round.cont = {};
    }

    function finalize(s, round, now) {
        round.final = true;
        round.winner = roundWinner(round);
        round.proposals = {};
        if (round.winner !== 'tie') s.score[round.winner] += 1;
        const need = winsNeeded(s.settings.bestOf);
        if (s.score.p1 >= need || s.score.p2 >= need) {
            end(s, s.score.p1 >= need ? 'p1' : 'p2', 'score', now);
        } else {
            startPrepare(s, now);
        }
    }

    function newMatch(s, now) {
        if (s.result) {
            s.history.push({ match: s.match, winner: s.result.winner, reason: s.result.reason, score: clone(s.score) });
            if (s.history.length > T.HISTORY_KEEP) s.history = s.history.slice(-T.HISTORY_KEEP);
        }
        s.match += 1;
        s.score = { p1: 0, p2: 0 };
        s.rounds = {};
        s.round = 0;
        s.result = null;
        s.rematch = {};
        startPrepare(s, now);
    }

    function bothSubmitted(round) {
        return SEATS.every(seat => solveOf(round, seat));
    }

    /** A player's inspection start penalty as the engine sees it. */
    function serverStartPenalty(s, round, startedAt) {
        if (!s.settings.inspection || typeof round.startAt !== 'number') return '';
        const slack = s.mode === 'online' ? T.START_TOLERANCE_MS : 0;
        return TimerCore.inspectionPenalty(startedAt - round.startAt - slack, 'wca');
    }

    /* ---------------- time ---------------- */

    function presenceOf(s, seat, now) {
        const p = s.players[seat];
        if (!p) return { here: false, away: false, awayMs: 0, graceLeft: 0 };
        if (s.mode !== 'online') return { here: true, away: false, awayMs: 0, graceLeft: T.GRACE_MS };
        const silent = now - p.seen;
        const away = silent > T.AWAY_MS;
        return {
            here: true,
            away,
            awayMs: away ? silent - T.AWAY_MS : 0,
            graceLeft: away ? Math.max(0, T.GRACE_MS - (silent - T.AWAY_MS)) : T.GRACE_MS,
            gone: silent > T.AWAY_MS + T.GRACE_MS,
        };
    }

    function tickOnce(s, now) {
        const round = current(s);

        if (s.mode === 'online') {
            if (s.phase === 'lobby' && !s.players.p2 && typeof s.expiresAt === 'number' && now > s.expiresAt) {
                s.phase = 'expired';
                s.result = { winner: null, reason: 'expired', at: now, match: s.match, score: clone(s.score) };
                return true;
            }
            if (ACTIVE.includes(s.phase) && s.players.p1 && s.players.p2) {
                const gone = SEATS.filter(seat => presenceOf(s, seat, now).gone);
                if (gone.length === 1) {
                    const seat = gone[0];
                    const nothingPlayed = s.round === 1 && s.phase === 'prepare';
                    if (nothingPlayed && seat === 'p2') {
                        // The guest wandered off before a single solve: free the
                        // seat rather than hand the host a win nobody played for.
                        if (round && round.scramble) s.nextScramble = round.scramble;
                        s.players.p2 = null;
                        s.players.p1.ready = false;
                        s.rounds = {};
                        s.round = 0;
                        s.phase = 'lobby';
                        s.expiresAt = now + T.LOBBY_TTL_MS;
                    } else if (nothingPlayed) {
                        end(s, null, 'abandoned', now);
                    } else {
                        end(s, other(seat), 'disconnect', now);
                    }
                    return true;
                }
            }
        }

        if (!round) return false;

        if (s.phase === 'countdown' && typeof round.startAt === 'number' && now >= round.startAt) {
            s.phase = s.settings.inspection ? 'inspection' : 'solving';
            round.phaseAt = round.startAt;
            return true;
        }

        if (s.phase === 'inspection' || s.phase === 'solving') {
            let changed = false;
            const slack = s.mode === 'online' ? T.START_TOLERANCE_MS : 0;
            SEATS.forEach(seat => {
                if (solveOf(round, seat)) return;
                const started = typeof round.started[seat] === 'number';
                const inspectionOut = s.settings.inspection && !started
                    && now > round.startAt + T.INSPECTION_DNF_MS + slack;
                const tooLong = now > round.startAt + T.INSPECTION_DNF_MS + T.MAX_SOLVE_MS;
                if (inspectionOut || tooLong) {
                    round.solves[seat] = { ms: null, penalty: 'DNF', auto: 'DNF', at: now, timeout: true };
                    changed = true;
                }
            });
            if (bothSubmitted(round)) { enterReview(s, round, now); return true; }
            if (s.phase === 'inspection'
                && SEATS.every(seat => typeof round.started[seat] === 'number' || solveOf(round, seat))) {
                s.phase = 'solving';
                return true;
            }
            return changed;
        }

        if (s.phase === 'review' && s.mode === 'online'
            && now >= round.phaseAt + T.REVIEW_AUTO_MS && !Object.keys(round.proposals).length) {
            finalize(s, round, now);
            return true;
        }
        return false;
    }

    /** Applies everything time alone decides. Pure: returns a new state. */
    function tick(state, now) {
        const s = normalize(clone(state));
        for (let i = 0; i < 8 && tickOnce(s, now); i++) { /* settle */ }
        return s;
    }

    /* ---------------- actions ---------------- */

    function fail(code) { return { error: code }; }

    function apply(s, action, now) {
        const type = action && action.type;
        const seat = action && action.seat;
        const round = current(s);

        if (type === 'SCRAMBLE') {
            // From whoever owns scramble generation: the server online, the
            // page locally. Never relayed from a player's request.
            const text = typeof action.scramble === 'string' ? action.scramble.trim().slice(0, 2000) : '';
            if (!text) return fail('bad_scramble');
            if (action.target === 'next') {
                if (!s.nextScramble) s.nextScramble = text;
            } else if (s.phase === 'prepare' && round && !round.scramble) {
                round.scramble = text;
            }
            return null;
        }

        if (type === 'JOIN') {
            if (s.mode !== 'online') return fail('not_online');
            if (s.phase !== 'lobby') return fail(s.players.p2 ? 'full' : 'closed');
            s.players.p2 = makePlayer(action.player, 'Player 2', now);
            s.expiresAt = null;
            startPrepare(s, now);
            return null;
        }

        if (!SEATS.includes(seat) || !s.players[seat]) return fail('not_a_player');
        const me = s.players[seat];
        if (s.mode === 'online') me.seen = now;

        switch (type) {
            case 'SEEN':
                return null;

            case 'READY': {
                if (s.phase !== 'prepare') return fail('wrong_phase');
                if (!round || !round.scramble) return fail('no_scramble');
                if (!s.players[other(seat)]) return fail('no_opponent');
                me.ready = action.ready !== false;
                if (SEATS.every(x => s.players[x] && s.players[x].ready)) {
                    s.phase = 'countdown';
                    round.phaseAt = now;
                    round.startAt = now + T.COUNTDOWN_MS + (T.LEAD_MS[s.mode] || 0);
                }
                return null;
            }

            case 'START': {
                if (s.phase !== 'inspection' && s.phase !== 'solving') return fail('wrong_phase');
                if (solveOf(round, seat)) return fail('already_done');
                if (typeof round.started[seat] === 'number') return null;
                round.started[seat] = now;
                round.startPenalty[seat] = TimerCore.worsePenalty(
                    action.penalty, serverStartPenalty(s, round, now));
                if (s.phase === 'inspection'
                    && SEATS.every(x => typeof round.started[x] === 'number' || solveOf(round, x))) {
                    s.phase = 'solving';
                }
                return null;
            }

            case 'SUBMIT': {
                if (s.phase !== 'inspection' && s.phase !== 'solving') return fail('wrong_phase');
                if (solveOf(round, seat)) return fail('already_done');
                let penalty = TimerCore.normPenalty(action.penalty);
                let ms = action.ms === null || action.ms === undefined ? null : Number(action.ms);
                if (ms !== null) {
                    if (!isFinite(ms) || ms < T.MIN_SOLVE_MS || ms > T.MAX_SOLVE_MS) return fail('bad_time');
                    ms = Math.round(ms);
                    // Nobody solves for longer than the round has existed.
                    if (s.mode === 'online' && ms > now - round.startAt + T.SUBMIT_TOLERANCE_MS) {
                        return fail('implausible');
                    }
                } else {
                    penalty = 'DNF';
                }
                let auto = round.startPenalty[seat] || '';
                if (typeof round.started[seat] !== 'number' && ms !== null) {
                    // Never told about the start: it was `ms` ago.
                    auto = serverStartPenalty(s, round, now - ms);
                    round.started[seat] = now - ms;
                }
                penalty = TimerCore.worsePenalty(penalty, auto);
                round.solves[seat] = { ms, penalty, auto, at: now };
                if (bothSubmitted(round)) enterReview(s, round, now);
                else if (s.phase === 'inspection') s.phase = 'solving';
                return null;
            }

            case 'PENALTY': {
                if (s.phase !== 'review') return fail('wrong_phase');
                const target = SEATS.includes(action.target) ? action.target : seat;
                const sv = solveOf(round, target);
                if (!sv) return fail('no_solve');
                const penalty = TimerCore.normPenalty(action.penalty);
                if (target === seat) {
                    // Your own solve: yours to call, but never below what
                    // inspection already earned it.
                    sv.penalty = TimerCore.worsePenalty(penalty, sv.auto);
                    delete round.proposals[seat];
                } else {
                    // Theirs: a proposal they accept or turn down.
                    if (TimerCore.worsePenalty(penalty, sv.auto) === sv.penalty) {
                        delete round.proposals[target];
                    } else {
                        round.proposals[target] = { penalty, by: seat };
                    }
                }
                round.winner = roundWinner(round);
                round.cont = {};
                round.phaseAt = now;
                return null;
            }

            case 'PENALTY_REPLY': {
                if (s.phase !== 'review') return fail('wrong_phase');
                const prop = round.proposals[seat];
                if (!prop) return fail('no_proposal');
                if (action.accept) {
                    const sv = solveOf(round, seat);
                    sv.penalty = TimerCore.worsePenalty(prop.penalty, sv.auto);
                }
                delete round.proposals[seat];
                round.winner = roundWinner(round);
                round.cont = {};
                round.phaseAt = now;
                return null;
            }

            case 'CONTINUE': {
                if (s.phase !== 'review') return fail('wrong_phase');
                if (round.proposals[seat]) return fail('answer_proposal');
                // Locally one button moves both players on.
                const who = action.both && s.mode === 'local' ? SEATS : [seat];
                who.forEach(x => { round.cont[x] = true; });
                if (SEATS.every(x => round.cont[x]) && !Object.keys(round.proposals).length) {
                    finalize(s, round, now);
                }
                return null;
            }

            case 'REMATCH': {
                if (s.phase !== 'ended') return fail('wrong_phase');
                if (!s.result || ['expired', 'abandoned', 'left'].includes(s.result.reason)
                    || !s.players.p1 || !s.players.p2 || s.players.p1.left || s.players.p2.left) {
                    return fail('no_rematch');
                }
                const who = action.both && s.mode === 'local' ? SEATS : [seat];
                who.forEach(x => { s.rematch[x] = true; });
                if (SEATS.every(x => s.rematch[x])) newMatch(s, now);
                return null;
            }

            case 'LEAVE': {
                if (s.phase === 'ended' || s.phase === 'expired') {
                    me.left = true;
                    s.rematch = {};
                    return null;
                }
                if (s.phase === 'lobby') {
                    s.phase = 'expired';
                    s.result = { winner: null, reason: 'host_left', at: now, match: s.match, score: clone(s.score) };
                    return null;
                }
                me.left = true;
                const nothingPlayed = s.round === 1 && s.phase === 'prepare';
                end(s, nothingPlayed ? null : other(seat), nothingPlayed ? 'abandoned' : 'left', now);
                return null;
            }

            default:
                return fail('unknown_action');
        }
    }

    /**
     * The one entry point that changes a fight.
     * Returns { state, error }: on an error the state is the input, ticked.
     */
    function reduce(state, action, now) {
        const s = tick(state, now);
        const before = JSON.stringify(s);
        const res = apply(s, action || {}, now);
        if (res && res.error) return { state: normalize(JSON.parse(before)), error: res.error };
        for (let i = 0; i < 8 && tickOnce(s, now); i++) { /* settle */ }
        s.updatedAt = now;
        s.seq += 1;
        return { state: s, error: null };
    }

    /**
     * A new fight.
     *   mode     'local' | 'online'
     *   host     { name, wcaId }   seat p1
     *   guest    { name }          seat p2, local only (online joins later)
     */
    function create({ mode, settings, host, guest, now }) {
        const m = mode === 'online' ? 'online' : 'local';
        const s = normalize({
            v: 1,
            mode: m,
            settings: normalizeSettings(settings),
            phase: m === 'online' ? 'lobby' : 'prepare',
            createdAt: now,
            updatedAt: now,
            expiresAt: m === 'online' ? now + T.LOBBY_TTL_MS : null,
            players: {
                p1: makePlayer(host, 'Player 1', now),
                p2: m === 'local' ? makePlayer(guest, 'Player 2', now) : null,
            },
            round: 0,
            match: 1,
        });
        if (m === 'local') startPrepare(s, now);
        return s;
    }

    /** What the round/scramble queue still needs filling. */
    function needsScramble(state) {
        const s = state;
        if (!s || s.phase === 'ended' || s.phase === 'expired') return { current: false, next: false };
        const round = current(s);
        return {
            current: s.phase === 'prepare' && !!round && !round.scramble,
            next: !s.nextScramble,
        };
    }

    /** Milliseconds until the round starts, or null outside a countdown. */
    function countdownLeft(state, now) {
        const round = current(state);
        if (state.phase !== 'countdown' || !round || typeof round.startAt !== 'number') return null;
        return Math.max(0, round.startAt - now);
    }

    return {
        SEATS,
        EVENTS,
        BEST_OF,
        TIMING: T,
        create,
        reduce,
        tick,
        normalize,
        needsScramble,
        roundWinner,
        winsNeeded,
        effective,
        presence: (state, seat, now) => presenceOf(normalize(clone(state)), seat, now),
        countdownLeft,
        current: (state) => current(state),
        roundKey,
        other,
        normalizeSettings,
        cleanName,
    };
});
