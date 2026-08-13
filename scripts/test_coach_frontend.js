/* Loads the Coach's browser modules in a minimal DOM shim and checks
   that they execute, export what other modules call, and behave
   correctly on the paths that matter.

   Not a substitute for opening the page — it is a fast guard against
   a typo in a module name or a missing export.

   Run: node scripts/test_coach_frontend.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ---------- the smallest DOM these modules need ---------------- */

function makeElement(tag) {
    const el = {
        tagName: String(tag || 'div').toUpperCase(),
        children: [], attributes: {}, dataset: {}, style: {},
        _html: '', textContent: '', hidden: false, value: '', disabled: false,
        classList: {
            _set: new Set(),
            add(...c) { c.forEach(x => this._set.add(x)); },
            remove(...c) { c.forEach(x => this._set.delete(x)); },
            toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); },
            contains(c) { return this._set.has(c); },
        },
        get innerHTML() { return this._html; },
        set innerHTML(v) { this._html = String(v); },
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k] ?? null; },
        removeAttribute(k) { delete this.attributes[k]; },
        appendChild(c) { this.children.push(c); return c; },
        insertBefore(c) { this.children.unshift(c); return c; },
        removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
        remove() { },
        addEventListener() { }, removeEventListener() { },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        scrollIntoView() { }, focus() { }, click() { },
        getContext() { return { measureText: () => ({ width: 10 }), save() { }, restore() { } }; },
    };
    return el;
}

function makeWindow() {
    const store = new Map();
    const listeners = new Map();
    const doc = {
        body: makeElement('body'),
        head: makeElement('head'),
        documentElement: makeElement('html'),
        readyState: 'complete',
        createElement: makeElement,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        removeEventListener() { },
        dispatchEvent(ev) {
            (listeners.get(ev.type) || []).forEach(fn => fn(ev));
            return true;
        },
        _listeners: listeners,
    };

    const win = {
        document: doc,
        localStorage: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
            clear: () => store.clear(),
        },
        navigator: { onLine: true },
        location: { href: 'https://cubinghq.online/coach.html', search: '', hash: '' },
        history: { replaceState() { } },
        CustomEvent: class CustomEvent {
            constructor(type, init) { this.type = type; this.detail = (init || {}).detail; }
        },
        Event: class Event { constructor(type) { this.type = type; } },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        requestAnimationFrame: (fn) => setTimeout(fn, 0),
        setTimeout, clearTimeout, setInterval, clearInterval,
        console, JSON, Math, Date, Object, Array, String, Number, Boolean,
        isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
        URLSearchParams, Set, Map, Promise, Infinity, NaN, RegExp, Error, TypeError,
        fetch: () => Promise.reject(new Error('no network in tests')),
        alert() { }, confirm: () => true,
        _store: store,
    };
    win.window = win;
    win.self = win;
    win.globalThis = win;
    return win;
}

function load(win, file) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    try {
        vm.runInNewContext(code, win, { filename: file });
        return true;
    } catch (e) {
        fail++;
        console.error(`FAIL loading ${file} — ${e.message}`);
        return false;
    }
}

const win = makeWindow();
const FILES = [
    'cube-stats.js', 'coach-cstimer.js', 'coach-analytics.js',
    'coach-evidence.js', 'coach-api.js', 'coach-store.js',
    'coach-chart.js', 'coach-ui.js', 'coach-onboarding.js',
    'coach-training.js', 'coach-chat.js', 'coach-dashboard.js',
];
for (const f of FILES) {
    if (load(win, f)) { pass++; }
}
// coach-app.js self-boots against a real DOM; loading it here would only
// test the shim. Its exports are asserted from the source instead.

/* ---------- every module attached itself ------------------------ */

const MODULES = ['CubeStats', 'CoachImport', 'CoachAnalytics', 'CoachEvidence',
    'CoachAPI', 'CoachStore', 'CoachChart', 'CoachUI', 'CoachOnboarding',
    'CoachTraining', 'CoachChat', 'CoachDashboard'];
for (const m of MODULES) check(`${m} attached to window`, typeof win[m] === 'object' && win[m] !== null);

/* ---------- the exports other modules actually call -------------- */

const CONTRACT = {
    CubeStats: ['effectiveMs', 'getBestSingle', 'getAverage', 'getMean', 'getStdDev'],
    CoachImport: ['parse', 'dedupe', 'parseTimeToken', 'eventFromScrType'],
    CoachAnalytics: ['rollingAverage', 'pbMarkers', 'sessionBoundaries', 'metricValue',
        'computeMetrics', 'computeStreak', 'detectMilestones', 'fmtMs', 'goalProgress'],
    CoachEvidence: ['getObservations', 'count', 'hasData', 'clear'],
    CoachAPI: ['loadProfile', 'saveProfile', 'deleteProfile', 'assess', 'plan', 'revise', 'chat'],
    CoachStore: ['get', 'getProfile', 'getPlan', 'hasOnboarded', 'latestAssessment',
        'listSessions', 'solvesForEvent', 'getTraining', 'todayKey', 'setProfile',
        'setGoal', 'addSession', 'removeSession', 'addAssessment', 'setPlan',
        'setTraining', 'completeDrill', 'markTrained', 'addMilestones',
        'seenMilestoneIds', 'recordMetricPoint', 'reset', 'pull', 'syncNow',
        'isSignedIn', 'hasAnyData'],
    CoachChart: ['render', 'destroy'],
    CoachUI: ['esc', 'fmt', 'fmtWithUnit', 'alert', 'empty', 'stat', 'statRow',
        'evidenceChip', 'finding', 'dataGaps', 'goalBar', 'richText', 'greeting',
        'eventLabel', 'isMo3', 'parseTimeInput', 'toast', 'T', 'ICON'],
    CoachOnboarding: ['init', 'show'],
    CoachTraining: ['today', 'start', 'collectResult', 'checkMilestones',
        'shouldRevise', 'revise'],
    CoachChat: ['init', 'send', 'clear', 'render'],
    CoachDashboard: ['renderAll', 'snapshot', 'renderTrend'],
};

for (const [mod, members] of Object.entries(CONTRACT)) {
    const target = win[mod];
    if (!target) continue;
    for (const m of members) {
        check(`${mod}.${m} exists`, typeof target[m] === 'function' || typeof target[m] === 'object',
            `got ${typeof target[m]}`);
    }
}

// coach-app.js's exports are what the dashboard's buttons call.
const appSrc = fs.readFileSync(path.join(ROOT, 'coach-app.js'), 'utf8');
for (const m of ['enterApp', 'enterOnboarding', 'activatePanel', 'reassess',
    'regeneratePlan', 'reviewProgress']) {
    check(`CoachApp.${m} exported`, new RegExp(`\\b${m}[,\\s]`).test(
        (appSrc.match(/window\.CoachApp\s*=\s*\{([\s\S]*?)\};/) || [, ''])[1]));
}

/* ---------- escaping: the security-relevant one ------------------ */

const UI = win.CoachUI;
eq('esc handles script tags', UI.esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;');
eq('esc handles quotes', UI.esc(`"'`), '&quot;&#39;');
eq('esc handles null', UI.esc(null), '');
check('richText escapes before formatting',
    !UI.richText('<img src=x onerror=alert(1)>').includes('<img'));
check('richText still bolds', UI.richText('**hi**').includes('<strong>hi</strong>'));
check('finding escapes model output',
    !UI.finding({ title: '<b>x</b>', detail: 'd', evidenceType: 'known', basis: 'b' }, 'weakness')
        .includes('<b>x</b>'));

/* ---------- the evidence chip is visually distinct ---------------- */

check('inferred chip is labelled', UI.evidenceChip('inferred').includes('Inferred'));
check('observed chip is labelled', UI.evidenceChip('observed').includes('Observed'));
check('known chip is labelled', UI.evidenceChip('known').includes('Measured'));
check('inferred has its own class', UI.evidenceChip('inferred').includes('coach-evidence--inferred'));
check('unknown type falls back to known', UI.evidenceChip('nonsense').includes('coach-evidence--known'));

/* ---------- store round-trip -------------------------------------- */

const Store = win.CoachStore;
eq('starts un-onboarded', Store.hasOnboarded(), false);
Store.setProfile({ primaryEvent: '333' });
Store.setGoal({ metric: 'ao100', targetMs: 10000 });
eq('onboarded after profile + goal', Store.hasOnboarded(), true);

const solves = Array.from({ length: 12 }, (_, i) => ({
    id: 's' + i, time: 12000 + i * 10, penalty: '', scramble: '', timestamp: 1700000000000 + i * 1000,
}));
const sess = Store.addSession({ source: 'test', name: 'S', event: '333', solves });
eq('session stored', Store.listSessions().length, 1);
eq('solveCount derived', sess.solveCount, 12);
eq('solves readable by event', Store.solvesForEvent('333').length, 12);
eq('other events excluded', Store.solvesForEvent('222').length, 0);
Store.removeSession(sess.id);
eq('session removed', Store.listSessions().length, 0);

// Persistence really goes through localStorage.
check('persisted to localStorage', win._store.has('chq_coach_v1'));

/* ---------- guests never hit the network -------------------------- */

eq('guest is not signed in', Store.isSignedIn(), false);
eq('guest sync state is local-only', Store.syncState, 'local-only');

/* ---------- training gate is deterministic ------------------------ */

const Training = win.CoachTraining;
const gate = Training.shouldRevise();
eq('no plan means no review', gate.revise, false);
eq('reason reported', gate.reason, 'no-plan');
eq('no plan means no drills', Training.today(), null);

/* ---------- UI helpers on real numbers ---------------------------- */

eq('fmtWithUnit seconds', UI.fmtWithUnit(11820), '11.82s');
eq('fmtWithUnit minutes', UI.fmtWithUnit(62500), '1:02.50');
eq('fmtWithUnit null', UI.fmtWithUnit(null), '—');
eq('eventLabel maps', UI.eventLabel('333oh'), 'One-Handed');
eq('eventLabel unknown passes through', UI.eventLabel('zzz'), 'zzz');
eq('mo3 for 6x6', UI.isMo3('666'), true);
eq('ao5 for 3x3', UI.isMo3('333'), false);
eq('parseTimeInput reads seconds', UI.parseTimeInput('14.5'), 14500);
eq('parseTimeInput rejects junk', UI.parseTimeInput('soon'), null);

/* ---------- evidence collector ------------------------------------ */

const Ev = win.CoachEvidence;
eq('no observations initially', Ev.count(), 0);
eq('hasData false', Ev.hasData(), false);
const obs = Ev._internal.observationsFor({
    segments: [
        { phase: 'cross', ms: 1900, moveCount: 8, tps: 4.2, rating: 'optimal', longestPause: 120 },
        { phase: 'f2l', slot: 2, ms: 3100, moveCount: 11, tps: 3.5, rating: 'fumble', longestPause: 900 },
        { phase: 'pll', ms: 1500, moveCount: 12, tps: 8, rating: 'blunder', undos: 2, longestPause: 200 },
    ],
    totalMs: 11000, moveCount: 55, complete: true, crossFace: 'D',
});
const cats = obs.map(o => o.category);
check('pause observed', cats.includes('pauses'));
check('wasted moves observed', cats.includes('wasted_moves'));
check('tps observed', cats.includes('tps'));
check('short pauses not reported', obs.filter(o => o.category === 'pauses').length === 1);
check('every observation carries evidence', obs.every(o => o.evidence && o.confidence));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
