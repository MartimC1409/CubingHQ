/* Tests the legal and consent surface: that the pages exist, that every
   page links to them, that the consent banner is wired everywhere, and
   that the policy does not contradict the code it describes.

   The last of those is the point. The previous privacy policy said, in
   as many words, that there were no accounts, that no password was ever
   asked for, and that solve data "is not transmitted anywhere" — while
   the code had email-and-password accounts and PUT every session to a
   public database on every save. A policy that describes a different
   product than the one shipped is worse than no policy: it is a written
   record of a claim the code disproves.

   So these checks are deliberately cross-cutting. They read app.js and
   timer.js as well as the HTML, and fail when the two drift apart.

   Run: node scripts/test_legal_pages.js */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
const ok = (label, cond, extra) => check(label, !!cond, extra);

/* Every page a visitor can land on. The guides are included because a
   search engine sends people straight to them, and a cookie banner that
   only appears on the home page is a cookie banner that does not work. */
const PAGES = ['index.html', 'timer.html', 'coach.html', 'about.html', 'contact.html',
    'privacy.html', 'terms.html', 'cookies.html', 'refunds.html']
    .concat(fs.readdirSync(path.join(ROOT, 'guides'))
        .filter(f => f.endsWith('.html')).map(f => 'guides/' + f));

/* ---- the pages exist --------------------------------------------- */

for (const page of ['privacy.html', 'terms.html', 'cookies.html', 'refunds.html']) {
    ok(`${page} exists`, fs.existsSync(path.join(ROOT, page)));
}

/* ---- consent is wired on every page ------------------------------ */

for (const page of PAGES) {
    const html = read(page);
    ok(`${page} loads consent.js`, /<script src="\/?consent\.js\?v=[0-9a-f]+"><\/script>/.test(html));

    // analytics.js establishes the Consent Mode defaults consent.js later
    // updates. Loading them the other way round means the update lands
    // before the defaults and is overwritten by them.
    const a = html.indexOf('analytics.js');
    const c = html.indexOf('consent.js');
    check(`${page} loads analytics.js before consent.js`, a !== -1 && c !== -1 && a < c);

    ok(`${page} links the cookie policy`, html.includes('cookies.html'));
    ok(`${page} offers a way to reopen the cookie choice`,
        html.includes('CubingConsent.reopen'));
    ok(`${page} links the privacy policy`, html.includes('privacy.html'));
}

/* ---- nothing is granted before an answer ------------------------- */

// The banner tells everyone "nothing is set until you choose". That
// sentence is only true if the Consent Mode defaults deny for everyone,
// which they did not always do — they used to grant outside the EEA.
const analytics = read('analytics.js');
const defaults = [...analytics.matchAll(/gtag\('consent',\s*'default',\s*\{([\s\S]*?)\}\)/g)]
    .map(m => m[1]);
check(`analytics.js declares exactly one set of defaults (${defaults.length})`,
    defaults.length === 1);
ok('no storage type is granted by default',
    defaults.every(block => !/:\s*'granted'/.test(block)),
    defaults.find(b => /granted/.test(b)));
ok('the defaults land before any tag reads them',
    analytics.indexOf("'consent', 'default'") < analytics.indexOf('googletagmanager.com'));
ok('a CMP is given time to answer before the first pageview',
    /wait_for_update/.test(analytics));

/* ---- the consent banner's own promises --------------------------- */

const consent = read('consent.js');
ok('consent.js grants nothing before an answer',
    !/consent',\s*'update'[\s\S]{0,200}granted'\s*,?\s*\n?\s*\}\)\s*;?\s*\n?\s*\}\s*\n?\s*start/.test(consent));
ok('consent.js offers reject as its own button', consent.includes('cc-reject'));
ok('consent.js gives accept and reject the same button class',
    (consent.match(/cc-btn--primary" id="cc-(accept|reject)/g) || []).length === 2);
ok('consent.js stands down for a certified CMP', consent.includes('__tcfapi'));
ok('consent.js re-applies a stored answer on later pages',
    /if \(stored\) apply\(stored\)/.test(consent));
ok('consent.js records when consent was given', consent.includes('at: Date.now()'));

// Escape must not count as agreement.
const escapeBlock = consent.slice(consent.indexOf("e.key === 'Escape'"));
ok('consent.js treats Escape as walking away, not accepting',
    escapeBlock.slice(0, 120).includes('hide()'));

/* ---- the policy matches the code --------------------------------- */

const timer = read('timer.js');
const privacy = read('privacy.html');

// The removed upload. If it ever comes back, the policy's "not uploaded"
// becomes false again, so the test guards the sentence and the code.
ok('timer.js no longer uploads sessions to the database',
    !timer.includes('firebaseio.com'));
ok('privacy.html says solve data stays on the device',
    /stored <strong>in your browser<\/strong>/.test(privacy));
ok('privacy.html owns up to the period when it did not',
    privacy.includes('A change from earlier versions of this policy'));

// Accounts exist, so the policy has to say so.
const accounts = read('api/_lib/accounts.js');
ok('the code really does store a password hash', accounts.includes('hashPassword'));
ok('privacy.html discloses password hashing', /scrypt/.test(privacy));
ok('privacy.html no longer claims there are no accounts',
    !/we never ask for a password/i.test(privacy));

// The video route sends footage to a third party.
ok('privacy.html discloses video analysis', /video/i.test(privacy) && privacy.includes('Gemini'));
ok('privacy.html names the AI providers',
    privacy.includes('Anthropic') && privacy.includes('OpenRouter'));
ok('privacy.html names the email provider', privacy.includes('Resend'));

// Rights and the supervisory authority.
ok('privacy.html names the supervisory authority', privacy.includes('CNPD'));
ok('privacy.html gives a lawful basis for each purpose', privacy.includes('Legal basis'));
ok('privacy.html covers international transfers',
    privacy.includes('Standard Contractual Clauses'));
ok('privacy.html states the age threshold', /\b13\b/.test(privacy));

/* ---- the cookie policy lists what is actually stored -------------- */

const cookies = read('cookies.html');
// Every localStorage key the site really writes should be accounted for.
const KEYS = ['sc-theme', 'sc-accent', 'chq_lang', 'chq_auth_token', 'wca_access_token',
    'cstimer_data_v2', 'sc-history', 'sc-sim-state', 'sor-people', 'sc-consent',
    'battle_uid', 'chq_coach_v1'];
for (const key of KEYS) {
    ok(`cookies.html lists ${key}`, cookies.includes(key));
}
ok('cookies.html separates consent-free from consent-required storage',
    cookies.includes('Strictly necessary') && cookies.includes('only with your consent'));

/* ---- forms ask before they collect -------------------------------- */

const index = read('index.html');
ok('sign-up asks you to accept the terms', index.includes('auth-accept-terms'));
ok('sign-up asks you to confirm your age', index.includes('auth-confirm-age'));
const app = read('app.js');
ok('sign-up refuses to submit without both', app.includes('auth.needTerms') && app.includes('auth.needAge'));
ok('neither box ships pre-ticked',
    !/id="auth-accept-terms"[^>]*checked/.test(index) && !/id="auth-confirm-age"[^>]*checked/.test(index));

const contact = read('contact.html');
ok('the contact form carries a notice', contact.includes('page-form-notice'));
ok('the contact form asks for acknowledgement', contact.includes('cf-consent'));
check('the notice sits above the submit button',
    contact.indexOf('page-form-notice') < contact.indexOf('id="cf-submit"'));

const video = read('coach-video.js');
ok('video upload asks for explicit consent first', video.includes('askVideoConsent'));
ok('the consent is recorded with a timestamp', video.includes('at: Date.now()'));
ok('consent can be withdrawn', video.includes('withdrawVideoConsent'));
check('the ask happens before the file picker opens',
    video.indexOf('askVideoConsent()') < video.indexOf('input.click()'));

/* ---- advertising claims match the advertising -------------------- */

// The site is not in an advertising programme: the AdSense tags are on the
// page for verification, but nothing is served. The policies said it was
// "paid for by ads" and listed cookies nobody was being given, which is the
// same class of mistake the rest of this file exists to catch — a policy
// describing a site that does not exist.
//
// If advertising is switched on, invert these: the pages should stop saying
// "not running" and this block should assert the opposite.
// Matched as whole phrases rather than keywords: the corrected pages talk
// about advertising constantly, including to say it is NOT running, and a
// loose match on "paid for by ads" flags the sentence that fixed the bug.
const AD_CLAIMS = [
    'carries advertising to cover its running costs',
    'carries advertising to cover hosting',
    'is paid for by ads. That is the whole business model',
    'Hosting and the domain are paid for with advertising',
    "which pays for the site's running costs",
];
const AD_PAGES = ['privacy.html', 'cookies.html', 'refunds.html', 'terms.html', 'about.html'];
for (const page of AD_PAGES) {
    const html = read(page);
    const found = AD_CLAIMS.filter(claim => html.includes(claim));
    check(`${page} does not claim ads are paying for the site`, found.length === 0, found[0]);
}
ok('privacy.html says no advertising is running',
    /No advertising is being shown on CubingHQ at the moment/.test(read('privacy.html')));
ok('cookies.html says the ad cookies are not being set',
    /none of the\s+cookies in this section is currently being set/.test(read('cookies.html')));
ok('the banner does not claim ads pay for the site',
    !/which pay for the site/.test(consent));

// The ad cookies stay documented and the category stays in the banner, so
// switching advertising on later cannot happen without a fresh choice.
ok('the ad cookies are still documented for when it is switched on',
    ['__gads', 'IDE', 'NID'].every(c => read('cookies.html').includes(c)));
ok('advertising is still a consent category', consent.includes('cc-ads'));

// The banner is the one thing every visitor has to read, so it is translated
// wherever the page carries a translator at all.
const i18n = read('i18n.js');
for (const key of ['cc.title', 'cc.body', 'cc.acceptAll', 'cc.rejectAll',
                   'cc.cat.necessary', 'cc.cat.analytics', 'cc.cat.ads']) {
    const uses = (i18n.match(new RegExp("'" + key.replace(/\./g, '\\.') + "':", 'g')) || []).length;
    check(`${key} is defined in both languages (${uses})`, uses === 2);
}
ok('the banner re-renders when the language changes',
    consent.includes("'app-language-changed'"));

/* ---- claims we cannot stand behind ------------------------------- */

ok('no "most popular" badge on a plan nobody has bought', !index.includes('MOST POPULAR'));
ok('no uncomputed "save 25%"', !index.includes('Save 25%'));
ok('no "the ultimate" in the social preview', !/content="The ultimate/.test(index));
const about = read('about.html');
ok('about.html no longer claims there is no account to create',
    !about.includes('no account to create'));
ok('about.html publishes operator details', about.includes('id="legal"'));
ok('about.html names the supervisory authority', about.includes('CNPD'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
