/* Fixture tests for the Coach's session importer.
   Run: node scripts/test_cstimer_import.js */
const I = require('../coach-cstimer.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function throwsCode(label, fn, code) {
    try { fn(); fail++; console.error(`FAIL ${label} — expected throw`); }
    catch (e) { eq(label, e.code, code); }
}

// ---------- csTimer JSON -----------------------------------------
const csTimer = JSON.stringify({
    session1: [
        [[0, 12340], "R U R' U'", "", 1700000000],
        [[2000, 11000], "F R U'", "", 1700000060],   // +2
        [[-1, 15000], "L D2 B", "", 1700000120],     // DNF
        [[0, 9990], "U2 R2", "", 1700000180],
    ],
    session2: [
        [[0, 3210], "R U R'", "", 1700001000],
    ],
    properties: {
        sessionData: JSON.stringify({
            "1": { name: "3x3 main", opt: { scrType: "333" } },
            "2": { name: "2x2", opt: { scrType: "222so" } },
        }),
    },
});

const r = I.parse(csTimer);
eq('cstimer source', r.source, 'cstimer');
eq('cstimer session count', r.sessions.length, 2);
eq('cstimer s1 name', r.sessions[0].name, '3x3 main');
eq('cstimer s1 event', r.sessions[0].event, '333');
eq('cstimer s2 event', r.sessions[1].event, '222');
eq('cstimer s1 solve count', r.sessions[0].solves.length, 4);
eq('cstimer ok time', r.sessions[0].solves[0].time, 12340);
eq('cstimer ok penalty', r.sessions[0].solves[0].penalty, '');
eq('cstimer scramble kept', r.sessions[0].solves[0].scramble, "R U R' U'");
// +2 stores the RAW time and flags the penalty, matching timer.js.
eq('cstimer +2 raw time', r.sessions[0].solves[1].time, 11000);
eq('cstimer +2 penalty', r.sessions[0].solves[1].penalty, '+2');
eq('cstimer DNF penalty', r.sessions[0].solves[2].penalty, 'DNF');
// unix seconds -> ms
eq('cstimer timestamp ms', r.sessions[0].solves[0].timestamp, 1700000000000);
// The +2 must read back through the shared stats as 13.0s.
const S = require('../cube-stats.js');
eq('+2 effective via CubeStats', S.effectiveMs(r.sessions[0].solves[1]), 13000);

// Session with no metadata falls back to name-guessing, then 333.
const noMeta = I.parse(JSON.stringify({ session1: [[[0, 10000], "", "", 0]] }));
eq('cstimer no meta event', noMeta.sessions[0].event, '333');

// Implausible times are skipped, not imported as garbage.
const junk = I.parse(JSON.stringify({
    session1: [[[0, 10000], "", "", 0], [[0, -5], "", "", 0], [[0, 9e9], "", "", 0]],
}));
eq('cstimer skips implausible', junk.sessions[0].solves.length, 1);
eq('cstimer reports skipped', junk.sessions[0].skipped, 2);

// Empty / malformed / wrong-shape files raise stable codes.
throwsCode('empty string', () => I.parse('   '), 'empty');
throwsCode('broken json', () => I.parse('{"session1": ['), 'malformed');
throwsCode('wrong json', () => I.parse('{"hello":"world"}'), 'unsupported');
throwsCode('all-unusable session', () => I.parse(JSON.stringify({ session1: [] })), 'empty');

// ---------- CubingHQ backup --------------------------------------
const ourBackup = JSON.stringify({
    sessions: {
        sess_a: {
            id: 'sess_a', name: 'My session', event: '444',
            solves: [
                { id: '1', time: 55000, penalty: '', scramble: 'Rw U', timestamp: 100 },
                { id: '2', time: 52000, penalty: '+2', scramble: '', timestamp: 200 },
            ],
        },
    },
    sessionOrder: ['sess_a'],
});
const b = I.parse(ourBackup);
eq('cubinghq source', b.source, 'cubinghq');
eq('cubinghq event preserved', b.sessions[0].event, '444');
eq('cubinghq solves', b.sessions[0].solves.length, 2);
eq('cubinghq penalty preserved', b.sessions[0].solves[1].penalty, '+2');

// ---------- CSV ---------------------------------------------------
const csv = [
    '"No.";"Time";"Comment";"Scramble";"Date";"P.1"',
    '"1";"12.34";"";"R U R\' U\'";"2024-01-01 10:00:00";"0"',
    '"2";"1:02.50";"";"F R U";"2024-01-01 10:01:00";"0"',
    '"3";"DNF(11.20)";"";"L D2";"2024-01-01 10:02:00";"-1"',
].join('\n');
const c = I.parse(csv);
eq('csv source', c.source, 'csv');
eq('csv count', c.sessions[0].solves.length, 3);
eq('csv seconds', c.sessions[0].solves[0].time, 12340);
eq('csv mm:ss', c.sessions[0].solves[1].time, 62500);
eq('csv dnf', c.sessions[0].solves[2].penalty, 'DNF');
eq('csv scramble', c.sessions[0].solves[0].scramble, "R U R' U'");

// ---------- plain times ------------------------------------------
const plain = '12.34\n11.20\n13.05\n(9.87)\nDNF\n1:01.00';
const p = I.parse(plain);
eq('plain source', p.source, 'plain');
eq('plain count', p.sessions[0].solves.length, 6);
eq('plain paren stripped', p.sessions[0].solves[3].time, 9870);
eq('plain dnf', p.sessions[0].solves[4].penalty, 'DNF');
eq('plain mm:ss', p.sessions[0].solves[5].time, 61000);

// csTimer's numbered text export.
const numbered = '1. 12.34   R U R\' U\'\n2. 11.20   F R U\n3. 10.05   L D2';
const n = I.parse(numbered);
eq('numbered count', n.sessions[0].solves.length, 3);
eq('numbered time', n.sessions[0].solves[0].time, 12340);
eq('numbered scramble', n.sessions[0].solves[0].scramble, "R U R' U'");

// Too little to be a real session.
throwsCode('two loose lines', () => I.parse('hello\nworld'), 'unsupported');

// ---------- time token edge cases --------------------------------
eq('token +2 suffix strips 2s', I.parseTimeToken('12.34+').ms, 10340);
eq('token +2 suffix flags', I.parseTimeToken('12.34+').penalty, '+2');
eq('token h:mm:ss', I.parseTimeToken('1:00:00.00').ms, 3600000);
eq('token DNS ignored', I.parseTimeToken('DNS'), null);
eq('token garbage', I.parseTimeToken('abc'), null);

// ---------- scramble-type mapping --------------------------------
eq('scrType 444wca', I.eventFromScrType('444wca'), '444');
eq('scrType pyrso', I.eventFromScrType('pyrso'), 'pyram');
eq('scrType skbso', I.eventFromScrType('skbso'), 'skewb');
eq('scrType mgmp', I.eventFromScrType('mgmp'), 'minx');
eq('scrType clkwca', I.eventFromScrType('clkwca'), 'clock');
eq('scrType sq1', I.eventFromScrType('sq1h'), 'sq1');
eq('scrType 333oh', I.eventFromScrType('333oh'), '333oh');
eq('scrType unknown', I.eventFromScrType('nonsense'), null);
eq('name guess OH', I.eventFromName('3x3 OH practice'), '333oh');
eq('name guess mega', I.eventFromName('Megaminx'), 'minx');

// ---------- dedupe -----------------------------------------------
const existing = [{ time: 12340, timestamp: 1700000000000 }];
const d = I.dedupe(r.sessions[0].solves, existing);
eq('dedupe removed', d.removed, 1);
eq('dedupe kept', d.solves.length, 3);
eq('dedupe no-op', I.dedupe(r.sessions[0].solves, []).removed, 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
