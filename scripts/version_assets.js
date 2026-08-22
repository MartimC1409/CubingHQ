/* Rewrites every ?v= cache buster to the content it actually busts.

   The site asks for its scripts and stylesheets with a hand-written
   version — i18n.js?v=17, app.js?v=20 — and a browser keyed on the URL
   serves whatever it cached last for that exact string. So a file can
   change and every returning visitor keeps the old one until somebody
   remembers to bump a number in every page that references it.

   Nobody remembered. Three files shipped changed with their versions
   untouched, and the visible result was a dialog rendering `link.title`
   where its heading should be: index.html was new, i18n.js was four
   commits old, and the keys the new markup asked for did not exist in
   the copy the browser had.

   A hash of the file cannot be forgotten. Change the file and the URL
   changes with it; leave it alone and the URL is stable, so caching
   still works for everything untouched.

   Run: node scripts/version_assets.js          (rewrite)
        node scripts/version_assets.js --check  (report, change nothing)  */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

/** Eight hex characters of the file's content, or null if it is missing. */
function hashOf(assetPath) {
    const full = path.join(ROOT, assetPath);
    if (!fs.existsSync(full)) return null;
    return crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').slice(0, 8);
}

/** Every .html the site serves, admin pages included — they load assets too. */
function htmlFiles() {
    const out = [];
    for (const entry of fs.readdirSync(ROOT)) {
        if (entry.endsWith('.html')) out.push(entry);
    }
    for (const entry of fs.readdirSync(path.join(ROOT, 'guides'))) {
        if (entry.endsWith('.html')) out.push(path.join('guides', entry));
    }
    return out;
}

// src="app.js?v=20"  href="/style.css?v=12"  — same-origin only. A version
// on a CDN URL is that CDN's business.
const REF = /(src|href)="(\/?[A-Za-z0-9_./-]+\.(?:js|css))\?v=([A-Za-z0-9]+)"/g;

/**
 * @returns [{ file, asset, was, now }] for every reference whose version
 *          does not match the file it points at.
 */
function scan() {
    const stale = [];
    for (const file of htmlFiles()) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const m of html.matchAll(REF)) {
            const [, , ref, version] = m;
            // A leading slash is site-root, which is the repo root here.
            const asset = ref.replace(/^\//, '');
            const hash = hashOf(asset);
            if (!hash) continue;   // referenced but not in the repo; not ours to version
            if (hash !== version) stale.push({ file, asset, ref, was: version, now: hash });
        }
    }
    return stale;
}

function rewrite() {
    const stale = scan();
    const byFile = new Map();
    for (const item of stale) {
        if (!byFile.has(item.file)) byFile.set(item.file, []);
        byFile.get(item.file).push(item);
    }
    for (const [file, items] of byFile) {
        const full = path.join(ROOT, file);
        let html = fs.readFileSync(full, 'utf8');
        for (const item of items) {
            html = html.split(`${item.ref}?v=${item.was}"`).join(`${item.ref}?v=${item.now}"`);
        }
        fs.writeFileSync(full, html);
    }
    return stale;
}

if (require.main === module) {
    const checkOnly = process.argv.includes('--check');
    const stale = checkOnly ? scan() : rewrite();
    if (!stale.length) {
        console.log('every ?v= matches the file it points at');
        process.exit(0);
    }
    for (const item of stale) {
        console.log(`${checkOnly ? 'STALE' : 'bumped'} ${item.file}: ${item.asset} ${item.was} -> ${item.now}`);
    }
    if (checkOnly) {
        console.log('\nrun: node scripts/version_assets.js');
        process.exit(1);
    }
    console.log(`\n${stale.length} reference(s) updated`);
}

module.exports = { scan, rewrite, hashOf, htmlFiles };
