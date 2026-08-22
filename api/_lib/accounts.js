/* ============================================================
   Email + password accounts
   ------------------------------------------------------------
   Storage and password handling for sign-in with an email address,
   alongside the existing WCA OAuth. Records live at /accounts/<uid>
   in the Realtime Database and are written ONLY by these serverless
   functions — the browser never reads that subtree, and the database
   rules must keep it closed. A password hash in a world-readable
   database is worse than no accounts at all, which is why every entry
   point here refuses to run unless storage is credentialed.

   Passwords are hashed with scrypt: a random 16-byte salt per
   account, and parameters recorded alongside the hash so they can be
   raised later without invalidating anyone.
   ============================================================ */
'use strict';

const crypto = require('crypto');
const rtdb = require('./rtdb.js');

// scrypt's cost. N=16384 is the node default and lands around 100ms on
// a serverless instance — slow enough to matter to someone guessing,
// fast enough not to be a denial of service against ourselves.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 16;

const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const NAME_MAX = 40;

class AccountError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = 'AccountError';
        this.status = status;
        this.code = code;
    }
}

function notConfigured() {
    return new AccountError(503, 'not_configured',
        'Accounts are not set up on this deployment yet.');
}

/**
 * A conservative address check.
 *
 * Not RFC 5322 — that grammar accepts things no mail system does, and
 * the only real proof an address works is sending to it. This rejects
 * what is obviously not an address and leaves the rest alone.
 */
function normalizeEmail(input) {
    const email = String(input == null ? '' : input).trim().toLowerCase();
    if (!email) throw new AccountError(400, 'bad_email', 'Enter your email address.');
    if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
        throw new AccountError(400, 'bad_email', "That doesn't look like an email address.");
    }
    return email;
}

function checkPassword(input) {
    const password = String(input == null ? '' : input);
    if (password.length < PASSWORD_MIN) {
        throw new AccountError(400, 'weak_password',
            `Use at least ${PASSWORD_MIN} characters for your password.`);
    }
    if (password.length > PASSWORD_MAX) {
        throw new AccountError(400, 'bad_password', 'That password is too long.');
    }
    return password;
}

function cleanName(input, email) {
    const name = String(input == null ? '' : input).trim().replace(/\s+/g, ' ');
    if (!name) return email.split('@')[0].slice(0, NAME_MAX) || 'Cuber';
    return name.slice(0, NAME_MAX);
}

/**
 * The account id for an address.
 *
 * A hash rather than the address itself, for two reasons: Firebase keys
 * cannot contain a dot, and this way the key list is not a list of our
 * users' email addresses. It is deterministic, so an address always
 * maps to the same account without an index to look it up in.
 */
function uidFor(email) {
    // Lowercased here as well as in normalizeEmail, so a caller that
    // forgets to normalize gets the same account rather than a second,
    // invisible one for the same person.
    const key = String(email == null ? '' : email).trim().toLowerCase();
    return 'acct_' + crypto.createHash('sha256')
        .update(`cubinghq:account:${key}`).digest('hex').slice(0, 24);
}

function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, SCRYPT.keylen,
            { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
            (err, key) => (err ? reject(err) : resolve(key)));
    });
}

/** `scrypt$N$r$p$<salt b64>$<hash b64>` — parameters travel with the hash. */
async function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const key = await scrypt(password, salt);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$`
        + `${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(stored, password) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, N, r, p, saltB64, hashB64] = parts;
    let expected, salt;
    try {
        salt = Buffer.from(saltB64, 'base64');
        expected = Buffer.from(hashB64, 'base64');
    } catch (e) { return false; }
    if (!salt.length || !expected.length) return false;

    let key;
    try {
        key = await new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, expected.length,
                { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
                (err, k) => (err ? reject(err) : resolve(k)));
        });
    } catch (e) { return false; }

    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** The stored record, or null. */
async function find(email) {
    if (!rtdb.isConfigured()) throw notConfigured();
    const uid = uidFor(email);
    let record;
    try { record = await rtdb.get(`accounts/${uid}`); } catch (e) {
        throw new AccountError(503, 'storage', 'Accounts are temporarily unavailable.');
    }
    return record ? Object.assign({ uid }, record) : null;
}

/**
 * Creates an account, or refuses if the address is taken.
 *
 * The check and the write are two calls, so two signups for one address
 * in the same instant could race. The loser overwrites the winner rather
 * than colliding, which is a rare and recoverable outcome — the database
 * offers no compare-and-set over REST, and a transaction endpoint is not
 * worth its weight for this.
 */
async function create({ email, password, name }) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const existing = await find(email);
    if (existing) {
        throw new AccountError(409, 'email_taken',
            'There is already an account with that email. Sign in instead.');
    }

    const uid = uidFor(email);
    const record = {
        email,
        name: cleanName(name, email),
        password: await hashPassword(password),
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
    };
    try { await rtdb.set(`accounts/${uid}`, record); } catch (e) {
        throw new AccountError(503, 'storage', 'Your account could not be saved. Try again shortly.');
    }
    return { uid, email, name: record.name };
}

/**
 * Checks an email and password.
 *
 * A wrong password and an address with no account return the SAME
 * error, on purpose: telling them apart turns this endpoint into a way
 * to ask whether someone has an account here.
 */
async function authenticate({ email, password }) {
    const wrong = () => new AccountError(401, 'bad_credentials',
        'That email and password do not match an account.');

    const record = await find(email);
    if (!record || !record.password) {
        // Spend comparable time either way, so the response time does not
        // answer the question the error refuses to.
        await hashPassword(password).catch(() => { });
        throw wrong();
    }
    if (!await verifyPassword(record.password, password)) throw wrong();

    // Best effort: a failed touch must not fail the sign-in.
    rtdb.patch(`accounts/${record.uid}`, { lastLoginAt: Date.now() })
        .catch(e => console.error('[accounts] could not record last login:', e.message));

    return { uid: record.uid, email: record.email, name: record.name || 'Cuber' };
}

/* ---- linking a WCA account --------------------------------------
   An email account can carry a WCA identity as well. The two are
   deliberately separate records: the link lives on the account, and a
   second entry under /wca_links maps the WCA id back to the account
   that claimed it.

   The index exists to keep one WCA account from being claimed by two
   CubingHQ accounts. Without it, two accounts would present the same
   competition record — and, because the battle system derives a
   player id from the WCA id, they would also BE the same player in a
   room. That is a correctness problem, not a policy one. */

/** WCA ids look like 2016SMIT01. Also a safe database key. */
function normalizeWcaId(input) {
    const id = String(input == null ? '' : input).trim().toUpperCase();
    if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(id)) {
        throw new AccountError(400, 'bad_wca_id', 'That does not look like a WCA ID.');
    }
    return id;
}

/** The account behind a session, or null. */
async function findByUid(uid) {
    if (!rtdb.isConfigured()) throw notConfigured();
    if (!/^[A-Za-z0-9_-]+$/.test(String(uid || ''))) {
        throw new AccountError(400, 'bad_uid', 'That sign-in is not valid.');
    }
    let record;
    try { record = await rtdb.get(`accounts/${uid}`); } catch (e) {
        throw new AccountError(503, 'storage', 'Accounts are temporarily unavailable.');
    }
    return record ? Object.assign({ uid }, record) : null;
}

/** Which account, if any, has claimed a WCA id. */
async function accountForWcaId(wcaId) {
    try { return await rtdb.get(`wca_links/${wcaId}`); } catch (e) {
        throw new AccountError(503, 'storage', 'Accounts are temporarily unavailable.');
    }
}

/**
 * Attaches a WCA identity to an account.
 *
 * The caller must have verified BOTH sides first: the session says
 * which account, and the WCA says which competitor. Nothing here comes
 * from the request.
 *
 * Re-linking the same id succeeds and changes nothing, so a client that
 * retries is not punished for it. Linking a different one is refused
 * while a link exists — unlink first, which is a deliberate act rather
 * than something a stray redirect can do.
 */
async function linkWca({ uid, wcaId, wcaName, wcaAccountId }) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const account = await findByUid(uid);
    if (!account) throw new AccountError(401, 'no_account', 'That sign-in is not valid.');

    if (account.wcaId && account.wcaId !== wcaId) {
        throw new AccountError(409, 'already_linked',
            'This account is already linked to a different WCA account. Unlink it first.');
    }

    const claimedBy = await accountForWcaId(wcaId);
    if (claimedBy && claimedBy !== uid) {
        throw new AccountError(409, 'wca_taken',
            'That WCA account is already linked to another CubingHQ account.');
    }

    const patch = {
        wcaId,
        wcaName: wcaName ? String(wcaName).slice(0, NAME_MAX) : null,
        wcaAccountId: wcaAccountId == null ? null : String(wcaAccountId),
        wcaLinkedAt: Date.now(),
    };
    try {
        // The index goes first. If the second write fails, the worst
        // case is an index entry pointing at an account that does not
        // claim it — which blocks nobody but this same account, and is
        // repaired by linking again. The other order could hand the same
        // WCA id to two accounts.
        await rtdb.set(`wca_links/${wcaId}`, uid);
        await rtdb.patch(`accounts/${uid}`, patch);
    } catch (e) {
        throw new AccountError(503, 'storage', 'That link could not be saved. Try again shortly.');
    }

    return {
        uid, email: account.email, name: account.name || 'Cuber',
        wcaId, wcaName: patch.wcaName,
    };
}

/** Detaches it again, freeing the WCA id for another account. */
async function unlinkWca(uid) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const account = await findByUid(uid);
    if (!account) throw new AccountError(401, 'no_account', 'That sign-in is not valid.');
    if (!account.wcaId) {
        return { uid, email: account.email, name: account.name || 'Cuber', wcaId: null };
    }

    try {
        // Account first here, for the same reason the other order is
        // right in linkWca: whichever write lands, no WCA id is ever
        // left claimable by two accounts at once.
        await rtdb.patch(`accounts/${uid}`, {
            wcaId: null, wcaName: null, wcaAccountId: null, wcaLinkedAt: null,
        });
        await rtdb.del(`wca_links/${account.wcaId}`);
    } catch (e) {
        throw new AccountError(503, 'storage', 'That could not be saved. Try again shortly.');
    }

    return { uid, email: account.email, name: account.name || 'Cuber', wcaId: null };
}

/** Stores (or clears) the account's profile picture. */
async function setAvatar(uid, avatar) {
    if (!rtdb.isConfigured()) throw notConfigured();

    const account = await findByUid(uid);
    if (!account) throw new AccountError(401, 'no_account', 'That sign-in is not valid.');

    try { await rtdb.patch(`accounts/${uid}`, { avatar: avatar || null }); } catch (e) {
        throw new AccountError(503, 'storage', 'That picture could not be saved. Try again shortly.');
    }
    return {
        uid, email: account.email, name: account.name || 'Cuber',
        wcaId: account.wcaId || null, avatar: avatar || null,
    };
}

/**
 * Everything a signed-in client needs about itself.
 *
 * The session token carries a uid, a name and a WCA id, which is enough
 * for authorization and deliberately not enough for a profile — a
 * picture has no business inside a token that travels on every request.
 * So this reads the record, and the caller decides what to do when
 * storage is unavailable.
 */
async function publicProfile(uid) {
    const account = await findByUid(uid);
    if (!account) return null;
    return {
        uid,
        email: account.email || null,
        name: account.name || 'Cuber',
        wcaId: account.wcaId || null,
        avatar: account.avatar || null,
    };
}

/**
 * The account record behind an identity, creating a minimal one if
 * none exists.
 *
 * Signing in with an email always makes a row here (accounts.create).
 * Signing in with the WCA never has: that path issues no CubingHQ
 * session at all, just verifies a WCA token per request, so there was
 * never a moment to write one. Friends and groups need somewhere to
 * read a name and a picture from, so the first time such a sign-in
 * touches either, a stand-in row is created from what the WCA already
 * told us — nothing the person had to type twice.
 *
 * `identity` is whatever resolveSignedInUser produced: real fields
 * for an email session, WCA-sourced ones for a bare WCA token.
 */
async function ensureAccount(identity) {
    if (!rtdb.isConfigured()) throw notConfigured();

    let account = await findByUid(identity.uid);
    if (account) return account;

    const record = {
        name: (identity.name || 'Cuber').slice(0, NAME_MAX),
        email: identity.email || null,
        wcaId: identity.wcaId || null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        // Distinguishes a real account from this stand-in: nobody has
        // set a password, and `email` above is always null for it — the
        // WCA branch of resolveSignedInUser never carries one — so a
        // later email signup can never collide with it.
        provisional: true,
    };
    try { await rtdb.set(`accounts/${identity.uid}`, record); } catch (e) {
        throw new AccountError(503, 'storage', 'Your account could not be prepared. Try again shortly.');
    }
    return Object.assign({ uid: identity.uid }, record);
}

module.exports = {
    normalizeEmail, checkPassword, cleanName, uidFor,
    hashPassword, verifyPassword, find, create, authenticate,
    findByUid, accountForWcaId, linkWca, unlinkWca, normalizeWcaId,
    setAvatar, publicProfile, ensureAccount,
    AccountError, PASSWORD_MIN, PASSWORD_MAX, NAME_MAX,
};
