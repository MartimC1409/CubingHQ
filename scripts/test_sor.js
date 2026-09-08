/* Tests the Sum of Ranks view (app.js): the maths, the ordering of the
   board, and how a WCA ID that is malformed, unknown or resultless is
   handled.

   Sum of Ranks adds a competitor's WCA rank in every event. The rank
   depends on two choices — world / continent / country and single /
   average — so the same person has four different totals, and reading
   the wrong key would still produce a plausible-looking number. These
   tests pin all of them.

   The second thing pinned here is the ordering. Unranked events are
   left out of the sum (the WCA publishes no way to score an event
   nobody has competed), which means a total on its own rewards having
   competed less: three events beat seventeen. The board therefore
   orders on events ranked first and the total second, and that is
   asserted rather than assumed.

   The code is extracted from app.js rather than copied here, so a
   change to the shipped file cannot silently escape this test.

   Run: node scripts/test_sor.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function ok(label, cond, extra) { check(label, !!cond, extra); }

/** Pulls a run of source out of app.js by its first and last line. */
function slice(startsWith, endsWith) {
    const start = SRC.indexOf(startsWith);
    if (start === -1) throw new Error(`not found in app.js: ${startsWith}`);
    const end = SRC.indexOf(endsWith, start);
    if (end === -1) throw new Error(`not found in app.js: ${endsWith}`);
    return SRC.slice(start, end + endsWith.length);
}

const BLOB = [
    "const WCA_API = 'https://www.worldcubeassociation.org/api/v0';",
    slice('    const EVENT_NAMES = {', "'444bf': '4x4 BLD', '555bf': '5x5 BLD'\n    };"),
    slice('    function esc(s) {', "        .replace(/'/g, '&#39;');\n    }"),
    slice('    function countryFlagImg(iso2, size = 20, altText) {', '\n    }'),
    slice('    function decodeMBLD(value) {', '\n    }'),
    slice('    function formatTime(seconds) {', '        return `${mins}:${secs}`;\n    }'),
    slice("    const WCA_EVENT_ORDER = ['333',", '        return formatTime(best / 100);\n    }'),
    slice('    // ========== SUM OF RANKS ==========', '        }\n    }\n\n    // ========== START'),
].join('\n\n');

/** The handful of nodes the SoR renderers reach for, as inert stand-ins.
    Assigning innerHTML drops the children, as it does in a browser —
    without that the rows of every render pile up on top of each other. */
function fakeEl() {
    const el = {
        textContent: '', className: '', style: {},
        dataset: {}, children: [],
        appendChild(c) { this.children.push(c); return c; },
        addEventListener() {},
        setAttribute() {},
        querySelectorAll() { return []; },
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
        get: () => html,
        set: (v) => { html = String(v); el.children.length = 0; },
    });
    return el;
}

function newHarness(wcaData) {
    const els = {};
    [
        '#sor-results', '#sor-empty', '#sor-board-title', '#sor-th-result',
        '#sor-board-body', '#sor-detail-card', '#sor-detail-body',
        '#sor-detail-flag', '#sor-detail-name', '#sor-detail-meta',
        '#sor-detail-total', '#sor-detail-total-label', '#sor-loading',
        '#sor-error', '#sor-error-text', '#sor-wca-id', '#sor-search-btn',
        '#sor-me-btn', '#sor-clear-btn', '#sor-region-chips', '#sor-type-chips',
    ].forEach(sel => { els[sel] = fakeEl(); });

    const store = {};
    const ctx = {
        console, JSON, Object, Math, String, Number, Array, Map, Set, Promise,
        state: { userProfile: null },
        i18nT: (key, fallback) => fallback,
        $: (sel) => els[sel] || null,
        document: { createElement: () => fakeEl() },
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
        },
        window: { WcaCountries: null },
        fetch: async (url) => {
            const m = /\/persons\/([^/]+)$/.exec(url);
            const data = m && wcaData[m[1]];
            return { ok: !!data, json: async () => data };
        },
    };
    vm.runInNewContext(BLOB + `
        this.sorState = sorState;
        this.computeSor = computeSor;
        this.addSorPerson = addSorPerson;
        this.renderSor = renderSor;
    `, ctx, { filename: 'app.js:sor' });
    return { ctx, els, store };
}

/** A /persons/:id payload with the ranks spelled out per region. */
function person(name, wcaId, records) {
    return {
        person: { wca_id: wcaId, name, country: { id: 'Portugal', name: 'Portugal', iso2: 'PT', continentId: '_Europe' } },
        personal_records: records,
    };
}

/** single/average sides carrying a different rank for each region. */
function ranks(best, world, continent, country) {
    return { best, world_rank: world, continent_rank: continent, country_rank: country };
}

(async () => {
    /* ---- the maths, per region and per type ---------------------- */
    const records = {
        '333': { single: ranks(800, 100, 20, 3), average: ranks(900, 150, 30, 4) },
        '222': { single: ranks(200, 500, 60, 9), average: ranks(250, 550, 70, 11) },
        'pyram': { single: ranks(300, 1000, 90, 12) },   // no average at all
    };
    let h = newHarness({ '2015TEST01': person('Ana', '2015TEST01', records) });
    await h.ctx.addSorPerson('2015TEST01');

    ok('the competitor was added', h.ctx.sorState.people.length === 1);

    let sor = h.ctx.computeSor(h.ctx.sorState.people[0]);
    check('world single sums the world ranks', sor.total === 1600, String(sor.total));
    check('world single counts three ranked events', sor.rankedCount === 3, String(sor.rankedCount));
    check('all seventeen WCA events are considered', sor.eventCount === 17, String(sor.eventCount));
    check('the average rank is the mean of the ranks', sor.avgRank === 533, String(sor.avgRank));

    h.ctx.sorState.region = 'continent';
    check('continent single reads continent_rank', h.ctx.computeSor(h.ctx.sorState.people[0]).total === 170);

    h.ctx.sorState.region = 'country';
    check('country single reads country_rank', h.ctx.computeSor(h.ctx.sorState.people[0]).total === 24);

    h.ctx.sorState.region = 'world';
    h.ctx.sorState.type = 'average';
    sor = h.ctx.computeSor(h.ctx.sorState.people[0]);
    check('world average sums the average ranks', sor.total === 700, String(sor.total));
    check('an event with no average is not counted', sor.rankedCount === 2, String(sor.rankedCount));

    /* An event the person has never competed contributes nothing and is
       reported as unranked, rather than being scored with a made-up rank. */
    h.ctx.sorState.type = 'single';
    sor = h.ctx.computeSor(h.ctx.sorState.people[0]);
    const unranked = sor.rows.filter(r => r.rank === null).map(r => r.eventId);
    check('every uncompeted event is listed unranked', unranked.length === 14, unranked.join(', '));
    ok('4x4 is among them', unranked.includes('444'));
    ok('3x3 is not', !unranked.includes('333'));

    /* ---- board ordering ------------------------------------------ */
    // Bea is ranked in one event with a very low rank; Ana in three with
    // a higher total. Ordering on the total alone would put Bea first.
    h = newHarness({
        '2015TEST01': person('Ana', '2015TEST01', records),
        '2015TEST02': person('Bea', '2015TEST02', {
            '333': { single: ranks(700, 5, 1, 1) },
        }),
    });
    await h.ctx.addSorPerson('2015TEST01');
    await h.ctx.addSorPerson('2015TEST02');
    h.ctx.renderSor();

    let rows = h.els['#sor-board-body'].children.map(c => c.innerHTML);
    check('both competitors are on the board', rows.length === 2, String(rows.length));
    ok('the competitor ranked in more events is first', rows[0].includes('Ana'), rows[0]);
    ok('the shorter list is second', rows[1].includes('Bea'), rows[1]);

    // With the event count level, the lower total wins.
    h = newHarness({
        '2015TEST01': person('Ana', '2015TEST01', { '333': { single: ranks(800, 100, 20, 3) } }),
        '2015TEST02': person('Bea', '2015TEST02', { '333': { single: ranks(700, 5, 1, 1) } }),
    });
    await h.ctx.addSorPerson('2015TEST01');
    await h.ctx.addSorPerson('2015TEST02');
    h.ctx.renderSor();
    rows = h.els['#sor-board-body'].children.map(c => c.innerHTML);
    ok('at equal event counts the lower total leads', rows[0].includes('Bea'), rows[0]);

    /* ---- rejected input ------------------------------------------ */
    h = newHarness({ '2015TEST01': person('Ana', '2015TEST01', records) });
    await h.ctx.addSorPerson('not-an-id');
    check('a malformed WCA ID adds nobody', h.ctx.sorState.people.length === 0);
    ok('and says so', h.els['#sor-error'].style.display === 'flex');

    await h.ctx.addSorPerson('2015NOPE99');
    check('an unknown WCA ID adds nobody', h.ctx.sorState.people.length === 0);
    ok('and says so', h.els['#sor-error-text'].textContent.includes('No WCA competitor'),
        h.els['#sor-error-text'].textContent);

    h = newHarness({ '2015TEST03': person('Cid', '2015TEST03', {}) });
    await h.ctx.addSorPerson('2015TEST03');
    check('someone with no official results adds nobody', h.ctx.sorState.people.length === 0);
    ok('and is named in the message', h.els['#sor-error-text'].textContent.includes('Cid'),
        h.els['#sor-error-text'].textContent);

    /* ---- persistence --------------------------------------------- */
    h = newHarness({ '2015TEST01': person('Ana', '2015TEST01', records) });
    await h.ctx.addSorPerson('2015test01');           // lower case is fine
    check('the ID is normalised to upper case',
        h.ctx.sorState.people[0].wcaId === '2015TEST01', h.ctx.sorState.people[0].wcaId);
    check('the board is remembered for next time',
        JSON.parse(h.store['sor-people'] || '[]')[0] === '2015TEST01', h.store['sor-people']);

    await h.ctx.addSorPerson('2015TEST01');
    check('adding the same person twice does not duplicate them',
        h.ctx.sorState.people.length === 1, String(h.ctx.sorState.people.length));

    /* ---- the view is actually reachable -------------------------- */
    ok('index.html carries the Sum of Ranks view', INDEX.includes('id="sor-view"'));
    ok('...and a nav button for it', INDEX.includes('id="nav-sor-btn"'));
    ok('...and the home grid links to it', INDEX.includes('bento-sor'));
    ok('app.js routes #sor to the view', SRC.includes("'#sor': 'sor'"));
    ok('...and the view back to #sor', SRC.includes("'sor': '#sor'"));
    ok('...and initialises it on arrival', SRC.includes("if (targetView === 'sor') initSorView();"));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
