/* ============================================================
   /api/coach/:endpoint   — one function, six endpoints

     POST /api/coach/assess     the first read of a solver
     POST /api/coach/plan       a training plan from that read
     POST /api/coach/revise     the plan, adjusted
     POST /api/coach/chat       the conversation
     GET  /api/coach/profile    stored coaching data
     GET  /api/coach/health     what is configured, for diagnosis

   Four of these stream, and streaming is unaffected: the dispatcher
   hands the response object straight to the handler, which opens the
   stream itself exactly as before.

   /api/coach/video/* is NOT served here — a nested route wins over a
   single-segment one, so those still reach video/[step].js.

   See _lib/dispatch.js for why this shape exists at all.
   ============================================================ */
'use strict';

const { makeDispatcher } = require('../_lib/dispatch.js');

module.exports = makeDispatcher('endpoint', {
    assess: require('./_assess.js'),
    plan: require('./_plan.js'),
    revise: require('./_revise.js'),
    chat: require('./_chat.js'),
    profile: require('./_profile.js'),
    health: require('./_health.js'),
});
