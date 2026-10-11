/* Tests online Cube Fights on the server: /api/fight and api/_lib/fights.js.

   The service runs against the in-memory store from fights.js, which
   behaves like Firebase where it matters here — nulls and empty objects
   vanish, and ETag conditional writes really conflict — with a clock the
   test moves by hand and a stand-in scramble generator. The handler is
   driven with real session tokens, so sign-in is checked the way it is
   in production.

   Run: node scripts/test_fight_api.js */

'use strict';

process.env.AUTH_SIGNING_SECRET = 'test-fight-secret';

const fights = require('../api/_lib/fights.js');
const session = require('../api/_lib/session.js');
const handler = require('../api/fight/[action].js');
const E = require('../fight-engine.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
    if (Object.is(got, want)) pass++;
    else { fail++; console.error(`FAIL ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
async function rejects(label, promise, code) {
    try { await promise; fail++; console.error(`FAIL ${label} — did not throw`); }
    catch (e) { eq(label, e.code, code); }
}

function world() {
    let now = 1_800_000_000_000;
    let n = 0;
    const store = fights.createMemoryStore();
    const svc = fights.createFightService({
        store,
        now: () => now,
        scrambleGenerator: (id) => `SCR-${id}-${++n}`,
    });
    return { store, svc, tick: (ms) => { now += ms; }, get now() { return now; } };
}

const ana = { uid: 'acc_ana', name: 'Ana', wcaId: null };
const bea = { uid: 'acc_bea', name: 'Bea', wcaId: '2016BEAA01' };
const cid = { uid: 'acc_cid', name: 'Cid', wcaId: null };

/** Ready, count down, both submit, both continue. */
async function round(w, fightId, msA, msB) {
    await w.svc.act(ana, fightId, { type: 'READY' });
    let r = await w.svc.act(bea, fightId, { type: 'READY' });
    w.tick(E.countdownLeft(r.state, w.now) + 4000);
    await w.svc.act(ana, fightId, { type: 'SUBMIT', ms: msA });
    r = await w.svc.act(bea, fightId, { type: 'SUBMIT', ms: msB });
    await w.svc.act(ana, fightId, { type: 'CONTINUE' });
    return w.svc.act(bea, fightId, { type: 'CONTINUE' });
}

(async () => {
    /* ---- create ------------------------------------------------- */
    let w = world();
    const c = await w.svc.create(ana, { event: '444', bestOf: 3, inspection: false });
    ok('a 6-character code', /^[A-Z0-9]{6}$/.test(c.code), c.code);
    ok('from the unambiguous alphabet', [...c.code].every(ch => fights.CODE_ALPHABET.includes(ch)));
    ok('a 20-character fight id', /^[A-Za-z0-9]{20}$/.test(c.fightId));
    eq('the creator is p1', c.seat, 'p1');
    eq('waiting in the lobby', c.state.phase, 'lobby');
    eq('settings kept', c.state.settings.event, '444');
    eq('the code is on the fight', c.state.code, c.code);

    const pub = w.store.data.fights[c.fightId];
    const priv = w.store.data.fight_private[c.fightId];
    ok('the next scramble is queued privately', typeof priv.next === 'string' && priv.next.startsWith('SCR-444'));
    ok('and is not in the readable fight', !('nextScramble' in pub) && !JSON.stringify(pub).includes(priv.next));
    ok('the public fight names no account', !JSON.stringify(pub).includes('acc_ana'));
    eq('the private node knows the seat', priv.seats.p1, 'acc_ana');
    eq('the code points at the fight', w.store.data.fight_codes[c.code].id, c.fightId);

    /* ---- join ---------------------------------------------------- */
    await rejects('a malformed code', w.svc.join(bea, 'ab'), 'bad_code');
    await rejects('an unknown code', w.svc.join(bea, 'ZZZZZZ'), 'no_fight');
    const j = await w.svc.join(bea, c.code.toLowerCase());
    eq('Bea joins as p2', j.seat, 'p2');
    eq('round 1 opens', j.state.phase, 'prepare');
    eq('with the queued scramble', j.state.rounds.r1.scramble, priv.next);
    ok('a fresh one is queued behind it', w.store.data.fight_private[c.fightId].next !== priv.next);
    eq('WCA ID carried', j.state.players.p2.wcaId, '2016BEAA01');
    const again = await w.svc.join(bea, c.code);
    eq('joining again returns the same seat', again.seat, 'p2');
    const host = await w.svc.join(ana, c.code);
    eq('the host can come back through the code', host.seat, 'p1');
    await rejects('a third person is turned away', w.svc.join(cid, c.code), 'full');
    await rejects('a stranger cannot act', w.svc.act(cid, c.fightId, { type: 'READY' }), 'not_a_player');
    await rejects('a bad fight id', w.svc.act(ana, 'nope', { type: 'SEEN' }), 'bad_fight');
    await rejects('a server-only action is refused', w.svc.act(ana, c.fightId, { type: 'SCRAMBLE', scramble: 'R' }), 'bad_action');

    /* ---- the server's clock decides ------------------------------ */
    await w.svc.act(ana, c.fightId, { type: 'READY' });
    let r = await w.svc.act(bea, c.fightId, { type: 'READY' });
    eq('both ready: countdown', r.state.phase, 'countdown');
    const startAt = r.state.rounds.r1.startAt;
    eq('scheduled on the server clock', startAt, w.now + E.TIMING.COUNTDOWN_MS + E.TIMING.LEAD_MS.online);
    r = await w.svc.act(ana, c.fightId, { type: 'SUBMIT', ms: 5000 });
    eq('a solve before the round starts is refused', r.error, 'wrong_phase');
    w.tick(E.countdownLeft(r.state, w.now) + 2000);
    r = await w.svc.act(ana, c.fightId, { type: 'SUBMIT', ms: 9000 });
    eq('a solve longer than the round is refused', r.error, 'implausible');
    // A client cannot pick its seat or slip in another player's result.
    r = await w.svc.act(ana, c.fightId, { type: 'SUBMIT', seat: 'p2', ms: 1500 });
    ok('the seat comes from the account, not the request', r.state.rounds.r1.solves.p1 && !r.state.rounds.r1.solves.p2);

    // Two submissions at the same instant: both land (ETag retry).
    const [x] = await Promise.all([
        w.svc.act(bea, c.fightId, { type: 'SUBMIT', ms: 1800 }),
        w.svc.act(ana, c.fightId, { type: 'SEEN' }),
    ]);
    void x;
    const after = w.store.data.fights[c.fightId];
    ok('a concurrent heartbeat does not lose a submission', after.rounds.r1.solves.p2 && after.rounds.r1.solves.p2.ms === 1800);
    eq('review', after.phase, 'review');

    /* ---- a full best of 3, history and stats ---------------------- */
    await w.svc.act(ana, c.fightId, { type: 'CONTINUE' });
    r = await w.svc.act(bea, c.fightId, { type: 'CONTINUE' });
    eq('round 2', r.state.round, 2);
    ok('round 2 has a new scramble', r.state.rounds.r2.scramble && r.state.rounds.r2.scramble !== r.state.rounds.r1.scramble);
    r = await round(w, c.fightId, 3000, 2500);
    eq('1–1', `${r.state.score.p1}-${r.state.score.p2}`, '1-1');
    r = await round(w, c.fightId, 2000, 2600);
    eq('match over', r.state.phase, 'ended');
    eq('Ana wins', r.state.result.winner, 'p1');

    const hist = w.store.data.fight_history;
    eq('one record for Ana', Object.keys(hist.acc_ana).length, 1);
    eq('one record for Bea', Object.keys(hist.acc_bea).length, 1);
    const recA = Object.values(hist.acc_ana)[0];
    eq('from Ana\'s seat', recA.seat, 'p1');
    eq('with three rounds', recA.rounds.length, 3);
    eq('and the opponent named', recA.players.p2, 'Bea');
    const st = w.store.data.fight_stats;
    eq('Ana: 1 win', st.acc_ana.wins, 1);
    eq('Bea: 1 loss', st.acc_bea.losses, 1);
    eq('rounds won counted', st.acc_ana.roundsWon, 2);
    eq('best single per event', st.acc_ana.best['444'], 1500);

    // More requests after the end must not count the match again.
    await w.svc.act(ana, c.fightId, { type: 'SEEN' });
    await w.svc.act(bea, c.fightId, { type: 'SEEN' });
    eq('still one win', w.store.data.fight_stats.acc_ana.wins, 1);
    eq('still one record', Object.keys(w.store.data.fight_history.acc_ana).length, 1);

    const h = await w.svc.history(ana);
    eq('history returns the record', h.records.length, 1);
    eq('and the stats', h.stats.played, 1);

    // Rematch: a new match, recorded separately.
    await w.svc.act(ana, c.fightId, { type: 'REMATCH' });
    r = await w.svc.act(bea, c.fightId, { type: 'REMATCH' });
    eq('rematch: match 2', r.state.match, 2);
    await round(w, c.fightId, 4000, 3000);
    r = await round(w, c.fightId, 4000, 3000);
    eq('Bea takes the rematch', r.state.result.winner, 'p2');
    eq('a second record each', Object.keys(w.store.data.fight_history.acc_ana).length, 2);
    eq('stats add up', `${w.store.data.fight_stats.acc_ana.wins}-${w.store.data.fight_stats.acc_ana.losses}`, '1-1');

    /* ---- disconnect forfeit, decided by the server's clock -------- */
    w = world();
    const d = await w.svc.create(ana, { bestOf: 3, inspection: false });
    await w.svc.join(bea, d.code);
    await round(w, d.fightId, 2000, 3000);
    for (let i = 0; i < 12; i++) { w.tick(4000); r = await w.svc.act(ana, d.fightId, { type: 'SEEN' }); }
    eq('Bea silent past the grace period: forfeit', r.state.phase, 'ended');
    eq('Ana wins by disconnect', `${r.state.result.winner}:${r.state.result.reason}`, 'p1:disconnect');
    eq('recorded for both', Object.keys(w.store.data.fight_history.acc_bea).length, 1);
    eq('as a loss for Bea', w.store.data.fight_stats.acc_bea.losses, 1);

    /* ---- leaving, expiry ------------------------------------------ */
    w = world();
    const e1 = await w.svc.create(ana, {});
    w.tick(E.TIMING.LOBBY_TTL_MS + 1);
    r = await w.svc.act(ana, e1.fightId, { type: 'SEEN' });
    eq('an unjoined room expires', r.state.phase, 'expired');
    await rejects('and cannot be joined', w.svc.join(bea, e1.code), 'closed');
    ok('nobody is credited with an expired room', !w.store.data.fight_stats);

    w = world();
    const l = await w.svc.create(ana, { inspection: false });
    await w.svc.join(bea, l.code);
    await round(w, l.fightId, 2000, 3000);
    r = await w.svc.act(bea, l.fightId, { type: 'LEAVE' });
    eq('leaving mid-match ends it', `${r.state.result.winner}:${r.state.result.reason}`, 'p1:left');

    /* ---- old fights are cleaned up -------------------------------- */
    w = world();
    const old = await w.svc.create(ana, {});
    w.tick(25 * 60 * 60 * 1000);
    await w.svc.create(bea, {});
    await new Promise(res => setTimeout(res, 20));   // clean-up runs after the reply
    ok('a day-old fight is deleted', !(w.store.data.fights || {})[old.fightId]);
    ok('with its code', !(w.store.data.fight_codes || {})[old.code]);

    /* ---- same-device results -------------------------------------- */
    w = world();
    const saved = await w.svc.saveLocal(ana, {
        id: 'local-123', at: w.now - 1000, event: '333', bestOf: 3,
        players: { p1: 'Ana', p2: '<b>Kid</b>' }, winner: 'p1', score: { p1: 2, p2: 99 },
        rounds: [{ p1: { ms: 9000, penalty: '' }, p2: { ms: 'x', penalty: '' }, winner: 'p1' }],
    });
    eq('a local fight is kept', saved.mode, 'local');
    eq('impossible scores are clamped', saved.score.p2, 7);
    eq('a garbage time becomes a DNF', saved.rounds[0].p2.penalty, 'DNF');
    ok('it does not touch the online stats', !w.store.data.fight_stats);

    /* ---- scrambles ------------------------------------------------- */
    const SE = fights.loadScrambleEngine();
    ok('the server loads ScrambleEngine\'s formatter', typeof SE.formatForEvent === 'function');
    eq('Square-1 in csTimer notation, as the page shows it', SE.formatForEvent('sq1', '(0, 5) / (3, 0) /'), '(0,5)/ (3,0)/');
    ok('and its offline fallback', /^[UDRLFB'2 ]+$/.test(SE.fallbackScramble('333')));

    /* ---- the handler ----------------------------------------------- */
    const store = fights.createMemoryStore();
    handler._setService(fights.createFightService({ store, scrambleGenerator: () => 'R U' }));
    handler._resetLimits();
    async function call(req) {
        let status = 0, body = null;
        const res = { statusCode: 0, setHeader() {}, end(b) { body = b ? JSON.parse(b) : null; status = this.statusCode; } };
        const empty = { [Symbol.asyncIterator]: async function* () {} };
        await handler(Object.assign({ method: 'POST', headers: {}, socket: {} }, empty, req), res);
        return { status, body };
    }
    const tok = (u) => ({ authorization: `Bearer ${session.issue(u)}` });

    let res = await call({ url: '/api/fight/create', body: { settings: {} } });
    eq('signed out: refused', res.status, 401);
    eq('with the sign-in code', res.body.error.code, 'sign_in_required');
    res = await call({ url: '/api/fight/create', headers: tok(ana), body: { settings: { bestOf: 5 } } });
    eq('signed in: created', res.status, 200);
    eq('best of 5', res.body.state.settings.bestOf, 5);
    ok('the reply carries the server time', typeof res.body.serverNow === 'number');
    const code = res.body.code, fid = res.body.fightId;
    res = await call({ url: '/api/fight/join', headers: tok(bea), body: { code } });
    eq('join through the handler', res.body.seat, 'p2');
    res = await call({ url: '/api/fight/act', headers: tok(bea), body: { fightId: fid, action: { type: 'READY' } } });
    eq('act through the handler', res.body.state.players.p2.ready, true);
    res = await call({ url: '/api/fight/history', method: 'GET', headers: tok(ana) });
    eq('history through the handler', res.status, 200);
    res = await call({ url: '/api/fight/history', headers: tok(ana) });
    eq('history only answers GET', res.status, 405);
    res = await call({ url: '/api/fight/nope', headers: tok(ana) });
    eq('an unknown action is a 404', res.status, 404);
    res = await call({ url: '/api/fight/local-result', headers: tok(ana), body: { record: { players: { p1: 'A', p2: 'B' } } } });
    eq('local results through the handler', res.body.record.mode, 'local');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
