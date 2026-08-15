/* ============================================================
   Coach API — request/response helpers
   ------------------------------------------------------------
   Shared plumbing so every handler fails the same way. The error
   shape { error: { code, message } } is what the client's error
   taxonomy keys off, and `message` is always something we are happy
   to show a user verbatim.
   ============================================================ */
'use strict';

const MAX_BODY_BYTES = 5 * 1024 * 1024;   // generous for a big session import

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

function sendError(res, err) {
    const status = err && err.status ? err.status : 500;
    const code = (err && err.code) || 'internal';
    const message = (err && err.message) || 'Something went wrong.';
    if (status >= 500) console.error(`[api] ${code}:`, err);

    // `step` and `detail` are diagnostics, not prose: the client shows
    // them in a collapsed technical block rather than as the message.
    // They exist because problems here get reported by screenshot, and a
    // screenshot cannot show a server log — several rounds were spent
    // asking for a log line that this puts on the page instead. Set only
    // where a handler chose to; `detail` is redacted at its source.
    const error = { code, message };
    if (err && err.step) error.step = err.step;
    if (err && err.detail) error.detail = err.detail;

    sendJson(res, status, { error });
}

/** Rejects anything but the listed methods. */
function methodGuard(req, res, allowed) {
    if (allowed.includes(req.method)) return true;
    res.setHeader('Allow', allowed.join(', '));
    sendJson(res, 405, { error: { code: 'method', message: 'Method not allowed.' } });
    return false;
}

/** Body as an object. Vercel usually parses it; fall back to reading it. */
function tooLarge() {
    const err = new Error('That upload was too large to send this way.');
    err.status = 413; err.code = 'too_large';
    return err;
}

/**
 * The request body as raw bytes.
 *
 * Separate from readBody because video is not JSON and base64 would
 * inflate it by a third — which matters when the whole point is fitting
 * under a platform body limit.
 *
 * `req.body` is checked first for the same reason readBody checks it:
 * the platform buffers the request before the handler runs, and a body
 * whose content type it does not recognise — `application/octet-stream`,
 * which is exactly what a video chunk is sent as — arrives as a Buffer
 * with the underlying stream already drained. Iterating `req` in that
 * case yields nothing at all, so every chunk would look empty while the
 * client had sent it perfectly well.
 */
async function readRawBody(req, maxBytes) {
    const cap = maxBytes || MAX_BODY_BYTES;

    if (Buffer.isBuffer(req.body)) {
        if (req.body.length > cap) throw tooLarge();
        return req.body;
    }
    // A string means the platform decoded the body as text, and a UTF-8
    // decode of arbitrary bytes is lossy — re-encoding would hand Google
    // a video that is subtly wrong rather than one that failed. Refuse
    // instead: a corrupted upload fails later, somewhere else, for no
    // visible reason, which is far worse than an error that says this.
    if (typeof req.body === 'string') {
        const err = new Error('That upload could not be read as raw bytes.');
        err.status = 400; err.code = 'bad_body';
        console.error('[http] raw body arrived decoded as a string — check the '
            + 'request Content-Type is application/octet-stream');
        throw err;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > cap) throw tooLarge();
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch (e) {
            const err = new Error('The request body was not valid JSON.');
            err.status = 400; err.code = 'bad_body';
            throw err;
        }
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            const err = new Error('That request was too large.');
            err.status = 413; err.code = 'too_large';
            throw err;
        }
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) {
        const err = new Error('The request body was not valid JSON.');
        err.status = 400; err.code = 'bad_body';
        throw err;
    }
}

/**
 * Server-sent events.
 *
 * Used so the client can show what the Coach is actually doing rather
 * than a spinner, and so long model calls don't sit behind a silent
 * connection. Progress events are emitted when a real pipeline step
 * happens, not on a timer.
 */
function openStream(res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Defeats proxy buffering, which would otherwise batch the whole
    // stream into one chunk at the end and defeat the point.
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let closed = false;
    res.on('close', () => { closed = true; });

    const send = (event, data) => {
        if (closed) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    return {
        progress: (stage, label) => send('progress', { stage, label }),
        delta: (text) => send('delta', { text }),
        result: (payload) => send('result', payload),
        fail: (err) => send('error', {
            code: (err && err.code) || 'internal',
            message: (err && err.message) || 'Something went wrong.',
        }),
        close: () => { if (!closed) { send('done', {}); res.end(); } },
        get closed() { return closed; },
    };
}

module.exports = { sendJson, sendError, methodGuard, readBody, readRawBody, openStream };
