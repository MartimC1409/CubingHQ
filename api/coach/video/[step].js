/* ============================================================
   /api/coach/video/:step   — one function, four endpoints

     POST /api/coach/video/begin     open a resumable session
     POST /api/coach/video/chunk     relay one slice of the file
     POST /api/coach/video/upload    the whole file, for short clips
     POST /api/coach/video/analyse   run the analysis

   Same reasoning as /api/auth: the Hobby plan allows 12 serverless
   functions per deployment, and these four are one feature sharing
   one adapter. A dynamic route counts once.

   URLs are unchanged, so no client code moved. The handlers are the
   same files with a leading underscore, which stops the platform
   from deploying each of them as a function of its own.
   ============================================================ */
'use strict';

const { sendJson } = require('../../_lib/http.js');

const ROUTES = {
    begin: require('./_begin.js'),
    chunk: require('./_chunk.js'),
    upload: require('./_upload.js'),
    analyse: require('./_analyse.js'),
};

/** Which step was asked for; see the note in /api/auth/[action].js. */
function stepOf(req) {
    const fromQuery = req.query && req.query.step;
    if (fromQuery) return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);

    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
}

module.exports = async function handler(req, res) {
    const step = stepOf(req);
    const route = Object.prototype.hasOwnProperty.call(ROUTES, step) && ROUTES[step];
    if (!route) {
        return sendJson(res, 404, {
            error: { code: 'not_found', message: 'No such endpoint.' },
        });
    }
    return route(req, res);
};

module.exports._internal = { stepOf, ROUTES: Object.keys(ROUTES) };
