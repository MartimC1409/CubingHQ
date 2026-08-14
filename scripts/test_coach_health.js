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

/** Loads the endpoint fresh under a given environment and calls GET. */
function callHealth(env, method = 'GET') {
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
    handler({ method }, res);
    return { status, body: payload };
}

/* ============ the five causes, distinguished =================== */

// The exact case the user hit: provider chosen, key never set.
let r = callHealth({ COACH_PROVIDER: 'gemini', COACH_MODEL: 'gemini-2.5-flash' });
eq('gemini with no key is not ok', r.body.ok, false);
eq('names the provider', r.body.provider, 'gemini');
eq('reports the key missing', r.body.hasKey, false);
eq('names the variable to set', r.body.keyVar, 'GEMINI_API_KEY');
check('tells the operator to redeploy', /REDEPLOY/i.test(r.body.diagnosis), r.body.diagnosis);

r = callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'gemini-2.5-flash' });
eq('fully configured gemini is ok', r.body.ok, true);
eq('reports the model', r.body.model, 'gemini-2.5-flash');
eq('gemini can do video', r.body.videoCapable, true);
check('points at the logs when config looks fine',
    /\[gemini\]/.test(r.body.diagnosis), r.body.diagnosis);

// GOOGLE_API_KEY is the documented alternative and must count.
r = callHealth({ COACH_PROVIDER: 'gemini', GOOGLE_API_KEY: 'k', COACH_MODEL: 'm' });
eq('GOOGLE_API_KEY also counts', r.body.hasKey, true);

// The quiet trap: no provider named and no keys, so selection falls back
// to anthropic and the operator is told about a provider they never chose.
r = callHealth({});
eq('falls back to anthropic', r.body.provider, 'anthropic');
eq('and says which key that needs', r.body.keyVar, 'ANTHROPIC_API_KEY');
eq('not ok', r.body.ok, false);

r = callHealth({ COACH_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' });
eq('openrouter with no model is not ok', r.body.ok, false);
check('says the model is missing', /COACH_MODEL/.test(r.body.diagnosis), r.body.diagnosis);
eq('openrouter cannot do video', r.body.videoCapable, false);

r = callHealth({ COACH_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k', COACH_MODEL: 'a/b:free' });
eq('openrouter fully configured is ok', r.body.ok, true);

/* ============ storage reporting ================================= */

r = callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' });
eq('storage off by default', r.body.hasStorage, false);
r = callHealth({
    COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm',
    FIREBASE_DB_URL: 'https://example.firebaseio.com', FIREBASE_DB_SECRET: 's',
});
eq('storage on when both are set', r.body.hasStorage, true);

// Both are required; one alone must not read as configured.
r = callHealth({
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
r = callHealth({ COACH_PROVIDER: 'gemini', COACH_MODEL: 'm', ...SECRETS });
const serialised = JSON.stringify(r.body);
for (const [name, value] of Object.entries(SECRETS)) {
    check(`${name}'s value never appears`, !serialised.includes(value), serialised);
}
// Not even a fragment — a prefix is enough to confirm a guess.
check('no key fragment appears', !/AIzaSy/.test(serialised), serialised);
check('the database host is not disclosed', !/private-instance/.test(serialised), serialised);
check('variable NAMES are fine to state', /GEMINI_API_KEY/.test(serialised));

/* ============ method guard ====================================== */

r = callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' }, 'POST');
eq('POST is rejected', r.status, 405);
r = callHealth({ COACH_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', COACH_MODEL: 'm' }, 'DELETE');
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
