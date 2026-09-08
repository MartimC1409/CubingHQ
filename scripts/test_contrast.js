/* Tests that the site's text colours meet WCAG 2.1 AA contrast.

   These were measured, not guessed, and several failed. The worst were
   the muted-text tokens, which carry most of the secondary copy on the
   site: 3.06:1 on the dark background, 2.43:1 on a dark card, 2.61:1 in
   light mode. All three are below the 4.5:1 that normal-size body text
   needs, and the last two are close to unreadable for anyone whose
   eyesight is not perfect.

   The accent was a subtler problem. --clr-primary was doing two jobs —
   accent TEXT on the page background, where it wants to be bright, and a
   FILL with white text on top, where bright leaves white at 4.24:1. One
   token cannot satisfy both: every lightness that fixes one breaks the
   other, which is why --clr-primary-solid exists.

   The values are read out of the stylesheets rather than restated here,
   so nudging a colour re-runs the maths instead of quietly failing it.

   Run: node scripts/test_contrast.js */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STYLE = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const LAUNCH = fs.readFileSync(path.join(ROOT, 'launch-ui.css'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

/* ---- colour maths ------------------------------------------------ */

function toLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]) {
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.1 contrast ratio, 1:1 to 21:1. */
function contrast(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function fromHex(h) {
    const s = h.replace('#', '').trim();
    return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}

/** OKLCH -> sRGB, because launch-ui.css is written in oklch(). */
function fromOklch(L, C, hDeg) {
    const h = hDeg * Math.PI / 180;
    const a = C * Math.cos(h), b2 = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b2) ** 3;
    const enc = (c) => {
        c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, c)) * 255);
    };
    return [
        enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        enc(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    ];
}

/* ---- reading the stylesheets ------------------------------------- */

/** Nth declaration of a custom property, as written in the file. */
function tokenValues(css, name) {
    const out = [];
    const re = new RegExp('--' + name + ':\\s*([^;]+);', 'g');
    let m;
    while ((m = re.exec(css))) out.push(m[1].trim());
    return out;
}

function parseColour(value) {
    if (value.startsWith('#')) return fromHex(value);
    const m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/.exec(value);
    if (!m) return null;
    const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    return fromOklch(L, parseFloat(m[2]), parseFloat(m[3]));
}

const AA_BODY = 4.5;
const WHITE = [255, 255, 255];

function assertContrast(label, fg, bg, need = AA_BODY) {
    if (!fg || !bg) { check(label, false, 'could not parse a colour'); return; }
    const r = contrast(fg, bg);
    check(`${label} (${r.toFixed(2)}:1, needs ${need})`, r >= need);
}

/* ---- style.css: the classic palette ------------------------------ */

const styleMuted = tokenValues(STYLE, 'clr-text-muted').map(parseColour);
check(`style.css declares --clr-text-muted for both themes (${styleMuted.length})`,
    styleMuted.length === 2);

const darkBg = parseColour(tokenValues(STYLE, 'clr-bg')[0]);
const darkSurface = parseColour(tokenValues(STYLE, 'clr-surface')[0]);
const darkCard = parseColour(tokenValues(STYLE, 'clr-bg-card')[0]);
const lightBg = parseColour(tokenValues(STYLE, 'clr-bg')[1]);

assertContrast('style.css dark muted text on the page background', styleMuted[0], darkBg);
assertContrast('style.css dark muted text on a surface', styleMuted[0], darkSurface);
assertContrast('style.css dark muted text on a card', styleMuted[0], darkCard);
assertContrast('style.css light muted text on the page background', styleMuted[1], lightBg);
assertContrast('style.css light muted text on white', styleMuted[1], WHITE);

const styleText = tokenValues(STYLE, 'clr-text').map(parseColour);
assertContrast('style.css dark body text on the background', styleText[0], darkBg);
assertContrast('style.css light body text on the background', styleText[1], lightBg);

/* ---- the accent, in its two separate roles ----------------------- */

const solid = tokenValues(STYLE, 'clr-primary-solid').map(parseColour);
check('style.css defines --clr-primary-solid', solid.length >= 1);
assertContrast('style.css white text on the solid accent', WHITE, solid[0]);

const luSolid = tokenValues(LAUNCH, 'clr-primary-solid').map(parseColour);
check(`launch-ui.css defines --clr-primary-solid for every accent (${luSolid.length})`,
    luSolid.length >= 4);
luSolid.forEach((colour, i) => {
    assertContrast(`launch-ui.css white text on solid accent #${i + 1}`, WHITE, colour);
});

/* ---- launch-ui.css: the home, records and Sum of Ranks palette ---- */

const luSubtle = tokenValues(LAUNCH, 'lu-subtle-fg').map(parseColour);
check(`launch-ui.css declares --lu-subtle-fg for both themes (${luSubtle.length})`,
    luSubtle.length === 2);

const luBg = tokenValues(LAUNCH, 'lu-bg').map(parseColour);
const luFg = tokenValues(LAUNCH, 'lu-fg').map(parseColour);
const luSurface = parseColour(tokenValues(LAUNCH, 'clr-surface')[0]);

assertContrast('launch-ui.css dark subtle text on the background', luSubtle[0], luBg[0]);
assertContrast('launch-ui.css dark subtle text on a surface', luSubtle[0], luSurface);
assertContrast('launch-ui.css light subtle text on the background', luSubtle[1], luBg[1]);
assertContrast('launch-ui.css dark body text on the background', luFg[0], luBg[0]);
assertContrast('launch-ui.css light body text on the background', luFg[1], luBg[1]);

/* ---- nothing paints white on the bright accent any more ---------- */

for (const [name, css] of [['style.css', STYLE], ['launch-ui.css', LAUNCH],
                           ['timer.css', fs.readFileSync(path.join(ROOT, 'timer.css'), 'utf8')],
                           ['coach.css', fs.readFileSync(path.join(ROOT, 'coach.css'), 'utf8')],
                           ['page.css', fs.readFileSync(path.join(ROOT, 'page.css'), 'utf8')]]) {
    // A fill of the bright --clr-primary with a hardcoded white on top is
    // the exact pairing that measured 4.24:1. It must use the solid token.
    const offenders = [...css.matchAll(/background:\s*var\(--clr-primary\)\s*;[\s\S]{0,80}?color:\s*(#fff|#ffffff|white)\b/gi)];
    check(`${name}: no white text on the bright accent fill`, offenders.length === 0,
        offenders.length ? offenders[0][0].replace(/\s+/g, ' ').slice(0, 90) : '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
