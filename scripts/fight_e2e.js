/* End to end: two phones play a full online best-of-3, then a rematch
   that one of them abandons mid-round.

   Two Chromium contexts, each signed in as a different account, against
   scripts/fight_e2e_server.js — the real /api/fight handler and engine,
   with an in-memory database in place of Firebase. Real touch events
   (Chrome DevTools Protocol) drive the timers, so this exercises the same
   pointer handling a phone does.

   Needs Playwright (not a dependency of the site):
     node scripts/fight_e2e.js            live updates via the stream
     node scripts/fight_e2e.js --poll     with the stream refused (polling)
     node scripts/fight_e2e.js --quick    skip the 45s disconnect test
*/
'use strict';

const path = require('path');
const { execSync } = require('child_process');

let playwright;
try { playwright = require('playwright'); } catch (e) {
    playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium, devices } = playwright;
const harness = require('./fight_e2e_server.js');

const PORT = 8790;
// FIGHT_SHOTS=<dir> saves a screenshot of each screen along the way.
const SHOTS = process.env.FIGHT_SHOTS || '';
async function shot(p, name) {
    if (SHOTS) await p.page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
}
const POLL = process.argv.includes('--poll');
const QUICK = process.argv.includes('--quick');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log(`  ok  ${label}`); } else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

async function phone(browser, uid, name) {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const token = harness.tokenFor(uid, name);
    await ctx.addInitScript(({ token, poll, port }) => {
        try {
            localStorage.setItem('chq_auth_token', token);
            localStorage.setItem('cookie-consent', JSON.stringify({ necessary: true }));
        } catch (e) { /* ignore */ }
        // The stream stand-in; with --poll, an address that refuses, so the
        // page has to fall back to polling.
        window.CHQ_RTDB_URL = poll ? `http://localhost:${port}/no-stream` : `http://localhost:${port}/rtdb`;
    }, { token, poll: POLL, port: PORT });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    return { ctx, page, cdp, errors, name };
}

const phaseOf = (p) => p.page.evaluate(() => {
    const tr = window.FightOnline._state.transport;
    return tr ? window.FightEngine.tick(tr.state, tr.now()).phase : null;
});
const stateOf = (p) => p.page.evaluate(() => {
    const tr = window.FightOnline._state.transport;
    return tr ? window.FightEngine.tick(tr.state, tr.now()) : null;
});
function waitPhase(p, phases, timeout = 20000) {
    const list = [].concat(phases);
    return p.page.waitForFunction((list) => {
        const tr = window.FightOnline._state.transport;
        return tr && list.includes(window.FightEngine.tick(tr.state, tr.now()).phase);
    }, list, { timeout });
}
async function zonePoint(p) {
    return p.page.$eval('.fo-zone', el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
}
async function touchDown(p, pt) { await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] }); }
async function touchUp(p) { await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }

/** One round: both ready, both inspect briefly, start, and stop in order. */
async function playRound(a, b, first, inspection) {
    await a.page.waitForSelector('[data-act="ready"]:not([disabled])', { timeout: 20000 });
    await b.page.waitForSelector('[data-act="ready"]:not([disabled])', { timeout: 20000 });
    const scrA = await a.page.textContent('.fo-scramble');
    const scrB = await b.page.textContent('.fo-scramble');
    ok('both devices show the same scramble', scrA === scrB && scrA.length > 10, `${scrA} | ${scrB}`);
    await shot(a, 'online-prepare');
    await a.page.tap('[data-act="ready"]');
    await b.page.tap('[data-act="ready"]');
    await waitPhase(a, 'countdown');
    // The countdown is scheduled in server time; both devices should agree
    // on how long is left to well within a frame or two.
    const leftA = await a.page.evaluate(() => { const tr = window.FightOnline._state.transport; return window.FightEngine.countdownLeft(window.FightEngine.tick(tr.state, tr.now()), tr.now()); });
    const leftB = await b.page.evaluate(() => { const tr = window.FightOnline._state.transport; return window.FightEngine.countdownLeft(window.FightEngine.tick(tr.state, tr.now()), tr.now()); });
    ok('the countdown is in sync across devices', leftA !== null && Math.abs(leftA - leftB) < 600, `${leftA} vs ${leftB}`);
    await waitPhase(a, inspection ? 'inspection' : 'solving');
    await waitPhase(b, inspection ? 'inspection' : 'solving');
    await a.page.waitForTimeout(900);

    const pa = await zonePoint(a), pb = await zonePoint(b);
    await Promise.all([touchDown(a, pa), touchDown(b, pb)]);
    await a.page.waitForTimeout(450);
    await Promise.all([touchUp(a), touchUp(b)]);
    await a.page.waitForTimeout(300);
    const tpa = await a.page.evaluate(() => window.FightOnline._state.seatTimer.timer.phase);
    const tpb = await b.page.evaluate(() => window.FightOnline._state.seatTimer.timer.phase);
    ok('both timers are running', tpa === 'running' && tpb === 'running', `${tpa} / ${tpb}`);
    await a.page.waitForTimeout(1200);
    const order = first === 'a' ? [[a, pa], [b, pb]] : [[b, pb], [a, pa]];
    for (const [p, pt] of order) {
        await touchDown(p, pt); await touchUp(p);
        await p.page.waitForTimeout(400);
    }
    await waitPhase(a, 'review');
    await waitPhase(b, 'review');
    await a.page.waitForTimeout(200);
    await shot(b, 'online-review');
    const sa = await stateOf(a), sb = await stateOf(b);
    const ra = sa.rounds['r' + sa.round], rb = sb.rounds['r' + sb.round];
    ok('both devices agree on the round', ra.winner === rb.winner && ra.solves.p1.ms === rb.solves.p1.ms && ra.solves.p2.ms === rb.solves.p2.ms,
        JSON.stringify([ra.solves, rb.solves]));
    const expected = first === 'a' ? 'p1' : 'p2';
    ok(`round ${sa.round} goes to whoever stopped first (${expected})`, ra.winner === expected, ra.winner);
    // Continue on both (waiting out the guard against stray taps).
    await a.page.waitForTimeout(600);
    await a.page.tap('[data-act="continue"]');
    await b.page.tap('[data-act="continue"]');
}

(async () => {
    const { server, store } = await harness.start(PORT);
    const browser = await chromium.launch();
    const a = await phone(browser, 'acc_ana', 'Ana');
    const b = await phone(browser, 'acc_bea', 'Bea');
    console.log(`Online best-of-3 (${POLL ? 'polling' : 'streaming'})`);

    try {
        await a.page.goto(`http://localhost:${PORT}/index.html#fights`, { waitUntil: 'domcontentloaded' });
        await a.page.waitForSelector('#fight-online-signed-in:not([hidden])', { timeout: 20000 });
        await a.page.tap('#fight-create-btn');
        await a.page.waitForSelector('.fo-big-code', { timeout: 20000 });
        const code = (await a.page.textContent('.fo-big-code')).trim();
        ok('a room code is shown', /^[A-Z0-9]{6}$/.test(code), code);
        ok('the address is the invite link', (await a.page.evaluate(() => location.hash)) === `#fight/${code}`);
        ok('the lobby waits for an opponent', (await phaseOf(a)) === 'lobby');
        await shot(a, 'online-lobby');

        // Bea follows the link.
        await b.page.goto(`http://localhost:${PORT}/index.html#fight/${code}`, { waitUntil: 'domcontentloaded' });
        await waitPhase(b, 'prepare');
        await waitPhase(a, 'prepare');
        ok('the invite link joins the fight', true);
        ok('Ana sees Bea', (await a.page.textContent('.fo-player--opp .fo-player-name')).includes('Bea'));
        ok('Bea sees Ana', (await b.page.textContent('.fo-player--opp .fo-player-name')).includes('Ana'));
        if (!POLL) {
            ok('updates arrive by stream', await a.page.evaluate(() => window.FightOnline._state.transport.streaming));
        } else {
            ok('with the stream refused, the page polls', !(await a.page.evaluate(() => window.FightOnline._state.transport.streaming)));
        }

        await playRound(a, b, 'a', true);
        await waitPhase(a, 'prepare');
        await playRound(a, b, 'b', true);
        await waitPhase(a, 'prepare');
        await playRound(a, b, 'a', true);
        await waitPhase(a, 'ended');
        await waitPhase(b, 'ended');
        const end = await stateOf(a);
        ok('Ana wins the match 2–1', end.result.winner === 'p1' && end.score.p1 === 2 && end.score.p2 === 1, JSON.stringify(end.result));
        await a.page.waitForTimeout(400);
        ok('Ana sees WINNER', /WINNER/i.test(await a.page.textContent('.fo-ended-badge')));
        ok('Bea sees that she lost', /lost/i.test(await b.page.textContent('.fo-ended-badge')));
        await shot(a, 'online-ended-a');
        await shot(b, 'online-ended-b');

        const hist = store.data.fight_history || {};
        ok('the match is in both players\' history', Object.keys(hist.acc_ana || {}).length === 1 && Object.keys(hist.acc_bea || {}).length === 1, JSON.stringify(Object.keys(hist)));
        const stats = store.data.fight_stats || {};
        ok('and in their stats', stats.acc_ana && stats.acc_ana.wins === 1 && stats.acc_bea && stats.acc_bea.losses === 1, JSON.stringify(stats));

        // Rematch.
        await a.page.waitForTimeout(600);
        await a.page.tap('[data-act="rematch"]');
        await b.page.waitForSelector('[data-act="rematch"]', { timeout: 10000 });
        await b.page.tap('[data-act="rematch"]');
        await waitPhase(a, 'prepare');
        ok('a rematch starts a fresh match', (await stateOf(a)).match === 2);

        if (!QUICK) {
            console.log('Disconnect: Bea vanishes mid-match (this takes ~45s)');
            await playRound(a, b, 'b', true);
            await waitPhase(a, 'prepare');
            await b.page.close();
            await a.page.waitForSelector('.fo-banner:not([hidden])', { timeout: 30000 });
            ok('Ana is told Bea lost connection', /lost connection/i.test(await a.page.textContent('.fo-banner')));
            await shot(a, 'online-disconnect');
            await waitPhase(a, 'ended', 60000);
            const s = await stateOf(a);
            ok('after the grace period Ana wins by forfeit', s.result.winner === 'p1' && s.result.reason === 'disconnect', JSON.stringify(s.result));
        }

        ok('no page errors on Ana\'s phone', a.errors.length === 0, a.errors.join(' | '));
        ok('no page errors on Bea\'s phone', b.errors.length === 0, b.errors.join(' | '));
    } catch (e) {
        fail++;
        console.error('FAIL', e.message);
        await shot(a, 'fail-a');
        await shot(b, 'fail-b');
    }

    await browser.close();
    server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
