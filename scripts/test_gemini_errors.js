/* Tests that Google's own words survive the trip to the screen.

   The bug: readError called res.json() first and res.text() in the
   catch. res.json() CONSUMES the body before it throws, so the text
   read could only ever fail with "Body has already been read" — and
   every error whose body was not JSON came out as the bare string
   `HTTP <status>`.

   Model errors are JSON, so they were fine, and that is why this
   survived. Resumable upload rejections are plain text: the one
   sentence saying why an upload was refused was destroyed every single
   time, which is exactly what a user reported — "fallback detail:
   HTTP 400" and nothing else to go on.

   These assertions were checked against the old readError first and
   fail there, so they catch the bug rather than only describing it.

   Run: node scripts/test_gemini_errors.js */

'use strict';

const Module = require('module');
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === '@anthropic-ai/sdk') return require.resolve('./_stub_anthropic.js');
    return realResolve.call(this, request, ...rest);
};
require('fs').writeFileSync(__dirname + '/_stub_anthropic.js',
    'module.exports = class Anthropic { constructor() {} };\n');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

process.env.COACH_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-key';
process.env.COACH_MODEL = 'gemini-3.6-flash';

const gemini = require('../api/_lib/gemini.js');
const { readError } = gemini._internal || {};

(async () => {
    check('readError is reachable for testing', typeof readError === 'function');
    if (typeof readError !== 'function') {
        console.log(`\n${pass} passed, ${fail} failed`);
        process.exit(1);
    }

    /* ---- the case that was being thrown away --------------------- */

    // A real resumable-upload refusal: plain text, not JSON.
    let got = await readError(new Response('Failed to parse upload offset.', { status: 400 }));
    check("a plain-text refusal keeps Google's sentence",
        got.includes('Failed to parse upload offset'), got);
    check('and is not reduced to a status code', !/^HTTP 400$/.test(got), got);

    got = await readError(new Response('<html><body>Bad Request</body></html>', { status: 400 }));
    check('even an HTML error page survives', got.includes('Bad Request'), got);

    /* ---- what already worked must keep working -------------------- */

    got = await readError(new Response(JSON.stringify({
        error: { message: 'API key not valid. Please pass a valid API key.' },
    }), { status: 400 }));
    eq('a JSON error still yields its message',
        got, 'API key not valid. Please pass a valid API key.');

    got = await readError(new Response(JSON.stringify({ weird: true }), { status: 400 }));
    check('JSON with no error field is stringified', got.includes('weird'), got);

    /* ---- an empty body still says something ----------------------- */

    got = await readError(new Response('', { status: 400 }));
    eq('an empty body falls back to the status', got, 'HTTP 400');

    // Google answers a dead resumable session with an empty body and this
    // header. It is the whole diagnosis, so it must reach the caller.
    got = await readError(new Response('', {
        status: 400, headers: { 'x-goog-upload-status': 'cancelled' },
    }));
    check('an empty body still reports the upload status',
        got.includes('cancelled'), got);

    got = await readError(new Response('Upload not found.', {
        status: 400, headers: { 'x-goog-upload-status': 'final' },
    }));
    check('a text body carries the upload status alongside it',
        got.includes('Upload not found') && got.includes('final'), got);

    /* ---- a body that cannot be read at all ------------------------ */

    const unreadable = {
        status: 400,
        headers: { get: () => null },
        text: async () => { throw new Error('stream broken'); },
    };
    eq('an unreadable body degrades rather than throwing',
        await readError(unreadable), 'HTTP 400');

    /* ---- the chunk size Google will accept ------------------------ */

    const begin = require('../api/coach/video/_begin.js');
    const { alignedChunkBytes, CHUNK_GRANULARITY, CHUNK_BYTES } = begin._internal;

    eq('the shipped default is a whole number of 256KB blocks',
        CHUNK_BYTES % CHUNK_GRANULARITY, 0);
    eq('an unaligned override is rounded down, not passed through',
        alignedChunkBytes('3000000') % CHUNK_GRANULARITY, 0);
    check('and stays close to what was asked for',
        alignedChunkBytes('3000000') > 2.5 * 1024 * 1024, String(alignedChunkBytes('3000000')));
    eq('a too-small value becomes one block', alignedChunkBytes('1000'), CHUNK_GRANULARITY);
    eq('so does nonsense', alignedChunkBytes('not a number'), CHUNK_GRANULARITY);
    eq('and an empty setting is the default',
        alignedChunkBytes('') % CHUNK_GRANULARITY, 0);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
