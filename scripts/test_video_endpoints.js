/* Tests the video upload endpoints as handlers.

   These two functions had no handler-level coverage at all: the existing
   test_video_chunking.js exercises the CLIENT, and the server side was
   only ever tested through the provider adapter. The gap is exactly
   where the live failure sits.

   The case that matters most is how the request body arrives. The
   platform buffers a request before the handler runs, and a body whose
   content type it does not recognise — application/octet-stream, which
   is precisely what a video chunk is sent as — arrives as a Buffer on
   req.body with the underlying stream already drained. Iterating the
   stream then yields nothing, so a perfectly good chunk looks empty.
   Both shapes are asserted here.

   Run: node scripts/test_video_endpoints.js */

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

const MODULES = ['../api/coach/video/begin.js', '../api/coach/video/chunk.js',
    '../api/_lib/model.js', '../api/_lib/gemini.js', '../api/_lib/openrouter.js',
    '../api/_lib/claude.js', '../api/_lib/upload-token.js', '../api/_lib/auth.js',
    '../api/_lib/http.js'];

const ENV = {
    COACH_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-key',
    COACH_MODEL: 'gemini-3.6-flash',
};

const UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files/session-abc';

/** Records every outbound request so the relay can be asserted exactly. */
let sent = [];

function installFetch({ startStatus = 200, chunkStatus = 200, uploadUrl = UPLOAD_URL } = {}) {
    sent = [];
    global.fetch = async (url, opts = {}) => {
        const u = String(url);
        sent.push({ url: u, headers: opts.headers || {}, body: opts.body, method: opts.method });

        // WCA identity check, done by requireUser before anything else.
        if (u.includes('worldcubeassociation.org')) {
            return {
                ok: true, status: 200,
                json: async () => ({ me: { id: 2019, wca_id: '2019TEST01', name: 'Test Cuber' } }),
            };
        }

        // Opening the resumable session.
        if (u.includes('/upload/v1beta/files?')) {
            return {
                ok: startStatus === 200, status: startStatus,
                headers: { get: (h) => (h.toLowerCase() === 'x-goog-upload-url' ? uploadUrl : null) },
                json: async () => (startStatus === 200
                    ? {}
                    : { error: { message: 'start refused' } }),
                text: async () => 'start refused',
            };
        }

        // A chunk.
        return {
            ok: chunkStatus === 200, status: chunkStatus,
            json: async () => (chunkStatus === 200
                ? { file: { name: 'files/xyz', uri: 'https://x/y', state: 'PROCESSING' } }
                : { error: { message: 'chunk refused' } }),
            text: async () => 'chunk refused',
        };
    };
}

function load(path) {
    for (const m of MODULES) delete require.cache[require.resolve(m)];
    Object.assign(process.env, ENV);
    return require(path);
}

/** Drives a handler and returns { status, body }. */
async function call(handlerPath, req) {
    const handler = load(handlerPath);
    let status = 0, payload = null;
    const res = {
        statusCode: 0,
        setHeader() { },
        end(body) { payload = body ? JSON.parse(body) : null; status = this.statusCode; },
    };
    await handler(Object.assign({ method: 'POST' }, req), res);
    return { status, body: payload };
}

/** A request whose body is only readable as a stream. */
function streamed(buf) {
    return {
        [Symbol.asyncIterator]: async function* () { yield buf; },
    };
}

(async () => {
    const AUTH = { authorization: 'Bearer wca-token' };

    /* ---- /begin ------------------------------------------------- */

    installFetch();
    let r = await call('../api/coach/video/begin.js', {
        headers: AUTH,
        body: { mimeType: 'video/mp4', sizeBytes: 10 * 1024 * 1024 },
    });
    eq('begin succeeds', r.status, 200);
    check('begin returns a token', typeof r.body.token === 'string' && r.body.token.length > 10);
    check('the token is opaque — the URL is not in it',
        !r.body.token.includes('generativelanguage'), r.body.token);
    check('begin advertises a chunk size', r.body.chunkBytes > 0);

    const token = r.body.token;

    installFetch();
    r = await call('../api/coach/video/begin.js', {
        headers: AUTH,
        body: { mimeType: 'application/pdf', sizeBytes: 1000 },
    });
    eq('begin refuses a non-video type', r.status, 400);

    installFetch();
    r = await call('../api/coach/video/begin.js', {
        headers: {},
        body: { mimeType: 'video/mp4', sizeBytes: 1000 },
    });
    eq('begin requires sign-in', r.status, 401);
    eq('and says so', r.body.error.code, 'no_token');

    /* ---- /chunk, body already buffered by the platform ---------- */

    // The live-failure case. If the handler reads only the stream, this
    // relays zero bytes and the upload is silently wrong.
    const payload = Buffer.alloc(2048, 0x41);

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token,
            'x-upload-offset': '0',
            'x-upload-final': '1',
        }, AUTH),
        body: payload,
    });
    eq('a pre-buffered body still uploads', r.status, 200);
    eq('and finalises', r.body.done, true);
    eq('returning the file record', r.body.name, 'files/xyz');

    let relay = sent.find(s => s.url === UPLOAD_URL);
    check('the real bytes reach Google', Buffer.isBuffer(relay.body)
        && relay.body.length === payload.length && relay.body.equals(payload),
        `sent ${relay.body && relay.body.length} of ${payload.length}`);
    eq('at the declared offset', relay.headers['X-Goog-Upload-Offset'], '0');
    eq('with the finalise command', relay.headers['X-Goog-Upload-Command'], 'upload, finalize');

    /* ---- /chunk, body as a stream ------------------------------- */

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token,
            'x-upload-offset': '3145728',
            'x-upload-final': '0',
        }, AUTH),
        ...streamed(payload),
    });
    eq('a streamed body still uploads', r.status, 200);
    eq('an intermediate chunk is not done', r.body.done, false);
    eq('and reports what it took', r.body.received, payload.length);

    relay = sent.find(s => s.url === UPLOAD_URL);
    check('the streamed bytes reach Google intact', relay.body.equals(payload));
    eq('at its own offset', relay.headers['X-Goog-Upload-Offset'], '3145728');
    eq('without finalising', relay.headers['X-Goog-Upload-Command'], 'upload');

    /* ---- /chunk rejections -------------------------------------- */

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token.slice(0, -3) + 'zzz',
            'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: payload,
    });
    eq('a tampered token is refused', r.status, 400);
    eq('with a session code', r.body.error.code, 'bad_session');
    check('and nothing is relayed', !sent.some(s => s.url === UPLOAD_URL));

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({ 'x-upload-token': token, 'x-upload-final': '1' }, AUTH),
        body: payload,
    });
    eq('a missing offset is refused', r.status, 400);

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: Buffer.alloc(0),
    });
    eq('an empty chunk is refused', r.status, 400);

    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: Buffer.alloc(64 * 1024 * 1024),
    });
    eq('an oversized chunk is refused', r.status, 413);
    eq('as too_large', r.body.error.code, 'too_large');

    // A decoded string cannot be turned back into bytes without risk of
    // corruption, so it must fail loudly rather than upload a subtly
    // wrong video that only breaks later, somewhere else.
    installFetch();
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: 'these are not bytes',
    });
    eq('a text-decoded body is refused rather than re-encoded', r.status, 400);
    check('and nothing is relayed', !sent.some(s => s.url === UPLOAD_URL));

    /* ---- Google rejecting the chunk ----------------------------- */

    // 400 used to classify as `unknown`, which named neither the cause
    // nor even which side of the link it came from.
    installFetch({ chunkStatus: 400 });
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: payload,
    });
    eq('a rejected chunk surfaces as bad_upload', r.body.error.code, 'bad_upload');
    check('not as unknown', r.body.error.code !== 'unknown');
    // The error body is what the page's technical block renders, and it
    // is reported by screenshot. Without these, telling "the session
    // would not open" from "Google refused a slice" meant reading the
    // deploy logs, which is how several rounds were spent.
    eq('the body names the failing call', r.body.error.step, 'chunk');
    check("and carries Google's own words", /chunk refused/i.test(r.body.error.detail || ''),
        JSON.stringify(r.body.error));

    installFetch({ startStatus: 400 });
    r = await call('../api/coach/video/begin.js', {
        headers: AUTH,
        body: { mimeType: 'video/mp4', sizeBytes: 1000 },
    });
    eq('a session that will not open says which step', r.body.error.step, 'begin');
    check('rather than looking identical to a chunk failure',
        r.body.error.step !== 'chunk');

    // The detail reaches a signed-in browser, so it must never carry a
    // credential — neither the API key nor the session id, which is a
    // bearer token for that upload.
    installFetch({ chunkStatus: 400 });
    global.fetch = (function (inner) {
        return async (url, opts) => {
            const res = await inner(url, opts);
            if (!String(url).includes('worldcubeassociation')) {
                res.json = async () => ({
                    error: {
                        message: 'rejected for https://x/u?upload_id=AHxX3fSECRET'
                            + '&key=AIzaSyLEAKEDKEYVALUE',
                    },
                });
            }
            return res;
        };
    })(global.fetch);
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: payload,
    });
    const serialised = JSON.stringify(r.body);
    check('no API key reaches the browser', !/AIzaSy/.test(serialised), serialised);
    check('no upload session id either', !/AHxX3f/.test(serialised), serialised);
    check('but something useful survives', /rejected for/.test(serialised), serialised);

    installFetch({ chunkStatus: 503 });
    r = await call('../api/coach/video/chunk.js', {
        headers: Object.assign({
            'x-upload-token': token, 'x-upload-offset': '0', 'x-upload-final': '1',
        }, AUTH),
        body: payload,
    });
    eq('a 5xx is still upstream', r.body.error.code, 'upstream');

    /* ---- method guard ------------------------------------------- */

    installFetch();
    r = await call('../api/coach/video/chunk.js', { method: 'GET', headers: AUTH });
    eq('GET is not allowed on chunk', r.status, 405);
    r = await call('../api/coach/video/begin.js', { method: 'GET', headers: AUTH });
    eq('GET is not allowed on begin', r.status, 405);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
