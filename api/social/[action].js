/* ============================================================
   /api/social/:action   — friends and groups, one function

     POST /api/social/request           { identifier }
     POST /api/social/accept            { fromUid }
     POST /api/social/decline           { uid }
     POST /api/social/remove-friend     { uid }
     GET  /api/social/list
     POST /api/social/create-group      { name, memberUids }
     GET  /api/social/list-groups
     GET  /api/social/group?id=<id>
     POST /api/social/add-to-group      { groupId, memberUid }
     POST /api/social/remove-from-group { groupId, memberUid }
     POST /api/social/delete-group      { groupId }

   One function rather than one file per action, unlike /api/auth and
   /api/coach: every action here shares the same first two steps —
   resolve who is calling, make sure they have an account row to hang
   friends off — so splitting them apart would split that prelude
   eleven ways instead of writing it once. See _lib/dispatch.js for why
   the Hobby plan's function count is what is being managed here.

   The compare view itself is not here. Personal bests are public WCA
   data the client already knows how to fetch for one competitor; doing
   it again per friend needs no server code and no round trip through
   one, so it stays entirely client-side.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody } = require('../_lib/http.js');
const { resolveSignedInUser } = require('../_lib/identity.js');
const accounts = require('../_lib/accounts.js');
const social = require('../_lib/social.js');
const rate = require('../_lib/ratelimit.js');

const MESSAGES = {
    required: 'Sign in to use friends and groups.',
    unavailable: "Couldn't check your sign-in just now. Try again shortly.",
};

// A friend request costs the recipient nothing to receive, but is the
// one action here that could be used to probe email addresses one at a
// time if it were free to call. Everything else is cheaper to allow
// more of.
const REQUEST_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };
const WRITE_LIMIT = { max: 120, windowMs: 60 * 60 * 1000 };

function paramOf(req) {
    const fromQuery = req.query && req.query.action;
    if (fromQuery) return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
}

function groupIdOf(req) {
    if (req.query && req.query.id) return String(req.query.id);
    const q = String(req.url || '').split('?')[1] || '';
    return new URLSearchParams(q).get('id') || '';
}

const GET_ACTIONS = new Set(['list', 'list-groups', 'group']);

async function handler(req, res) {
    const action = paramOf(req);
    const isGet = GET_ACTIONS.has(action);

    if (req.method !== (isGet ? 'GET' : 'POST')) {
        res.setHeader('Allow', isGet ? 'GET' : 'POST');
        return sendJson(res, 405, { error: { code: 'method', message: 'Method not allowed.' } });
    }

    try {
        const identity = await resolveSignedInUser(req, MESSAGES);

        const ip = rate.clientIp(req);
        const limit = action === 'request' ? REQUEST_LIMIT : WRITE_LIMIT;
        if (!isGet && !rate.take(`social:${identity.uid}:${action}`, limit) ) {
            const e = new Error('That is a lot of requests at once — give it a minute.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        await accounts.ensureAccount(identity);
        const me = { uid: identity.uid };

        const body = isGet ? {} : await readBody(req);

        let result;
        switch (action) {
            case 'request':
                result = await social.sendRequest(me, body.identifier);
                break;
            case 'accept':
                result = await social.acceptRequest(me, String(body.fromUid || ''));
                break;
            case 'decline':
                result = await social.declineRequest(me, String(body.uid || ''));
                break;
            case 'remove-friend':
                result = await social.removeFriend(me, String(body.uid || ''));
                break;
            case 'list':
                result = await social.listFriends(me);
                break;
            case 'create-group':
                result = await social.createGroup(me, body.name, body.memberUids);
                break;
            case 'list-groups':
                result = { groups: await social.listGroups(me) };
                break;
            case 'group':
                result = await social.getGroup(me, groupIdOf(req));
                break;
            case 'add-to-group':
                result = await social.addToGroup(me, String(body.groupId || ''), String(body.memberUid || ''));
                break;
            case 'remove-from-group':
                result = await social.removeFromGroup(me, String(body.groupId || ''), String(body.memberUid || ''));
                break;
            case 'delete-group':
                result = await social.deleteGroup(me, String(body.groupId || ''));
                break;
            default:
                return sendJson(res, 404, { error: { code: 'not_found', message: 'No such endpoint.' } });
        }
        sendJson(res, 200, result);
    } catch (err) {
        sendError(res, err);
    }
}

module.exports = handler;
module.exports._internal = {
    paramOf, groupIdOf,
    ROUTES: ['request', 'accept', 'decline', 'remove-friend', 'list',
        'create-group', 'list-groups', 'group', 'add-to-group', 'remove-from-group', 'delete-group'],
};
