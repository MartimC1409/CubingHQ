/* Tests the OpenRouter adapter and the schema validator that backs it.
   No network: global fetch is stubbed with a queue of canned responses.
   Run: node scripts/test_openrouter.js */

'use strict';

// Read at module load in openrouter.js, so they must be set first.
process.env.OPENROUTER_API_KEY = 'sk-or-test';
process.env.COACH_MODEL = 'test/model:free';

const { validate, prune } = require('../api/_lib/validate.js');
const { COACH_ASSESSMENT_SCHEMA } = require('../api/_lib/schemas.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ================= validate.js ================================== */

const findingSchema = COACH_ASSESSMENT_SCHEMA.properties.strengths.items;

const goodFinding = {
    title: 'Consistent', detail: 'Spread is tight.',
    evidenceType: 'inferred', basis: 'Ao100 11.82s, sd 1.1s',
};

eq('valid finding passes', validate(goodFinding, findingSchema).length, 0);

check('missing required field is caught',
    validate({ title: 'x', detail: 'y', basis: 'z' }, findingSchema)
        .some(e => /evidenceType.*required/.test(e)));

// The load-bearing case: a model inventing an evidence type it was not
// offered would let an unfounded claim render as established fact.
check('bogus evidenceType is caught',
    validate({ ...goodFinding, evidenceType: 'observed_maybe' }, findingSchema)
        .some(e => /evidenceType/.test(e) && /not one of/.test(e)));

check('every real evidenceType is accepted',
    ['known', 'observed', 'inferred'].every(t =>
        validate({ ...goodFinding, evidenceType: t }, findingSchema).length === 0));

check('extra field is caught',
    validate({ ...goodFinding, madeUp: 1 }, findingSchema)
        .some(e => /madeUp.*unexpected/.test(e)));

check('wrong type is caught',
    validate({ ...goodFinding, title: 42 }, findingSchema)
        .some(e => /title.*expected string/.test(e)));

// JSON has no integer type and models emit 5.0 for 5 constantly.
eq('whole float satisfies integer', validate(5.0, { type: 'integer' }).length, 0);
eq('real float does not', validate(5.5, { type: 'integer' }).length, 1);
eq('NaN is not a number', validate(NaN, { type: 'number' }).length, 1);
eq('null is not an object', validate(null, { type: 'object' }).length, 1);
eq('array is not an object', validate([], { type: 'object' }).length, 1);

// Errors must name the path, or the repair prompt is useless.
const nested = validate(
    { strengths: [goodFinding, { ...goodFinding, evidenceType: 'nope' }] },
    { type: 'object', properties: { strengths: { type: 'array', items: findingSchema } } });
check('array errors carry an index', nested.some(e => /strengths\[1\]\.evidenceType/.test(e)));

// prune drops what the schema forbids but must never fabricate.
const pruned = prune({ ...goodFinding, extra: 'x' }, findingSchema);
eq('prune removes extras', pruned.extra, undefined);
eq('prune keeps real fields', pruned.evidenceType, 'inferred');
eq('prune does not invent absent fields',
    Object.prototype.hasOwnProperty.call(prune({ title: 'a' }, findingSchema), 'basis'), false);

/* ================= fetch stub =================================== */

const queue = [];
let requests = [];

function sse(frames, { chunkSize = 0 } = {}) {
    const text = frames.map(f =>
        f === '[DONE]' ? 'data: [DONE]\n\n'
            : typeof f === 'string' ? `${f}\n`
                : `data: ${JSON.stringify(f)}\n\n`).join('');

    // Chunking on an arbitrary boundary proves the parser buffers partial
    // lines rather than assuming a frame arrives whole.
    const bytes = Buffer.from(text, 'utf8');
    const chunks = [];
    const step = chunkSize || bytes.length;
    for (let i = 0; i < bytes.length; i += step) chunks.push(bytes.subarray(i, i + step));

    let i = 0;
    return {
        ok: true,
        status: 200,
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
        ok: false,
        status,
        json: async () => ({ error: { message, code: status } }),
        text: async () => message,
    };
}

function delta(content, finish) {
    return { choices: [{ delta: content ? { content } : {}, finish_reason: finish || null }] };
}

global.fetch = async (url, opts) => {
    requests.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    if (!queue.length) throw new Error('test: no queued response');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
};

const or = require('../api/_lib/openrouter.js');
const { classifyFailure, extractJson, readStream } = or._internal;

/* ================= classifyFailure ============================== */

eq('bad model slug', classifyFailure(400, 'test/x is not a valid model ID'), 'bad_model');
eq('no endpoints for model', classifyFailure(404, 'No endpoints found for test/x'), 'bad_model');
eq('no schema support', classifyFailure(404, 'No endpoints found that support structured outputs'), 'no_schema_support');
eq('response_format complaint', classifyFailure(400, 'response_format is not supported'), 'no_schema_support');
eq('rate limit by status', classifyFailure(429, 'slow down'), 'rate_limited');
eq('rate limit by text', classifyFailure(400, 'Rate limit exceeded'), 'rate_limited');
eq('out of credit', classifyFailure(402, 'Insufficient credits'), 'no_credit');
eq('auth', classifyFailure(401, 'no key'), 'auth');
eq('upstream', classifyFailure(503, 'provider down'), 'upstream');

// A bad slug must not be mistaken for missing schema support, or the
// fallback would retry forever against a model that does not exist.
check('bad model is not treated as a schema problem',
    classifyFailure(404, 'No endpoints found for test/x') !== 'no_schema_support');

/* ================= extractJson ================================== */

eq('bare json', extractJson('{"a":1}').a, 1);
eq('fenced json', extractJson('```json\n{"a":2}\n```').a, 2);
eq('unlabelled fence', extractJson('```\n{"a":3}\n```').a, 3);
eq('prose around json', extractJson('Sure! Here you go:\n{"a":4}\nHope that helps.').a, 4);
eq('nested braces survive', extractJson('x {"a":{"b":5}} y').a.b, 5);
eq('garbage yields null', extractJson('no json here'), null);
eq('empty yields null', extractJson('   '), null);

/* ================= readStream =================================== */

(async () => {
    let out = '';
    let r = await readStream(sse([delta('Hel'), delta('lo'), '[DONE]']), t => { out += t; });
    eq('stream concatenates', r.text, 'Hello');
    eq('deltas are forwarded', out, 'Hello');

    // OpenRouter emits these as keepalives during long waits.
    r = await readStream(sse([': OPENROUTER PROCESSING', delta('a'), ': ping', delta('b'), '[DONE]']));
    eq('keepalive comments ignored', r.text, 'ab');

    r = await readStream(sse([delta('x'), delta(null, 'length'), '[DONE]']));
    eq('finish_reason captured', r.finish, 'length');

    // Byte-level chunking must not split a frame's meaning.
    r = await readStream(sse([delta('one'), delta('two'), delta('three'), '[DONE]'], { chunkSize: 7 }));
    eq('partial lines are buffered', r.text, 'onetwothree');

    r = await readStream(sse([delta('a'), 'data: {bad json', delta('b'), '[DONE]']));
    eq('unparseable frame skipped', r.text, 'ab');

    // A 200 that turns into an error partway through.
    let threw = null;
    try {
        await readStream(sse([delta('a'), { error: { message: 'Rate limit exceeded', code: 429 } }]));
    } catch (e) { threw = e; }
    check('mid-stream error throws', threw && threw.code === 'rate_limited', threw && threw.code);

    // A stream that ends without [DONE] still returns what it had.
    r = await readStream(sse([delta('partial')]));
    eq('missing [DONE] still resolves', r.text, 'partial');

    /* ================= structured: happy path =================== */

    const assessment = {
        summary: 'Ao100 is 11.82s.',
        strengths: [goodFinding],
        weaknesses: [],
        bottleneck: goodFinding,
        rationale: 'Because.',
        priority: 'Consistency',
        confidence: 0.7,
        dataGaps: ['PLL recognition quality'],
        recommendedActions: [],
    };

    requests = [];
    queue.push(sse([delta(JSON.stringify(assessment)), '[DONE]']));
    let got = await or.structured({
        system: 'sys', user: 'usr', schema: COACH_ASSESSMENT_SCHEMA, _name: 'coach_assessment',
    });
    eq('structured returns the object', got.summary, 'Ao100 is 11.82s.');
    eq('one request on the happy path', requests.length, 1);
    eq('asks for a strict json_schema', requests[0].body.response_format.json_schema.strict, true);
    eq('schema name carried', requests[0].body.response_format.json_schema.name, 'coach_assessment');
    check('requires a provider that honours it', requests[0].body.provider.require_parameters === true);
    check('streams', requests[0].body.stream === true);
    check('sends the key', /sk-or-test/.test(requests[0].headers.Authorization));
    check('no reasoning block unless opted in', requests[0].body.reasoning === undefined);

    // onActivity exists so the UI advances on something real.
    let fired = 0;
    queue.push(sse([delta(JSON.stringify(assessment)), '[DONE]']));
    await or.structured({
        system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA,
        onActivity: () => { fired++; },
    });
    eq('onActivity fires once', fired, 1);

    /* ================= structured: schema fallback ============== */

    requests = [];
    queue.push(errorResponse(404, 'No endpoints found that support structured outputs'));
    queue.push(sse([delta('```json\n' + JSON.stringify(assessment) + '\n```'), '[DONE]']));
    got = await or.structured({ system: 'sys', user: 'usr', schema: COACH_ASSESSMENT_SCHEMA });
    eq('falls back and still returns the object', got.priority, 'Consistency');
    eq('fallback took two requests', requests.length, 2);
    eq('fallback uses json_object mode', requests[1].body.response_format.type, 'json_object');
    check('fallback drops the provider filter', requests[1].body.provider === undefined);
    check('fallback puts the schema in the prompt',
        /JSON Schema/.test(requests[1].body.messages[0].content));

    /* ================= structured: repair loop ================== */

    // Model omits a required field; one repair round-trip fixes it.
    const broken = { ...assessment };
    delete broken.confidence;

    requests = [];
    queue.push(sse([delta(JSON.stringify(broken)), '[DONE]']));
    queue.push(sse([delta(JSON.stringify(assessment)), '[DONE]']));
    got = await or.structured({ system: 'sys', user: 'usr', schema: COACH_ASSESSMENT_SCHEMA });
    eq('repair recovers', got.confidence, 0.7);
    eq('repair took two requests', requests.length, 2);
    check('repair states the error', /confidence/.test(JSON.stringify(requests[1].body.messages)));
    check('repair forbids inventing findings',
        /do not invent findings/i.test(JSON.stringify(requests[1].body.messages)));

    // A bad enum is repaired the same way — this is the evidence contract
    // surviving a model that ignored it.
    const badEnum = { ...assessment, strengths: [{ ...goodFinding, evidenceType: 'vibes' }] };
    queue.push(sse([delta(JSON.stringify(badEnum)), '[DONE]']));
    queue.push(sse([delta(JSON.stringify(assessment)), '[DONE]']));
    got = await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    eq('bad evidenceType repaired', got.strengths[0].evidenceType, 'inferred');

    // Two failures in a row is a real failure, not an infinite loop.
    queue.push(sse([delta(JSON.stringify(broken)), '[DONE]']));
    queue.push(sse([delta(JSON.stringify(broken)), '[DONE]']));
    threw = null;
    try {
        await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    } catch (e) { threw = e; }
    check('gives up after one repair', threw && threw.code === 'malformed', threw && threw.code);
    eq('queue drained — no third attempt', queue.length, 0);

    /* ================= structured: hard errors ================== */

    queue.push(errorResponse(400, 'test/model:free is not a valid model ID'));
    threw = null;
    try {
        await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    } catch (e) { threw = e; }
    check('bad model does not fall back', queue.length === 0 && threw);
    eq('bad model reported as config', threw && threw.code, 'not_configured');

    queue.push(errorResponse(429, 'Rate limit exceeded'));
    threw = null;
    try {
        await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    } catch (e) { threw = e; }
    eq('rate limit surfaces as rate_limited', threw && threw.code, 'rate_limited');
    eq('rate limit keeps its status', threw && threw.status, 429);

    queue.push(sse([delta('I am afraid I cannot do that.'), '[DONE]']));
    threw = null;
    try {
        await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    } catch (e) { threw = e; }
    eq('non-JSON reply is malformed', threw && threw.code, 'malformed');

    queue.push(sse([delta('{"summary":"x"}'), delta(null, 'length'), '[DONE]']));
    threw = null;
    try {
        await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA });
    } catch (e) { threw = e; }
    eq('truncation is not silently accepted', threw && threw.code, 'truncated');

    /* ================= conversation ============================= */

    requests = [];
    let streamed = '';
    queue.push(sse([delta('You '), delta('are '), delta('close.'), '[DONE]']));
    const text = await or.CoachModel.chat({
        system: 'coach system',
        messages: [{ role: 'user', content: 'am I ready for full OLL?' }],
        onDelta: t => { streamed += t; },
    });
    eq('chat returns full text', text, 'You are close.');
    eq('chat streams deltas', streamed, 'You are close.');
    eq('system becomes the first message', requests[0].body.messages[0].role, 'system');
    eq('system content preserved', requests[0].body.messages[0].content, 'coach system');
    eq('user turn follows', requests[0].body.messages[1].role, 'user');
    check('chat sends no response_format', requests[0].body.response_format === undefined);

    // Anthropic-style block content must not leak through as [object Object].
    requests = [];
    queue.push(sse([delta('ok'), '[DONE]']));
    await or.CoachModel.chat({
        system: 's',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        onDelta: null,
    });
    eq('block content flattened to text', requests[0].body.messages[1].content, 'hi');

    /* ================= configuration ============================ */

    const key = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    threw = null;
    try { await or.structured({ system: 's', user: 'u', schema: COACH_ASSESSMENT_SCHEMA }); }
    catch (e) { threw = e; }
    eq('missing key is not_configured', threw && threw.code, 'not_configured');
    eq('missing key is a 503', threw && threw.status, 503);
    process.env.OPENROUTER_API_KEY = key;

    /* ================= provider selection ======================= */

    function freshSelect(env) {
        for (const k of ['COACH_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']) delete process.env[k];
        Object.assign(process.env, env);
        delete require.cache[require.resolve('../api/_lib/model.js')];
        return require('../api/_lib/model.js').PROVIDER;
    }

    eq('explicit openrouter wins', freshSelect({ COACH_PROVIDER: 'openrouter' }), 'openrouter');
    eq('openrouter key alone infers openrouter',
        freshSelect({ OPENROUTER_API_KEY: 'sk-or-x' }), 'openrouter');
    eq('explicit beats inference',
        freshSelect({ COACH_PROVIDER: 'openrouter', ANTHROPIC_API_KEY: 'sk-ant-x' }), 'openrouter');
    eq('unknown provider falls back safely',
        freshSelect({ COACH_PROVIDER: 'sometimes', OPENROUTER_API_KEY: 'sk-or-x' }), 'anthropic');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
