/* Tests the accessibility fixes that are checkable without a browser:
   images carry useful alternative text, dialogs confine Tab, and every
   control has an accessible name.

   The focus trap is the one worth explaining. Every dialog in app.js
   already had role="dialog" aria-modal="true" and took focus when it
   opened, but nothing stopped Tab walking straight out into the page
   behind — which is still rendered and still focusable under a backdrop
   the person tabbing cannot see past. aria-modal tells a screen reader
   the rest of the page is inert while the browser happily tabs into it.
   Confining Tab is what makes the attribute true.

   Run: node scripts/test_a11y.js */

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

const HTML = ['index.html', 'timer.html', 'coach.html', 'about.html', 'contact.html',
    'privacy.html', 'terms.html', 'cookies.html', 'refunds.html'];

/* ---- images ------------------------------------------------------- */

for (const page of HTML) {
    const imgs = read(page).match(/<img\b[^>]*>/g) || [];
    const missing = imgs.filter(tag => !/\balt\s*=/.test(tag));
    check(`${page}: every <img> has an alt attribute`, missing.length === 0,
        missing[0]);
}

// Generated markup counts too — most images on this site are built in JS.
const app = read('app.js');
const jsImgs = app.match(/<img\b[^>]*>/g) || [];
check('app.js: every generated <img> has an alt attribute',
    jsImgs.every(tag => /\balt\s*=/.test(tag)),
    jsImgs.find(tag => !/\balt\s*=/.test(tag)));

// A flag's alt used to be the two-letter code, which a screen reader
// reads as "P T". The country name is the thing worth announcing.
ok('flags are described by country name, not ISO code',
    app.includes('nameForIso2'));
const countries = read('wca-countries.js');
ok('wca-countries.js can map a code back to a name', countries.includes('nameForIso2'));

// An avatar sitting next to the person's name is decorative; announcing
// "Avatar" adds nothing that the adjacent name has not already said.
const index = read('index.html');
ok('the redundant avatars are marked decorative', !index.includes('alt="Avatar"'));

/* ---- dialogs confine Tab ------------------------------------------ */

ok('app.js traps Tab inside the open dialog', app.includes("if (e.key !== 'Tab') return;"));
ok('app.js knows which dialog is open', app.includes('function openDialogElement'));
ok('the trap covers every dialog, not just the login modal',
    app.includes('DIALOG_IDS') &&
    ['#login-modal', '#premium-modal', '#link-wca-modal', '#account-modal',
     '#create-group-modal', '#reset-password-modal']
        .every(id => app.includes(`'${id}'`)));
ok('the trap wraps backwards as well as forwards', app.includes('e.shiftKey'));
ok('it skips controls that are disabled or hidden',
    app.includes('!el.disabled') && app.includes('offsetParent !== null'));

// Escape and focus return were already right; keep them that way.
ok('dialogs still close on Escape', app.includes("e.key === 'Escape' && isLoginModalOpen()"));
ok('focus returns to whatever opened the dialog', app.includes('_loginOpener.focus()'));

// The consent banner and the video dialog bring their own.
const video = read('coach-video.js');
ok('the video consent dialog traps Tab', video.includes("e.key !== 'Tab'"));
ok('the video consent dialog closes on Escape', video.includes("e.key === 'Escape'"));
ok('backdrop clicks cancel rather than agree',
    video.includes('if (e.target === wrap) close(false)'));

/* ---- every control has a name ------------------------------------- */

for (const page of HTML) {
    const html = read(page);
    // An icon-only button — one whose content is an <svg> and nothing
    // else — is announced as "button" unless it is labelled.
    const bare = (html.match(/<button(?![^>]*(?:aria-label|title=|data-i18n))[^>]*>\s*<svg[\s\S]{0,400}?<\/button>/g) || [])
        .filter(tag => !/>\s*[A-Za-z0-9]/.test(tag.replace(/<svg[\s\S]*?<\/svg>/g, '')));
    check(`${page}: no unlabelled icon-only buttons`, bare.length === 0,
        bare[0] && bare[0].replace(/\s+/g, ' ').slice(0, 100));

    // Every input needs a name from somewhere: an aria-label, a <label
    // for=...>, or a wrapping <label> that contains visible text (an
    // implicit label, which is how the event chips and toggles are built).
    const implicit = new Set();
    for (const block of html.match(/<label\b[^>]*>[\s\S]*?<\/label>/g) || []) {
        const text = block
            .replace(/<svg[\s\S]*?<\/svg>/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();
        if (!text) continue;                       // a label with only a graphic names nothing
        for (const inner of block.match(/<input\b[^>]*>/g) || []) implicit.add(inner);
    }
    const inputs = html.match(/<input\b[^>]*>/g) || [];
    const unlabelled = inputs.filter(tag => {
        if (/type="(hidden|submit|button)"/.test(tag)) return false;
        if (/\bhidden\b/.test(tag)) return false;   // not reachable by Tab
        if (/aria-label|aria-labelledby/.test(tag)) return false;
        if (implicit.has(tag)) return false;
        const id = /id="([^"]+)"/.exec(tag);
        if (!id) return true;
        return !html.includes(`for="${id[1]}"`);
    });
    check(`${page}: every input has a label`, unlabelled.length === 0,
        unlabelled.map(t => (/id="([^"]+)"/.exec(t) || [, t.slice(0, 60)])[1]).join(', '));
}

/* ---- the consent banner is reachable by keyboard ------------------ */

const consent = read('consent.js');
ok('the banner is announced as a dialog', consent.includes("setAttribute('role', 'dialog')"));
ok('the banner names itself for a screen reader', consent.includes('aria-labelledby'));
ok('focus lands on the question, not on a button', consent.includes("querySelector('#cc-title')"));
ok('focus returns when the banner closes', consent.includes('lastFocused.focus'));

// The banner must not be a modal: it would trap someone on a page they
// only wanted to read.
ok('the banner does not claim to be modal',
    !/setAttribute\('aria-modal'/.test(consent) && !/aria-modal="true"/.test(consent));

/* ---- touch targets ------------------------------------------------ */

const style = read('style.css');
ok('consent buttons are a usable size', /\.cc-btn\s*\{[\s\S]*?min-height:\s*44px/.test(style));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
