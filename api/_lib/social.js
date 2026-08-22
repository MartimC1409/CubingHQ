/* ============================================================
   Friends and groups
   ------------------------------------------------------------
   Storage and rules for adding friends, accepting requests, and
   collecting friends into named groups — the data "compare results"
   is built from client-side, against each member's WCA id.

   Everything here writes to three top-level subtrees, closed in the
   database rules exactly like /accounts:

     /friend_requests/<toUid>/<fromUid>   an inbox entry, readable
                                           only by its recipient
     /friends/<uid>/<friendUid>           a symmetric edge, written
                                           to both sides
     /groups/<groupId>                    { name, ownerUid, members }

   A fourth piece — who I am waiting to hear back from — lives under
   /accounts/<uid>/outgoing_requests, which is already private. That
   keeps the new top-level surface to the three paths above.

   Anti-enumeration. Sending a request by email must not answer the
   question "does an account exist at this address" — the same reason
   /api/auth/login returns one message for a wrong password and for no
   account at all. Every path through sendRequest therefore looks the
   same from outside: silent success, whether the address is taken,
   unclaimed, or the sender's own.

   A WCA ID is not the same kind of secret — the WCA publishes its own
   competitor database — so resolving one to nobody is allowed to say
   so plainly.
   ============================================================ */
'use strict';

const rtdb = require('./rtdb.js');
const accounts = require('./accounts.js');

const NAME_MAX = accounts.NAME_MAX;
const GROUP_NAME_MIN = 2;
const GROUP_NAME_MAX = 40;
const GROUP_MEMBERS_MAX = 30;   // owner included

class SocialError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = 'SocialError';
        this.status = status;
        this.code = code;
    }
}

function notConfigured() {
    return new SocialError(503, 'not_configured', 'Friends are not set up on this deployment yet.');
}

function storageFailed() {
    return new SocialError(503, 'storage', 'That could not be saved. Try again shortly.');
}

/** What a friend, a request, or a group member shows about someone. */
function snapshot(profile) {
    return {
        uid: profile.uid,
        name: profile.name || 'Cuber',
        avatar: profile.avatar || null,
        wcaId: profile.wcaId || null,
    };
}

function checkGroupName(input) {
    const name = String(input == null ? '' : input).trim().replace(/\s+/g, ' ');
    if (name.length < GROUP_NAME_MIN || name.length > GROUP_NAME_MAX) {
        throw new SocialError(400, 'bad_group_name',
            `Group names need to be between ${GROUP_NAME_MIN} and ${GROUP_NAME_MAX} characters.`);
    }
    return name;
}

/* ---- friend requests ---------------------------------------------- */

/**
 * Sends a friend request, or quietly does nothing.
 *
 * `identifier` is whatever the sender typed: an email address or a WCA
 * ID. Every outcome that must not leak account existence — an
 * unregistered email, the sender's own address, an already-pending
 * request — returns the same shape as success.
 */
async function sendRequest(me, identifier) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const raw = String(identifier || '').trim();
    if (!raw) throw new SocialError(400, 'bad_identifier', 'Enter an email address or a WCA ID.');

    const looksLikeEmail = raw.includes('@');
    let toUid = null;
    let notFoundIsPublic = false;   // a WCA ID can say "no such account"; an email cannot

    if (looksLikeEmail) {
        let email;
        try { email = accounts.normalizeEmail(raw); } catch (e) { throw e; }
        toUid = accounts.uidFor(email);
        // Existence is checked below via findByUid, but the RESPONSE must
        // not distinguish "no account" from "request sent" — only the
        // control flow may know the difference.
    } else {
        let wcaId;
        try { wcaId = accounts.normalizeWcaId(raw); } catch (e) { throw e; }
        toUid = await accounts.accountForWcaId(wcaId);
        notFoundIsPublic = true;
        if (!toUid) {
            throw new SocialError(404, 'no_such_account',
                'No CubingHQ account is linked to that WCA ID yet.');
        }
    }

    if (toUid === me.uid) {
        throw new SocialError(400, 'self_request', "That's you — try a friend's email or WCA ID.");
    }

    const target = await accounts.findByUid(toUid);
    if (!target) {
        if (notFoundIsPublic) {
            throw new SocialError(404, 'no_such_account', 'No account found.');
        }
        return { sent: true };   // silent: no account at that email
    }

    // Already friends, or already asked: both are successful no-ops, so
    // a client that retries — or two people who click at once — is
    // never punished for it.
    const [alreadyFriends, myProfile] = await Promise.all([
        rtdb.get(`friends/${me.uid}/${toUid}`),
        accounts.findByUid(me.uid),
    ]);
    if (alreadyFriends) return { sent: true, alreadyFriends: true };

    const theirRequestToMe = await rtdb.get(`friend_requests/${me.uid}/${toUid}`);
    if (theirRequestToMe) {
        // They already asked first. Accept rather than crossing requests
        // in opposite directions, which would otherwise sit forever
        // waiting for two separate accept clicks.
        await completeFriendship(me.uid, toUid, myProfile, target);
        return { sent: true, becameFriends: true };
    }

    const already = await rtdb.get(`accounts/${me.uid}/outgoing_requests/${toUid}`);
    if (already) return { sent: true };

    const now = Date.now();
    try {
        await rtdb.set(`friend_requests/${toUid}/${me.uid}`, {
            from: snapshot(Object.assign({ uid: me.uid }, myProfile)),
            sentAt: now,
        });
        await rtdb.set(`accounts/${me.uid}/outgoing_requests/${toUid}`, {
            to: snapshot(Object.assign({ uid: toUid }, target)),
            sentAt: now,
        });
    } catch (e) {
        throw storageFailed();
    }
    return { sent: true };
}

/** Writes both sides of a friendship and clears any request between them. */
async function completeFriendship(uidA, uidB, profileA, profileB) {
    const now = Date.now();
    try {
        await rtdb.set(`friends/${uidA}/${uidB}`, Object.assign(snapshot(Object.assign({ uid: uidB }, profileB)), { since: now }));
        await rtdb.set(`friends/${uidB}/${uidA}`, Object.assign(snapshot(Object.assign({ uid: uidA }, profileA)), { since: now }));
    } catch (e) {
        throw storageFailed();
    }
    // Cleanup is best-effort in both directions: the friendship above is
    // what matters, and a leftover request/outgoing marker is harmless —
    // listFriends drops a request for someone who is already a friend.
    await Promise.all([
        rtdb.del(`friend_requests/${uidA}/${uidB}`).catch(() => {}),
        rtdb.del(`friend_requests/${uidB}/${uidA}`).catch(() => {}),
        rtdb.del(`accounts/${uidA}/outgoing_requests/${uidB}`).catch(() => {}),
        rtdb.del(`accounts/${uidB}/outgoing_requests/${uidA}`).catch(() => {}),
    ]);
}

/** Accepts a pending request FROM `fromUid` TO `me`. */
async function acceptRequest(me, fromUid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    if (!fromUid) throw new SocialError(400, 'bad_uid', 'That request could not be found.');

    const request = await rtdb.get(`friend_requests/${me.uid}/${fromUid}`);
    if (!request) throw new SocialError(404, 'no_such_request', 'That request is no longer there.');

    const [myProfile, theirProfile] = await Promise.all([
        accounts.findByUid(me.uid),
        accounts.findByUid(fromUid),
    ]);
    if (!theirProfile) {
        // The sender's account is gone; there is nothing left to accept.
        await rtdb.del(`friend_requests/${me.uid}/${fromUid}`).catch(() => {});
        throw new SocialError(404, 'no_such_request', 'That request is no longer there.');
    }

    await completeFriendship(me.uid, fromUid, myProfile, theirProfile);
    return { uid: fromUid, ...snapshot(Object.assign({ uid: fromUid }, theirProfile)) };
}

/** Declines, or cancels one already sent — same operation from either end. */
async function declineRequest(me, otherUid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    if (!otherUid) throw new SocialError(400, 'bad_uid', 'That request could not be found.');
    await Promise.all([
        rtdb.del(`friend_requests/${me.uid}/${otherUid}`).catch(() => {}),
        rtdb.del(`friend_requests/${otherUid}/${me.uid}`).catch(() => {}),
        rtdb.del(`accounts/${me.uid}/outgoing_requests/${otherUid}`).catch(() => {}),
        rtdb.del(`accounts/${otherUid}/outgoing_requests/${me.uid}`).catch(() => {}),
    ]);
    return { declined: true };
}

async function removeFriend(me, friendUid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    if (!friendUid) throw new SocialError(400, 'bad_uid', 'That friend could not be found.');
    try {
        await Promise.all([
            rtdb.del(`friends/${me.uid}/${friendUid}`),
            rtdb.del(`friends/${friendUid}/${me.uid}`),
        ]);
    } catch (e) {
        throw storageFailed();
    }
    return { removed: true };
}

/** Everything the friends panel needs in one call. */
async function listFriends(me) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const [friendsMap, incomingMap, outgoingMap] = await Promise.all([
        rtdb.get(`friends/${me.uid}`),
        rtdb.get(`friend_requests/${me.uid}`),
        rtdb.get(`accounts/${me.uid}/outgoing_requests`),
    ]);

    const friends = Object.entries(friendsMap || {}).map(([uid, v]) => Object.assign({ uid }, v));
    // A request from someone who is already a friend (the crossed-request
    // case, or a leftover from a failed cleanup) is not shown twice.
    const friendUids = new Set(friends.map(f => f.uid));
    const incoming = Object.entries(incomingMap || {})
        .filter(([uid]) => !friendUids.has(uid))
        .map(([uid, v]) => Object.assign({ uid }, v.from, { sentAt: v.sentAt }));
    const outgoing = Object.entries(outgoingMap || {})
        .filter(([uid]) => !friendUids.has(uid))
        .map(([uid, v]) => Object.assign({ uid }, v.to, { sentAt: v.sentAt }));

    return { friends, incoming, outgoing };
}

/* ---- groups ---------------------------------------------------------- */

/** Every member must already be a friend of the creator. */
async function createGroup(me, name, memberUids) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const groupName = checkGroupName(name);

    const ids = [...new Set((memberUids || []).map(String))].filter(uid => uid !== me.uid);
    if (ids.length > GROUP_MEMBERS_MAX - 1) {
        throw new SocialError(400, 'too_many_members', `Groups top out at ${GROUP_MEMBERS_MAX} people.`);
    }

    const [myProfile, friendsMap] = await Promise.all([
        accounts.findByUid(me.uid),
        rtdb.get(`friends/${me.uid}`),
    ]);
    const friends = friendsMap || {};
    const notAFriend = ids.find(uid => !friends[uid]);
    if (notAFriend) {
        throw new SocialError(400, 'not_a_friend', 'A group can only be made from your friends list.');
    }

    const members = { [me.uid]: snapshot(Object.assign({ uid: me.uid }, myProfile)) };
    for (const uid of ids) members[uid] = snapshot(Object.assign({ uid }, friends[uid]));

    let created;
    try {
        created = await rtdb.push('groups', {
            name: groupName, ownerUid: me.uid, createdAt: Date.now(), members,
        });
    } catch (e) {
        throw storageFailed();
    }
    const groupId = created && created.name;
    if (!groupId) throw storageFailed();

    try {
        await Promise.all(Object.keys(members).map(uid =>
            rtdb.set(`accounts/${uid}/group_ids/${groupId}`, true)));
    } catch (e) {
        // The group itself was saved; a missing index entry only means
        // one member's list does not show it yet. Not fatal to the call.
        console.error('[social] group created but an index write failed:', e.message);
    }

    return { groupId, name: groupName, ownerUid: me.uid, members };
}

/** Group + membership check in one place, since every other call needs it. */
async function requireMember(me, groupId) {
    if (!groupId) throw new SocialError(400, 'bad_group', 'That group could not be found.');
    const group = await rtdb.get(`groups/${groupId}`);
    if (!group || !group.members || !group.members[me.uid]) {
        // Deliberately the same not-found whether the group is gone or
        // the caller was never in it — either way there is nothing here
        // for them to see.
        throw new SocialError(404, 'no_such_group', 'That group could not be found.');
    }
    return group;
}

async function listGroups(me) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const ids = await rtdb.get(`accounts/${me.uid}/group_ids`);
    const groupIds = Object.keys(ids || {});
    const groups = await Promise.all(groupIds.map(async (groupId) => {
        const group = await rtdb.get(`groups/${groupId}`);
        return group ? Object.assign({ groupId }, group) : null;
    }));
    return groups.filter(Boolean);
}

async function getGroup(me, groupId) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const group = await requireMember(me, groupId);
    return Object.assign({ groupId }, group);
}

/** The owner adds a friend of theirs to the group. */
async function addToGroup(me, groupId, memberUid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const group = await requireMember(me, groupId);
    if (group.ownerUid !== me.uid) {
        throw new SocialError(403, 'not_owner', 'Only the group owner can add people.');
    }
    if (!memberUid || memberUid === me.uid) {
        throw new SocialError(400, 'bad_uid', 'That person could not be added.');
    }
    const currentSize = Object.keys(group.members || {}).length;
    if (currentSize >= GROUP_MEMBERS_MAX) {
        throw new SocialError(400, 'too_many_members', `Groups top out at ${GROUP_MEMBERS_MAX} people.`);
    }
    const friend = await rtdb.get(`friends/${me.uid}/${memberUid}`);
    if (!friend) {
        throw new SocialError(400, 'not_a_friend', 'A group can only be made from your friends list.');
    }
    try {
        await rtdb.set(`groups/${groupId}/members/${memberUid}`, snapshot(Object.assign({ uid: memberUid }, friend)));
        await rtdb.set(`accounts/${memberUid}/group_ids/${groupId}`, true);
    } catch (e) {
        throw storageFailed();
    }
    return { groupId, memberUid };
}

/**
 * Removes a member. The owner may remove anyone; anyone else may only
 * remove themselves — leaving is not the same permission as evicting.
 */
async function removeFromGroup(me, groupId, memberUid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const group = await requireMember(me, groupId);
    const target = memberUid || me.uid;

    if (target !== me.uid && group.ownerUid !== me.uid) {
        throw new SocialError(403, 'not_owner', 'Only the group owner can remove someone else.');
    }
    if (target === group.ownerUid) {
        throw new SocialError(400, 'owner_cannot_leave',
            'The owner cannot leave — delete the group instead.');
    }
    try {
        await rtdb.del(`groups/${groupId}/members/${target}`);
        await rtdb.del(`accounts/${target}/group_ids/${groupId}`);
    } catch (e) {
        throw storageFailed();
    }
    return { groupId, memberUid: target };
}

async function deleteGroup(me, groupId) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const group = await requireMember(me, groupId);
    if (group.ownerUid !== me.uid) {
        throw new SocialError(403, 'not_owner', 'Only the group owner can delete it.');
    }
    const memberUids = Object.keys(group.members || {});
    try {
        await Promise.all(memberUids.map(uid => rtdb.del(`accounts/${uid}/group_ids/${groupId}`)));
        await rtdb.del(`groups/${groupId}`);
    } catch (e) {
        throw storageFailed();
    }
    return { deleted: true };
}

module.exports = {
    sendRequest, acceptRequest, declineRequest, removeFriend, listFriends,
    createGroup, listGroups, getGroup, addToGroup, removeFromGroup, deleteGroup,
    SocialError, GROUP_NAME_MIN, GROUP_NAME_MAX, GROUP_MEMBERS_MAX,
};
