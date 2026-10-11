/* Tests the Cube Fights page wiring: the view is reachable, the scripts
   load in the order they depend on each other, every string has both
   languages, and the server bundle carries the files it reads.

   It also runs the real per-seat timer (CubeFights._shared.createSeatTimer)
   against a stand-in transport, to pin two touch bugs found while
   building it:
     - a finger whose pointerup never arrives (the element under it was
       replaced when the round ended) must not swallow the next round;
     - inspection must start at the round's scheduled instant, converted
       to this device's clock.

   The full touch-driven matches run in Chromium: scripts/fight_e2e.js.

   Run: node scripts/test_fight_ui.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const INDEX = read('index.html');
const APP = read('app.js');
const I18N = read('i18n.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
    if (Object.is(got, want)) pass++;
    else { fail++; console.error(`FAIL ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

/* ---- reachable ---------------------------------------------------- */
ok('index.html has the Fights view', INDEX.includes('id="fights-view"'));
ok('...a Fights nav button', INDEX.includes('id="nav-fights-btn"'));
ok('...and the full-screen split-screen layer', INDEX.includes('id="fight-local"'));
for (const page of ['timer.html', 'coach.html']) {
    const html = read(page);
    ok(`${page} links the Fights button to index.html#fights`, /'nav-fights-btn':\s*'index\.html#fights'/.test(html));
}
ok('app.js routes #fights', APP.includes("'#fights': 'fights'"));
ok('...and the view back to #fights', APP.includes("'fights': '#fights'"));
ok('...and invite links #fight/CODE', /#fight\\\/\(\[A-Za-z0-9\]\{4,8\}\)/.test(APP));
ok('...entering the view starts Cube Fights', APP.includes('window.CubeFights.enter('));
ok('...and leaving it ends a fight in progress', APP.includes('window.CubeFights.leave()'));
ok('the pre-paint router knows #fights', /'#fights': 'fights'/.test(INDEX));
ok('...and invite links', /\^#fight\\\//.test(INDEX));
ok('app.js hands Cube Fights the sign-in', /window\.CubingHQApp = \{/.test(APP) && APP.includes("'chq-auth-changed'"));

/* ---- load order --------------------------------------------------- */
const order = ['timer-core.js', 'fight-engine.js', 'fight-transport.js', 'fight-ui.js', 'fight-online.js', 'app.js']
    .map(f => INDEX.indexOf(`<script src="${f}?v=`));
ok('every Cube Fights script is loaded', order.every(i => i !== -1), JSON.stringify(order));
ok('in dependency order, before app.js', order.every((v, i) => i === 0 || v > order[i - 1]), JSON.stringify(order));
ok('fight.css is linked', /<link rel="stylesheet" href="fight\.css\?v=[0-9a-f]{8}">/.test(INDEX));
ok('scramble-engine.js comes first (local scrambles)', INDEX.indexOf('scramble-engine.js?v=') < order[1]);

/* ---- strings ------------------------------------------------------ */
const used = new Set();
for (const f of ['fight-ui.js', 'fight-online.js']) {
    for (const m of read(f).matchAll(/t\('((?:fight|nav)\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]);
}
const missing = [...used].filter(k => (I18N.match(new RegExp(`'${k.replace(/\./g, '\\.')}':`, 'g')) || []).length !== 2);
ok(`all ${used.size} Cube Fights strings exist in English and Portuguese`, missing.length === 0, missing.join(', '));

/* ---- the server bundle -------------------------------------------- */
const vercel = JSON.parse(read('vercel.json'));
const fightFn = vercel.functions['api/fight/**/*.js'];
ok('the fight function has its own config', !!fightFn);
for (const f of ['fight-engine.js', 'timer-core.js', 'scramble-engine.js', 'square1-drawer.js', 'node_modules/cubing']) {
    ok(`...which ships ${f}`, fightFn && fightFn.includeFiles.includes(f));
}
const globs = Object.keys(vercel.functions);
ok('no two function patterns can match the same file', !globs.includes('api/**/*.js'), globs.join(', '));
ok('cubing is a dependency (server scrambles)', !!JSON.parse(read('package.json')).dependencies.cubing);

/* ---- the seat timer ------------------------------------------------ */
function loadUi() {
    const listeners = {};
    const store = {};
    const fakeEl = () => ({ addEventListener() {}, setAttribute() {}, classList: { toggle() {}, add() {}, remove() {} }, style: {}, dataset: {} });
    const win = {
        performance: { now: () => clockNow, timeOrigin: 0 },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        matchMedia: () => ({ matches: false }),
        requestAnimationFrame: () => 0, cancelAnimationFrame() {},
        navigator: {},
        addEventListener() {},
    };
    let clockNow = 1000;
    const ctx = Object.assign(win, {
        window: win, self: win, console, JSON, Math, Date, Promise, Set, Map, Object, Array, String, Number,
        setTimeout, clearTimeout, setInterval, clearInterval,
        document: {
            addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
            querySelector: () => null, querySelectorAll: () => [], createElement: fakeEl,
            body: { classList: { add() {}, remove() {} } },
        },
        CustomEvent: function () {},
    });
    ctx.performance = win.performance;
    ctx.localStorage = win.localStorage;
    ctx.navigator = win.navigator;
    vm.createContext(ctx);
    for (const f of ['timer-core.js', 'fight-engine.js', 'fight-transport.js', 'fight-ui.js']) {
        vm.runInContext(read(f), ctx, { filename: f });
    }
    return { ctx, setClock: (t) => { clockNow = t; } };
}

const { ctx, setClock } = loadUi();
const E = ctx.FightEngine;
const shared = ctx.CubeFights._shared;
ok('fight-ui exposes the seat timer', typeof shared.createSeatTimer === 'function');

// A stand-in transport whose server clock runs 5s ahead of the device.
let device = 10_000;
const dispatched = [];
const transport = {
    now: () => device + 5000,
    deviceNow: () => device,
    toDevice: (t) => t - 5000,
    dispatch: (a) => { dispatched.push(a); return Promise.resolve(null); },
};
const st = shared.createSeatTimer('p1', transport, { changed() {} });

function viewAt(phase, n, extra) {
    const v = E.create({ mode: 'local', settings: { inspection: true }, host: { name: 'A' }, guest: { name: 'B' }, now: 0 });
    v.phase = phase;
    v.round = n;
    v.rounds = { [`r${n}`]: Object.assign({ n, scramble: 'R', startAt: 20_000, phaseAt: 0, solves: {}, started: {}, startPenalty: {}, proposals: {}, cont: {}, winner: null, final: false }, extra || {}) };
    return v;
}

// Round 1: inspection starts at server 20000 = device 15000.
device = 16_000;
let v = viewAt('inspection', 1);
st.sync(v);
eq('inspection is armed by the round', st.timer.phase, 'inspecting');
eq('at the scheduled instant, on the device clock', st.timer.inspectionStart, 15_000);
eq('so 1s of inspection has gone', st.timer.inspectionLeft(device), 14_000);

// Press and hold, release: running. Then the stopping tap, whose pointerup
// never comes (the screen switched to the results under the finger).
ok('a press is taken', st.down('finger-1', v));
device += 400; st.timer.tick(device);
st.up('finger-1');
eq('released after a full hold: running', st.timer.phase, 'running');
eq('START was sent', dispatched.some(a => a.type === 'START'), true);
device += 5000;
st.down('finger-2', v);
eq('the stopping tap stops it', st.timer.phase, 'stopped');
eq('SUBMIT carries the device-clock time', dispatched.find(a => a.type === 'SUBMIT').ms, 5000);
// ...and finger-2 is never lifted. The round goes to review, then round 2.
st.sync(viewAt('review', 1, { solves: { p1: { ms: 5000, penalty: '' } } }));
st.sync(viewAt('prepare', 2));
device = 40_000;
v = viewAt('inspection', 2, { startAt: 44_000 });
st.sync(v);
device += 1000;
ok('next round: a new press is taken', st.down('finger-3', v));
eq('...and starts the hold (the lost finger is forgotten)', st.timer.phase, 'holding');

// Nobody can start before the round does.
const st2 = shared.createSeatTimer('p2', transport, { changed() {} });
st2.sync(viewAt('countdown', 1));
ok('no press during the countdown', !st2.down('f', viewAt('countdown', 1)));

void setClock;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
