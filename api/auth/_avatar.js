/* ============================================================
   POST /api/auth/avatar

     Authorization: Bearer <session token>
     { avatar: "data:image/jpeg;base64,..." }  or  { avatar: null }

   A profile picture for an email account.

   A WCA sign-in already has one — the WCA serves it — but an account
   made with an email address had nothing, and fell back to the WCA's
   grey silhouette placeholder: a picture of nobody, served from
   someone else's site.

   The image arrives as a data URI already resized by the browser, and
   is stored as one on the account record. That is not how anyone would
   build an image host, and it is not one: at this size a picture is
   smaller than the JSON around it, and the alternative is object
   storage, a bucket policy, signed URLs and a second thing to
   configure. The cap below is what keeps that true.
   ============================================================ */
'use strict';

const { sendJson, sendError, readBody, methodGuard } = require('../_lib/http.js');
const accounts = require('../_lib/accounts.js');
const session = require('../_lib/session.js');
const rate = require('../_lib/ratelimit.js');

// Comfortably above a 256px JPEG and far below anything worth storing
// in a database row.
const MAX_AVATAR_BYTES = 96 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

/**
 * Checks the string really is a small image and nothing else.
 *
 * This value is written into other people's pages later, so "it starts
 * with data:image" is not enough: `data:image/svg+xml` is a document
 * that can carry script, and is not in the list above for that reason.
 */
function checkAvatar(value) {
    const bad = (message) => {
        const e = new Error(message);
        e.status = 400; e.code = 'bad_avatar';
        return e;
    };

    const uri = String(value);
    const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
    if (!m) throw bad('That picture could not be read. Try another one.');

    const [, mime, b64] = m;
    if (!ALLOWED.includes(mime)) {
        throw bad('Use a JPEG, PNG or WebP image.');
    }
    if (Buffer.byteLength(uri, 'utf8') > MAX_AVATAR_BYTES) {
        throw bad('That picture is too large. Try a smaller one.');
    }

    // Decodes, and decodes back to the same thing: a base64 string the
    // regex accepts can still be malformed, and a value that is not
    // really an image should not reach the account record.
    let bytes;
    try { bytes = Buffer.from(b64, 'base64'); } catch (e) { throw bad('That picture could not be read.'); }
    if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== b64.replace(/=+$/, '')) {
        throw bad('That picture could not be read. Try another one.');
    }

    // The first bytes of the file must match what it claims to be, so a
    // mislabelled file is refused here rather than by whatever opens it.
    const magic = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/webp': [0x52, 0x49, 0x46, 0x46],
    }[mime];
    if (!magic.every((b, i) => bytes[i] === b)) {
        throw bad('That file is not the image type it claims to be.');
    }

    return uri;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    try {
        const header = req.headers.authorization || req.headers.Authorization || '';
        const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
        const me = match && session.verify(match[1].trim());
        if (!me) {
            const e = new Error('Sign in again to change your picture.');
            e.status = 401; e.code = 'invalid_session';
            throw e;
        }

        if (!rate.take(`avatar:${me.uid}`, LIMIT)) {
            const e = new Error('That is a lot of pictures. Try again later.');
            e.status = 429; e.code = 'rate_limited';
            throw e;
        }

        const body = await readBody(req);
        const raw = body && body.avatar;
        // null clears it, which is the only way back to no picture.
        const avatar = (raw === null || raw === '') ? null : checkAvatar(raw);

        const user = await accounts.setAvatar(me.uid, avatar);
        sendJson(res, 200, { user });
    } catch (err) {
        sendError(res, err);
    }
};

module.exports._internal = { checkAvatar, MAX_AVATAR_BYTES, ALLOWED };
