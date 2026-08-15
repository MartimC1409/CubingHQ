/* Tests the chunked fallback upload in coach-api.js.

   Offsets and the finalise flag are the two things that can go wrong
   silently: a wrong offset corrupts the file inside Google rather than
   failing, and a missing finalise leaves an upload that never completes.
   Both are asserted against the exact byte ranges.

   Run: node scripts/test_video_chunking.js */

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

/** A File stand-in that records the ranges asked of it. */
function fakeFile(size, type) {
    return {
        size, type, name: 'solve.mp4',
        slice(start, end) { return { _start: start, _end: end, length: end - start }; },
    };
}

function loadApi({ chunkBytes = 3 * 1024 * 1024, failAt = -1 } = {}) {
    const calls = [];
    const ctx = {
        window: {}, self: {},
        document: { addEventListener() { }, querySelector: () => null },
        navigator: { onLine: true },
        localStorage: { getItem: () => 'wca-token', setItem() { }, removeItem() { } },
        console,
        JSON, Math, Object, Array, String, Number, Boolean, Promise, Error,
        RegExp, Set, Map, isFinite, parseInt, parseFloat, encodeURIComponent,
        setTimeout, clearTimeout, TextDecoder,
        fetch: async (url, opts) => {
            calls.push({
                url: String(url),
                headers: opts.headers || {},
                body: opts.body,
            });

            if (String(url).endsWith('/begin')) {
                return {
                    ok: true, status: 200,
                    json: async () => ({ token: 'opaque.token', chunkBytes }),
                };
            }

            const index = calls.filter(c => c.url.endsWith('/chunk')).length - 1;
            if (index === failAt) {
                return {
                    ok: false, status: 500,
                    json: async () => ({ error: { code: 'upstream', message: 'chunk died' } }),
                };
            }

            const isFinal = opts.headers['X-Upload-Final'] === '1';
            return {
                ok: true, status: 200,
                json: async () => (isFinal
                    ? { done: true, name: 'files/abc', uri: 'u', state: 'ACTIVE' }
                    : { done: false, received: 1 }),
            };
        },
    };
    ctx.window = ctx;
    ctx.self = ctx;
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'coach-api.js'), 'utf8'),
        ctx, { filename: 'coach-api.js' });
    return { api: ctx.CoachAPI, calls };
}

(async () => {
    /* ---------- a file smaller than one chunk -------------------- */

    let { api, calls } = loadApi();
    let res = await api.proxyVideoUpload(fakeFile(1000, 'video/mp4'));

    const chunks = () => calls.filter(c => c.url.endsWith('/chunk'));
    eq('a small file takes one chunk', chunks().length, 1);
    eq('sent at offset 0', chunks()[0].headers['X-Upload-Offset'], '0');
    eq('and finalised', chunks()[0].headers['X-Upload-Final'], '1');
    eq('the whole file is sent', chunks()[0].body._end, 1000);
    eq('the file record comes back', res.name, 'files/abc');

    /* ---------- a file spanning several chunks ------------------- */

    ({ api, calls } = loadApi({ chunkBytes: 3 * 1024 * 1024 }));
    const TEN_MB = 10 * 1024 * 1024;
    const progress = [];
    res = await api.proxyVideoUpload(fakeFile(TEN_MB, 'video/mp4'), (f) => progress.push(f));

    const sent = chunks();
    eq('10MB in 3MB slices is 4 chunks', sent.length, 4);

    // Wrong offsets corrupt the file inside Google rather than failing,
    // so they are checked exactly rather than approximately.
    const offsets = sent.map(c => Number(c.headers['X-Upload-Offset']));
    eq('offsets are exact and in order', JSON.stringify(offsets),
        JSON.stringify([0, 3145728, 6291456, 9437184]));

    // The ranges must tile the file with no gap and no overlap.
    let covered = 0;
    let contiguous = true;
    for (const c of sent) {
        if (c.body._start !== covered) contiguous = false;
        covered = c.body._end;
    }
    check('the slices are contiguous', contiguous,
        JSON.stringify(sent.map(c => [c.body._start, c.body._end])));
    eq('and cover the whole file', covered, TEN_MB);

    const finals = sent.map(c => c.headers['X-Upload-Final']);
    eq('only the last chunk finalises', JSON.stringify(finals),
        JSON.stringify(['0', '0', '0', '1']));

    check('every chunk carries the session token',
        sent.every(c => c.headers['X-Upload-Token'] === 'opaque.token'));
    check('every chunk is sent as raw bytes',
        sent.every(c => c.headers['Content-Type'] === 'application/octet-stream'));
    check('the session is opened once', calls.filter(c => c.url.endsWith('/begin')).length === 1);

    /* ---------- progress reads as one upload -------------------- */

    eq('progress is reported per chunk', progress.length, 4);
    check('it never goes backwards',
        progress.every((p, i) => i === 0 || p > progress[i - 1]), JSON.stringify(progress));
    eq('it ends at 100%', progress[progress.length - 1], 1);
    check('it starts partway, not at zero — a bar that resets per chunk reads as stuck',
        progress[0] > 0 && progress[0] < 1, String(progress[0]));

    /* ---------- a failure partway must not look like success ---- */

    ({ api, calls } = loadApi({ chunkBytes: 3 * 1024 * 1024, failAt: 2 }));
    let threw = null;
    try { await api.proxyVideoUpload(fakeFile(TEN_MB, 'video/mp4')); }
    catch (e) { threw = e; }
    check('a mid-upload failure throws', !!threw, 'no error');
    eq('and stops sending', chunks().length, 3);
    // The server's own wording is deliberately not shown — the client
    // maps codes to sentences written for a cuber. The code is what has
    // to survive, so the failure can still be reasoned about.
    eq('the error code survives', threw.code, 'upstream');
    check('and the user gets a readable sentence',
        /try again/i.test(threw.message), threw.message);

    /* ---------- the session request is well formed -------------- */

    ({ api, calls } = loadApi());
    await api.proxyVideoUpload(fakeFile(2048, 'video/quicktime'));
    const begin = calls.find(c => c.url.endsWith('/begin'));
    const body = JSON.parse(begin.body);
    eq('begin declares the type', body.mimeType, 'video/quicktime');
    eq('begin declares the size', body.sizeBytes, 2048);
    check('begin is authenticated', /Bearer /.test(begin.headers.Authorization || ''));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
