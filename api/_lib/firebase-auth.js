/* ============================================================
   Firebase Realtime Database — server credentials
   ------------------------------------------------------------
   One place that answers "how does this server prove who it is to
   the database", because there are now two answers and every caller
   wants the same one.

     FIREBASE_SERVICE_ACCOUNT_JSON — the current mechanism. The JSON
       from Firebase console → Project settings → Service accounts →
       Generate new private key, either verbatim or base64-encoded
       (some hosts mangle multi-line values, so both are accepted).
       Signed into a short-lived OAuth access token here, with no
       dependencies: RS256 is a `crypto.createSign` call.

     FIREBASE_DB_SECRET — the legacy database secret. Still honoured
       because a deployment that has one working should not break on
       the day this file lands, but it is deprecated by Google and the
       service account is the one to set.

   Neither is required. With no credential the request goes out
   unauthenticated, which is exactly what the browser used to do — the
   database's own rules then decide. That keeps a deployment that never
   locked its rules working instead of failing closed on an upgrade.
   ============================================================ */
'use strict';

const crypto = require('crypto');

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPES = [
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Google's tokens last an hour. Renew a minute early so a request can
// never be issued with a token that expires while it is in flight.
const RENEW_SKEW_MS = 60 * 1000;

let cached = null;         // { token, expiresAt }
let inFlight = null;       // dedupes concurrent mints within one instance

/** The service account object, or null when none is configured. */
function serviceAccount() {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (!raw) return null;

    let text = raw;
    // Base64 is offered because a JSON blob with newlines is awkward in
    // several dashboards; detect it rather than requiring a second var.
    if (!text.startsWith('{')) {
        try { text = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) { /* reported below */ }
    }

    let sa;
    try { sa = JSON.parse(text); } catch (e) {
        console.error('[firebase-auth] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON '
            + '(raw or base64) — the database will be called unauthenticated');
        return null;
    }
    if (!sa || !sa.client_email || !sa.private_key) {
        console.error('[firebase-auth] FIREBASE_SERVICE_ACCOUNT_JSON is missing '
            + 'client_email or private_key');
        return null;
    }
    // Dashboards commonly store the key with literal backslash-n.
    sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
    return sa;
}

function b64url(input) {
    return Buffer.from(input).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintAccessToken(sa) {
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = sa.token_uri || TOKEN_URI;
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
        iss: sa.client_email, scope: SCOPES, aud: tokenUri,
        iat: now, exp: now + 3600,
    };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

    let assertion;
    try {
        const sig = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key);
        assertion = `${signingInput}.${b64url(sig)}`;
    } catch (e) {
        // A malformed private_key is an operator problem and produces an
        // otherwise baffling 401 much later, so name it here.
        console.error('[firebase-auth] could not sign with private_key — check that the '
            + 'PEM survived the environment variable intact:', e.message);
        return null;
    }

    let res;
    try {
        res = await fetch(tokenUri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion,
            }).toString(),
            signal: AbortSignal.timeout(10000),
        });
    } catch (e) {
        console.error('[firebase-auth] token endpoint unreachable:', e.message);
        return null;
    }

    const text = await res.text().catch(() => '');
    if (!res.ok) {
        console.error(`[firebase-auth] token endpoint returned ${res.status}: ${text.slice(0, 200)}`);
        return null;
    }
    let body;
    try { body = JSON.parse(text); } catch (e) { body = null; }
    if (!body || !body.access_token) {
        console.error('[firebase-auth] token response carried no access_token');
        return null;
    }
    const ttlMs = (Number(body.expires_in) || 3600) * 1000;
    return { token: body.access_token, expiresAt: Date.now() + ttlMs - RENEW_SKEW_MS };
}

/** A valid access token for the configured service account, or null. */
async function accessToken() {
    const sa = serviceAccount();
    if (!sa) return null;
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    if (!inFlight) {
        inFlight = mintAccessToken(sa).finally(() => { inFlight = null; });
    }
    const minted = await inFlight;
    if (!minted) return null;
    cached = minted;
    return cached.token;
}

/**
 * How to authenticate one request, as parts a caller can apply:
 *
 *   { kind, headers, query }
 *
 * `query` is a URL query fragment without a leading ? or &, used for the
 * legacy secret (which has no header form). `kind` is for logging and
 * diagnostics — it is a mechanism name, never a credential.
 */
async function authorize() {
    const token = await accessToken();
    if (token) {
        return { kind: 'service_account', headers: { Authorization: `Bearer ${token}` }, query: '' };
    }
    if (serviceAccount()) {
        // Configured but unusable. Falling through to the legacy secret
        // or to anonymous would hide a broken credential behind a
        // permission error; say which one failed.
        return { kind: 'service_account_failed', headers: {}, query: '' };
    }
    const secret = (process.env.FIREBASE_DB_SECRET || '').trim();
    if (secret) {
        return { kind: 'secret', headers: {}, query: `auth=${encodeURIComponent(secret)}` };
    }
    return { kind: 'none', headers: {}, query: '' };
}

/** True when some credential is configured (not that it works). */
function hasCredential() {
    return !!(serviceAccount() || (process.env.FIREBASE_DB_SECRET || '').trim());
}

/** The variable an operator should set, for diagnostics. */
const CREDENTIAL_VAR = 'FIREBASE_SERVICE_ACCOUNT_JSON';

/** Test seam: drops the cached access token. */
function _resetCache() { cached = null; inFlight = null; }

module.exports = { authorize, accessToken, hasCredential, CREDENTIAL_VAR, _resetCache };
