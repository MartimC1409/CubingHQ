/* Tests that a page asks for the files it actually needs.

   A dialog shipped rendering `link.title` where its heading belonged.
   Nothing was wrong with the strings — they were in i18n.js, in both
   languages, correctly spelled. The page asked for `i18n.js?v=17`, and
   that URL had been cached four commits earlier, before those keys
   existed. index.html was new; the dictionary it depended on was not.

   Hand-written cache busters fail this way every time somebody edits a
   file and forgets the number, which is every time. So the version is
   a hash of the file now, and this is the check that no page is asking
   for a version of a file that no longer exists.

   The second half checks the other side of the same failure: that
   every string the markup asks for is defined, in both languages, so a
   raw key cannot reach a screen even when the file is fresh.

   Run: node scripts/test_assets.js */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const ROOT = path.join(__dirname, '..');
const { scan, hashOf, htmlFiles } = require('./version_assets.js');

(async () => {
    /* ---- every ?v= matches the file it points at ------------------- */

    const stale = scan();
    check('no page asks for a stale asset version', stale.length === 0,
        stale.map(s => `${s.file}: ${s.asset} ${s.was}→${s.now}`).join('; '));

    // The versions must be content hashes, not counters — a counter is
    // the thing that gets forgotten.
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const versions = [...index.matchAll(/(?:src|href)="\/?([A-Za-z0-9_./-]+\.(?:js|css))\?v=([A-Za-z0-9]+)"/g)];
    check('index.html versions its assets', versions.length >= 5, String(versions.length));
    for (const [, asset, version] of versions) {
        if (!hashOf(asset)) continue;
        check(`${asset} is versioned by content`, /^[0-9a-f]{8}$/.test(version), version);
        eq(`${asset}'s version is its current hash`, version, hashOf(asset));
    }

    // The files this actually protects: the three that shipped stale.
    for (const asset of ['i18n.js', 'app.js', 'launch-ui.css']) {
        const m = index.match(new RegExp(`(?:src|href)="/?${asset.replace('.', '\\.')}\\?v=([0-9a-f]{8})"`));
        check(`index.html asks for the current ${asset}`, !!m && m[1] === hashOf(asset),
            m ? `${m[1]} vs ${hashOf(asset)}` : 'no versioned reference found');
    }

    /* ---- and every string the markup asks for exists --------------- */

    const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
    const dictionaries = (i18n.match(/^\s{8}(en|pt):\s*\{/gm) || []).length;
    eq('there are two dictionaries', dictionaries, 2);

    const missing = [];
    let checked = 0;
    for (const file of htmlFiles()) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const m of html.matchAll(/data-i18n(?:-aria|-placeholder|-title|-html)?="([A-Za-z0-9_.]+)"/g)) {
            const key = m[1];
            checked++;
            const defined = (i18n.match(new RegExp(`'${key.replace(/\./g, '\\.')}':`, 'g')) || []).length;
            // Two, because a key defined once is a key missing from one
            // language — which renders as English on a Portuguese page,
            // or as the raw key.
            if (defined < 2) missing.push(`${file}: ${key} (defined ${defined}×)`);
        }
    }
    check(`checked every translated string in the markup (${checked})`, checked > 200, String(checked));
    check('none is missing from either language', missing.length === 0,
        missing.slice(0, 8).join('; '));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
