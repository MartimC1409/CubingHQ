/* Tests the shape of the algorithm database (algorithms.js), and in
   particular that Pyraminx L4E is one section.

   L4E was stored as seven named subsets — Last Layer, L3E, Flipped
   Edges, Polish Flip, Separated Bar, Connected Bar, No Bar. The
   algorithms view turns a subset object into a row of chips and, above
   three of them, opens on the first chip instead of "All". So picking
   Pyraminx showed four cases out of thirty-seven, behind a row of
   filters nobody asked for. L4E is one set of cases and is now stored
   as one flat list, which the view renders whole.

   The rest of the checks are the general case: a set is either a flat
   list of cases or a group of named subsets, every case has a name and
   an algorithm, and no two cases in a set share a name (the trainer
   selects cases by index against a list it labels by name).

   Run: node scripts/test_alg_sets.js */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALGORITHMS = new Function(
    fs.readFileSync(path.join(ROOT, 'algorithms.js'), 'utf8') + '; return ALGORITHMS;')();

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function ok(label, cond, extra) { check(label, !!cond, extra); }

/* ---- Pyraminx L4E is a single section ---------------------------- */
const l4e = ALGORITHMS.Pyraminx && ALGORITHMS.Pyraminx.L4E;
ok('Pyraminx has an L4E set', l4e);
ok('L4E is one flat list, not a group of subsets', Array.isArray(l4e));
check('every L4E case survived the flattening', Array.isArray(l4e) && l4e.length === 37,
    Array.isArray(l4e) ? String(l4e.length) : typeof l4e);

// Named cases from every one of the seven former subsets, so a future
// edit cannot quietly drop one of them.
for (const name of ['Sune', 'Sledge', '2 Flip', 'SUS', 'Good Niky', 'Right Spam', 'Bad Sexy']) {
    ok(`L4E still has "${name}"`, Array.isArray(l4e) && l4e.some(c => c.name === name));
}
check('every L4E case keeps its setup, so the preview is the real case',
    Array.isArray(l4e) && l4e.every(c => typeof c.setup === 'string' && c.setup.trim()));

/* ---- the general shape ------------------------------------------- */
function checkCases(label, cases) {
    check(`${label}: every case has a name`, cases.every(c => c && typeof c.name === 'string' && c.name));
    check(`${label}: every case has an algorithm`, cases.every(c => c && typeof c.alg === 'string'));
    const names = cases.map(c => c && c.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    check(`${label}: no two cases share a name`, dupes.length === 0, [...new Set(dupes)].join(', '));
}

for (const [event, sets] of Object.entries(ALGORITHMS)) {
    for (const [setName, value] of Object.entries(sets)) {
        const label = `${event} ${setName}`;
        if (Array.isArray(value)) {
            checkCases(label, value);
            continue;
        }
        check(`${label} is a list or a group of named subsets`,
            value && typeof value === 'object', typeof value);
        for (const [subName, cases] of Object.entries(value)) {
            check(`${label} ${subName} is a list of cases`, Array.isArray(cases), typeof cases);
            if (Array.isArray(cases)) checkCases(`${label} ${subName}`, cases);
        }
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
