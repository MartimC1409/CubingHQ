/* Tests fight-engine.js — the rules both Cube Fights modes share.

   Each test drives a fight through the same reduce()/tick() the page
   (local mode) and /api/fight (online mode) call, with time passed in
   explicitly, so a 15-second inspection or a 30-second disconnect grace
   costs nothing to test.

   Run: node scripts/test_fight_engine.js */

'use strict';

const E = require('../fight-engine.js');
const T = E.TIMING;

let pass = 0, fail = 0;
function eq(label, got, want) {
    if (Object.is(got, want)) pass++;
    else { fail++; console.error(`FAIL ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

/** A fight plus a clock, with shorthand for the common actions. */
function fight(opts = {}) {
    let now = 1_000_000;
    let s = E.create(Object.assign({
        mode: 'local',
        settings: { event: '333', bestOf: 3, inspection: false },
        host: { name: 'Ana' }, guest: { name: 'Bea' },
        now,
    }, opts));
    const f = {
        get s() { return s; },
        get now() { return now; },
        set(state) { s = state; },
        wait(ms) { now += ms; s = E.tick(s, now); return f; },
        act(action) {
            const r = E.reduce(s, action, now);
            s = r.state;
            f.lastError = r.error;
            return r.error;
        },
        scramble(text = 'R U R\' U\'') { return f.act({ type: 'SCRAMBLE', scramble: text }); },
        readyBoth() { f.act({ type: 'READY', seat: 'p1' }); f.act({ type: 'READY', seat: 'p2' }); },
        /** Scramble, both ready, count down to the start. */
        startRound() {
            if (E.needsScramble(s).current) f.scramble(`scr-${s.round}`);
            f.readyBoth();
            const left = E.countdownLeft(s, now);
            f.wait(left);
            return f;
        },
        submit(seat, ms, penalty = '') { return f.act({ type: 'SUBMIT', seat, ms, penalty }); },
        continueBoth() { return f.act({ type: 'CONTINUE', seat: 'p1', both: true }); },
        round() { return E.current(s); },
    };
    return f;
}

/* ---- settings ---------------------------------------------------- */
eq('unknown event falls back to 3x3', E.normalizeSettings({ event: 'nope' }).event, '333');
eq('best of 4 is not a thing', E.normalizeSettings({ bestOf: 4 }).bestOf, 3);
eq('inspection defaults on', E.normalizeSettings({}).inspection, true);
eq('best of 3 needs 2 wins', E.winsNeeded(3), 2);
eq('best of 7 needs 4', E.winsNeeded(7), 4);
eq('best of 1 needs 1', E.winsNeeded(1), 1);

/* ---- a full local best-of-3 -------------------------------------- */
let f = fight();
eq('local starts in prepare', f.s.phase, 'prepare');
eq('round 1', f.s.round, 1);
ok('it asks for a scramble', E.needsScramble(f.s).current);
eq('ready without a scramble is refused', f.act({ type: 'READY', seat: 'p1' }), 'no_scramble');
f.scramble('F R U');
eq('the scramble is the round\'s', f.round().scramble, 'F R U');
f.act({ type: 'READY', seat: 'p1' });
eq('one ready is not enough', f.s.phase, 'prepare');
f.act({ type: 'READY', seat: 'p1', ready: false });
eq('ready can be taken back', f.s.players.p1.ready, false);
f.readyBoth();
eq('both ready: countdown', f.s.phase, 'countdown');
const left = E.countdownLeft(f.s, f.now);
eq('a 3s countdown plus the local lead', left, T.COUNTDOWN_MS + T.LEAD_MS.local);
f.wait(left - 1);
eq('still counting a millisecond before', f.s.phase, 'countdown');
f.wait(1);
eq('no inspection: straight to solving', f.s.phase, 'solving');
eq('a time before the round started is refused', f.submit('p1', 50), 'bad_time');
f.wait(9000);
f.submit('p1', 8000);
eq('one finished: still solving', f.s.phase, 'solving');
f.wait(1500);
f.submit('p2', 9500);
eq('both finished: review', f.s.phase, 'review');
eq('provisional winner shown', f.round().winner, 'p1');
eq('score not counted until both continue', f.s.score.p1, 0);
f.continueBoth();
eq('round 1 to Ana', f.s.score.p1, 1);
eq('round 2 begins', f.s.round, 2);
eq('in prepare again', f.s.phase, 'prepare');
eq('ready flags reset', f.s.players.p1.ready, false);

f.startRound(); f.wait(10000);
f.submit('p1', 10000); f.submit('p2', 9000); f.continueBoth();
eq('round 2 to Bea', f.s.score.p2, 1);
f.startRound(); f.wait(10000);
f.submit('p1', 7000); f.submit('p2', 7500); f.continueBoth();
eq('match over', f.s.phase, 'ended');
eq('Ana wins', f.s.result.winner, 'p1');
eq('by score', f.s.result.reason, 'score');
eq('2–1', `${f.s.result.score.p1}-${f.s.result.score.p2}`, '2-1');

/* ---- rematch ------------------------------------------------------ */
f.act({ type: 'REMATCH', seat: 'p1', both: true });
eq('rematch starts a new match', f.s.match, 2);
eq('scores reset', f.s.score.p1 + f.s.score.p2, 0);
eq('back to round 1', f.s.round, 1);
eq('the old match is kept', f.s.history.length, 1);
eq('...with its winner', f.s.history[0].winner, 'p1');

/* ---- ties ---------------------------------------------------------- */
f = fight({ settings: { bestOf: 1, inspection: false } });
f.startRound(); f.wait(9000);
f.submit('p1', 8001); f.submit('p2', 8009);
eq('same centisecond is a tie', f.round().winner, 'tie');
f.continueBoth();
eq('a tie scores nobody', f.s.score.p1 + f.s.score.p2, 0);
eq('and the round is replayed', f.s.round, 2);
eq('best of 1 is still on', f.s.phase, 'prepare');
f.startRound(); f.wait(9000);
f.submit('p1', null, 'DNF'); f.submit('p2', null, 'DNF');
eq('two DNFs tie', f.round().winner, 'tie');
f.continueBoth();
f.startRound(); f.wait(9000);
f.submit('p1', 9000, '+2'); f.submit('p2', 10500);
eq('+2 counts: 11.00 loses to 10.50', f.round().winner, 'p2');
f.continueBoth();
eq('best of 1 decided', f.s.result.winner, 'p2');

/* ---- inspection penalties ----------------------------------------- */
f = fight({ settings: { bestOf: 3, inspection: true } });
f.startRound();
eq('inspection on: inspection phase', f.s.phase, 'inspection');
f.wait(14000);
f.act({ type: 'START', seat: 'p2' });
eq('one started: still inspection', f.s.phase, 'inspection');
eq('a start at 14s is clean', f.round().startPenalty.p2, '');
f.wait(1800);
f.act({ type: 'START', seat: 'p1' });
eq('a start at 15.8s earns +2', f.round().startPenalty.p1, '+2');
eq('both started: solving', f.s.phase, 'solving');
f.wait(9000);
f.submit('p1', 9500, '');
eq('the client cannot drop the +2', f.round().solves.p1.penalty, '+2');
f.submit('p2', 9600);
eq('9.50+2 loses to 9.60', f.round().winner, 'p2');

// Never starting is a DNF at 17s.
f = fight({ settings: { bestOf: 3, inspection: true } });
f.startRound();
f.wait(5000); f.act({ type: 'START', seat: 'p1' });
f.wait(12000);
eq('p2 still inspecting at 17s exactly', f.round().solves.p2, undefined);
f.wait(1);
eq('p2 DNFs after 17s', f.round().solves.p2 && f.round().solves.p2.penalty, 'DNF');
eq('marked as a timeout', f.round().solves.p2.timeout, true);
f.wait(3000); f.submit('p1', 15000);
eq('the starter wins against a DNF', f.round().winner, 'p1');

/* ---- penalties in review ------------------------------------------ */
f = fight();
f.startRound(); f.wait(9000);
f.submit('p1', 8000); f.submit('p2', 9000);
f.act({ type: 'PENALTY', seat: 'p1', target: 'p1', penalty: '+2' });
eq('your own +2 applies at once', f.round().solves.p1.penalty, '+2');
eq('and the winner flips', f.round().winner, 'p2');
f.act({ type: 'PENALTY', seat: 'p1', target: 'p1', penalty: '' });
eq('and can be taken back', f.round().solves.p1.penalty, '');
f.act({ type: 'PENALTY', seat: 'p2', target: 'p1', penalty: 'DNF' });
eq('a penalty on the opponent is only a proposal', f.round().solves.p1.penalty, '');
ok('...waiting on them', f.round().proposals.p1 && f.round().proposals.p1.by === 'p2');
eq('they cannot continue past it', f.act({ type: 'CONTINUE', seat: 'p1' }), 'answer_proposal');
f.act({ type: 'PENALTY_REPLY', seat: 'p1', accept: false });
eq('turned down: no penalty', f.round().solves.p1.penalty, '');
f.act({ type: 'PENALTY', seat: 'p2', target: 'p1', penalty: '+2' });
f.act({ type: 'PENALTY_REPLY', seat: 'p1', accept: true });
eq('accepted: the penalty applies', f.round().solves.p1.penalty, '+2');
f.act({ type: 'CONTINUE', seat: 'p1' });
eq('one continue is not enough', f.s.phase, 'review');
f.act({ type: 'CONTINUE', seat: 'p2' });
eq('both continue: next round', f.s.round, 2);
eq('the agreed penalty decided it', f.s.score.p2, 1);

// Inspection's own penalty cannot be removed by the solver.
f = fight({ settings: { inspection: true } });
f.startRound(); f.wait(16000);
f.act({ type: 'START', seat: 'p1' }); f.act({ type: 'START', seat: 'p2' });
f.wait(9000); f.submit('p1', 9000); f.submit('p2', 9000);
f.act({ type: 'PENALTY', seat: 'p1', target: 'p1', penalty: '' });
eq('an inspection +2 stays', f.round().solves.p1.penalty, '+2');

/* ---- errors leave state alone ------------------------------------- */
f = fight();
const seqBefore = f.s.seq;
eq('a stranger cannot act', f.act({ type: 'READY', seat: 'p3' }), 'not_a_player');
eq('submitting in prepare is refused', f.submit('p1', 9000), 'wrong_phase');
eq('nothing changed', f.s.seq, seqBefore);
eq('unknown actions are refused', f.act({ type: 'NOPE', seat: 'p1' }), 'unknown_action');

/* ---- online ------------------------------------------------------- */
function online(opts) {
    const o = fight(Object.assign({ mode: 'online', guest: undefined }, opts));
    return o;
}
let o = online({ settings: { bestOf: 3, inspection: false } });
eq('online starts in the lobby', o.s.phase, 'lobby');
eq('with an empty seat', o.s.players.p2, null);
eq('ready alone is refused', o.act({ type: 'READY', seat: 'p1' }), 'wrong_phase');
o.act({ type: 'SCRAMBLE', target: 'next', scramble: 'U2 F2' });
eq('the next scramble waits in the queue', o.s.nextScramble, 'U2 F2');
o.act({ type: 'JOIN', player: { name: 'Bea', wcaId: '2015BEAA01' } });
eq('a join fills the seat', o.s.players.p2.name, 'Bea');
eq('and opens round 1', o.s.phase, 'prepare');
eq('with the queued scramble', o.round().scramble, 'U2 F2');
eq('the queue is empty again', o.s.nextScramble, null);
eq('a third player is turned away', o.act({ type: 'JOIN', player: { name: 'Cid' } }), 'full');

o.readyBoth();
eq('online countdown has a longer lead', E.countdownLeft(o.s, o.now), T.COUNTDOWN_MS + T.LEAD_MS.online);
o.wait(E.countdownLeft(o.s, o.now));
o.wait(3000);
eq('a time longer than the round is refused online', o.submit('p1', 9000), 'implausible');
eq('a plausible one is fine', o.submit('p1', 2900), null);

// The room expires if nobody joins.
o = online();
o.wait(T.LOBBY_TTL_MS);
eq('not yet expired at exactly the TTL', o.s.phase, 'lobby');
o.wait(1);
eq('expired after it', o.s.phase, 'expired');
eq('a late join is refused', o.act({ type: 'JOIN', player: { name: 'Bea' } }), 'closed');

// Disconnect grace, then forfeit.
o = online({ settings: { bestOf: 3, inspection: false } });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
o.scramble('X'); o.readyBoth();
o.wait(E.countdownLeft(o.s, o.now));
o.wait(5000); o.submit('p1', 4000); o.submit('p2', 4500);
o.act({ type: 'CONTINUE', seat: 'p1' }); o.act({ type: 'CONTINUE', seat: 'p2' });
eq('round 2 underway', o.s.round, 2);
// From here only Ana keeps checking in.
for (let i = 0; i < 4; i++) { o.wait(4000); o.act({ type: 'SEEN', seat: 'p1' }); }
let pres = E.presence(o.s, 'p2', o.now);
ok('Bea shows as away after 12s', pres.away, JSON.stringify(pres));
ok('with grace time left', pres.graceLeft > 0 && pres.graceLeft < T.GRACE_MS, String(pres.graceLeft));
eq('no forfeit yet', o.s.phase, 'prepare');
for (let i = 0; i < 7; i++) { o.wait(4000); o.act({ type: 'SEEN', seat: 'p1' }); }
eq('after the grace period: forfeit', o.s.phase, 'ended');
eq('Ana wins', o.s.result.winner, 'p1');
eq('by disconnect', o.s.result.reason, 'disconnect');

// Coming back inside the grace period saves the match.
o = online({ settings: { bestOf: 3, inspection: false } });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
o.scramble('X'); o.readyBoth(); o.wait(E.countdownLeft(o.s, o.now));
for (let i = 0; i < 8; i++) { o.wait(4000); o.act({ type: 'SEEN', seat: 'p1' }); }
ok('Bea is away', E.presence(o.s, 'p2', o.now).away);
o.act({ type: 'SEEN', seat: 'p2' });
ok('back inside the grace period', !E.presence(o.s, 'p2', o.now).away);
for (let i = 0; i < 4; i++) { o.wait(4000); o.act({ type: 'SEEN', seat: 'p1' }); o.act({ type: 'SEEN', seat: 'p2' }); }
eq('the match goes on', o.s.phase, 'solving');

// A guest who vanishes before anything is played frees the seat.
o = online();
o.act({ type: 'SCRAMBLE', target: 'next', scramble: 'first' });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
for (let i = 0; i < 12; i++) { o.wait(4000); o.act({ type: 'SEEN', seat: 'p1' }); }
eq('back to the lobby', o.s.phase, 'lobby');
eq('the seat is free', o.s.players.p2, null);
eq('the unplayed scramble is kept', o.s.nextScramble, 'first');
o.act({ type: 'JOIN', player: { name: 'Cid' } });
eq('someone else can join', o.s.players.p2.name, 'Cid');

// Leaving mid-match forfeits it.
o = online({ settings: { bestOf: 3, inspection: false } });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
o.scramble('X'); o.readyBoth(); o.wait(E.countdownLeft(o.s, o.now));
o.wait(4000); o.submit('p1', 3000); o.submit('p2', 3500);
o.act({ type: 'CONTINUE', seat: 'p1' }); o.act({ type: 'CONTINUE', seat: 'p2' });
o.act({ type: 'LEAVE', seat: 'p2' });
eq('leaving ends the match', o.s.phase, 'ended');
eq('for the one who stayed', o.s.result.winner, 'p1');
eq('reason: left', o.s.result.reason, 'left');
eq('no rematch with someone who left', o.act({ type: 'REMATCH', seat: 'p1' }), 'no_rematch');

// Review moves on by itself online.
o = online({ settings: { bestOf: 3, inspection: false } });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
o.scramble('X'); o.readyBoth(); o.wait(E.countdownLeft(o.s, o.now));
o.wait(4000); o.submit('p1', 3000); o.submit('p2', 3500);
o.wait(T.REVIEW_AUTO_MS - 1);
eq('review waits for the players', o.s.phase, 'review');
o.wait(1);
eq('then continues by itself', o.s.round, 2);
eq('scoring the round', o.s.score.p1, 1);

// Online rematch needs both.
o = online({ settings: { bestOf: 1, inspection: false } });
o.act({ type: 'JOIN', player: { name: 'Bea' } });
o.scramble('X'); o.readyBoth(); o.wait(E.countdownLeft(o.s, o.now));
o.wait(4000); o.submit('p1', 3000); o.submit('p2', 3500);
o.act({ type: 'CONTINUE', seat: 'p1' }); o.act({ type: 'CONTINUE', seat: 'p2' });
eq('best of 1 ends', o.s.phase, 'ended');
o.act({ type: 'REMATCH', seat: 'p2', both: true });
eq('online, "both" is ignored', o.s.phase, 'ended');
o.act({ type: 'REMATCH', seat: 'p1' });
eq('both asked: a new match', o.s.phase, 'prepare');

/* ---- a Firebase round trip --------------------------------------- */
// Firebase drops nulls, empty objects and empty arrays. A state that has
// been through it must still run.
function firebaseize(v) {
    if (Array.isArray(v)) {
        const a = v.map(firebaseize).filter(x => x !== undefined);
        return a.length ? a : undefined;
    }
    if (v && typeof v === 'object') {
        const o2 = {};
        for (const [k, x] of Object.entries(v)) {
            const y = firebaseize(x);
            if (y !== undefined) o2[k] = y;
        }
        return Object.keys(o2).length ? o2 : undefined;
    }
    return v === null ? undefined : v;
}
f = fight({ settings: { bestOf: 3, inspection: false } });
f.set(firebaseize(f.s));
f.scramble('A'); f.set(firebaseize(f.s));
f.readyBoth(); f.set(firebaseize(f.s));
f.wait(E.countdownLeft(f.s, f.now)); f.set(firebaseize(f.s));
f.wait(5000); f.submit('p1', null, 'DNF'); f.set(firebaseize(f.s));
f.submit('p2', 4000); f.set(firebaseize(f.s));
eq('a DNF with no time survives the round trip', f.round().solves.p1.penalty, 'DNF');
eq('and loses', f.round().winner, 'p2');
f.continueBoth();
eq('the fight carries on', f.s.round, 2);
ok('no numeric keys anywhere', !/"\d+":/.test(JSON.stringify(f.s)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
