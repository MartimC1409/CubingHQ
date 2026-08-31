/* Tests the world-records table logic.

   The bug report was "some records are missing". They were not: the
   times come live from the WCA while the holder names are maintained by
   hand, and metaFor drops a stored name the moment it stops describing
   the time being shown — because crediting the previous holder with
   somebody else's result on a page headed "Official WCA records" is the
   worst kind of wrong, being both specific and plausible.

   So these tests pin the behaviour that made it look broken, and the
   wording that now explains it. The code is extracted from app.js
   rather than copied, so a change to the shipped file cannot silently
   escape them.

   Run: node scripts/test_records.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const WORLD_RECORDS = require('../world-records.js');

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

const CODE = [
    slice('    function liveSide(entry) {', '\n    }\n'),
    slice('    function wcaRawToDisplay(eventId, raw, isAverage) {', '\n    }\n'),
    slice('    function buildRecordFor(eventId, regionRecords, isWorld) {', '\n        return (rec.single || rec.average) ? rec : null;\n    }\n'),
    slice('    const NO_AVERAGE_EVENTS =', '\n    }\n'),          // through formatRecordValue
    slice('    function formatRecordHolder(rec, eventId, isAverage) {', '\n    }\n'),
].join('\n');

const ctx = {
    WORLD_RECORDS,
    fetchedWorldRecords: null,
    // Stand-ins for the app's own helpers. Deliberately identity-ish so an
    // assertion reads the real string rather than an escaped one.
    esc: (v) => String(v),
    i18nT: (key, fallback) => fallback,
    countryFlagImg: (c) => `[${c || '?'}]`,
    formatTime: (t) => String(t),
    decodeMBLD: (raw) => `mbld:${raw}`,
    Set, Object, Math, String, Number, JSON, isFinite, window: undefined,
};
vm.runInNewContext(
    CODE + '\nthis.api = { liveSide, buildRecordFor, formatRecordValue, formatRecordHolder, wcaRawToDisplay };',
    ctx, { filename: 'app.js:records' });
const A = ctx.api;

/* ---------- the reported symptom, and why ----------------------- */

// 6x6 average: stored 64.94, live 1:03.63. The record moved on, so the
// stored name no longer describes the time and must not be shown.
let rec = A.buildRecordFor('666', { '666': { single: 5769, average: 6363 } }, true);
eq('a moved record keeps the live time', rec.average.time, 63.63);
eq('and drops the stale holder', rec.average.holder, '—');
eq('and its competition', rec.average.competition, '');

// 7x7 average: stored 96.86, live 1:36.86 — unchanged, so the name stands.
rec = A.buildRecordFor('777', { '777': { single: 9059, average: 9686 } }, true);
eq('an unchanged record keeps its holder', rec.average.holder, 'Max Park');
eq('while the single that DID move loses its name', rec.single.holder, '—');
eq('and still shows the live single', rec.single.time, 90.59);

// The tolerance is real: floating-point noise must not blank a name.
rec = A.buildRecordFor('333', { '333': { single: 276, average: 351 } }, true);
eq('an exact match keeps the holder', rec.single.holder, 'Teodor Zajder');

/* ---------- what the cell now says ------------------------------ */

const pending = A.formatRecordHolder({ holder: '—' }, '666', true);
check('a missing holder explains itself', /holder not confirmed/.test(pending), pending);
check('rather than a bare dash', pending !== '—', pending);
check('and says the time is live, in the tooltip',
    /live from the WCA/.test(pending), pending);

const named = A.formatRecordHolder({ holder: 'Max Park', country: 'US' }, '777', true);
check('a known holder renders plainly', /Max Park/.test(named), named);
check('with a flag', /\[US\]/.test(named), named);
check('and no pending note', !/not confirmed/.test(named), named);

eq('no record at all is still a dash', A.formatRecordHolder(null, '333', false), '—');

/* ---------- Multi-BLD has no average ---------------------------- */

// Not a value that failed to load — there is no such record to hold.
const mbldAvg = A.formatRecordValue(null, true, '333mbf');
check('MBLD average reads as not applicable', /n\/a/.test(mbldAvg), mbldAvg);
check('and explains why', /single only/.test(mbldAvg), mbldAvg);
eq('its holder cell is left empty', A.formatRecordHolder(null, '333mbf', true), '');
// The single is a real record and must be untouched.
check('but the MBLD single still renders',
    A.formatRecordValue({ time: 'mbld:x', isMulti: true }, false, '333mbf') === 'mbld:x');
// Every other event keeps a dash for a genuinely absent average.
eq('another event with no average still shows a dash',
    A.formatRecordValue(null, true, '333'), '—');

/* ---------- a live name wins, if the feed ever carries one ------ */

eq('a bare number is read as a value', A.liveSide(5769).raw, 5769);
check('and carries no holder', !A.liveSide(5769).meta);
eq('null is nothing', A.liveSide(null), null);

const withName = A.liveSide({ value: 6363, name: 'Real Person', country: 'PT' });
eq('an object value is read', withName.raw, 6363);
eq('and its holder', withName.meta.holder, 'Real Person');

// The guard that matters: an unrecognised shape must yield nothing rather
// than an undefined value, because undefined / 100 is NaN and a NaN would
// render into the table as though it were a time.
eq('an unrecognised object is refused', A.liveSide({ nope: 1 }), null);
check('and never produces NaN', !Number.isNaN(A.wcaRawToDisplay('333', 276, false).time));

rec = A.buildRecordFor('666', {
    '666': { single: 5769, average: { value: 6363, name: 'Live Holder', country: 'JP' } },
}, true);
eq('a live name beats a blank curated one', rec.average.holder, 'Live Holder');
eq('and brings its country', rec.average.country, 'JP');
eq('while the time still comes from the feed', rec.average.time, 63.63);

// It must also beat a curated name that happens to still match, since a
// live name cannot be stale and a curated one can.
rec = A.buildRecordFor('777', {
    '777': { single: 9059, average: { value: 9686, name: 'Newer Name', country: 'AU' } },
}, true);
eq('a live name beats a matching curated one', rec.average.holder, 'Newer Name');

/* ---------- regional rows ---------------------------------------- */

// The feed publishes regional times without names, so a regional row must
// never borrow a world-record holder.
rec = A.buildRecordFor('333', { '333': { single: 500, average: 600 } }, false);
eq('a regional single shows its time', rec.single.time, 5);
eq('but no holder', rec.single.holder, '—');
eq('a region with no entry for the event renders nothing',
    A.buildRecordFor('333', {}, false), null);

// Worldwide, an event the feed omits still falls back to the curated row.
rec = A.buildRecordFor('333', {}, true);
eq('worldwide falls back to the stored record', rec.single.holder, 'Teodor Zajder');

/* ---------- the shared table ------------------------------------- */

// The duplicate copy in admin_records.html is what let the two drift.
const admin = fs.readFileSync(path.join(ROOT, 'admin_records.html'), 'utf8');
check('the admin page no longer inlines its own copy',
    !/const WORLD_RECORDS = \{\s*\n\s*'333'/.test(admin));
// Versioned like every other asset: main stamps a content hash into each
// ?v= so a changed file cannot be served from a stale cache, and a
// reference without one silently opts out of that.
check('it loads the shared module instead',
    /<script src="world-records\.js\?v=[a-f0-9]{8}"><\/script>/.test(admin),
    (admin.match(/world-records\.js[^"]*/) || ['not found'])[0]);
check('and app.js reads the same module',
    /window\.WorldRecords/.test(SRC));
check('which index.html loads before app.js',
    (() => {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        const w = html.indexOf('world-records.js');
        const a = html.indexOf('app.js?v=');
        return w !== -1 && a !== -1 && w < a;
    })());
eq('the table still covers every event', Object.keys(WORLD_RECORDS).length, 17);

/* ---------- the hero pill is gone -------------------------------- */

const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'launch-ui.css'), 'utf8');
check('the pill is out of the markup', !/lu-badge/.test(home));
check('its strings are gone from both languages', !/hero\.badge/.test(i18n));
check('and its now-dead CSS with them', !/\.lu-badge/.test(css));
check('the unrelated .hero-badge survives', /\.hero-badge/.test(css));

/* ---------- both languages have the new strings ------------------ */

for (const key of ['records.pending', 'records.pendingHint',
                   'records.noAverage', 'records.noAverageHint']) {
    eq(`${key} is defined twice — EN and PT`,
        (i18n.match(new RegExp(`'${key.replace('.', '\\.')}':`, 'g')) || []).length, 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
