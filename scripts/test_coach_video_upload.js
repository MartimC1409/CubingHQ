/* Tests the video upload failure paths.

   These exist because the previous behaviour reported every failure as
   "the upload was interrupted, check your connection" — which is a guess
   presented as a diagnosis. A request blocked by an extension, an
   expired upload link and a genuinely offline device all need different
   actions from the user, and none of them is "check your connection".

   Run: node scripts/test_coach_video_upload.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ---------- a shim just big enough to run coach-video.js -------- */

let lastXhr = null;
const logged = [];

function makeXHR(behaviour) {
    return function XMLHttpRequestStub() {
        const xhr = {
            status: 0, statusText: '', responseText: '',
            timeout: 0,
            upload: {},
            _headers: {},
            _responseHeaders: behaviour.responseHeaders || {},
            open(method, url) { this.method = method; this.url = url; },
            setRequestHeader(k, v) { this._headers[k] = v; },
            getResponseHeader(k) {
                const want = String(k).toLowerCase();
                for (const [hk, hv] of Object.entries(this._responseHeaders)) {
                    if (hk.toLowerCase() === want) return hv;
                }
                return null;
            },
            send() {
                lastXhr = this;
                // Fire asynchronously, the way a real request would.
                setTimeout(() => {
                    if (behaviour.progress && this.upload.onprogress) {
                        this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
                    }
                    this.status = behaviour.status || 0;
                    this.statusText = behaviour.statusText || '';
                    this.responseText = behaviour.responseText || '';
                    if (behaviour.event === 'timeout') return this.ontimeout();
                    if (behaviour.event === 'error') return this.onerror();
                    if (behaviour.event === 'abort') return this.onabort();
                    this.onload();
                }, 0);
            },
        };
        return xhr;
    };
}

let probeCalls = [];

function makeWindow(behaviour, { online = true, probe = 'reachable' } = {}) {
    const el = () => ({
        hidden: false, className: '', innerHTML: '', value: '', disabled: false,
        files: [], addEventListener() { }, click() { }, querySelectorAll: () => [],
    });
    const doc = {
        readyState: 'complete',
        querySelector: () => el(),
        querySelectorAll: () => [],
        addEventListener() { },
        dispatchEvent() { return true; },
        createElement: el,
        body: el(),
    };
    const win = {
        document: doc,
        navigator: { onLine: online },
        XMLHttpRequest: makeXHR(behaviour),
        console: {
            error: (...a) => logged.push(a),
            warn: () => { }, log: () => { },
        },
        setTimeout, clearTimeout, JSON, Math, Date, Object, Array, String, Number,
        Boolean, Promise, Error, RegExp, Set, Map, isFinite, parseInt, parseFloat,
        AbortController,
        // The reachability probe. Any HTTP response means reachable; a
        // rejection means the host is blocked on this device.
        fetch: (url, opts) => {
            probeCalls.push({ url: String(url), opts });
            if (probe === 'blocked') return Promise.reject(new TypeError('Failed to fetch'));
            if (probe === 'abort') {
                const e = new Error('aborted'); e.name = 'AbortError';
                return Promise.reject(e);
            }
            if (probe === 'throws') return Promise.reject(new Error('probe exploded'));
            return Promise.resolve({ ok: false, status: 400 });
        },
        // Just enough CoachUI for the module to render text.
        CoachUI: {
            esc: (s) => String(s),
            T: (k, fallback) => fallback,
            toast() { },
            alert: (kind, title, body) => `${title} ${body}`,
            evidenceChip: () => '',
            dataGaps: () => '',
        },
        CoachStore: { getProfile: () => ({ primaryEvent: '333' }) },
        CoachEvidence: { recordVideo: () => 0 },
        CoachAPI: {},
    };
    win.window = win;
    win.self = win;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'coach-video.js'), 'utf8'),
        win, { filename: 'coach-video.js' });
    return win;
}

/** Runs putFile against a stubbed transport and returns the rejection. */
async function upload(behaviour, opts) {
    logged.length = 0;
    probeCalls = [];
    const win = makeWindow(behaviour, opts);
    // putFile is module-private; drive it through the public entry point.
    win.CoachAPI.startVideoUpload = async () => ({
        uploadUrl: 'https://upload.example/session/abc',
        headers: {
            'Content-Length': '1000',
            'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize',
        },
    });

    let shown = '';
    const statusEl = { hidden: true, className: '', innerHTML: '' };
    win.document.querySelector = (sel) => {
        if (sel === '#coach-video-status') {
            return new Proxy(statusEl, {
                set(t, k, v) { if (k === 'innerHTML') shown = String(v); t[k] = v; return true; },
            });
        }
        return { hidden: false, innerHTML: '', value: '', disabled: false, addEventListener() { }, click() { } };
    };

    await win.CoachVideo.analyse({ size: 1000, type: 'video/mp4', name: 'solve.mp4' });
    return { shown, logged: logged.slice(), probes: probeCalls.slice() };
}

(async () => {
    /* ---------- offline is offline ------------------------------ */

    let r = await upload({ event: 'error', status: 0 }, { online: false });
    check('offline says so', /offline/i.test(r.shown), r.shown);

    /* ---------- status 0: measured, not guessed ------------------ */

    // The device really cannot reach the host — now established rather
    // than assumed, so naming extensions is fair.
    r = await upload({ event: 'error', status: 0 }, { online: true, probe: 'blocked' });
    check('an unreachable service is reported as blocked',
        /cannot reach/i.test(r.shown), r.shown);
    check('and names a plausible culprit',
        /extension|VPN|filter/i.test(r.shown), r.shown);
    check('it never blames the connection',
        !/check your connection/i.test(r.shown), r.shown);
    eq('the probe ran once', r.probes.length, 1);
    check('the probe carries no API key',
        !/key=/i.test(r.probes[0].url), r.probes[0].url);
    check('the probe targets the service host',
        /generativelanguage\.googleapis\.com/.test(r.probes[0].url), r.probes[0].url);

    // The host IS reachable, so this is ours — and blaming the user's
    // network here would send them chasing a problem they do not have.
    r = await upload({ event: 'error', status: 0 }, { online: true, probe: 'reachable' });
    check('a reachable service means the upload was refused',
        /refused/i.test(r.shown), r.shown);
    check('and it is owned as our problem',
        /our side|report/i.test(r.shown), r.shown);
    check('it does not blame an extension',
        !/extension|VPN|filter/i.test(r.shown), r.shown);

    // An aborted probe decided nothing; claiming either cause would be
    // the same overclaim in a new place.
    r = await upload({ event: 'error', status: 0 }, { online: true, probe: 'abort' });
    check('an inconclusive probe asserts neither cause',
        !/cannot reach/i.test(r.shown) && !/refused/i.test(r.shown), r.shown);
    check('but still says what was observed',
        /did not reach/i.test(r.shown), r.shown);

    // A probe that explodes must not swallow the upload failure.
    r = await upload({ event: 'error', status: 0 }, { online: true, probe: 'throws' });
    check('a broken probe still reports a failure', /reach|refused/i.test(r.shown), r.shown);

    // Offline needs no probe — the browser already knows.
    r = await upload({ event: 'error', status: 0 }, { online: false });
    eq('offline skips the probe', r.probes.length, 0);

    // An HTTP rejection already carries its reason; probing would be an
    // extra request that answers nothing.
    r = await upload({ event: 'load', status: 400 });
    eq('an HTTP failure does not probe', r.probes.length, 0);

    /* ---------- the detail is on the page, not just the console -- */

    r = await upload({ event: 'error', status: 0 }, { online: true, probe: 'blocked' });
    check('a details block is rendered', /<details/.test(r.shown), r.shown);
    check('it records whether the service was reachable',
        /service reachable/i.test(r.shown), r.shown);
    check('and the online state', /online/i.test(r.shown), r.shown);

    /* ---------- Google's own reason ----------------------------- */

    r = await upload({
        event: 'load', status: 400, statusText: 'Bad Request',
        responseHeaders: { 'X-Goog-Upload-Status': 'final' },
        responseText: '{"error":{"message":"bad"}}',
    });
    check('an HTTP rejection reports the status', /400/.test(r.shown), r.shown);
    check("and Google's upload status", /final/.test(r.shown), r.shown);

    /* ---------- an expired session is not a network fault ------- */

    for (const status of [403, 404, 410]) {
        r = await upload({ event: 'load', status });
        check(`${status} reads as an expired link`, /expired/i.test(r.shown), r.shown);
        check(`${status} tells the user to start over`,
            /again|over/i.test(r.shown), r.shown);
    }

    r = await upload({ event: 'load', status: 413 });
    check('413 reads as too large', /too large/i.test(r.shown), r.shown);

    /* ---------- timeout is its own thing ------------------------ */

    r = await upload({ event: 'timeout', status: 0 });
    check('a timeout says it timed out', /timed out/i.test(r.shown), r.shown);
    check('and is not called an interruption',
        !/interrupted/i.test(r.shown), r.shown);
    check('it suggests something actionable', /shorter|connection/i.test(r.shown), r.shown);

    /* ---------- a 2xx we cannot parse --------------------------- */

    r = await upload({ event: 'load', status: 200, responseText: 'not json' });
    check('an unreadable 2xx does not quote a status code',
        !/\(200/.test(r.shown), r.shown);
    check('and says the reply could not be read', /reply/i.test(r.shown), r.shown);

    r = await upload({ event: 'load', status: 200, responseText: '{"file":{}}' });
    check('a 2xx with no file name is also a reply problem',
        /reply/i.test(r.shown), r.shown);

    /* ---------- every failure leaves evidence ------------------- */

    r = await upload({ event: 'error', status: 0 }, { online: true });
    const detail = (r.logged.find(a => /video upload failed/.test(String(a[0]))) || [])[1];
    check('the failure is logged', !!detail, JSON.stringify(r.logged));
    if (detail) {
        eq('status is recorded', detail.status, 0);
        eq('onLine is recorded', detail.online, true);
        check('the kind is recorded', typeof detail.kind === 'string');
        check('a body slice is recorded when present', 'body' in detail);
    }

    /* ---------- the happy path still works ---------------------- */

    r = await upload({
        event: 'load', status: 200, progress: true,
        responseText: '{"file":{"name":"files/abc","uri":"u","state":"ACTIVE"}}',
    });
    check('a good upload shows no error',
        !/blocked|expired|timed out|rejected/i.test(r.shown), r.shown);

    /* ---------- the request itself is well formed --------------- */

    eq('posts to the resumable URL', lastXhr.url, 'https://upload.example/session/abc');
    eq('uses POST', lastXhr.method, 'POST');
    check('a timeout is set', lastXhr.timeout > 0);
    // Content-Length is a forbidden header; assigning it throws.
    check('does not try to set Content-Length',
        !Object.keys(lastXhr._headers).some(h => h.toLowerCase() === 'content-length'),
        JSON.stringify(lastXhr._headers));
    eq('sends the upload command', lastXhr._headers['X-Goog-Upload-Command'], 'upload, finalize');
    eq('sends the offset', lastXhr._headers['X-Goog-Upload-Offset'], '0');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
