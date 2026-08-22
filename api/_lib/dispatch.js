/* ============================================================
   Dynamic-route dispatch
   ------------------------------------------------------------
   A deployment on the Hobby plan may contain 12 serverless
   functions, and every file under api/ is one. A dynamic route
   counts once however many endpoints it serves, so groups of
   endpoints that share a library and a request shape share a
   function: /api/auth/:action, /api/coach/:endpoint and
   /api/coach/video/:step.

   The URLs are unchanged by this — filesystem routing maps
   /api/coach/chat here with `chat` as the parameter — and so are
   the handlers, which keep deciding their own methods, validation
   and errors. This chooses between them and nothing else.

   Handlers live beside their route file with a leading underscore,
   which is what stops the platform from turning each of them back
   into a function of its own.
   ============================================================ */
'use strict';

const { sendJson } = require('./http.js');

/**
 * Which endpoint was asked for.
 *
 * The platform's own parse is preferred. The URL is read as a fallback
 * so routing stays testable without a platform around it, and so a
 * change that stopped populating the parameter would fail loudly
 * rather than send every request to whichever handler sorted first.
 */
function paramOf(req, name) {
    const fromQuery = req && req.query && req.query[name];
    if (fromQuery) return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);

    const path = String((req && req.url) || '').split('?')[0].replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * @param name  the dynamic segment's name, matching the [brackets]
 *              in the filename
 * @param routes {endpoint: handler}
 */
function makeDispatcher(name, routes) {
    async function handler(req, res) {
        const key = paramOf(req, name);
        // hasOwnProperty, not `routes[key]`: `constructor` and
        // `__proto__` are truthy on any object literal, and neither is
        // an endpoint.
        const route = Object.prototype.hasOwnProperty.call(routes, key) && routes[key];
        if (!route) {
            return sendJson(res, 404, {
                error: { code: 'not_found', message: 'No such endpoint.' },
            });
        }
        return route(req, res);
    }

    handler._internal = { paramOf: (req) => paramOf(req, name), ROUTES: Object.keys(routes) };
    return handler;
}

module.exports = { makeDispatcher, paramOf };
