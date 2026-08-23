/* Tests the Single / Average / Both toggle on the friends comparison
   table (renderComparison in app.js).

   Before this feature, every cell always stacked single over average
   with no way to see just one. The toggle reads friendsState.compareType
   and, per cell, drops whichever value is not wanted — this test proves
   each of the three modes actually produces different markup, and that
   the "best in row" highlight still lands on the right value in every
   mode, rather than just describing the intent.

   The code is extracted from app.js rather than copied here, so a
   change to the shipped file cannot silently escape this test.

   Run: node scripts/test_compare_type.js */

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
    slice('    function initialsOf(name) {', '        return (first + last).toUpperCase();\n    }'),
    slice('    function friendAvatarHtml(person) {', '\n    }'),
    slice("    const WCA_EVENT_ORDER = ['333',", '        return formatTime(best / 100);\n    }'),
    slice('    function formatTime(seconds) {', '        return `${mins}:${secs}`;\n    }'),
    slice('    async function fetchWcaPersonalRecords(wcaId) {', '\n    }'),
    slice('    async function renderComparison(people) {', '\n    }\n'),
].join('\n\n');

/**
 * Runs the extracted renderComparison against stubbed DOM/WCA data.
 * @param wcaData { [wcaId]: personal_records-shaped object } — absent id = 404
 * @param compareType 'both' | 'single' | 'average'
 */
async function runRender(people, wcaData, compareType) {
    const wrap = { innerHTML: '', style: {} };
    const section = { innerHTML: '', style: {} };
    const els = { '#friends-compare-table-wrap': wrap, '#friends-compare-section': section };
    const ctx = {
        console, JSON, Object, Math, String, Promise, Set, Array, Infinity,
        friendsState: { compareType, wcaCache: new Map(), lastCompared: null },
        i18nT: (key, fallback) => fallback,
        $: (sel) => els[sel],
        fetch: async (url) => {
            const m = /\/persons\/([^/]+)$/.exec(url);
            const data = m && wcaData[m[1]];
            return { ok: !!data, json: async () => ({ personal_records: data || {} }) };
        },
    };
    vm.runInNewContext(BLOB + '\nthis.renderComparison = renderComparison;', ctx, { filename: 'app.js:compare' });
    await ctx.renderComparison(people);
    return wrap.innerHTML;
}

(async () => {
    const people = [
        { uid: 'a', name: 'Alice', wcaId: 'A1' },
        { uid: 'b', name: 'Bob', wcaId: 'B1' },
    ];
    // Alice: single 8.00s, average 9.00s. Bob: single 7.00s (best single),
    // average 9.50s (Alice has the best average).
    const wcaData = {
        A1: { '333': { single: { best: 800 }, average: { best: 900 } } },
        B1: { '333': { single: { best: 700 }, average: { best: 950 } } },
    };

    /* "Both" (the default) keeps the original stacked layout. */
    let html = await runRender(people, wcaData, 'both');
    ok('both: shows Alice single', html.includes('8.00'));
    ok('both: shows Alice average', html.includes('9.00'));
    ok('both: shows Bob single', html.includes('7.00'));
    ok('both: shows Bob average', html.includes('9.50'));
    ok('both: stacks with a line break', html.includes('<br>'));

    /* "Single" drops every average value and the stacking markup. */
    html = await runRender(people, wcaData, 'single');
    ok('single: shows Alice single', html.includes('8.00'));
    ok('single: shows Bob single', html.includes('7.00'));
    check('single: no average values leak through', !html.includes('9.00') && !html.includes('9.50'),
        html);
    check('single: no stacked <br> left over', !html.includes('<br>'), html);

    /* "Average" drops every single value and the stacking markup. */
    html = await runRender(people, wcaData, 'average');
    ok('average: shows Alice average', html.includes('9.00'));
    ok('average: shows Bob average', html.includes('9.50'));
    check('average: no single values leak through', !html.includes('8.00') && !html.includes('7.00'),
        html);
    check('average: no stacked <br> left over', !html.includes('<br>'), html);

    /* The "best in row" highlight still lands on the right person in
       single-only mode (Bob has the faster single). */
    html = await runRender(people, wcaData, 'single');
    const bobCellMatch = /<td class="([^"]*)">7\.00<\/td>/.exec(html);
    const aliceCellMatch = /<td class="([^"]*)">8\.00<\/td>/.exec(html);
    ok('single: Bob\'s single is highlighted as best', bobCellMatch && bobCellMatch[1].includes('compare-best'), html);
    ok('single: Alice\'s single is not highlighted', aliceCellMatch && !aliceCellMatch[1].includes('compare-best'), html);

    /* ...and in average-only mode (Alice has the faster average). */
    html = await runRender(people, wcaData, 'average');
    const aliceAvgMatch = /<td class="([^"]*)">9\.00<\/td>/.exec(html);
    const bobAvgMatch = /<td class="([^"]*)">9\.50<\/td>/.exec(html);
    ok('average: Alice\'s average is highlighted as best', aliceAvgMatch && aliceAvgMatch[1].includes('compare-best'), html);
    ok('average: Bob\'s average is not highlighted', bobAvgMatch && !bobAvgMatch[1].includes('compare-best'), html);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
