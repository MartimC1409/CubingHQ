/* Tests the health endpoint and the missing-key logging.

   The endpoint exists to shorten diagnosis, so the tests that matter
   most are the ones asserting it never leaks a key while doing so.
   Run: node scripts/test_coach_health.js */

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

const ENV_KEYS = ['COACH_PROVIDER', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
    'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'COACH_MODEL',
    'FIREBASE_DB_URL', 'FIREBASE_DB_SECRET'];

/**
 * Loads the endpoint fresh under a given environment and calls it.
 *
 * Awaited because the handler is async. It would appear to work without
 * the await — the non-live path reaches sendJson before any await, so
 * the body is already set when this returns — but that is an accident of
 * the current control flow. Add one await earlier in the handler and
 * every assertion below would silently read null instead of failing.
 */
async function callHealth(env, method = 'GET', url = '/api/coach/health') {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, env);

    for (const m of ['../api/coach/health.js', '../api/_lib/model.js', '../api/_lib/rtdb.js',
        '../api/_lib/gemini.js', '../api/_lib/openrouter.js', '../api/_lib/claude.js']) {
        delete require.cache[require.resolve(m)];
    }

    const handler = require('../api/coach/health.js');
    let status = 0, payload = null;
    const res = {
        statusCode: 0,
        setHeader() { },
        end(body) { payload = JSON.parse(body); status = this.statusCode; },
    };
    await handler({ method, url }, res);
    return { status, body: payload };
}

/** Same, but supplying req.query the way Vercel actually does. */
async function callHealthWithQuery(env, query) {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, env);
    for (const m of ['../api/coach/health.js', '../api/_lib/model.js', '../api/_lib/rtdb.js',
        '../api/_lib/gemini.js', '../api/_lib/openrouter.js', '../api/_lib/claude.js']) {
        delete require.cache[require.resolve(m)];
    }
    const handler = require('../api/coach/health.js');
    let status = 0, payload = null;
    await handler({ method: 'GET', query }, {
        statusCode: 0,
        setHeader() { },
        end(body) { payload = JSON.parse(body); status = this.statusCode; },
    });
    return { status, body: payload };
}

(async () => {
    /* ============ the five causes, distinguished =================== */


    // The exact case the user hit: provider chosen, key never set.
    let r = await callHealth({ COACH_PROVIDER: 'gemini', COACH_MODEL: 'gemini-2.5-flash' });
    eq('gemini with no key is not ok', r.body.ok, false);
    eq('names the provider', r.body.provider, 'gemini');
    eq('reports the key missing', r.body.hasKey, false);
    eq('names the variable to set', r.body.keyVar, 'GEMINI_API_KEY');
    check('tells the operator to redeploy', /REDEPLOY/i.test(r.body.diagnosis), r.body.diagnosis);

    r = await callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'gemini-2.5-flash' });
    eq('fully configured gemini is ok', r.body.ok, true);
    eq('reports the model', r.body.model, 'gemini-2.5-flash');
    eq('gemini can do video', r.body.videoCapable, true);
    check('points at the logs when config looks fine',
        /\[gemini\]/.test(r.body.diagnosis), r.body.diagnosis);

    // GOOGLE_API_KEY is the documented alternative and must count.
    r = await callHealth({ COACH_PROVIDER: 'gemini', GOOGLE_API_KEY: 'k', COACH_MODEL: 'm' });
    eq('GOOGLE_API_KEY also counts', r.body.hasKey, true);

    // The quiet trap: no provider named and no keys, so selection falls back
    // to anthropic and the operator is told about a provider they never chose.
    r = await callHealth({});
    eq('falls back to anthropic', r.body.provider, 'anthropic');
    eq('and says which key that needs', r.body.keyVar, 'ANTHROPIC_API_KEY');
    eq('not ok', r.body.ok, false);

    r = await callHealth({ COACH_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' });
    eq('openrouter with no model is not ok', r.body.ok, false);
    check('says the model is missing', /COACH_MODEL/.test(r.body.diagnosis), r.body.diagnosis);
    eq('openrouter cannot do video', r.body.videoCapable, false);

    r = await callHealth({ COACH_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k', COACH_MODEL: 'a/b:free' });
    eq('openrouter fully configured is ok', r.body.ok, true);

    /* ============ storage reporting ================================= */

    r = await callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' });
    eq('storage off by default', r.body.hasStorage, false);
    r = await callHealth({
        COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm',
        FIREBASE_DB_URL: 'https://example.firebaseio.com', FIREBASE_DB_SECRET: 's',
    });
    eq('storage on when both are set', r.body.hasStorage, true);

    // Both are required; one alone must not read as configured.
    r = await callHealth({
        COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm',
        FIREBASE_DB_URL: 'https://example.firebaseio.com',
    });
    eq('a URL without a secret is not storage', r.body.hasStorage, false);

    /* ============ it must not leak ================================== */

    // The whole endpoint is unauthenticated, so this is the load-bearing test.
    const SECRETS = {
        GEMINI_API_KEY: 'AIzaSyTOTALLY-SECRET-VALUE',
        FIREBASE_DB_SECRET: 'super-secret-db-token',
        FIREBASE_DB_URL: 'https://private-instance.firebaseio.com',
    };
    r = await callHealth({ COACH_PROVIDER: 'gemini', COACH_MODEL: 'm', ...SECRETS });
    const serialised = JSON.stringify(r.body);
    for (const [name, value] of Object.entries(SECRETS)) {
        check(`${name}'s value never appears`, !serialised.includes(value), serialised);
    }
    // Not even a fragment — a prefix is enough to confirm a guess.
    check('no key fragment appears', !/AIzaSy/.test(serialised), serialised);
    check('the database host is not disclosed', !/private-instance/.test(serialised), serialised);
    check('variable NAMES are fine to state', /GEMINI_API_KEY/.test(serialised));

    /* ============ ?live=1 =========================================== */

    // Everything above is presence, and presence is not validity — the
    // retired-model outage looked perfectly configured right up to the
    // first real request. These cover the check that closes that gap.
    const realFetch = global.fetch;
    let fetchCalls = 0;
    const stubFetch = (response) => {
        fetchCalls = 0;
        global.fetch = async () => {
            fetchCalls++;
            if (response instanceof Error) throw response;
            return response;
        };
    };
    const googleErr = (status, message) => ({
        ok: false, status,
        json: async () => ({ error: { code: status, message } }),
        text: async () => message,
    });

    const CONFIGURED = { COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'gemini-3.6-flash' };

    // The default must stay instant and free — that is why it is opt-in.
    stubFetch({ ok: true, status: 200, json: async () => ({}) });
    r = await callHealth(CONFIGURED);
    eq('no live check unless asked', fetchCalls, 0);
    check('and no live block is reported', r.body.live === undefined);

    stubFetch({ ok: true, status: 200, json: async () => ({ name: 'models/gemini-3.6-flash' }) });
    r = await callHealth(CONFIGURED, 'GET', '/api/coach/health?live=1');
    eq('live check runs when asked', fetchCalls, 1);
    eq('a working model verifies', r.body.live.ok, true);
    eq('and the config is ok', r.body.ok, true);
    check('the diagnosis says it was verified',
        /verified/i.test(r.body.diagnosis), r.body.diagnosis);

    // The exact outage: configured correctly, model retired underneath it.
    const RETIRED = 'This model models/gemini-2.5-flash is no longer available to new users. '
        + 'Please update your code to use models/gemini-3.6-flash for the latest features.';
    stubFetch(googleErr(404, RETIRED));
    r = await callHealth({ ...CONFIGURED, COACH_MODEL: 'gemini-2.5-flash' },
        'GET', '/api/coach/health?live=1');
    eq('a retired model fails the live check', r.body.live.ok, false);
    eq('and drags ok down with it', r.body.ok, false);
    check('the diagnosis names the replacement',
        /COACH_MODEL=gemini-3.6-flash/.test(r.body.diagnosis), r.body.diagnosis);
    // hasKey stayed true throughout — presence was never the problem.
    eq('the key is still reported present', r.body.hasKey, true);

    stubFetch(googleErr(400, 'API key not valid. Please pass a valid API key.'));
    r = await callHealth(CONFIGURED, 'GET', '/api/coach/health?live=1');
    eq('a rejected key fails the live check', r.body.live.ok, false);
    check('and says the key was rejected',
        /rejected/i.test(r.body.live.reason), r.body.live.reason);

    // A network problem is not a misconfiguration. Reporting it as one
    // would send the operator changing settings that were never wrong.
    stubFetch(new Error('network down'));
    r = await callHealth(CONFIGURED, 'GET', '/api/coach/health?live=1');
    eq('an unreachable provider is unknown, not invalid', r.body.live.ok, null);
    eq('and does not condemn the configuration', r.body.ok, true);
    check('it says what actually happened',
        /reach/i.test(r.body.live.reason), r.body.live.reason);

    // Vercel supplies req.query; the URL regex is the fallback. Both work.
    stubFetch({ ok: true, status: 200, json: async () => ({}) });
    r = await callHealthWithQuery(CONFIGURED, { live: '1' });
    eq('req.query triggers the check too', r.body.live.ok, true);

    // Nothing to check against when the config is incomplete.
    stubFetch({ ok: true, status: 200, json: async () => ({}) });
    r = await callHealth({ COACH_PROVIDER: 'gemini', COACH_MODEL: 'm' },
        'GET', '/api/coach/health?live=1');
    eq('skipped when there is no key', r.body.live.ok, null);
    eq('and no request is made', fetchCalls, 0);
    check('the reason points back at the diagnosis',
        /incomplete/i.test(r.body.live.reason), r.body.live.reason);

    // Providers without a live check say so rather than silently passing.
    stubFetch({ ok: true, status: 200, json: async () => ({}) });
    r = await callHealth({ COACH_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k', COACH_MODEL: 'a/b' },
        'GET', '/api/coach/health?live=1');
    eq('openrouter has no live check', r.body.live.ok, null);
    check('and names the provider', /openrouter/.test(r.body.live.reason), r.body.live.reason);

    // Even the live path must not echo a key back.
    stubFetch(googleErr(400, 'API key not valid. Please pass a valid API key.'));
    r = await callHealth({ ...CONFIGURED, GEMINI_API_KEY: 'AIzaSyLIVE-PATH-SECRET' },
        'GET', '/api/coach/health?live=1');
    check('the live path leaks no key',
        !JSON.stringify(r.body).includes('AIzaSyLIVE-PATH-SECRET'), JSON.stringify(r.body));

    global.fetch = realFetch;

    /* ============ method guard ====================================== */

    r = await callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' }, 'POST');
    eq('POST is rejected', r.status, 405);
    r = await callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' }, 'DELETE');
    eq('DELETE is rejected', r.status, 405);

    /* ============ the missing key is no longer silent =============== */

    function capture(fn) {
        const lines = [];
        const real = console.error;
        console.error = (...a) => lines.push(a.join(' '));
        try { fn(); } catch (e) { /* the throw is the point */ }
        console.error = real;
        return lines.join('\n');
    }

    for (const [provider, mod, variable] of [
        ['gemini', '../api/_lib/gemini.js', 'GEMINI_API_KEY'],
        ['openrouter', '../api/_lib/openrouter.js', 'OPENROUTER_API_KEY'],
        ['anthropic', '../api/_lib/claude.js', 'ANTHROPIC_API_KEY'],
    ]) {
        for (const k of ENV_KEYS) delete process.env[k];
        if (provider === 'openrouter') process.env.COACH_MODEL = 'a/b';
        delete require.cache[require.resolve(mod)];
        const impl = require(mod);

        const logged = capture(() => {
            impl.structured({ system: 's', user: 'u', schema: { type: 'object' } })
                .catch(() => { });
            // claude.js and gemini.js reach the key check synchronously via
            // their client/apiKey helpers; openrouter via assertConfigured.
        });
        check(`${provider} logs the missing key`, logged.includes(variable),
            logged || '(nothing logged)');
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
