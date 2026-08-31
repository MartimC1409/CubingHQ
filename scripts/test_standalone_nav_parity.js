/* Tests that every nav button on the SPA also exists on the standalone
   pages — coach.html and timer.html each carry their own copy of the
   navbar rather than sharing index.html's, because they are not part
   of the single-page app.

   The Friends button was added to index.html when friends shipped and
   never copied to the other two, so opening the Coach or Timer page
   made it vanish — the same button, present a moment ago on Home,
   gone on the next click. Nothing broke loudly: the id was simply
   absent, so nothing rendered and nothing errored.

   This checks the general case, not just Friends, so the next nav
   button added only to index.html fails a test instead of shipping
   the same way.

   Run: node scripts/test_standalone_nav_parity.js */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Every `id="nav-...-btn"` in a page's navbar. */
function navButtonIds(html) {
    const ids = new Set();
    for (const m of html.matchAll(/id="(nav-[a-z-]+-btn)"/g)) ids.add(m[1]);
    return ids;
}

const spaButtons = navButtonIds(index);
check(`found index.html's nav buttons (${spaButtons.size})`, spaButtons.size >= 8,
    [...spaButtons].join(', '));

// nav-profile-btn only exists once someone is signed in — it replaces
// nav-login-btn at runtime (updateUIAfterLogin), so it is never present
// in anyone's static markup and must not be expected there.
spaButtons.delete('nav-profile-btn');

for (const page of ['coach.html', 'timer.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const pageButtons = navButtonIds(html);

    for (const id of spaButtons) {
        check(`${page} has ${id}`, pageButtons.has(id));
    }

    // Every button that isn't the current page's own must be wired in
    // NAV_MAP to go somewhere — otherwise it renders but does nothing
    // on click, a quieter version of the same bug: present, but dead.
    // The current-page button carries "active" in its class and is
    // exempt, matching wireCoachNavbar/wireCsNavbar's own convention of
    // mapping it to null.
    const navMapMatch = html.match(/const NAV_MAP = \{([\s\S]*?)\};/);
    check(`${page} defines its own NAV_MAP`, !!navMapMatch);
    if (navMapMatch) {
        const mapBody = navMapMatch[1];
        for (const id of pageButtons) {
            const buttonTag = (html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`)) || [''])[0];
            const isActivePage = /class="[^"]*\bactive\b/.test(buttonTag);
            const inMap = new RegExp(`'${id}':`).test(mapBody);
            check(`${page}: ${id} is wired in NAV_MAP, or is this page's own button`,
                inMap || isActivePage, buttonTag);
        }
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
