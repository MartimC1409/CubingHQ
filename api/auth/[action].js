/* ============================================================
   /api/auth/:action   — one function, three endpoints

     POST /api/auth/signup
     POST /api/auth/login
     GET  /api/auth/me

   Why a dispatcher rather than three files: a deployment on the
   Hobby plan may contain at most 12 serverless functions, and three
   endpoints that share a library and a request shape are not worth
   three of them. A dynamic route counts once, whatever it serves.

   The URLs are unchanged — filesystem routing maps /api/auth/login
   here with `login` as the parameter — so nothing the client sends
   had to move. The handlers themselves are unchanged too, only
   renamed with a leading underscore, which is what keeps the
   platform from turning each of them back into a function.
   ============================================================ */
'use strict';

const { sendJson } = require('../_lib/http.js');

const ROUTES = {
    signup: require('./_signup.js'),
    login: require('./_login.js'),
    me: require('./_me.js'),
};

/**
 * Which endpoint was asked for.
 *
 * `req.query` is the platform's answer and is preferred. The URL is
 * parsed as a fallback so this stays testable, and so a routing change
 * cannot silently strip the parameter and leave every request looking
 * like the same endpoint.
 */
function actionOf(req) {
    const fromQuery = req.query && req.query.action;
    if (fromQuery) return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);

    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
}

module.exports = async function handler(req, res) {
    const action = actionOf(req);
    const route = Object.prototype.hasOwnProperty.call(ROUTES, action) && ROUTES[action];
    if (!route) {
        return sendJson(res, 404, {
            error: { code: 'not_found', message: 'No such endpoint.' },
        });
    }
    return route(req, res);
};

module.exports._internal = { actionOf, ROUTES: Object.keys(ROUTES) };
