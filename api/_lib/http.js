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
    sendJson(res, status, { error: { code, message } });
}

/** Rejects anything but the listed methods. */
function methodGuard(req, res, allowed) {
    if (allowed.includes(req.method)) return true;
    res.setHeader('Allow', allowed.join(', '));
    sendJson(res, 405, { error: { code: 'method', message: 'Method not allowed.' } });
    return false;
}

/** Body as an object. Vercel usually parses it; fall back to reading it. */
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

module.exports = { sendJson, sendError, methodGuard, readBody, openStream };
