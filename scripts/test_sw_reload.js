/* Tests the service-worker auto-reload guard.

   The page that triggers a worker update is always the stale one: its
   scripts came from the OLD worker's cache before the new one claimed
   control. Reloading on controllerchange closes that gap — but an
   automatic reload is exactly the kind of thing that goes wrong loudly,
   so the guards are what these tests are really about. A reload loop on
   a live site is far worse than a stale asset.

   The handler is extracted from the page rather than duplicated here,
   so a change to the shipped markup cannot silently escape the tests.

   Run: node scripts/test_sw_reload.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PAGES = ['coach.html', 'index.html', 'timer.html'];

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/** Pulls the registration script out of a page so the real code runs. */
function extractBlock(page) {
    const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const start = src.indexOf("if ('serviceWorker' in navigator) {");
    if (start === -1) return null;
    const end = src.indexOf('</script>', start);
    return src.slice(start, end);
}

/**
 * Runs the page's registration block against a fake browser.
 * @returns a handle for firing controllerchange and reading reloads
 */
function run(page, { hasController = true, storageThrows = false } = {}) {
    const listeners = [];
    const store = new Map();
    let reloads = 0;

    const ctx = {
        console: { warn() { }, error() { }, log() { } },
        navigator: {
            serviceWorker: {
                controller: hasController ? { scriptURL: '/sw.js' } : null,
                addEventListener: (type, fn) => { if (type === 'controllerchange') listeners.push(fn); },
                register: () => Promise.resolve({}),
            },
        },
        sessionStorage: {
            getItem: (k) => {
                if (storageThrows) throw new Error('denied');
                return store.has(k) ? store.get(k) : null;
            },
            setItem: (k, v) => {
                if (storageThrows) throw new Error('denied');
                store.set(k, String(v));
            },
        },
        Error,
    };
    ctx.window = {
        addEventListener() { },
        location: { reload: () => { reloads++; } },
    };
    ctx.location = ctx.window.location;
    ctx.addEventListener = ctx.window.addEventListener;

    vm.runInNewContext(extractBlock(page), ctx, { filename: page });

    return {
        fireControllerChange: () => listeners.forEach(fn => fn()),
        get reloads() { return reloads; },
        get listenerCount() { return listeners.length; },
        store,
    };
}

/* ---------- the block exists on every page it should ------------ */

for (const page of PAGES) {
    check(`${page} registers a service worker`, extractBlock(page) !== null);
    check(`${page} listens for controllerchange`,
        (extractBlock(page) || '').includes('controllerchange'));
}

/* ---------- the behaviour, on the page that matters ------------- */

const PAGE = 'coach.html';

// The case this exists for: an update arrives while a page is already
// controlled, so its scripts are stale.
let h = run(PAGE, { hasController: true });
eq('one listener is attached', h.listenerCount, 1);
eq('no reload before anything happens', h.reloads, 0);
h.fireControllerChange();
eq('a controller change reloads once', h.reloads, 1);

// Guard 1: a first-time visitor has no previous controller, so nothing
// is stale. Reloading them would be worse than the problem.
h = run(PAGE, { hasController: false });
h.fireControllerChange();
eq('the first install does not reload', h.reloads, 0);

// Guard 2: the flag makes a loop impossible even if a worker re-claims.
h = run(PAGE, { hasController: true });
h.fireControllerChange();
h.fireControllerChange();
h.fireControllerChange();
eq('repeated claims still reload only once', h.reloads, 1);

// The flag is session-scoped: a new session may legitimately reload
// again, which is what makes this per-visit rather than permanent.
h = run(PAGE, { hasController: true });
h.fireControllerChange();
check('the guard is recorded in session storage',
    h.store.has('chq-sw-reloaded'), JSON.stringify([...h.store]));

// Private mode can throw on sessionStorage. Without a working guard a
// reload could repeat, so it is skipped rather than risked.
h = run(PAGE, { hasController: true, storageThrows: true });
h.fireControllerChange();
eq('no reload when the guard cannot be recorded', h.reloads, 0);

/* ---------- every page behaves the same ------------------------- */

for (const page of PAGES) {
    const p = run(page, { hasController: true });
    p.fireControllerChange();
    p.fireControllerChange();
    eq(`${page} reloads exactly once`, p.reloads, 1);

    const first = run(page, { hasController: false });
    first.fireControllerChange();
    eq(`${page} spares a first-time visitor`, first.reloads, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
