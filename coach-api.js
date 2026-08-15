/* ============================================================
   CubingHQ Coach — API client
   ------------------------------------------------------------
   Talks to /api/coach/*. Two things it does beyond fetch:

   1. Reads server-sent events, so the UI can show what the Coach is
      actually doing (§38) instead of a spinner.
   2. Normalises every failure into a CoachError with a stable `code`,
      so callers can react to "not configured" differently from "the
      network died" — and so the user never sees a raw exception.

   Exposed as window.CoachAPI.
   ============================================================ */
(function () {
    'use strict';

    const WCA_TOKEN_KEY = 'wca_access_token';

    // Guarded the same way every other coach module guards it, so load
    // order cannot matter: these are only ever read at failure time.
    const T = (key, fallback) => (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);

    class CoachError extends Error {
        constructor(code, message, status) {
            super(message);
            this.name = 'CoachError';
            this.code = code;
            this.status = status || 0;
        }
    }

    // Messages the user actually sees. Written for a cuber, not a developer.
    const FRIENDLY = {
        offline: "You're offline. The Coach needs a connection for this — your data is safe on this device.",
        timeout: 'The Coach took too long to answer. Try again.',
        rate_limited: 'The Coach is busy right now. Give it a moment and try again.',
        // Separate from rate_limited because the remedy is different, and
        // "give it a moment" is actively wrong here — waiting never fixes
        // a spent allowance.
        no_credit: 'The Coach has reached its usage limit for now. It should be back later today.',
        video_unavailable: 'Video analysis is not switched on for this site yet.',
        video_failed: "That video couldn't be read. Try a different file or format.",
        too_large: 'That video is too large. A single solve is all I need.',
        not_configured: 'The Coach is not switched on for this deployment yet.',
        sync_unavailable: 'Cloud sync is off, so your coaching data is saved on this device only.',
        no_token: 'Sign in with your WCA account to sync across devices.',
        invalid_token: 'Your WCA sign-in expired. Sign in again to keep syncing.',
        upstream: 'The Coach had a problem at its end. Try again shortly.',
        // Both of these were reaching the user as `unknown`, which meant
        // the server's own English sentence was shown verbatim on a
        // Portuguese page. They are separate faults with separate
        // remedies, so they say separate things.
        bad_upload: 'That upload was rejected partway through. Pick the video again.',
        network: "The Coach couldn't reach the analysis service. Try again shortly.",
        unknown: 'Something went wrong at the Coach\'s end. Try again shortly.',
        internal: 'Something went wrong. Try again.',
    };

    // The English above is the fallback, not the string that ships: every
    // other user-visible sentence on this page is translated, and an
    // error is the worst place to drop back into another language.
    function friendly(code, fallback) {
        if (FRIENDLY[code]) return T('coach.err.' + code, FRIENDLY[code]);
        return fallback || T('coach.err.internal', FRIENDLY.internal);
    }

    function authHeaders() {
        let token = null;
        try { token = localStorage.getItem(WCA_TOKEN_KEY); } catch (e) { }
        const h = { 'Content-Type': 'application/json' };
        if (token) h.Authorization = 'Bearer ' + token;
        return h;
    }

    async function toError(res) {
        let body = null;
        try { body = await res.json(); } catch (e) { }
        const err = (body && body.error) || {};
        return new CoachError(
            err.code || 'internal',
            friendly(err.code, err.message),
            res.status
        );
    }

    async function requestJSON(path, options) {
        if (!navigator.onLine) throw new CoachError('offline', friendly('offline'));
        let res;
        try {
            res = await fetch(path, options);
        } catch (e) {
            throw new CoachError('offline', friendly('offline'));
        }
        if (!res.ok) throw await toError(res);
        return res.json();
    }

    /* ---- storage ------------------------------------------------ */

    function loadProfile() {
        return requestJSON('/api/coach/profile', { method: 'GET', headers: authHeaders() });
    }

    function saveProfile(payload) {
        return requestJSON('/api/coach/profile', {
            method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload),
        });
    }

    function deleteProfile(scope) {
        const q = scope && scope !== 'all' ? `?scope=${encodeURIComponent(scope)}` : '';
        return requestJSON('/api/coach/profile' + q, { method: 'DELETE', headers: authHeaders() });
    }

    /* ---- streaming ---------------------------------------------- */

    /**
     * POSTs and reads an SSE response.
     *
     * @param {object} handlers
     *   onProgress(stage, label) — a real pipeline step happened
     *   onDelta(text)            — a chunk of the answer
     * @returns {Promise<object>} the `result` payload
     */
    /**
     * Formats every duration in the payload before it leaves the browser.
     *
     * Done here rather than at each call site because this is the single
     * point every request passes through, so no future endpoint can
     * forget. Callers keep their raw millisecond metrics — onboarding
     * reads `metrics.goal.currentMs` for its own logic — and only the
     * outbound copy is presented.
     */
    function present(body) {
        const A = window.CoachAnalytics;
        if (!body || !A || typeof A.formatMetricsForModel !== 'function') return body;

        const out = { ...body };

        // Raw figures the SERVER still needs for arithmetic — clamping plan
        // phases between where the athlete is and where they are going.
        // Kept under its own key rather than left inside `metrics`, because
        // anything inside `metrics` is shown to the model and the whole
        // point is that it sees no millisecond values to misquote.
        if (body.metrics && body.metrics.goal) {
            out.compute = {
                currentMs: body.metrics.goal.currentMs,
                targetMs: body.metrics.goal.targetMs,
            };
        }

        if (out.metrics) out.metrics = A.formatMetricsForModel(out.metrics);
        if (out.context && out.context.metrics) {
            out.context = { ...out.context, metrics: A.formatMetricsForModel(out.context.metrics) };
        }
        return out;
    }

    async function stream(path, rawBody, handlers = {}) {
        const body = present(rawBody);
        if (!navigator.onLine) throw new CoachError('offline', friendly('offline'));

        let res;
        try {
            res = await fetch(path, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
                signal: handlers.signal,
            });
        } catch (e) {
            if (e && e.name === 'AbortError') throw new CoachError('aborted', 'Cancelled.');
            throw new CoachError('offline', friendly('offline'));
        }

        if (!res.ok) throw await toError(res);
        if (!res.body) throw new CoachError('internal', friendly('internal'));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let result = null;
        let failure = null;

        // SSE frames are separated by a blank line. Anything after the
        // last separator is an incomplete frame and stays in the buffer.
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);

                let event = 'message', data = '';
                for (const line of frame.split('\n')) {
                    if (line.startsWith('event:')) event = line.slice(6).trim();
                    else if (line.startsWith('data:')) data += line.slice(5).trim();
                }
                if (!data) continue;

                let payload;
                try { payload = JSON.parse(data); } catch (e) { continue; }

                if (event === 'progress' && handlers.onProgress) {
                    handlers.onProgress(payload.stage, payload.label);
                } else if (event === 'delta' && handlers.onDelta) {
                    handlers.onDelta(payload.text || '');
                } else if (event === 'result') {
                    result = payload;
                } else if (event === 'error') {
                    failure = new CoachError(payload.code, friendly(payload.code, payload.message));
                }
            }
        }

        // An error frame is authoritative even if a partial result arrived.
        if (failure) throw failure;
        if (!result) {
            throw new CoachError('incomplete',
                'The Coach was interrupted before it finished. Try again.');
        }
        return result;
    }

    /* ---- video --------------------------------------------------- */

    // Returns { uploadUrl, headers } — the browser sends the bytes to
    // Google itself, so no video ever passes through CubingHQ.
    function startVideoUpload({ mimeType, sizeBytes }) {
        return requestJSON('/api/coach/video/upload', {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ mimeType, sizeBytes }),
        });
    }

    /**
     * Fallback upload, through our own server, in slices.
     *
     * A serverless request body caps out a few megabytes up, which is
     * why this is chunked rather than one POST: the resumable protocol
     * Google is already speaking takes byte offsets, so the ceiling is
     * a property of one request rather than of the file.
     *
     * Each slice is the body itself — not a JSON field — because base64
     * would spend a third of the very limit being worked around.
     *
     * Sequential on purpose: resumable offsets have to arrive in order.
     */
    async function proxyVideoUpload(file, onProgress) {
        const begun = await requestJSON('/api/coach/video/begin', {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({
                mimeType: file.type || 'video/mp4',
                sizeBytes: file.size,
            }),
        });

        const size = Math.max(1, begun.chunkBytes || 3 * 1024 * 1024);
        let offset = 0;
        let result = null;

        while (offset < file.size) {
            const end = Math.min(offset + size, file.size);
            const isFinal = end >= file.size;

            const headers = authHeaders();
            headers['Content-Type'] = 'application/octet-stream';
            headers['X-Upload-Token'] = begun.token;
            headers['X-Upload-Offset'] = String(offset);
            headers['X-Upload-Final'] = isFinal ? '1' : '0';

            const res = await fetch('/api/coach/video/chunk', {
                method: 'POST', headers, body: file.slice(offset, end),
            });
            if (!res.ok) throw await toError(res);
            const body = await res.json();

            offset = end;
            // Progress across the whole file, not within a slice — a bar
            // that restarts at every chunk reads as a stuck upload.
            if (typeof onProgress === 'function') onProgress(offset / file.size);
            if (body.done) result = body;
        }

        if (!result) {
            throw new CoachError('incomplete',
                'The upload finished without confirming. Try again.');
        }
        return result;
    }

    const analyseVideo = (payload, handlers) =>
        stream('/api/coach/video/analyse', payload, handlers);

    const assess = (payload, handlers) => stream('/api/coach/assess', payload, handlers);
    const plan = (payload, handlers) => stream('/api/coach/plan', payload, handlers);
    const revise = (payload, handlers) => stream('/api/coach/revise', payload, handlers);
    const chat = (payload, handlers) => stream('/api/coach/chat', payload, handlers);

    window.CoachAPI = {
        loadProfile, saveProfile, deleteProfile,
        assess, plan, revise, chat,
        startVideoUpload, proxyVideoUpload, analyseVideo,
        CoachError, friendly,
    };
})();
