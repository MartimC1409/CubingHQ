/* Tests the service worker's caching strategy.

   This exists because of a real cost: every asset on this site is
   versioned with ?v=, and the worker served those requests
   stale-while-revalidate *and* matched them with ignoreSearch. So a
   bumped version resolved to the previous file, and any change reached
   users a full page-load late. Several rounds of debugging were spent
   looking at code one revision behind what had just shipped.

   Run: node scripts/test_sw_cache.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ---------- a shim for the bits of the SW globals we use -------- */

function makeResponse(body, { ok = true, type = 'basic' } = {}) {
    return { _body: body, ok, type, clone() { return makeResponse(body, { ok, type }); } };
}

/** @param entries {Object} url -> body already in the cache */
function loadWorker({ entries = {}, offline = false, network = {} } = {}) {
    const store = new Map(Object.entries(entries));
    const puts = [];
    let fetches = 0;

    const cache = {
        match: async (request, opts) => {
            const url = typeof request === 'string' ? request : request.url;
            if (store.has(url)) return makeResponse(store.get(url));
            if (opts && opts.ignoreSearch) {
                const bare = url.split('?')[0];
                for (const [k, v] of store) {
                    if (k.split('?')[0] === bare) return makeResponse(v);
                }
            }
            return undefined;
        },
        put: async (request, res) => {
            const url = typeof request === 'string' ? request : request.url;
            puts.push(url);
            store.set(url, res._body);
        },
        add: async () => { },
    };

    const ctx = {
        caches: { open: async () => cache, keys: async () => [], delete: async () => true },
        fetch: async (request) => {
            fetches++;
            const url = typeof request === 'string' ? request : request.url;
            if (offline) throw new TypeError('Failed to fetch');
            return makeResponse(network[url] !== undefined ? network[url] : 'FROM-NETWORK');
        },
        Response: { error: () => makeResponse('ERROR', { ok: false }) },
        URL, TypeError, Promise, Object, Map, Set, JSON, console,
        self: {
            addEventListener() { },
            skipWaiting() { },
            clients: { claim() { } },
            location: { origin: 'https://www.cubinghq.online' },
        },
    };
    ctx.self.caches = ctx.caches;
    vm.createContext(ctx);

    const code = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    // The file registers listeners against `self`; expose its functions
    // by evaluating it and reading them out of the context.
    vm.runInContext(code + '\n;globalThis.__handleStatic = handleStatic;'
        + 'globalThis.__isVersioned = isVersioned;', ctx);

    return {
        handleStatic: ctx.__handleStatic,
        isVersioned: ctx.__isVersioned,
        puts,
        get fetches() { return fetches; },
        store,
    };
}

const req = (url) => ({ url });

(async () => {
    /* ---------- what counts as versioned ---------------------- */

    const w0 = loadWorker();
    check('a ?v= URL is versioned',
        w0.isVersioned(new URL('https://x/coach-video.js?v=2')));
    check('a bare URL is not',
        !w0.isVersioned(new URL('https://x/coach-video.js')));
    check('another query is not a version',
        !w0.isVersioned(new URL('https://x/coach-video.js?foo=1')));

    /* ---------- the bug this fixes ----------------------------- */

    // The exact failure: cache holds v1, page asks for v2. Serving the
    // cached copy means the user runs the previous release.
    let w = loadWorker({
        entries: { 'https://www.cubinghq.online/coach-video.js?v=1': 'OLD' },
        network: { 'https://www.cubinghq.online/coach-video.js?v=2': 'NEW' },
    });
    let res = await w.handleStatic(
        req('https://www.cubinghq.online/coach-video.js?v=2'),
        new URL('https://www.cubinghq.online/coach-video.js?v=2'));
    eq('a bumped version never resolves to the old file', res._body, 'NEW');
    eq('and it went to the network', w.fetches, 1);

    // Even an exact cached copy is bypassed: the version is the contract.
    w = loadWorker({
        entries: { 'https://www.cubinghq.online/app.js?v=19': 'CACHED' },
        network: { 'https://www.cubinghq.online/app.js?v=19': 'FRESH' },
    });
    res = await w.handleStatic(req('https://www.cubinghq.online/app.js?v=19'),
        new URL('https://www.cubinghq.online/app.js?v=19'));
    eq('a versioned asset is network-first', res._body, 'FRESH');
    check('and the fresh copy is stored', w.puts.includes('https://www.cubinghq.online/app.js?v=19'));

    /* ---------- offline still works ---------------------------- */

    w = loadWorker({
        entries: { 'https://www.cubinghq.online/app.js?v=19': 'CACHED' },
        offline: true,
    });
    res = await w.handleStatic(req('https://www.cubinghq.online/app.js?v=19'),
        new URL('https://www.cubinghq.online/app.js?v=19'));
    eq('offline falls back to the cached copy', res._body, 'CACHED');

    // But offline must not hand back a DIFFERENT version — that is the
    // original bug wearing a disguise.
    w = loadWorker({
        entries: { 'https://www.cubinghq.online/app.js?v=18': 'OLD' },
        offline: true,
    });
    res = await w.handleStatic(req('https://www.cubinghq.online/app.js?v=19'),
        new URL('https://www.cubinghq.online/app.js?v=19'));
    check('offline never substitutes another version', res._body !== 'OLD', res._body);

    /* ---------- unversioned assets keep the old strategy -------- */

    w = loadWorker({
        entries: { 'https://www.cubinghq.online/logo.png': 'CACHED' },
        network: { 'https://www.cubinghq.online/logo.png': 'FRESH' },
    });
    res = await w.handleStatic(req('https://www.cubinghq.online/logo.png'),
        new URL('https://www.cubinghq.online/logo.png'));
    eq('an unversioned asset is still served from cache', res._body, 'CACHED');

    // And its ignoreSearch fallback survives, which is what the original
    // comment was actually for: a precached bare path answering a query.
    w = loadWorker({
        entries: { 'https://www.cubinghq.online/logo.png': 'PRECACHED' },
        network: {},
    });
    res = await w.handleStatic(req('https://www.cubinghq.online/logo.png?t=123'),
        new URL('https://www.cubinghq.online/logo.png?t=123'));
    eq('a precached bare path still answers a non-version query', res._body, 'PRECACHED');

    // Nothing cached at all: straight to the network.
    w = loadWorker({ network: { 'https://www.cubinghq.online/new.js': 'FRESH' } });
    res = await w.handleStatic(req('https://www.cubinghq.online/new.js'),
        new URL('https://www.cubinghq.online/new.js'));
    eq('an uncached asset comes from the network', res._body, 'FRESH');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
