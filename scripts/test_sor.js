/* Tests the Sum of Ranks view (app.js) and the data it reads.

   Sum of Ranks is the WCA statistic cubing.com publishes: a competitor's
   rank in every event, added up, lowest first, where an event they are
   not ranked in counts as (people ranked in it, in that region) + 1.
   That penalty is the whole point — without it a total rewards competing
   less — so it is pinned here twice: in the generator's output, and in
   the page's scoring of a competitor looked up live.

   The code is extracted from app.js rather than copied here, so a change
   to the shipped file cannot silently escape this test.

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
    slice('    // ========== SUM OF RANKS ==========', '\n    // ========== START'),
].join('\n\n');

function fakeEl() {
    const el = {
        textContent: '', className: '', style: {}, value: '', disabled: false,
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

const W_SRC = fs.readFileSync(path.join(ROOT, 'wca-countries.js'), 'utf8');

function newHarness({ files = {}, wca = {} } = {}) {
    const els = {};
    const fetched = [];
    const win = {};
    vm.runInNewContext(W_SRC, { window: win });
    const ctx = {
        console, JSON, Object, Math, String, Number, Array, Map, Set, Promise,
        state: { userProfile: null, currentView: 'sor' },
        i18nT: (key, fallback) => fallback,
        $: (sel) => els[sel] || (els[sel] = fakeEl()),
        document: { createElement: () => fakeEl(), querySelector: () => null, addEventListener() {} },
        window: win,
        fetch: async (url) => {
            fetched.push(url);
            if (url in files) return { ok: true, json: async () => JSON.parse(JSON.stringify(files[url])) };
            const m = /\/persons\/([^/]+)$/.exec(url);
            const data = m && wca[m[1]];
            return { ok: !!data, json: async () => data };
        },
    };
    vm.runInNewContext(BLOB + `
        this.sorState = sorState;
        this.computeSor = computeSor;
        this.sorPositionFor = sorPositionFor;
        this.sorBoardUrl = sorBoardUrl;
        this.showSorBoard = showSorBoard;
        this.findSorCompetitor = findSorCompetitor;
        this.renderSor = renderSor;
    `, ctx, { filename: 'app.js:sor' });
    return { ctx, els, fetched };
}

function board(rows, extra = {}) {
    return Object.assign({
        region: 'world', type: 'single', exportDate: '2026-10-02T00:00:00Z',
        events: ['333', '222', 'pyram'], penalties: [1001, 501, 301], competitors: 1000, rows,
    }, extra);
}

/** A /persons/:id payload. */
function person(name, wcaId, records, countryId = 'Portugal') {
    return {
        person: { wca_id: wcaId, name, country: { id: countryId, name: countryId, iso2: 'PT', continentId: '_Europe' } },
        personal_records: records,
    };
}
function ranks(best, world, continent, country) {
    return { best, world_rank: world, continent_rank: continent, country_rank: country };
}

(async () => {
    /* ---- where each board lives ---------------------------------- */
    let h = newHarness();
    check('world single', h.ctx.sorBoardUrl('world', 'single') === 'data/sor/world-single.json');
    check('a continent', h.ctx.sorBoardUrl('_North America', 'average') === 'data/sor/north-america-average.json',
        h.ctx.sorBoardUrl('_North America', 'average'));
    check('a country', h.ctx.sorBoardUrl('Portugal', 'single') === 'data/sor/pt-single.json');

    /* ---- the penalty, for a competitor scored live ---------------- */
    const ana = person('Ana', '2015TEST01', {
        '333': { single: ranks(800, 100, 20, 3), average: ranks(900, 150, 30, 4) },
        '222': { single: ranks(200, 500, 60, 9) },
    });
    const b = board([]);
    let sor = h.ctx.computeSor({ records: ana.personal_records }, b, 'world');
    check('ranked events add their rank, unranked ones the penalty', sor.sum === 100 + 500 + 301, String(sor.sum));
    check('the unranked event is recorded as 0', sor.ranks[2] === 0);
    check('ranked count', sor.ranked === 2);
    sor = h.ctx.computeSor({ records: ana.personal_records }, b, '_Europe');
    check('a continent reads continent_rank', sor.sum === 20 + 60 + 301, String(sor.sum));
    sor = h.ctx.computeSor({ records: ana.personal_records }, b, 'Portugal');
    check('a country reads country_rank', sor.sum === 3 + 9 + 301, String(sor.sum));
    sor = h.ctx.computeSor({ records: ana.personal_records }, board([], { type: 'average' }), 'world');
    check('average reads the average ranks', sor.sum === 150 + 501 + 301, String(sor.sum));
    check('nobody with no rank of the type is scored',
        h.ctx.computeSor({ records: {} }, b, 'world') === null);

    /* ---- position on a board ------------------------------------- */
    const rows = [
        [1, 'A', 'A', 'PT', 10, [1, 1, 8]],
        [2, 'B', 'B', 'PT', 20, [1, 1, 18]],
        [2, 'C', 'C', 'PT', 20, [1, 1, 18]],
        [4, 'D', 'D', 'PT', 30, [1, 1, 28]],
    ];
    check('a better total goes first', h.ctx.sorPositionFor(5, rows) === 1);
    check('a tie shares the position', h.ctx.sorPositionFor(20, rows) === 2);
    check('between rows', h.ctx.sorPositionFor(25, rows) === 4);
    check('past the last row is unplaced', h.ctx.sorPositionFor(31, rows) === null);

    /* ---- the board renders, paged -------------------------------- */
    const many = Array.from({ length: 250 }, (_, i) =>
        [i + 1, `2020ZZZZ${String(i).padStart(2, '0')}`, `Person ${i}`, 'PT', 100 + i, [i + 1, 0, 3]]);
    h = newHarness({ files: { 'data/sor/world-single.json': board(many) } });
    await h.ctx.showSorBoard();
    check('the board loaded', h.ctx.sorState.board && h.ctx.sorState.board.rows.length === 250);
    let body = h.els['#sor-board-body'];
    check('a page is 100 rows', body.children.length === 100, String(body.children.length));
    ok('a penalty cell is drawn faded', body.children[0].innerHTML.includes('sor-pen'));
    ok('and shows the penalty', body.children[0].innerHTML.includes('>501<'), body.children[0].innerHTML);
    ok('the head names the events', h.els['#sor-board-head'].innerHTML.includes('Pyra'));
    ok('the meta line says how many are ranked', h.els['#sor-board-meta'].textContent.includes('1,000'),
        h.els['#sor-board-meta'].textContent);

    // Finding someone on page 3 turns to it.
    await h.ctx.findSorCompetitor('person 220');
    check('a name search turns to their page', h.ctx.sorState.page === 2, String(h.ctx.sorState.page));
    check('and highlights them', h.ctx.sorState.highlight === '2020ZZZZ220');
    check('the last page is short', h.els['#sor-board-body'].children.length === 50);

    /* ---- a competitor outside the board -------------------------- */
    h = newHarness({
        files: { 'data/sor/world-single.json': board(rows.map(r => r.slice())) },
        wca: { '2015TEST01': ana },
    });
    await h.ctx.showSorBoard();
    await h.ctx.findSorCompetitor('2015test01');
    ok('they are scored live', h.ctx.sorState.found && h.ctx.sorState.found.person.wcaId === '2015TEST01');
    ok('and shown with their total', h.els['#sor-found-body'].innerHTML.includes('901'),
        h.els['#sor-found-body'].innerHTML);
    ok('and told they are outside the board', /Outside the top 4/.test(h.els['#sor-found-note'].textContent),
        h.els['#sor-found-note'].textContent);

    // On a board for a region they do not compete for, say so.
    h = newHarness({
        files: { 'data/sor/es-single.json': board(rows.map(r => r.slice()), { region: 'Spain' }) },
        wca: { '2015TEST01': ana },
    });
    h.ctx.sorState.region = 'Spain';
    await h.ctx.showSorBoard();
    await h.ctx.findSorCompetitor('2015TEST01');
    ok('another region is refused', /does not compete for Spain/.test(h.els['#sor-found-note'].textContent),
        h.els['#sor-found-note'].textContent);

    /* ---- rejected input ------------------------------------------ */
    h = newHarness({ files: { 'data/sor/world-single.json': board(rows) } });
    await h.ctx.showSorBoard();
    await h.ctx.findSorCompetitor('nobody');
    ok('an unknown name says so', /Nobody by that name/.test(h.els['#sor-error-text'].textContent));
    await h.ctx.findSorCompetitor('2015NOPE99');
    ok('an unknown WCA ID says so', /No WCA competitor/.test(h.els['#sor-error-text'].textContent));

    // A board that cannot be loaded is an error, not an empty page.
    h = newHarness();
    await h.ctx.showSorBoard();
    ok('a missing board reports an error', h.els['#sor-error'].style.display === 'flex');

    /* ---- the generated data -------------------------------------- */
    const file = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sor', name), 'utf8'));
    for (const name of ['world-single.json', 'world-average.json', 'europe-single.json', 'pt-single.json']) {
        const exists = fs.existsSync(path.join(ROOT, 'data', 'sor', name));
        check(`data/sor/${name} exists`, exists);
        if (!exists) continue;
        const d = file(name);
        check(`${name}: a penalty per event`, d.penalties.length === d.events.length);
        let sorted = true, sumsRight = true, positionsRight = true;
        d.rows.forEach((r, i) => {
            const [pos, , , , sum, rk] = r;
            const expect = rk.reduce((s, x, e) => s + (x || d.penalties[e]), 0);
            if (expect !== sum) sumsRight = false;
            if (i && d.rows[i - 1][4] > sum) sorted = false;
            const wantPos = i && d.rows[i - 1][4] === sum ? d.rows[i - 1][0] : i + 1;
            if (pos !== wantPos) positionsRight = false;
        });
        check(`${name}: every total is ranks + penalties`, sumsRight);
        check(`${name}: lowest total first`, sorted);
        check(`${name}: ties share a position`, positionsRight);
    }
    const ws = file('world-single.json');
    check('single covers all seventeen events', ws.events.length === 17);
    check('average has no multi-blind', !file('world-average.json').events.includes('333mbf'));

    /* ---- the view is actually reachable -------------------------- */
    ok('index.html carries the Sum of Ranks view', INDEX.includes('id="sor-view"'));
    ok('...and a nav button for it', INDEX.includes('id="nav-sor-btn"'));
    ok('...and the home grid links to it', INDEX.includes('bento-sor'));
    ok('...and a region picker', INDEX.includes('id="sor-region"'));
    ok('app.js routes #sor to the view', SRC.includes("'#sor': 'sor'"));
    ok('...and the view back to #sor', SRC.includes("'sor': '#sor'"));
    ok('...and initialises it on arrival', SRC.includes("if (targetView === 'sor') initSorView();"));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
