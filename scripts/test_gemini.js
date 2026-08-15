/* Tests the Gemini adapter: schema translation, SSE parsing, error
   classification, the repair loop and the video upload handshake.
   No network — global fetch is stubbed with a queue of canned responses.
   Run: node scripts/test_gemini.js */

'use strict';

// Read at module load in gemini.js, so they must be set first.
process.env.GEMINI_API_KEY = 'test-key';
process.env.COACH_MODEL = 'gemini-test';
process.env.COACH_MAX_VIDEO_BYTES = String(50 * 1024 * 1024);

const { COACH_ASSESSMENT_SCHEMA } = require('../api/_lib/schemas.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ================= fetch stub =================================== */

const queue = [];
let requests = [];

function sse(frames, { chunkSize = 0 } = {}) {
    const text = frames.map(f => `data: ${JSON.stringify(f)}\n\n`).join('');
    const bytes = Buffer.from(text, 'utf8');
    const chunks = [];
    const step = chunkSize || bytes.length;
    for (let i = 0; i < bytes.length; i += step) chunks.push(bytes.subarray(i, i + step));

    let i = 0;
    return {
        ok: true, status: 200,
        body: {
            getReader: () => ({
                read: async () => i < chunks.length
                    ? { done: false, value: new Uint8Array(chunks[i++]) }
                    : { done: true, value: undefined },
                cancel: async () => { },
            }),
        },
    };
}

function errorResponse(status, message) {
    return {
        ok: false, status,
        json: async () => ({ error: { code: status, message } }),
        text: async () => message,
    };
}

function jsonResponse(status, body, headers = {}) {
    const lower = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k) => lower[String(k).toLowerCase()] || null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    };
}

/** A Gemini SSE frame carrying text. */
function part(text, finish) {
    const c = { content: { role: 'model', parts: text ? [{ text }] : [] } };
    if (finish) c.finishReason = finish;
    return { candidates: [c] };
}

global.fetch = async (url, opts = {}) => {
    requests.push({
        url: String(url),
        method: opts.method || 'GET',
        headers: opts.headers || {},
        // Raw bytes are a legitimate body here — a video chunk is sent as
        // a Buffer — so only decode what is actually JSON. Parsing
        // everything made an upload look like a network failure.
        body: typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || null),
    });
    if (!queue.length) throw new Error('test: no queued response');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
};

const G = require('../api/_lib/gemini.js');
const { classifyFailure, toGeminiSchema, extractJson, readStream,
    extractSuggestedModel, checkModel } = G._internal;

/* ================= retired model names ========================== */

// The real message that took production down, verbatim from Google.
const RETIRED = 'This model models/gemini-2.5-flash is no longer available to new users. '
    + 'Please update your code to use models/gemini-3.6-flash for the latest features and improvements.';

eq('lifts the replacement out of a retirement notice',
    extractSuggestedModel(RETIRED), 'gemini-3.6-flash');
// The message names the OLD model first; echoing that back would send
// the operator round in a circle.
check('does not echo the retired name back',
    extractSuggestedModel(RETIRED) !== 'gemini-2.5-flash');

eq('works without the models/ prefix',
    extractSuggestedModel('Please use gemini-9.9-pro instead.'), 'gemini-9.9-pro');
eq('no suggestion when none is offered',
    extractSuggestedModel('models/foo is not found for API version v1beta'), null);
eq('tolerates an empty message', extractSuggestedModel(''), null);
eq('tolerates a missing message', extractSuggestedModel(null), null);

// A retirement is still a bad_model, so the fallback logic is unchanged.
eq('a retired model classifies as bad_model', classifyFailure(404, RETIRED), 'bad_model');

/* ================= schema translation =========================== */

const translated = toGeminiSchema(COACH_ASSESSMENT_SCHEMA);

// The whole reason this function exists: Gemini rejects the request
// outright if additionalProperties is present, and schemas.js sets it on
// every object.
function hasAdditionalProperties(node) {
    if (!node || typeof node !== 'object') return false;
    if ('additionalProperties' in node) return true;
    return Object.values(node).some(hasAdditionalProperties);
}
check('additionalProperties is stripped everywhere', !hasAdditionalProperties(translated));

eq('object types are uppercased', translated.type, 'OBJECT');
eq('string types are uppercased', translated.properties.summary.type, 'STRING');
eq('array types are uppercased', translated.properties.strengths.type, 'ARRAY');
eq('number types are uppercased', translated.properties.confidence.type, 'NUMBER');
eq('nested item objects translate', translated.properties.strengths.items.type, 'OBJECT');

// The evidence contract rides on this enum surviving translation.
const evidenceType = translated.properties.strengths.items.properties.evidenceType;
eq('enum survives', JSON.stringify(evidenceType.enum),
    JSON.stringify(['known', 'observed', 'inferred']));
check('required survives', translated.required.includes('bottleneck'));
check('nested required survives',
    translated.properties.strengths.items.required.includes('evidenceType'));
check('descriptions survive', typeof translated.properties.summary.description === 'string');

// Gemini emits fields in the order given, and the schemas put the summary
// first deliberately.
check('propertyOrdering is set', Array.isArray(translated.propertyOrdering));
eq('propertyOrdering leads with summary', translated.propertyOrdering[0], 'summary');

eq('non-objects pass through', toGeminiSchema(null), null);

/* ================= classifyFailure ============================== */

eq('invalid key', classifyFailure(400, 'API key not valid. Please pass a valid API key.'), 'auth');
eq('permission denied', classifyFailure(403, 'Permission denied'), 'auth');
eq('missing model', classifyFailure(404, 'models/foo is not found for API version v1beta'), 'bad_model');
eq('404 defaults to bad model', classifyFailure(404, 'nope'), 'bad_model');
eq('quota exhausted', classifyFailure(429, 'You exceeded your current quota'), 'no_credit');
eq('plain rate limit', classifyFailure(429, 'Resource has been exhausted'), 'rate_limited');
eq('upstream', classifyFailure(503, 'The model is overloaded'), 'upstream');

// A quota problem and a rate limit need opposite responses from the
// operator, so they must not collapse into one another.
check('quota is not a plain rate limit',
    classifyFailure(429, 'exceeded your current quota') !== 'rate_limited');

/* ================= extractJson ================================== */

eq('bare json', extractJson('{"a":1}').a, 1);
eq('fenced json', extractJson('```json\n{"a":2}\n```').a, 2);
eq('prose around json', extractJson('Here:\n{"a":3}\ndone').a, 3);
eq('garbage yields null', extractJson('nope'), null);

/* ================= readStream =================================== */

(async () => {
    let out = '';
    let r = await readStream(sse([part('He'), part('llo'), part('', 'STOP')]), t => { out += t; });
    eq('stream concatenates', r.text, 'Hello');
    eq('deltas forwarded', out, 'Hello');
    eq('finishReason captured', r.finish, 'STOP');

    // Byte-level chunking must not split a frame's meaning.
    r = await readStream(sse([part('one'), part('two'), part('three')], { chunkSize: 9 }));
    eq('partial lines are buffered', r.text, 'onetwothree');

    // Several parts in one candidate.
    r = await readStream({
        ok: true, status: 200,
        body: {
            getReader: () => {
                let done = false;
                return {
                    read: async () => done ? { done: true } : (done = true, {
                        done: false,
                        value: new Uint8Array(Buffer.from(
                            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })}\n\n`)),
                    }),
                    cancel: async () => { },
                };
            },
        },
    });
    eq('multiple parts concatenate', r.text, 'ab');

    let threw = null;
    try { await readStream(sse([{ error: { code: 429, message: 'Resource has been exhausted' } }])); }
    catch (e) { threw = e; }
    eq('mid-stream error throws', threw && threw.code, 'rate_limited');

    /* ================= structured ================================ */

    const assessment = {
        summary: 'Ao100 is 11.82s.',
        strengths: [], weaknesses: [],
        bottleneck: {
            title: 'Consistency', detail: 'Spread is wide.',
            evidenceType: 'inferred', basis: 'Ao100 11.82s vs best single 9.42s',
        },
        rationale: 'Because.', priority: 'Consistency', confidence: 0.7,
        dataGaps: ['PLL recognition quality'], recommendedActions: [],
    };

    requests = [];
    queue.push(sse([part(JSON.stringify(assessment), 'STOP')]));
    let got = await G.structured({ system: 'sys', user: 'usr', schema: COACH_ASSESSMENT_SCHEMA });
    eq('structured returns the object', got.summary, 'Ao100 is 11.82s.');
    eq('one request on the happy path', requests.length, 1);
    check('streams over SSE', /streamGenerateContent\?alt=sse/.test(requests[0].url));
    check('key is on the query string', /key=test-key/.test(requests[0].url));
    eq('system goes in systemInstruction', requests[0].body.systemInstruction.parts[0].text, 'sys');
    eq('user turn has role user', requests[0].body.contents[0].role, 'user');
    eq('asks for JSON', requests[0].body.generationConfig.responseMimeType, 'application/json');
    eq('sends a translated schema', requests[0].body.generationConfig.responseSchema.type, 'OBJECT');
    check('sends no additionalProperties',
        !hasAdditionalProperties(requests[0].body.generationConfig.responseSchema));

    let fired = 0;
    queue.push(sse([part(JSON.stringify(assessment), 'STOP')]));
    await G.structured({
        system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA,
        onActivity: () => { fired++; },
    });
    eq('onActivity fires once', fired, 1);

    // Extra fields are expected here: additionalProperties could not be
    // sent, so the model was never forbidden from adding them.
    queue.push(sse([part(JSON.stringify({ ...assessment, invented: 'x' }), 'STOP')]));
    got = await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    eq('extra fields are pruned, not rejected', got.invented, undefined);
    eq('real fields survive pruning', got.priority, 'Consistency');

    /* ================= repair loop =============================== */

    const broken = { ...assessment };
    delete broken.confidence;

    requests = [];
    queue.push(sse([part(JSON.stringify(broken), 'STOP')]));
    queue.push(sse([part(JSON.stringify(assessment), 'STOP')]));
    got = await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    eq('repair recovers', got.confidence, 0.7);
    eq('repair took two requests', requests.length, 2);
    eq('repair replays as a model turn', requests[1].body.contents[1].role, 'model');
    check('repair names the missing field',
        /confidence/.test(JSON.stringify(requests[1].body.contents)));
    check('repair forbids inventing findings',
        /do not invent findings/i.test(JSON.stringify(requests[1].body.contents)));

    // The evidence contract surviving a model that ignored the enum.
    const badEnum = {
        ...assessment,
        bottleneck: { ...assessment.bottleneck, evidenceType: 'vibes' },
    };
    queue.push(sse([part(JSON.stringify(badEnum), 'STOP')]));
    queue.push(sse([part(JSON.stringify(assessment), 'STOP')]));
    got = await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    eq('bogus evidenceType is repaired', got.bottleneck.evidenceType, 'inferred');

    // Two failures is a failure, not a loop.
    queue.push(sse([part(JSON.stringify(broken), 'STOP')]));
    queue.push(sse([part(JSON.stringify(broken), 'STOP')]));
    threw = null;
    try { await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('gives up after one repair', threw && threw.code, 'malformed');
    eq('queue drained — no third attempt', queue.length, 0);

    /* ================= finishReason handling ===================== */

    queue.push(sse([part('{"summary":"x"}', 'MAX_TOKENS')]));
    threw = null;
    try { await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('truncation is not silently accepted', threw && threw.code, 'truncated');

    queue.push(sse([part('', 'SAFETY')]));
    threw = null;
    try { await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('safety stop is a refusal', threw && threw.code, 'refused');

    queue.push(sse([part('partial', 'RECITATION')]));
    threw = null;
    try { await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('recitation stop is a refusal', threw && threw.code, 'refused');

    /* ================= conversation ============================== */

    requests = [];
    let streamed = '';
    queue.push(sse([part('You '), part('are '), part('close.', 'STOP')]));
    const text = await G.CoachModel.chat({
        system: 'coach system',
        messages: [
            { role: 'user', content: 'am I ready for full OLL?' },
            { role: 'assistant', content: 'Not yet.' },
            { role: 'user', content: 'why?' },
        ],
        onDelta: t => { streamed += t; },
    });
    eq('chat returns full text', text, 'You are close.');
    eq('chat streams deltas', streamed, 'You are close.');
    eq('system is not a message turn', requests[0].body.contents.length, 3);
    eq('system goes to systemInstruction', requests[0].body.systemInstruction.parts[0].text, 'coach system');
    // Gemini calls the assistant "model"; sending "assistant" is rejected.
    eq('assistant is renamed to model', requests[0].body.contents[1].role, 'model');
    eq('user turns keep their role', requests[0].body.contents[0].role, 'user');
    check('chat sends no responseSchema',
        requests[0].body.generationConfig.responseSchema === undefined);

    // Anthropic-style block content must not leak through as [object Object].
    requests = [];
    queue.push(sse([part('ok', 'STOP')]));
    await G.CoachModel.chat({
        system: 's',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });
    eq('block content flattened', requests[0].body.contents[0].parts[0].text, 'hi');

    /* ================= video upload handshake ==================== */

    requests = [];
    queue.push(jsonResponse(200, {}, { 'X-Goog-Upload-URL': 'https://upload.example/session/abc' }));
    const started = await G.CoachModel.startVideoUpload({
        displayName: 'solve', mimeType: 'video/mp4', sizeBytes: 4 * 1024 * 1024,
    });
    eq('returns the resumable URL', started.uploadUrl, 'https://upload.example/session/abc');
    check('uses the resumable protocol',
        requests[0].headers['X-Goog-Upload-Protocol'] === 'resumable');
    eq('starts the upload', requests[0].headers['X-Goog-Upload-Command'], 'start');
    eq('declares the size up front',
        requests[0].headers['X-Goog-Upload-Header-Content-Length'], String(4 * 1024 * 1024));
    eq('declares the type', requests[0].headers['X-Goog-Upload-Header-Content-Type'], 'video/mp4');
    // The bytes must never come through this server.
    check('no file content is sent from here',
        !/data|content|bytes/i.test(JSON.stringify(requests[0].body).replace(/display_name/g, '')));

    // Oversize is refused before Google is contacted at all.
    requests = [];
    threw = null;
    try {
        await G.CoachModel.startVideoUpload({ mimeType: 'video/mp4', sizeBytes: 900 * 1024 * 1024 });
    } catch (e) { threw = e; }
    eq('oversize video refused', threw && threw.code, 'too_large');
    eq('oversize never reaches Google', requests.length, 0);
    check('the limit is stated in the message', /MB/.test(threw.message), threw.message);

    threw = null;
    try { await G.CoachModel.startVideoUpload({ mimeType: 'video/mp4', sizeBytes: 0 }); }
    catch (e) { threw = e; }
    eq('empty file refused', threw && threw.code, 'bad_request');

    // A start that succeeds but returns no URL must not look like success.
    queue.push(jsonResponse(200, {}, {}));
    threw = null;
    try { await G.CoachModel.startVideoUpload({ mimeType: 'video/mp4', sizeBytes: 1000 }); }
    catch (e) { threw = e; }
    check('missing upload URL is an error', threw && threw.kind === 'upstream');

    /* ================= file state ================================ */

    requests = [];
    queue.push(jsonResponse(200, {
        state: 'ACTIVE', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc',
        mimeType: 'video/mp4', name: 'files/abc',
    }));
    const state = await G.CoachModel.getVideoState('files/abc');
    eq('reports ACTIVE', state.state, 'ACTIVE');
    check('strips the files/ prefix when building the URL',
        /\/files\/abc\?/.test(requests[0].url), requests[0].url);

    queue.push(jsonResponse(200, { state: 'PROCESSING', name: 'files/abc' }));
    eq('reports PROCESSING', (await G.CoachModel.getVideoState('abc')).state, 'PROCESSING');

    // A path segment is interpolated into a URL, so it is guarded.
    requests = [];
    threw = null;
    try { await G.CoachModel.getVideoState('../../models/gemini-test'); }
    catch (e) { threw = e; }
    eq('path traversal refused', threw && threw.code, 'bad_request');
    eq('traversal never reaches Google', requests.length, 0);

    /* ================= live model check ========================== */

    // The check that would have caught the retirement before a user did:
    // "set" and "valid" are different things, and only this knows which.
    requests = [];
    queue.push(jsonResponse(200, { name: 'models/gemini-test' }));
    let live = await checkModel();
    eq('a usable model checks out', live.ok, true);
    check('checks the model directly, without generating',
        /\/models\/gemini-test\?/.test(requests[0].url), requests[0].url);
    eq('it is a plain GET', requests[0].method, 'GET');

    queue.push(errorResponse(404, RETIRED));
    live = await checkModel();
    eq('a retired model fails the check', live.ok, false);
    eq('and the replacement comes back with it', live.suggested, 'gemini-3.6-flash');
    check('the reason quotes the provider', /no longer available/.test(live.reason), live.reason);

    queue.push(errorResponse(400, 'API key not valid. Please pass a valid API key.'));
    live = await checkModel();
    eq('a bad key fails the check', live.ok, false);
    check('and says so plainly', /key was rejected/i.test(live.reason), live.reason);
    // The distinction that matters: a rejected key is not a wrong model,
    // and telling someone to change the model would waste their time.
    check('a bad key suggests no model', !live.suggested);

    queue.push(new Error('network down'));
    live = await checkModel();
    eq('an unreachable API is not a valid config', live.ok, false);
    check('but is flagged as unreachable rather than misconfigured', live.unreachable === true);
    check('and is reported as unreachable', /reach/i.test(live.reason), live.reason);

    /* ================= failure kinds ============================= */

    // Both of these used to land in `unknown`, which named neither the
    // cause nor which side of the link it came from. 400 is the single
    // most likely answer to a malformed resumable chunk, so it having no
    // name of its own cost a whole round of diagnosis.
    eq('400 is a bad upload, not unknown', G._internal.classifyFailure(400, 'nope'), 'bad_upload');
    eq('429 is still rate limiting', G._internal.classifyFailure(429, 'slow down'), 'rate_limited');
    eq('503 is still upstream', G._internal.classifyFailure(503, 'boom'), 'upstream');
    eq('an unrecognised status is still unknown', G._internal.classifyFailure(418, 'tea'), 'unknown');
    // A message that names the real cause must still win over the status:
    // a 400 API_KEY_INVALID is an auth problem, not an upload problem.
    eq('a 400 naming the key is auth',
        G._internal.classifyFailure(400, 'API key not valid. Please pass a valid API key.'), 'auth');

    queue.push(errorResponse(400, 'Invalid upload request'));
    threw = null;
    try {
        await G._internal.uploadVideoChunk(
            'https://generativelanguage.googleapis.com/upload/v1beta/files/s', Buffer.alloc(8), 0, true);
    } catch (e) { threw = e; }
    eq('a rejected chunk surfaces as bad_upload', threw && threw.code, 'bad_upload');
    check('with a sentence a cuber can act on', /choose the video again/i.test(threw.message),
        threw.message);

    queue.push(new Error('getaddrinfo ENOTFOUND'));
    threw = null;
    try {
        await G._internal.uploadVideoChunk(
            'https://generativelanguage.googleapis.com/upload/v1beta/files/s', Buffer.alloc(8), 0, true);
    } catch (e) { threw = e; }
    eq('an unreachable Google is a network failure', threw && threw.code, 'network');
    check('and does not claim the upload was rejected',
        !/rejected/i.test(threw.message), threw.message);

    /* ================= the video path probe ====================== */

    // The whole point of this probe: it removes the browser from the
    // picture, so "our server cannot reach Google" and "Google refused
    // the chunk" stop being the same opaque answer.
    requests = [];
    queue.push(jsonResponse(200, {}, { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/v1beta/files/probe' }));
    queue.push(jsonResponse(200, { file: { name: 'files/probe1', uri: 'u', state: 'ACTIVE' } }));
    queue.push(jsonResponse(200, {}));   // the delete
    let probe = await G._internal.checkVideoPath();
    eq('a working path reports ok', probe.ok, true);
    eq('having got all the way through', probe.step, 'done');
    eq('and tidies the file up', probe.cleanedUp, true);
    check('the probe deletes what it uploaded',
        requests.some(r => r.method === 'DELETE' && /files\/probe1/.test(r.url)),
        JSON.stringify(requests.map(r => [r.method, r.url])));
    check('and never asks the model for anything — no generation quota is spent',
        !requests.some(r => /generateContent/.test(r.url)));

    queue.push(errorResponse(403, 'permission denied'));
    probe = await G._internal.checkVideoPath();
    eq('a session that will not open fails at begin', probe.step, 'begin');
    eq('and is not ok', probe.ok, false);

    queue.push(jsonResponse(200, {}, { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/v1beta/files/probe' }));
    queue.push(errorResponse(400, 'Invalid upload request'));
    probe = await G._internal.checkVideoPath();
    eq('a refused chunk fails at chunk', probe.step, 'chunk');
    check('and carries a reason', typeof probe.reason === 'string' && probe.reason.length > 0);

    // A health endpoint that leaks the key defeats its own purpose.
    eq('a key in a query string is redacted',
        G._internal.redact('POST https://x/y?key=AIzaSyABCDEFGHIJKLMNOPQ failed'),
        'POST https://x/y?key=[redacted] failed');
    check('a bare key is redacted too',
        !/AIzaSy/.test(G._internal.redact('token AIzaSyABCDEFGHIJKLMNOPQ here')));
    check('and the reason is bounded',
        G._internal.redact('x'.repeat(5000)).length <= 300);

    /* ================= configuration ============================= */

    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    threw = null;
    try { await G.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('missing key is not_configured', threw && threw.code, 'not_configured');
    eq('missing key is a 503', threw && threw.status, 503);
    process.env.GEMINI_API_KEY = key;

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
