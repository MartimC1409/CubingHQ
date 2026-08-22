/* ============================================================
   /api/coach/video/:step   — one function, four endpoints

     POST /api/coach/video/begin     open a resumable session
     POST /api/coach/video/chunk     relay one slice of the file
     POST /api/coach/video/upload    the whole file, for short clips
     POST /api/coach/video/analyse   run the analysis

   See _lib/dispatch.js for why this shape exists at all.
   ============================================================ */
'use strict';

const { makeDispatcher } = require('../../_lib/dispatch.js');

module.exports = makeDispatcher('step', {
    begin: require('./_begin.js'),
    chunk: require('./_chunk.js'),
    upload: require('./_upload.js'),
    analyse: require('./_analyse.js'),
});
