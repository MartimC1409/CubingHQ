/* Tests that a deep link lands on its own view without going via Home
   first (the inline boot router in index.html + app.js).

   index.html ships with #home-view carrying class="view active", so a
   browser painted the home page for as long as it took app.js to boot
   and route. That boot was itself behind an awaited fetch to Firebase,
   so arriving from timer.html at index.html#simulation showed the home
   page, a network round trip, and only then the simulator. Every page
   looked like it went through the front door.

   The inline script picks the view out of the hash and hides the rest
   before the first paint; app.js drops the rule once it has switched
   views for real. Both halves are pinned here, along with the maps
   staying in step — a hash the inline script does not know would flash
   Home again, and a view id it gets wrong would show nothing at all.

   Run: node scripts/test_view_boot.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function ok(label, cond, extra) { check(label, !!cond, extra); }

/** The inline boot router, lifted whole out of index.html's <head>. */
const BOOT = (() => {
    const marker = INDEX.indexOf('Land on the requested view before the first paint');
    if (marker === -1) throw new Error('boot router not found in index.html');
    const open = INDEX.indexOf('<script>', marker);
    const close = INDEX.indexOf('</script>', open);
    if (open === -1 || close === -1) throw new Error('boot router script tag not found');
    return INDEX.slice(open + '<script>'.length, close);
})();

/** Its hash -> view table, read out of that same source. */
const bootMap = (() => {
    const start = BOOT.indexOf('var HASH_TO_VIEW = {');
    const end = BOOT.indexOf('};', start);
    return vm.runInNewContext('(' + BOOT.slice(BOOT.indexOf('{', start), end + 1) + ')');
})();

/** Runs the boot router for one hash and reports the style it injected. */
function boot(hash) {
    let injected = null;
    const ctx = {
        window: { location: { hash } },
        document: {
            createElement: () => ({ id: '', textContent: '' }),
            head: { appendChild: (el) => { injected = el; } },
        },
    };
    vm.runInNewContext(BOOT, ctx, { filename: 'index.html:boot' });
    return injected;
}

/* The reported case: arriving at the simulator shows the simulator. */
let style = boot('#simulation');
ok('a #simulation deep link injects a rule', style);
check('...that hides every view', style.textContent.includes('.view{display:none!important}'), style.textContent);
check('...and shows the simulator', style.textContent.includes('#setup-view{display:block!important}'), style.textContent);
check('...tagged so app.js can find it again', style.id === 'boot-view-style', style.id);

/* Home is already the view in the markup, so it needs no rule — and
   neither does a hash nobody routes. */
check('landing on Home injects nothing', boot('#home') === null);
check('landing with no hash injects nothing', boot('') === null);
check('an unknown hash injects nothing', boot('#nonsense') === null);

/* A WCA OAuth redirect returns with the token in the hash. That is not
   a route, and hiding every view over it would blank the page. */
check('an OAuth callback is left alone', boot('#access_token=abc123&token_type=bearer') === null);

/* Every hash app.js routes must be one the boot router also knows,
   mapped to the same view — otherwise the deep link flashes Home. */
const appMap = (() => {
    const start = APP.indexOf('    const HASH_TO_VIEW = {');
    const end = APP.indexOf('};', start);
    const body = APP.slice(APP.indexOf('{', start), end + 1);
    return vm.runInNewContext('(' + body + ')');
})();
for (const [hash, view] of Object.entries(appMap)) {
    check(`the boot router knows ${hash || '(no hash)'}`, bootMap[hash] === view,
        `app.js says ${view}, boot router says ${bootMap[hash]}`);
    if (view !== 'home') {
        ok(`#${view}-view exists in index.html`, INDEX.includes(`id="${view}-view"`));
    }
}

/* The rule is temporary: app.js must take it back down, or the page is
   pinned to the view it booted on for the rest of the session. */
ok('app.js removes the boot rule', APP.includes("document.getElementById('boot-view-style')"));
ok('...as part of switching views', /dropBootViewStyle\(\);\s*\n\s*\$\$\('\.view'\)/.test(APP));

/* And booting must not wait on the network to get there. */
const boot_ = APP.slice(APP.indexOf('// ========== START =========='));
check('boot no longer awaits a fetch before init()',
    !/DOMContentLoaded[\s\S]{0,400}?await fetch/.test(boot_), boot_.slice(0, 400));
ok('init() still runs on DOMContentLoaded', /DOMContentLoaded[\s\S]{0,200}init\(\);/.test(boot_));

/* The markup itself still starts on Home, which is what the rule overrides. */
const actives = INDEX.match(/class="view active"/g) || [];
check('exactly one view is active in the markup', actives.length === 1, String(actives.length));
ok('...and it is Home', /id="home-view" class="view active"/.test(INDEX));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
