/* Tests that the timer's mobile event chip shows the event the SESSION
   is actually on (timer-mobile.js syncEventSelect).

   The bug: opening the timer on a 4x4 session showed "3x3x3" in the chip
   above a 4x4 scramble. The chip mirrored #cs-setting-event, and
   renderAll() announced the session list — which is what triggers the
   mirror — before renderSettings() had pushed the session's event into
   that select. So the chip copied the select's untouched first option
   and never heard about it again, while the scramble, the cube preview
   and the stats below it were all on the real event.

   Two things are pinned here: the mirror reads the session rather than
   the select, and renderAll() no longer announces before it syncs.

   Run: node scripts/test_timer_event_chip.js */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MOBILE = fs.readFileSync(path.join(ROOT, 'timer-mobile.js'), 'utf8');
const TIMER = fs.readFileSync(path.join(ROOT, 'timer.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function ok(label, cond, extra) { check(label, !!cond, extra); }

function slice(src, startsWith, endsWith) {
    const start = src.indexOf(startsWith);
    if (start === -1) throw new Error(`not found: ${startsWith}`);
    const end = src.indexOf(endsWith, start);
    if (end === -1) throw new Error(`not found: ${endsWith}`);
    return src.slice(start, end + endsWith.length);
}

/** A <select> stand-in: options only matter as a count and as markup. */
function fakeSelect(value, optionCount) {
    return {
        value,
        innerHTML: `<options n="${optionCount}">`,
        options: { length: optionCount },
    };
}

/**
 * Runs the shipped syncEventSelect against a chip and a settings select
 * that disagree, and returns what each ended up showing.
 */
function runSync({ chip, settings, sessionEvent }) {
    const els = { '#cs-mtop-event': chip, '#cs-setting-event': settings };
    const ctx = {
        console,
        document: { querySelector: (sel) => els[sel] || null },
        window: sessionEvent === undefined ? {} : {
            TimerModule: { getCurrentEvent: () => sessionEvent },
        },
    };
    const body = [
        'const $ = (sel) => document.querySelector(sel);',
        slice(MOBILE, '    function syncEventSelect() {', '\n    }'),
        'this.syncEventSelect = syncEventSelect;',
    ].join('\n');
    vm.runInNewContext(body, ctx, { filename: 'timer-mobile.js:sync' });
    ctx.syncEventSelect();
    return { chip, settings };
}

/* The reported case: the session is on 4x4, the settings select has not
   been written to yet and still reads 3x3x3. */
let chip = fakeSelect('333', 12);
let settings = fakeSelect('333', 12);
let out = runSync({ chip, settings, sessionEvent: '444' });
check('the chip follows the session, not the stale select', out.chip.value === '444', out.chip.value);
check('the settings select is corrected too', out.settings.value === '444', out.settings.value);

/* Once they agree, nothing is disturbed. */
chip = fakeSelect('444', 12);
settings = fakeSelect('444', 12);
out = runSync({ chip, settings, sessionEvent: '444' });
check('an already-correct chip is left alone', out.chip.value === '444', out.chip.value);

/* An empty chip is populated from the select's options. */
chip = fakeSelect('', 0);
settings = fakeSelect('pyram', 12);
out = runSync({ chip, settings, sessionEvent: 'pyram' });
check('an empty chip copies the options across',
    out.chip.innerHTML === settings.innerHTML, out.chip.innerHTML);
check('and lands on the session event', out.chip.value === 'pyram', out.chip.value);

/* If the timer module has not booted there is no session to read, and
   the select remains the best available answer. */
chip = fakeSelect('333', 12);
settings = fakeSelect('555', 12);
out = runSync({ chip, settings, sessionEvent: undefined });
check('without TimerModule it falls back to the select', out.chip.value === '555', out.chip.value);

/* And the ordering that caused it: renderAll() must sync the settings
   before it announces the session list to anything mirroring them. */
const renderAll = slice(TIMER, '    function renderAll() {', 'renderPhaseBadge();\n    }');
ok('renderAll still syncs the settings', renderAll.includes('renderSettings();'));
ok('renderAll still announces the session list', renderAll.includes('renderSessionTabs();'));
check('settings are synced before the announcement',
    renderAll.indexOf('renderSettings();') < renderAll.indexOf('renderSessionTabs();'),
    renderAll);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
