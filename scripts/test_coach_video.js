/* Tests the video analysis path — schema, evidence rules and the
   upload/poll handshake. No network; global fetch is stubbed.

   The load-bearing tests here are the ones asserting what video does
   NOT unlock. Video is the first evidence source that genuinely sees
   hands, which makes it the easiest place for the evidence contract to
   quietly widen into "the model watched a video, so it knows".
   Run: node scripts/test_coach_video.js */

'use strict';

process.env.COACH_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-key';
process.env.COACH_MODEL = 'gemini-test';
// Keep the polling test instant.
process.env.COACH_VIDEO_POLL_MS = '1';
process.env.COACH_VIDEO_POLL_BUDGET_MS = '10';

const { VIDEO_ANALYSIS_SCHEMA, VIDEO_CATEGORIES } = require('../api/_lib/schemas.js');
const { CATEGORY_COVERS, topicsForEvent, videoPrompt } = require('../api/_lib/prompts.js');
const { validate } = require('../api/_lib/validate.js');
const { _internal: assessInternal } = require('../api/coach/_assess.js');
const { _internal: videoInternal } = require('../api/coach/video/_analyse.js');

let pass = 0, fail = 0;
function check(label, cond, extra) {
    if (cond) pass++; else { fail++; console.error(`FAIL ${label}` + (extra ? ` — ${extra}` : '')); }
}
function eq(label, got, want) {
    check(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* ============ the schema ======================================== */

const obs = VIDEO_ANALYSIS_SCHEMA.properties.observations.items;

// "known" means a figure the app computed. A camera never produces one,
// so offering the tag would invite the model to dress an impression as a
// measurement.
eq('video findings cannot be tagged "known"',
    JSON.stringify(obs.properties.evidenceType.enum), JSON.stringify(['observed', 'inferred']));
check('every observation needs a basis', obs.required.includes('basis'));
check('every observation needs a timestamp', obs.required.includes('timestamp'));
check('every observation needs a confidence', obs.required.includes('confidence'));
check('categories are a closed list', Array.isArray(obs.properties.category.enum));
check('no recognition category exists',
    !VIDEO_CATEGORIES.some(c => /recogni/i.test(c)), JSON.stringify(VIDEO_CATEGORIES));
check('solveDetected is required', VIDEO_ANALYSIS_SCHEMA.required.includes('solveDetected'));
check('notVisible is required', VIDEO_ANALYSIS_SCHEMA.required.includes('notVisible'));

const goodAnalysis = {
    solveDetected: true,
    whatWasSeen: 'One 3x3 solve, about 14 seconds, filmed from the side.',
    observations: [{
        timestamp: '0:06', category: 'pauses',
        observation: 'Hands stop for roughly half a second before the last layer.',
        evidenceType: 'observed', basis: 'Visible gap between the final F2L insert and the next turn.',
        confidence: 0.9,
    }],
    summary: 'Turning is smooth; the time goes on a pause before the last layer.',
    notVisible: ['Inspection was not filmed.'],
};
eq('a well-formed analysis validates', validate(goodAnalysis, VIDEO_ANALYSIS_SCHEMA).length, 0);

check('a "known" tag is rejected',
    validate({ ...goodAnalysis, observations: [{ ...goodAnalysis.observations[0], evidenceType: 'known' }] },
        VIDEO_ANALYSIS_SCHEMA).some(e => /evidenceType/.test(e)));
check('an invented category is rejected',
    validate({ ...goodAnalysis, observations: [{ ...goodAnalysis.observations[0], category: 'recognition' }] },
        VIDEO_ANALYSIS_SCHEMA).some(e => /category/.test(e)));

/* ============ what video does and does not unlock =============== */

const videoObs = (categories) => categories.map(c => ({
    category: c, observation: 'seen', confidence: 0.9, source: 'video',
}));

const everything = assessInternal.buildEvidence({
    metrics: { solveCount: 80, event: '333' },
    profile: null,
    observations: videoObs(['rotations', 'regrips', 'pauses', 'inspection',
        'turning_quality', 'finger_tricks']),
});

// The payoff: these five stop being "I can't tell you that".
for (const gone of [/rotation/i, /regrip/i, /pause/i, /inspection/i, /turning quality/i, /finger trick/i]) {
    check(`video clears ${gone}`, !everything.unknown.some(u => gone.test(u)),
        JSON.stringify(everything.unknown));
}

// The line that must hold. A pause before the last layer is evidence
// ABOUT recognition, not a measurement of it — the solver might have
// been resting. If this ever passes, the Coach can claim to have seen
// someone think.
check('PLL recognition stays unknown even with full video',
    everything.unknown.some(u => /PLL recognition/i.test(u)), JSON.stringify(everything.unknown));
check('OLL recognition stays unknown even with full video',
    everything.unknown.some(u => /OLL recognition/i.test(u)));
check('F2L lookahead stays unknown even with full video',
    everything.unknown.some(u => /F2L lookahead/i.test(u)));

check('no video category claims recognition',
    !Object.entries(CATEGORY_COVERS)
        .some(([, topics]) => topics.some(t => /recognition|lookahead/.test(t))));

// A smart cube cannot see hands, and must not start clearing what video does.
const cubeOnly = assessInternal.buildEvidence({
    metrics: { solveCount: 80, event: '333' }, profile: null,
    observations: [{ category: 'pauses', observation: 'gap', confidence: 1 }],
});
check('cube data still cannot see regrips', cubeOnly.unknown.some(u => /regrip/i.test(u)));
check('cube data still cannot see grip', cubeOnly.unknown.some(u => /finger trick/i.test(u)));
check('cube data does clear pause location', !cubeOnly.unknown.some(u => /where pauses/i.test(u)));

/* ============ source attribution ================================ */

eq('video is named as the source',
    everything.observed.source, 'an uploaded solve video.');
eq('the cube is named as the source',
    cubeOnly.observed.source, 'Bluetooth smart cube move data, analysed per solve.');

const both = assessInternal.buildEvidence({
    metrics: { solveCount: 80, event: '333' }, profile: null,
    observations: [
        { category: 'pauses', observation: 'gap', confidence: 1 },
        { category: 'regrips', observation: 'regrip', confidence: 1, source: 'video' },
    ],
});
check('both sources are named when both exist',
    /video/.test(both.observed.source) && /smart cube/.test(both.observed.source),
    both.observed.source);

/* ============ the prompt ======================================== */

const prompt = videoPrompt('333');
check('prompt allows regrips', /regrip/i.test(prompt));
check('prompt allows rotations', /rotation/i.test(prompt));
check('prompt requires timestamps', /timestamp/i.test(prompt));
check('prompt forbids observing recognition',
    /recognition speed in particular is not visible/i.test(prompt));
check('prompt says thinking is not visible', /not visible|cannot see what the solver/i.test(prompt));
check('prompt handles a clip with no solve', /solveDetected false/i.test(prompt));
check('prompt forbids guessing times', /do not estimate solve times/i.test(prompt));
check('prompt carries event-specific coaching', /F2L is the largest block/i.test(prompt));
check('clock prompt is not about F2L', !/F2L is the largest block/i.test(videoPrompt('clock')));

/* ============ upload polling ==================================== */

const queue = [];
global.fetch = async () => {
    if (!queue.length) throw new Error('test: no queued response');
    const next = queue.shift();
    return {
        ok: true, status: 200,
        headers: { get: () => null },
        json: async () => next,
    };
};

(async () => {
    queue.push({ state: 'ACTIVE', uri: 'files/abc', mimeType: 'video/mp4', name: 'files/abc' });
    let r = await videoInternal.waitForFile('files/abc');
    eq('an active file is ready at once', r.ready, true);
    eq('the file record comes back', r.file.uri, 'files/abc');

    // Transcoding then finishing.
    queue.push({ state: 'PROCESSING', name: 'files/abc' });
    queue.push({ state: 'ACTIVE', uri: 'files/abc', mimeType: 'video/mp4', name: 'files/abc' });
    let waited = 0;
    r = await videoInternal.waitForFile('files/abc', () => { waited++; });
    eq('polls until active', r.ready, true);
    eq('tells the user it is waiting, once', waited, 1);

    // Still processing when the budget runs out: a wait, not a failure.
    // Holding the function open instead would get it killed mid-answer.
    for (let i = 0; i < 40; i++) queue.push({ state: 'PROCESSING', name: 'files/abc' });
    r = await videoInternal.waitForFile('files/abc');
    eq('gives up cleanly rather than hanging', r.ready, false);
    check('no file is returned when not ready', r.file === undefined);

    queue.length = 0;
    queue.push({ state: 'FAILED', name: 'files/abc' });
    let threw = null;
    try { await videoInternal.waitForFile('files/abc'); } catch (e) { threw = e; }
    eq('a failed upload is an error', threw && threw.code, 'video_failed');
    eq('and is reported as unprocessable', threw && threw.status, 422);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
