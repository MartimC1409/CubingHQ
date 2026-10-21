/* Tests that the standalone pages (timer.html, coach.html) show a signed-in
   person as signed in, and that a WCA outage no longer signs anyone out.

   The report was "using the timer logs me out". It did not: timer.html is
   its own page and never ran the code that swaps the navbar's Login button
   for the account picture, so it said "Login" to everyone. nav-session.js
   now does that from what the browser already holds. Separately, a WCA
   sign-in really was being deleted whenever the WCA answered /me with
   anything but 200 — a rate limit or an outage — and every trip between
   the timer and the rest of the site was another chance of that.

   The full flow (sign in, open the timer, solve, reload, come back) runs
   in Chromium against the real pages; this pins the parts that can be
   checked without a browser.

   Run: node scripts/test_nav_session.js */

'use strict';

process.env.AUTH_SIGNING_SECRET = 'test-nav-secret';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const session = require('../api/_lib/session.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('nav-session.js');
const APP = read('app.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
    if (Object.is(got, want)) pass++;
    else { fail++; console.error(`FAIL ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

/** Runs nav-session.js against a navbar holding a Login button. */
function run(storage) {
    const store = Object.assign({}, storage);
    const writes = [];
    function el(id) {
        return {
            id, title: 'Login', innerHTML: 'Login', attrs: { 'data-i18n': 'nav.login' }, listeners: {},
            parentNode: null,
            cloneNode() { const c = el(this.id); c.attrs = Object.assign({}, this.attrs); return c; },
            setAttribute(k, v) { this.attrs[k] = v; },
            removeAttribute(k) { delete this.attrs[k]; },
            addEventListener(t, fn) { this.listeners[t] = fn; },
        };
    }
    const nav = {
        children: [],
        replaceChild(n, o) { this.children[this.children.indexOf(o)] = n; n.parentNode = this; },
    };
    const login = el('nav-login-btn');
    login.parentNode = nav;
    nav.children.push(login);
    const ctx = {
        window: {}, console, JSON, Date, Math, String, Uint8Array, TextDecoder,
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { writes.push(k); store[k] = String(v); },
            removeItem: k => { writes.push(k); delete store[k]; },
        },
        sessionStorage: { setItem() {}, getItem() { return null; } },
        document: { getElementById: id => nav.children.find(c => c.id === id) || null },
    };
    vm.runInNewContext(SRC, ctx, { filename: 'nav-session.js' });
    return { button: nav.children[0], writes, store };
}

/* ---- an email account ------------------------------------------- */
const token = session.issue({ uid: 'acc_ana', name: 'Ana Silva' });
let r = run({ chq_auth_token: token });
eq('a signed-in account replaces Login', r.button.id, 'nav-profile-btn');
ok('with their initials', r.button.innerHTML.includes('>AS<'), r.button.innerHTML);
ok('and their name as the title', r.button.title === 'Ana Silva');
ok('no longer translated as "Login"', !('data-i18n' in r.button.attrs));
ok('and it goes somewhere when tapped', typeof r.button.listeners.click === 'function');
eq('nothing is written to storage', r.writes.length, 0);

// The picture app.js last showed is used when there is one.
r = run({ chq_auth_token: token, chq_nav_profile: JSON.stringify({ name: 'Ana Silva', picture: 'https://example.test/a.png' }) });
ok('the saved picture is shown', r.button.innerHTML.includes('src="https://example.test/a.png"'), r.button.innerHTML);

// A name outside ASCII survives the token's base64url.
r = run({ chq_auth_token: session.issue({ uid: 'acc_x', name: 'Yìhéng Wáng' }) });
eq('accented names decode', r.button.title, 'Yìhéng Wáng');

/* ---- what is not a sign-in --------------------------------------- */
r = run({});
eq('nobody signed in: Login stays', r.button.id, 'nav-login-btn');
r = run({ chq_auth_token: session.issue({ uid: 'acc_old', name: 'Old' }, Date.now() - 40 * 24 * 3600 * 1000) });
eq('an expired session: Login stays', r.button.id, 'nav-login-btn');
eq('...and the expired token is left for app.js to judge', r.store.chq_auth_token !== undefined, true);
r = run({ chq_auth_token: 'garbage' });
eq('an unreadable token: Login stays', r.button.id, 'nav-login-btn');

/* ---- a WCA sign-in ------------------------------------------------ */
r = run({ wca_access_token: 'abc', chq_nav_profile: JSON.stringify({ name: 'Bea Costa', source: 'wca' }) });
eq('a WCA sign-in replaces Login', r.button.id, 'nav-profile-btn');
ok('with the saved name', r.button.innerHTML.includes('>BC<'));
r = run({ wca_access_token: 'abc' });
eq('even before a name was ever saved', r.button.id, 'nav-profile-btn');

/* ---- the pages load it in the right place ------------------------- */
for (const page of ['timer.html', 'coach.html']) {
    const html = read(page);
    const at = html.indexOf('nav-session.js?v=');
    ok(`${page} loads nav-session.js`, at !== -1);
    ok(`...after the navbar markup`, at > html.indexOf('id="nav-login-btn"'));
    ok(`...before the navbar is wired`, at < html.search(/function wire(Cs|Coach)Navbar/));
    ok(`...and before mobile-nav.js moves the buttons`, at < html.indexOf('mobile-nav.js?v='));
}

/* ---- app.js keeps the profile for it, and stops over-deleting ------ */
ok('app.js saves the display profile on sign-in', /function updateUIAfterLogin\(\) \{[\s\S]{0,200}rememberNavProfile\(\)/.test(APP));
ok('and forgets it on sign-out', /function signOut\(\) \{[\s\S]{0,250}forgetNavProfile\(\)/.test(APP));
const wcaFetch = APP.slice(APP.indexOf('async function fetchWCAProfile'), APP.indexOf('function updateUIAfterLogin'));
ok('a WCA token is only deleted on a 401', /else if \(res\.status === 401\) \{\s*[\s\S]{0,400}localStorage\.removeItem\('wca_access_token'\)/.test(wcaFetch));
ok('not on any other failure', !/\} else \{\s*localStorage\.removeItem\('wca_access_token'\)/.test(wcaFetch));
ok('the profile is never a credential', !/token/i.test(APP.slice(APP.indexOf('function rememberNavProfile'), APP.indexOf('function forgetNavProfile'))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
