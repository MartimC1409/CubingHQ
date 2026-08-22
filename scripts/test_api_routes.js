/* Tests the two dynamic routes that keep this deployment under the
   platform's function limit.

   A Hobby deployment may contain 12 serverless functions. Adding the
   battle gateway and three auth endpoints took the count to 14, and
   the build failed outright — nothing shipped, including the parts
   that had nothing to do with the new code.

   Four auth and video endpoints now share two functions. The URLs did
   not change, which is the thing worth testing: the dispatcher is the
   only place that decides which handler a request reaches, and if it
   picks wrong, /api/auth/login quietly becomes /api/auth/me.

   Run: node scripts/test_api_routes.js */

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
// Accounts refuse to run at all unless they can sign a session and
// store a record, and that check comes before any validation — so
// without these, every auth assertion below would read 503 and prove
// nothing about routing.
process.env.AUTH_SIGNING_SECRET = 'test-signing-secret';
process.env.FIREBASE_DB_URL = 'https://db.example.com';
process.env.FIREBASE_DB_SECRET = 'legacy-secret';

const authRoute = require('../api/auth/[action].js');
const videoRoute = require('../api/coach/video/[step].js');
const coachRoute = require('../api/coach/[endpoint].js');

/** Runs a dispatcher and reports the status it produced. */
async function call(route, req) {
    let status = 0, payload = null;
    const res = {
        statusCode: 0, setHeader() { },
        end(b) { payload = b ? JSON.parse(b) : null; status = this.statusCode; },
    };
    // A real request is always readable, even when it carries nothing.
    // Handlers that parse a body before checking anything else would
    // otherwise fail on the read rather than on the thing being tested.
    const empty = { [Symbol.asyncIterator]: async function* () { } };
    await route(Object.assign({ method: 'POST', headers: {}, socket: {} }, empty, req), res);
    return { status, body: payload };
}

(async () => {
    /* ---- the function budget -------------------------------------- */

    // The check that would have caught the failed build. Underscore-
    // prefixed files are not deployed as functions; everything else
    // under api/ is one.
    const { execSync } = require('child_process');
    const files = execSync('find api -name "*.js"', { cwd: __dirname + '/..' })
        .toString().trim().split('\n')
        .filter(f => !f.split('/').some(seg => seg.startsWith('_')));
    check(`api/ deploys ${files.length} functions, at most 12`,
        files.length <= 12, files.join(', '));
    // Headroom, so the next endpoint added does not fail a build again.
    check('with real room to spare', files.length <= 8, files.join(', '));

    /* ---- every URL still reaches its own handler ------------------ */

    const actionOf = authRoute._internal.paramOf;
    const stepOf = videoRoute._internal.paramOf;
    const endpointOf = coachRoute._internal.paramOf;

    eq('a path picks the endpoint', actionOf({ url: '/api/auth/login' }), 'login');
    eq('a query string does not confuse it',
        actionOf({ url: '/api/auth/signup?next=%2Fbattle' }), 'signup');
    eq('a trailing slash does not either', actionOf({ url: '/api/auth/me/' }), 'me');
    eq("the platform's own parse wins when present",
        actionOf({ url: '/api/auth/anything', query: { action: 'login' } }), 'login');
    eq('an array parameter takes its first value',
        actionOf({ query: { action: ['me', 'login'] } }), 'me');
    eq('video steps are read the same way',
        stepOf({ url: '/api/coach/video/chunk' }), 'chunk');
    eq('and so are coach endpoints',
        endpointOf({ url: '/api/coach/chat' }), 'chat');
    eq('health keeps its query string, which it reads itself',
        endpointOf({ url: '/api/coach/health?live=1&video=1' }), 'health');

    // Each dispatcher reads its OWN parameter name. Sharing one helper
    // makes it cheap to pass the wrong one, and the failure would be
    // invisible: every request would fall back to the URL and mostly
    // still work, until one did not.
    eq('the coach route reads `endpoint`',
        endpointOf({ url: '/api/coach/x', query: { endpoint: 'chat', action: 'me' } }), 'chat');
    eq('the auth route reads `action`',
        actionOf({ url: '/api/auth/x', query: { endpoint: 'chat', action: 'me' } }), 'me');
    eq('the video route reads `step`',
        stepOf({ url: '/api/coach/video/x', query: { step: 'begin', action: 'me' } }), 'begin');

    /* ---- and the right handler actually runs ---------------------- */

    // Each is identified by a response only it can produce, so a
    // dispatcher that returned a plausible-looking 404 for everything
    // could not pass this.

    let r = await call(authRoute, { url: '/api/auth/me', method: 'GET' });
    eq('/me without a token is its own 401', r.status, 401);
    eq('from the me handler', r.body.error.code, 'invalid_session');

    r = await call(authRoute, { url: '/api/auth/me', method: 'POST' });
    eq('/me refuses a POST — the handler, not the dispatcher, decides', r.status, 405);

    r = await call(authRoute, {
        url: '/api/auth/login',
        [Symbol.asyncIterator]: async function* () { yield Buffer.from('{"email":"not-an-address"}'); },
    });
    eq('/login validates its own body', r.status, 400);
    eq('as a bad address', r.body.error.code, 'bad_email');

    r = await call(authRoute, {
        url: '/api/auth/signup',
        [Symbol.asyncIterator]: async function* () { yield Buffer.from('{"email":"a@b.com","password":"x"}'); },
    });
    eq('/signup validates its own body', r.status, 400);
    eq('as a weak password', r.body.error.code, 'weak_password');

    // Coach endpoints, each identified by a refusal only it produces.
    r = await call(coachRoute, { url: '/api/coach/health', method: 'GET' });
    eq('/health answers without sign-in — a health check that needs one is useless', r.status, 200);
    check('and reports configuration', typeof r.body.ok === 'boolean', JSON.stringify(r.body));

    r = await call(coachRoute, { url: '/api/coach/health', method: 'DELETE' });
    eq('/health still refuses a DELETE', r.status, 405);

    r = await call(coachRoute, { url: '/api/coach/profile', method: 'GET', headers: {} });
    eq('/profile requires sign-in', r.status, 401);

    // These two validate their payload before anything else, and each
    // says something only it says — which is exactly what proves the
    // dispatcher sent the request to the right one rather than to a
    // neighbour that happens to fail the same way.
    r = await call(coachRoute, { url: '/api/coach/chat', headers: {} });
    eq('/chat asks for a question', r.status, 400);
    check('in its own words', /Ask the Coach/.test(r.body.error.message), r.body.error.message);

    r = await call(coachRoute, { url: '/api/coach/assess', headers: {} });
    eq('/assess asks for statistics', r.status, 400);
    check('in its own words too', /statistics/.test(r.body.error.message), r.body.error.message);

    r = await call(videoRoute, { url: '/api/coach/video/begin', headers: {} });
    eq('/begin requires sign-in', r.status, 401);
    eq('and says which', r.body.error.code, 'no_token');

    r = await call(videoRoute, { url: '/api/coach/video/chunk', headers: {} });
    eq('/chunk requires sign-in too', r.status, 401);

    /* ---- and nothing else is reachable ---------------------------- */

    for (const url of ['/api/auth/', '/api/auth/logout', '/api/auth/_signup',
        '/api/auth/constructor', '/api/auth/__proto__', '/api/auth/toString']) {
        r = await call(authRoute, { url });
        eq(`${url} is 404`, r.status, 404);
    }
    for (const url of ['/api/coach/video/', '/api/coach/video/delete', '/api/coach/video/_begin']) {
        r = await call(videoRoute, { url });
        eq(`${url} is 404`, r.status, 404);
    }
    for (const url of ['/api/coach/', '/api/coach/video', '/api/coach/_chat',
        '/api/coach/constructor', '/api/coach/__proto__']) {
        r = await call(coachRoute, { url });
        eq(`${url} is 404`, r.status, 404);
    }

    /* ---- the client asks for exactly these ------------------------ */

    // Read from the shipped client rather than restated here, so a URL
    // that changes on one side fails instead of drifting.
    const fs = require('fs');
    const path = require('path');
    const api = fs.readFileSync(path.join(__dirname, '..', 'coach-api.js'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const client = api + app;

    const wanted = new Set();
    for (const m of client.matchAll(/['"`]\/api\/(auth|coach|coach\/video)\/([a-z]+)['"`]/g)) {
        wanted.add(`${m[1]}/${m[2]}`);
    }
    check('the client calls some of these at all', wanted.size >= 4, [...wanted].join(', '));
    for (const url of wanted) {
        const [group, name] = [url.slice(0, url.lastIndexOf('/')), url.slice(url.lastIndexOf('/') + 1)];
        const routes = group === 'auth' ? authRoute._internal.ROUTES
            : group === 'coach' ? coachRoute._internal.ROUTES
            : videoRoute._internal.ROUTES;
        check(`/api/${url} is a route that exists`, routes.includes(name), routes.join(', '));
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
