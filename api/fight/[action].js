/* ============================================================
   /api/fight/:action   — online Cube Fights, one function

     POST /api/fight/create        { settings }        -> a new room
     POST /api/fight/join          { code }            -> a seat in it
     POST /api/fight/act           { fightId, action } -> the fight after it
     GET  /api/fight/history                           -> your fights + stats
     POST /api/fight/local-result  { record }          -> keep a same-device fight

   Every action needs a signed-in account — online fights are for
   accounts only; same-device fights need none and never come here.

   The rules live in fight-engine.js and the storage in
   _lib/fights.js. This file checks who is calling, limits how often,
   and routes. One function for all five, like /api/social, because
   the Hobby plan counts functions.

   `act` with { type: 'SEEN' } is the heartbeat and the poll: it
   changes nothing but the caller's last-seen time and returns the
   fight. A device that stops sending it is, after a grace period,
   a device that forfeits.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody } = require('../_lib/http.js');
const { resolveSignedInUser } = require('../_lib/identity.js');
const fights = require('../_lib/fights.js');
const rate = require('../_lib/ratelimit.js');

const MESSAGES = {
    required: 'Sign in to fight online.',
    unavailable: "Couldn't check your sign-in just now. Try again shortly.",
};

// A heartbeat every few seconds plus a poll a second at most, plus the
// actions themselves: generous for a person, a wall for a script.
const ACT_LIMIT = { max: 240, windowMs: 60 * 1000 };
const CREATE_LIMIT = { max: 12, windowMs: 60 * 60 * 1000 };
const JOIN_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };
const LOCAL_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 };

const ROUTES = {
    create: 'POST',
    join: 'POST',
    act: 'POST',
    history: 'GET',
    'local-result': 'POST',
};

let service = null;
function svc() {
    if (!service) service = fights.createFightService();
    return service;
}

function paramOf(req) {
    const fromQuery = req.query && req.query.action;
    if (fromQuery) return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
}

function limited() {
    const e = new Error('That is a lot of requests at once — give it a minute.');
    e.status = 429; e.code = 'rate_limited';
    return e;
}

async function handler(req, res) {
    const action = paramOf(req);
    const method = ROUTES[action];
    if (!method) {
        return sendJson(res, 404, { error: { code: 'not_found', message: 'No such fight action.' } });
    }
    if (req.method !== method) {
        res.setHeader('Allow', method);
        return sendJson(res, 405, { error: { code: 'method', message: 'Method not allowed.' } });
    }

    try {
        const user = await resolveSignedInUser(req, MESSAGES);
        const who = `fight:${user.uid}`;
        const body = method === 'POST' ? (await readBody(req)) || {} : {};
        if (method === 'POST' && (typeof body !== 'object' || Array.isArray(body))) {
            const e = new Error('That request was not shaped like a fight action.');
            e.status = 400; e.code = 'bad_body';
            throw e;
        }
        const identity = { uid: user.uid, name: user.name || 'Cuber', wcaId: user.wcaId || null };

        switch (action) {
            case 'create':
                if (!rate.take(`${who}:create`, CREATE_LIMIT)) throw limited();
                return sendJson(res, 200, await svc().create(identity, body.settings || {}));
            case 'join':
                if (!rate.take(`${who}:join`, JOIN_LIMIT)) throw limited();
                return sendJson(res, 200, await svc().join(identity, body.code));
            case 'act':
                if (!rate.take(`${who}:act`, ACT_LIMIT)) throw limited();
                return sendJson(res, 200, await svc().act(identity, body.fightId, body.action || {}));
            case 'history':
                return sendJson(res, 200, await svc().history(identity));
            case 'local-result':
                if (!rate.take(`${who}:local`, LOCAL_LIMIT)) throw limited();
                return sendJson(res, 200, { ok: true, record: await svc().saveLocal(identity, body.record) });
            default:
                return sendJson(res, 404, { error: { code: 'not_found', message: 'No such fight action.' } });
        }
    } catch (err) {
        sendError(res, err);
    }
}

module.exports = handler;
/** Test seams. */
module.exports._setService = (s) => { service = s; };
module.exports._resetLimits = () => rate._reset();
module.exports._internal = { paramOf, ROUTES };
