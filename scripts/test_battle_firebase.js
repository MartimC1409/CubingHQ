/* Tests the Firebase REST helpers and the battle lobby's failure state.

   These helpers used to `return await r.json()` whatever the HTTP status,
   so Firebase's `401 {"error":"Permission denied"}` came back looking
   exactly like data. Nothing logged, nothing surfaced. The visible cost
   was battles: a database that was refusing to answer rendered as
   "No rooms found.", and creating a room said "try again" for a
   permission error that retrying can never fix.

   The code is extracted from app.js rather than copied here, so a change
   to the shipped file cannot silently escape these tests.

   Run: node scripts/test_battle_firebase.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/** Pulls a run of source out of app.js by its first and last line. */
function slice(startsWith, endsWith) {
    const start = SRC.indexOf(startsWith);
    if (start === -1) throw new Error(`not found in app.js: ${startsWith}`);
    const end = SRC.indexOf(endsWith, start);
    if (end === -1) throw new Error(`not found in app.js: ${endsWith}`);
    return SRC.slice(start, end + endsWith.length);
}

const HELPERS = slice('    let fbLastError = null;',
    "    function fbDelete(path)       { return fbRequest('DELETE', path); }");

const RENDER = slice('    function renderBattleLobby(data) {', '\n    }\n');

/* ---------- the helpers ----------------------------------------- */

/**
 * Runs the extracted helpers against a stubbed fetch.
 * @param response what fetch resolves to, or an Error to reject with
 */
function runHelpers(response) {
    const logged = [];
    const ctx = {
        RTDB: 'https://db.example',
        console: { error: (...a) => logged.push(a.join(' ')), warn() { }, log() { } },
        JSON, Error, Object, Date, Promise,
        fetch: async () => {
            if (response instanceof Error) throw response;
            return response;
        },
    };
    vm.runInNewContext(HELPERS + '\nthis.api = { fbGet, fbSet, fbUpdate, fbPush, fbDelete, fbError };',
        ctx, { filename: 'app.js:fb' });
    return { api: ctx.api, logged };
}

function res(status, body, { unreadable = false } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => { if (unreadable) throw new Error('not json'); return body; },
        text: async () => JSON.stringify(body),
    };
}

(async () => {
    /* A normal read is completely unaffected. */
    let h = runHelpers(res(200, { '-Nabc': { name: 'Room' } }));
    let out = await h.api.fbGet('/battle/rooms');
    eq('a good read returns the data', JSON.stringify(out), JSON.stringify({ '-Nabc': { name: 'Room' } }));
    eq('and records no error', h.api.fbError(), null);
    eq('and logs nothing', h.logged.length, 0);

    /* An empty database is null — and must NOT read as a failure. */
    h = runHelpers(res(200, null));
    eq('an empty path returns null', await h.api.fbGet('/battle/rooms'), null);
    eq('with no error recorded — empty is not broken', h.api.fbError(), null);

    /* The case that broke battles. */
    h = runHelpers(res(401, { error: 'Permission denied' }));
    out = await h.api.fbGet('/battle/rooms');
    eq('a refused read returns null, not the error body', out, null);
    eq('and records it as denied', h.api.fbError(), 'denied');
    check('and says so in the console', h.logged.some(l => /HTTP 401/.test(l)), h.logged.join('|'));

    h = runHelpers(res(401, { error: 'Permission denied' }));
    out = await h.api.fbPush('/battle/rooms', { name: 'Room' });
    eq('a refused write returns null', out, null);
    check('so the caller cannot read a key off an error body',
        out === null || out.name === undefined);
    eq('and is denied', h.api.fbError(), 'denied');

    /* Some Firebase errors arrive with a 200. */
    h = runHelpers(res(200, { error: 'Permission denied' }));
    eq('a 200 error body is still a failure', await h.api.fbGet('/battle/rooms'), null);
    eq('and still denied', h.api.fbError(), 'denied');

    h = runHelpers(res(200, { error: 'Index not defined' }));
    eq('a non-permission 200 error is a failure too', await h.api.fbGet('/x'), null);
    eq('but not denied — retrying is not the wrong advice here',
        h.api.fbError(), 'error');

    /* A real record that happens to carry an `error` field is data. */
    h = runHelpers(res(200, { error: 'oops', name: 'Room', createdAt: 1 }));
    out = await h.api.fbGet('/battle/rooms/-Nabc');
    check('a record with other fields is not mistaken for an error', out !== null
        && out.name === 'Room', JSON.stringify(out));

    /* A 404 on a battle path is the gateway missing, not a missing room.
       This is the failure that shipped: app.js was switched over to
       /api/battle before that endpoint existed, so every write 404'd and
       the only thing on screen was "try again". */
    h = runHelpers(res(404, { error: 'Not Found' }));
    eq('a 404 on a battle path returns null', await h.api.fbPush('/battle/rooms', { name: 'R' }), null);
    eq('and names the missing gateway', h.api.fbError(), 'no_gateway');

    h = runHelpers(res(404, { error: 'Not Found' }));
    await h.api.fbGet('/battle_chats/-Nabc');
    eq('chat goes through the same gateway', h.api.fbError(), 'no_gateway');

    h = runHelpers(res(404, { error: 'Not Found' }));
    await h.api.fbGet('/records');
    eq('a 404 elsewhere is just an error — those paths are direct',
        h.api.fbError(), 'error');

    /* Server errors and network failures are distinguishable. */
    h = runHelpers(res(500, { error: 'boom' }));
    eq('a 500 returns null', await h.api.fbGet('/x'), null);
    eq('as a plain error', h.api.fbError(), 'error');

    h = runHelpers(new Error('offline'));
    eq('a network failure returns null', await h.api.fbGet('/x'), null);
    eq('and is recorded as network', h.api.fbError(), 'network');
    check('and is logged', h.logged.some(l => /network error/.test(l)));

    h = runHelpers(res(200, null, { unreadable: true }));
    eq('an unreadable body returns null', await h.api.fbGet('/x'), null);
    eq('as an error', h.api.fbError(), 'error');

    /* The flag clears, so one failure does not poison later reads. */
    const ctx = runHelpers(res(401, { error: 'Permission denied' }));
    await ctx.api.fbGet('/x');
    eq('denied is recorded', ctx.api.fbError(), 'denied');
    // A second run stands in for a later, successful request.
    h = runHelpers(res(200, { ok: 1 }));
    await h.api.fbGet('/x');
    eq('a later success clears the flag', h.api.fbError(), null);

    /* All five helpers use the right verb. */
    const verbs = [];
    const vctx = {
        RTDB: 'https://db.example',
        console: { error() { }, warn() { }, log() { } },
        JSON, Error, Object, Date, Promise,
        fetch: async (url, opts) => { verbs.push([opts.method, String(url)]); return res(200, {}); },
    };
    vm.runInNewContext(HELPERS + '\nthis.api = { fbGet, fbSet, fbUpdate, fbPush, fbDelete, fbError };',
        vctx, { filename: 'app.js:fb' });
    await vctx.api.fbGet('/a');
    await vctx.api.fbSet('/b', { x: 1 });
    await vctx.api.fbUpdate('/c', { x: 1 });
    await vctx.api.fbPush('/d', { x: 1 });
    await vctx.api.fbDelete('/e');
    eq('the verbs are unchanged', JSON.stringify(verbs.map(v => v[0])),
        JSON.stringify(['GET', 'PUT', 'PATCH', 'POST', 'DELETE']));
    eq('and the .json suffix is kept', verbs[0][1], 'https://db.example/a.json');

    /* ---------- the lobby's failure state ------------------------ */

    function runRender(data, lobbyError) {
        let html = '';
        const grid = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
        const rctx = {
            $: (sel) => (sel === '#battle-rooms-grid' ? grid : null),
            // The populated path binds join handlers after writing the
            // markup; the markup is what these tests are about.
            $$: () => [],
            esc: (s) => String(s),
            i18nT: (key, fb) => fb,
            battleState: { filterEvent: 'all', lastLobbyData: null, lobbyError },
            BATTLE_EVENTS: { '3x3': { label: '3x3', color: '#000' } },
            Date, Object, JSON, String, Number, Math,
        };
        vm.runInNewContext(RENDER + '\nthis.render = renderBattleLobby;', rctx,
            { filename: 'app.js:lobby' });
        rctx.render(data);
        return html;
    }

    // The heart of it: a refusal and a quiet evening looked identical.
    let html = runRender(null, 'denied');
    check('a refused lobby does not claim there are no rooms',
        !/No rooms found/.test(html), html.slice(0, 200));
    check('it says the database is refusing', /refusing connections/.test(html),
        html.slice(0, 200));
    check('and does not offer "Create one!", which would also fail',
        !/Create one/.test(html));

    html = runRender(null, 'no_gateway');
    check('a missing gateway says the service is not running',
        /not running/.test(html), html.slice(0, 200));
    check('and does not claim there are no rooms', !/No rooms found/.test(html));

    html = runRender(null, 'network');
    check('an unreachable lobby says so', /Couldn't reach/.test(html), html.slice(0, 200));
    check('and does not blame an empty database', !/No rooms found/.test(html));

    html = runRender(null, null);
    check('a genuinely empty lobby still says no rooms', /No rooms found/.test(html),
        html.slice(0, 200));
    check('and still offers to create one', /Create one/.test(html));

    html = runRender({
        '-Nabc': { name: 'Room', event: '3x3', updatedAt: Date.now(), members: { a: {} } },
    }, null);
    check('a populated lobby is unaffected', /Room/.test(html) && !/No rooms found/.test(html),
        html.slice(0, 200));

    // An error flag must win over stale data, or a refusal would show the
    // previous poll's rooms as though they were still live.
    html = runRender({
        '-Nabc': { name: 'Room', event: '3x3', updatedAt: Date.now(), members: { a: {} } },
    }, 'denied');
    check('an error beats leftover data', /refusing connections/.test(html)
        && !/>Room</.test(html), html.slice(0, 200));

    /* ---------- the create handler ------------------------------- */

    const create = SRC.slice(SRC.indexOf("$('#battle-create-confirm').addEventListener"),
        SRC.indexOf("// Password modal"));

    check('the button is disabled before the scramble is generated — a click '
        + 'that shows nothing for 30s reads as a broken button',
        create.indexOf("confirmLabel.textContent = i18nT('battle.creating'")
        < create.indexOf('await generateBattleScramble'), 'ordering');
    check('the label is restored in a finally, so it cannot stick on "Creating..."',
        /finally\s*\{[^}]*battle\.createRoom/s.test(create));
    check('a denied write gets its own message', /roomCreateDenied/.test(create));
    check('a missing gateway gets its own message too',
        /roomCreateNoGateway/.test(create));
    check('and "try again" is kept for everything else', /roomCreateFailed/.test(create));

    /* ---------- the strings exist in both languages -------------- */

    const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
    for (const key of ['battle.roomsDenied', 'battle.roomsUnreachable', 'toast.roomCreateDenied',
        'battle.roomsNoGateway', 'toast.roomCreateNoGateway']) {
        eq(`${key} is defined twice — EN and PT`,
            (i18n.match(new RegExp(`'${key.replace('.', '\\.')}':`, 'g')) || []).length, 2);
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
