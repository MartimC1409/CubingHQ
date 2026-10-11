/* Tests timer-core.js: the phase machine and the WCA penalty rules that
   the solo timer and Cube Fights now share.

   Every timestamp is passed in, so nothing here waits on a real clock;
   the hold delay runs on a fake scheduler that fires when told to.

   Run: node scripts/test_timer_core.js */

'use strict';

const fs = require('fs');
const path = require('path');
const C = require('../timer-core.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
    if (Object.is(got, want)) pass++;
    else { fail++; console.error(`FAIL ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}

/** A timer with a hand-cranked hold delay and a recorded phase trail. */
function harness(opts = {}) {
    const pending = [];
    const trail = [];
    let clock = 0;
    const t = C.createSolveTimer(Object.assign({
        now: () => clock,
        schedule: (fn, ms) => { pending.push({ fn, at: clock + ms }); return pending.length; },
        cancel: (id) => { if (pending[id - 1]) pending[id - 1].fn = null; },
        onChange: (phase, prev, info) => trail.push({ phase, prev, info }),
    }, opts));
    return {
        t, trail,
        at(ms) { clock = ms; return this; },
        /** Advance the clock, firing any hold timer that falls due. */
        advance(ms) {
            clock += ms;
            pending.forEach(p => { if (p.fn && p.at <= clock) { const fn = p.fn; p.fn = null; fn(); } });
            return this;
        },
        get now() { return clock; },
    };
}

/* ---- formatting ------------------------------------------------- */
eq('seconds', C.fmt(9876), '9.88');
eq('minutes', C.fmt(62340), '1:02.34');
eq('DNF for Infinity', C.fmt(Infinity), 'DNF');
eq('DNF for null', C.fmt(null), 'DNF');

/* ---- WCA penalty rules ------------------------------------------ */
eq('inside 15s is clean', C.inspectionPenalty(14999, 'wca'), '');
eq('exactly 15s is clean', C.inspectionPenalty(15000, 'wca'), '');
eq('15–17s is +2', C.inspectionPenalty(16500, 'wca'), '+2');
eq('17s is still +2', C.inspectionPenalty(17000, 'wca'), '+2');
eq('past 17s is DNF', C.inspectionPenalty(17001, 'wca'), 'DNF');
eq('strict: past 15s is DNF', C.inspectionPenalty(15001, 'strict'), 'DNF');
eq('+2 adds two seconds', C.effectiveMs(10000, '+2'), 12000);
eq('DNF is Infinity', C.effectiveMs(10000, 'DNF'), Infinity);
eq('worse of +2 and DNF', C.worsePenalty('+2', 'DNF'), 'DNF');
eq('worse of clean and +2', C.worsePenalty('', '+2'), '+2');
eq('unknown penalty is clean', C.normPenalty('weird'), '');

/* ---- a solve with no inspection --------------------------------- */
let h = harness({ holdMs: 300, inspection: false });
h.at(1000); h.t.press();
eq('press starts the hold', h.t.phase, 'holding');
h.advance(200); h.t.release();
eq('letting go early goes back to idle', h.t.phase, 'idle');
h.t.press(); h.advance(300);
eq('a full hold is ready', h.t.phase, 'ready');
h.t.release();
eq('release starts the solve', h.t.phase, 'running');
const startedAt = h.now;
h.advance(8765); h.t.press();
eq('press stops it', h.t.phase, 'stopped');
eq('the time is the run length', h.t.result.ms, 8765);
eq('with no penalty', h.t.result.penalty, '');
eq('onChange carries the result', h.trail[h.trail.length - 1].info.ms, 8765);
ok('runStart is when it started', h.t.runStart === startedAt);

// A hold timer that never fires (a throttled background tab): the hold is
// measured from timestamps, so releasing after a full hold still starts.
h = harness({ holdMs: 300, inspection: false, schedule: () => 1, cancel: () => {} });
h.at(0); h.t.press(); h.at(350); h.t.release();
eq('a full hold counts even if the timer never fired', h.t.phase, 'running');
h = harness({ holdMs: 300, inspection: false, schedule: () => 1, cancel: () => {} });
h.at(0); h.t.press(); h.at(320); h.t.tick();
eq('tick notices a full hold too', h.t.phase, 'ready');

h = harness({ holdMs: 0, inspection: false });
h.t.press();
eq('no hold delay: straight to ready', h.t.phase, 'ready');

/* ---- inspection ------------------------------------------------- */
h = harness({ holdMs: 300, inspection: true, inspectionRule: 'wca' });
h.at(0); h.t.press();
eq('press from idle starts inspection', h.t.phase, 'inspecting');
h.t.release();
eq('the release that follows does nothing', h.t.phase, 'inspecting');
h.advance(200); h.t.press();
eq('a press right after starting is ignored', h.t.phase, 'inspecting');
h.advance(4000); h.t.press(); h.advance(100); h.t.release();
eq('an early release returns to inspection, not idle', h.t.phase, 'inspecting');
h.advance(1000); h.t.press(); h.advance(300); h.t.release();
eq('then the solve starts', h.t.phase, 'running');
h.advance(9000); h.t.stop();
eq('clean start inside 15s', h.t.result.penalty, '');

// +2: start the solve 16s into inspection.
h = harness({ holdMs: 300, inspection: true, inspectionRule: 'wca' });
h.at(0); h.t.startInspection(0);
h.advance(15800); h.t.press(); h.advance(300); h.t.release();
eq('started in the +2 window', h.t.phase, 'running');
h.advance(10000); h.t.stop();
eq('earns +2', h.t.result.penalty, '+2');

// DNF: inspection runs out while still inspecting.
h = harness({ holdMs: 300, inspection: true, inspectionRule: 'wca' });
h.t.startInspection(0);
h.at(16999); h.t.tick();
eq('still inspecting at 16.999s', h.t.phase, 'inspecting');
h.at(17000); h.t.tick();
eq('DNF at 17s', h.t.phase, 'inspection_dnf');
eq('the result is a DNF', h.t.result.penalty, 'DNF');

// DNF while holding through the limit.
h = harness({ holdMs: 300, inspection: true, inspectionRule: 'wca' });
h.t.startInspection(0);
h.at(16900); h.t.press(); h.advance(300);
eq('holding past 17s is a DNF too', h.t.phase, 'inspection_dnf');

// The solo timer keeps its strict 15s rule.
h = harness({ holdMs: 300, inspection: true, inspectionRule: 'strict' });
h.t.startInspection(0);
h.at(15000); h.t.tick();
eq('strict: DNF at 15s', h.t.phase, 'inspection_dnf');

// A scheduled start: two timers given the same instant agree to the ms.
const a = harness({ inspection: true }), b = harness({ inspection: true });
a.t.startInspection(5000); b.t.startInspection(5000);
a.at(9000); b.at(9000);
eq('synced inspection: same time left', a.t.inspectionLeft(), b.t.inspectionLeft());
eq('...which is 11s', a.t.inspectionLeft(), 11000);

/* ---- smart cube start, reset ------------------------------------ */
h = harness({ inspection: true });
ok('forceStart from idle', h.t.forceStart(100));
eq('runs immediately', h.t.phase, 'running');
h.t.reset();
eq('reset returns to idle', h.t.phase, 'idle');
h.t.press();
eq('after a reset, inspection again', h.t.phase, 'inspecting');

/* ---- the solo timer uses it ------------------------------------- */
const TIMER = fs.readFileSync(path.join(__dirname, '..', 'timer.js'), 'utf8');
ok('timer.js builds on TimerCore', /Core\.createSolveTimer\(/.test(TIMER));
ok('...keeping the strict rule', /inspectionRule: 'strict'/.test(TIMER));
ok('and has no phase machine of its own', !/function beginHold|function goReady|function inspectionTick/.test(TIMER));
for (const page of ['index.html', 'timer.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const core = html.indexOf('timer-core.js?v=');
    const timer = html.indexOf('timer.js?v=');
    ok(`${page} loads timer-core.js before timer.js`, core !== -1 && core < timer);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
