/* Tests that the site does not advertise itself as unfinished.

   AdSense review turned CubingHQ down with the generic "meet AdSense
   program policies", naming nothing. Google's policies do name sites
   under construction as not ready to carry ads, and exactly one part of
   this site made that claim about itself: a Premium panel with an
   "UNDER CONSTRUCTION" badge over real monthly prices, reached from the
   main navigation, with a button that announced a trial and did nothing
   but write to localStorage.

   Whether that was the reason is not knowable — Google did not say. What
   is knowable is that a page saying "under construction" next to a price
   is worth not shipping, and that it is the kind of thing that comes
   back by accident. This is the check that it has not.

   Rendered text only: markup inside a <template> is parsed but never
   rendered, never in the DOM and never read out, so it is not part of
   the page for a reader, a crawler or a reviewer.

   Run: node scripts/test_no_under_construction.js */

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

/** Every .html the site actually serves. */
function pages() {
    const out = [];
    for (const entry of fs.readdirSync(ROOT)) {
        if (entry.endsWith('.html') && !entry.startsWith('admin')) out.push(entry);
    }
    for (const entry of fs.readdirSync(path.join(ROOT, 'guides'))) {
        if (entry.endsWith('.html')) out.push(`guides/${entry}`);
    }
    return out;
}

/** What a reader sees: no <template>, no <script>, no <style>, no tags. */
function renderedText(html) {
    return html
        .replace(/<template[\s\S]*?<\/template>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ');
}

// Phrases that tell a visitor the site is not finished. "Coming soon" is
// included because it is the same claim in a friendlier voice.
const UNFINISHED = [
    /under construction/i,
    /coming soon/i,
    /work in progress/i,
    /\bcheck back (soon|later)\b/i,
    /lorem ipsum/i,
];

(async () => {
    const all = pages();
    check(`found the site's pages (${all.length})`, all.length >= 10, all.join(', '));

    for (const page of all) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        const text = renderedText(html);
        for (const pattern of UNFINISHED) {
            const hit = text.match(pattern);
            check(`${page} does not say ${pattern.source}`, !hit,
                hit ? `…${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}…` : '');
        }
    }

    /* ---- the Premium panel specifically --------------------------- */

    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const rendered = renderedText(index);

    check('no monthly price is rendered', !/£\s?\d/.test(rendered),
        (rendered.match(/.{40}£\s?\d.{40}/) || [''])[0]);
    check('the Premium panel is not reachable from the nav',
        !index.includes('id="nav-premium-btn"'));
    check('its markup is kept, not deleted',
        index.includes('<template id="premium-plan-markup">'));
    check('and the panel is inside that template',
        /<template id="premium-plan-markup">[\s\S]*id="premium-modal"[\s\S]*<\/template>/.test(index));

    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    check('the feature is off behind one flag',
        /const PREMIUM_ENABLED = false;/.test(app));
    check('opening the panel is refused while it is off',
        /function openPremiumModal\(\)\s*\{\s*\n\s*if \(!PREMIUM_ENABLED\) return;/.test(app));

    // The thing that would read as a purchase that did not happen.
    check('nothing announces a trial that does not exist',
        !/welcome aboard/i.test(app), 'app.js still starts a fake trial');
    check('and no fake trial is recorded',
        !/cubinghq_premium_trial/.test(app), 'app.js still writes a trial flag');

    /* ---- what AdSense needs, which was already right --------------- */

    // Checked here so a future edit cannot quietly remove one: these are
    // the mechanical requirements, and they were the parts NOT at fault.
    const ads = fs.readFileSync(path.join(ROOT, 'ads.txt'), 'utf8').trim();
    check('ads.txt names one direct seller',
        /^google\.com, pub-\d+, DIRECT, [a-f0-9]+$/.test(ads), ads);

    const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    for (const bot of ['Mediapartners-Google', 'AdsBot-Google', 'AdsBot-Google-Mobile']) {
        check(`robots.txt lets ${bot} in`,
            new RegExp(`User-agent: ${bot}\\s*\\nAllow: /`).test(robots));
    }

    const privacy = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
    for (const [what, pattern] of [
        ['third-party ad cookies', /third-party vendors, including google, use cookies/i],
        ['the Google ads settings opt-out', /google\.com\/settings\/ads/],
        ["Google's ad technologies page", /policies\.google\.com\/technologies\/ads/],
    ]) {
        check(`the privacy policy discloses ${what}`, pattern.test(privacy));
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
