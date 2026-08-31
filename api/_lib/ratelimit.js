/* ============================================================
   Shared rate limiting
   ------------------------------------------------------------
   Per instance and in memory, which is the honest description: a
   platform running several instances multiplies every limit here, and
   a cold start forgets everything. That is fine for what these are
   for — making a flood or a guessing run cost something — and it is
   not fine as a correctness guarantee, so nothing here is load-bearing
   for authorization.
   ============================================================ */
'use strict';

const buckets = new Map();
const MAX_KEYS = 5000;

/**
 * The caller's address.
 *
 * x-forwarded-for is client-controlled in general; behind Vercel the
 * leftmost entry is the real peer, and that is the only deployment this
 * runs on. A forged header spreads one attacker across many buckets,
 * which is why nothing security-critical rests on these limits.
 */
function clientIp(req) {
    const fwd = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    const first = String(fwd || '').split(',')[0].trim();
    return first || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/**
 * Records one hit against `key`.
 * @returns true when the caller is within the limit, false when over.
 */
function take(key, { max, windowMs }) {
    const now = Date.now();
    // Bounded so a spray of forged keys cannot grow this without limit.
    // The oldest entry goes; the worst case is a limiter that forgets
    // someone, which is the failure mode to prefer here.
    if (buckets.size > MAX_KEYS) buckets.delete(buckets.keys().next().value);

    const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) {
        buckets.set(key, hits);
        return false;
    }
    hits.push(now);
    buckets.set(key, hits);
    return true;
}

/** Seconds until `key` frees up, for a Retry-After. */
function retryAfter(key, { windowMs }) {
    const hits = buckets.get(key) || [];
    if (!hits.length) return 0;
    return Math.max(1, Math.ceil((windowMs - (Date.now() - hits[0])) / 1000));
}

/** Test seam. */
function _reset() { buckets.clear(); }

module.exports = { take, retryAfter, clientIp, _reset };
