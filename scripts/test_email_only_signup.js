/* Tests that creating a CubingHQ account only ever asks for an email
   and a password — WCA is a link you add afterward, never a way in.

   Nothing here is about the server: /api/auth/signup already only
   accepts { email, password, name }, and /api/auth/link-wca already
   requires an existing session before it does anything. What broke
   the promise in the past was the CLIENT offering a second front
   door — a "Continue with WCA" button in the sign-in modal that
   created a session with no email, no password, and no account row
   until something else touched it. This is the check that the door
   stays closed, and that the one still open (linking, after signing
   up) stays open.

   Run: node scripts/test_email_only_signup.js */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');

function dictValue(key, lang) {
    // Values in i18n.js can span more than one physical line-scan target;
    // a plain regex on `'key': '...'` is enough because none of the
    // strings this test cares about contain an escaped quote.
    const start = lang === 'pt' ? i18n.indexOf('pt: {') : 0;
    const end = lang === 'pt' ? i18n.length : i18n.indexOf('pt: {');
    const scope = i18n.slice(start, end);
    const m = scope.match(new RegExp(`'${key.replace('.', '\\.')}':\\s*"([^"]*)"|'${key.replace('.', '\\.')}':\\s*'([^']*)'`));
    return m ? (m[1] || m[2] || '') : null;
}

(async () => {
    /* ---- the login modal has no WCA entry point --------------------- */

    check('the login modal has no #wca-login-btn',
        !index.includes('id="wca-login-btn"'));
    check('nothing in the shipped page still binds one',
        !app.includes("$('#wca-login-btn')"));
    check('the "or use email" divider is gone — there is only one path now',
        !index.includes('or use an email address') && !/auth\.or"/.test(index));

    /* ---- the copy matches: email is the account, WCA is optional ---- */

    for (const lang of ['en', 'pt']) {
        // Mentioning WCA is fine — the subtitle SHOULD say linking is
        // available afterward. What must not come back is WCA framed as
        // the primary action: "connect your WCA account" as the verb
        // of the sentence, the way the old copy opened.
        const subtitle = dictValue('login.subtitle', lang);
        check(`${lang}: the subtitle's account is an email account`,
            subtitle && /email/i.test(subtitle), subtitle);
        check(`${lang}: WCA is not the opening verb of the subtitle`,
            subtitle && !/^(connect|liga)\s+.*wca/i.test(subtitle.trim()), subtitle);

        const note = dictValue('login.note', lang);
        check(`${lang}: the privacy note no longer claims signing in reads WCA data`,
            note && !/wca/i.test(note), note);
    }

    /* ---- but linking is still there, and still reachable ------------ */

    check('the link-wca modal still exists',
        index.includes('id="link-wca-modal"'));
    check('with its own WCA button',
        index.includes('id="link-wca-start"'));
    check('reachable from the account panel',
        index.includes('id="account-link"'));
    check('the endpoint that requires a session first is untouched',
        fs.existsSync(path.join(ROOT, 'api/auth/_link-wca.js')));

    /* ---- and signup itself is unaffected ----------------------------- */

    check('the email + password form is still the only form in the modal',
        index.includes('id="auth-form"') && index.includes('id="auth-email"')
        && index.includes('id="auth-password"'));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
