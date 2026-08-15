/* ============================================================
   Coach API — Gemini model adapter
   ------------------------------------------------------------
   The same CoachModel interface as claude.js and openrouter.js, plus
   analyseVideo — the reason this provider exists. Selected with
   COACH_PROVIDER=gemini.

   Built on global fetch, like the OpenRouter adapter and for the same
   reason: the whole surface used here is a few HTTP calls and an SSE
   parse, and this repo's one dependency already broke a deploy once.

   Three things differ from the other providers and shape the code:

     - Gemini's responseSchema is an OpenAPI 3.0 subset. It rejects
       `additionalProperties`, which every schema in schemas.js sets,
       so schemas are translated on the way out. validate.js still
       checks what comes back, because a translated schema is a weaker
       guarantee than the original.
     - Roles are "user" and "model", not "user" and "assistant".
     - Video is not uploaded through us. The browser sends bytes
       straight to Google using a resumable URL minted here, so the
       server never handles the file and nothing is stored. Google
       expires uploaded files on its own after about two days.
   ============================================================ */
'use strict';

const { validate, prune } = require('./validate.js');

const BASE = 'https://generativelanguage.googleapis.com';
const API = `${BASE}/v1beta`;
const UPLOAD = `${BASE}/upload/v1beta/files`;

// Google retires model names on its own schedule — gemini-2.5-flash went
// "no longer available to new users" while this was being written, which
// is exactly the failure I argued against when I refused to hardcode a
// default for OpenRouter, and then did here anyway.
//
// A default is kept because it makes a fresh deploy work, but the
// staleness is now self-diagnosing rather than mysterious: the 404 names
// the replacement Google wants, extractSuggestedModel lifts it into the
// log, and /api/coach/health?live=1 checks the model before a user ever
// hits it.
const MODEL = process.env.COACH_MODEL || 'gemini-3.6-flash';
// Video is the expensive path and may deserve a different model than
// chat; falls back to the same one when unset.
const VIDEO_MODEL = process.env.COACH_VIDEO_MODEL || MODEL;
const MAX_TOKENS = parseInt(process.env.COACH_MAX_TOKENS || '16000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.COACH_TIMEOUT_MS || '240000', 10);

// Largest video we will mint an upload URL for. Not a Gemini limit — a
// deliberate product one, because a 10-minute 4K clip costs a great deal
// of tokens to analyse and a single solve does not need it.
const MAX_VIDEO_BYTES = parseInt(process.env.COACH_MAX_VIDEO_BYTES || String(200 * 1024 * 1024), 10);

class ModelError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.name = 'ModelError';
        this.code = code;
        this.status = status;
    }
}

function apiKey() {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
        // Named explicitly: this failure and "the key is set but wrong"
        // reach the user as the same sentence, and without a log line
        // there is nothing to tell them apart.
        console.error('[gemini] GEMINI_API_KEY is not set on this deployment '
            + '— add it in the Vercel project settings and redeploy '
            + '(env vars are read at boot, so an existing deployment will not pick it up)');
        throw new ModelError('not_configured',
            'The Coach is not configured on this deployment yet.', 503);
    }
    return key;
}

/* ---- error mapping ---------------------------------------------- */

const HINTS = {
    bad_model: 'check COACH_MODEL against https://ai.google.dev/gemini-api/docs/models',
    auth: 'check GEMINI_API_KEY',
    no_credit: 'the project has exhausted its quota — enable billing or wait for the daily reset',
    rate_limited: 'Gemini free-tier limits are per project, shared by every visitor',
};

function classifyFailure(status, message) {
    const m = String(message || '').toLowerCase();

    if (/api key not valid|api_key_invalid|permission denied|unauthenticated/.test(m)) return 'auth';
    if (/is not found|not found for api version|unsupported model|invalid model/.test(m)) return 'bad_model';
    if (/quota|billing|exceeded your current quota/.test(m)) return 'no_credit';
    if (status === 429 || /rate limit|resource_exhausted/.test(m)) return 'rate_limited';
    if (status === 401 || status === 403) return 'auth';
    if (status === 404) return 'bad_model';
    if (status >= 500) return 'upstream';
    return 'unknown';
}

/**
 * Pulls the replacement model out of a retirement notice.
 *
 * When Google retires a name it says so in the error and names the
 * successor: "This model models/gemini-2.5-flash is no longer available
 * to new users. Please update your code to use models/gemini-3.6-flash".
 * Surfacing that turns a documentation lookup into a copy-paste, and it
 * keeps working for whatever the next replacement turns out to be —
 * which a hardcoded list of model names would not.
 *
 * Anchored on "use" because the message names the OLD model first, and
 * echoing that back would send the operator in a circle.
 */
function extractSuggestedModel(message) {
    const m = /\buse\s+(?:models\/)?([A-Za-z0-9][\w.-]*)/i.exec(String(message || ''));
    return m ? m[1] : null;
}

function logFailure(kind, status, message) {
    const suggested = kind === 'bad_model' ? extractSuggestedModel(message) : null;
    const hint = suggested
        ? `set COACH_MODEL=${suggested} and redeploy`
        : HINTS[kind];
    const line = `[gemini] ${MODEL} → ${kind}`
        + (status ? ` (HTTP ${status})` : '')
        + `: ${String(message || '').slice(0, 300)}`
        + (hint ? ` — ${hint}` : '');
    if (kind === 'rate_limited') console.warn(line);
    else console.error(line);
}

function toModelError(kind) {
    switch (kind) {
        case 'bad_model':
            return new ModelError('not_configured',
                'The Coach is pointed at a model that does not exist. Check the model name.', 503);
        case 'auth':
            return new ModelError('not_configured', 'The Coach is not configured correctly.', 503);
        case 'no_credit':
            return new ModelError('no_credit', 'The Coach has used up its allowance for now.', 429);
        case 'rate_limited':
            return new ModelError('rate_limited',
                'The Coach is busy right now. Try again in a moment.', 429);
        case 'upstream':
            return new ModelError('upstream', 'The Coach had a problem. Try again shortly.', 502);
        default:
            return new ModelError('unknown', 'Something went wrong reaching the Coach.', 502);
    }
}

function fail(kind, status, message) {
    logFailure(kind, status, message);
    const err = toModelError(kind);
    err.kind = kind;
    return err;
}

async function readError(res) {
    try {
        const body = await res.json();
        return (body && body.error && body.error.message) || JSON.stringify(body);
    } catch (e) {
        try { return await res.text(); } catch (e2) { return `HTTP ${res.status}`; }
    }
}

/* ---- schema translation ------------------------------------------ */

const TYPES = {
    object: 'OBJECT', array: 'ARRAY', string: 'STRING',
    number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN',
};

/**
 * Rewrites a JSON Schema into the OpenAPI subset Gemini accepts.
 *
 * `additionalProperties: false` is the important casualty — it is set on
 * every object in schemas.js and Gemini rejects the request outright if
 * it is present. Dropping it means the model is no longer forbidden from
 * inventing fields, which is precisely why validate.js runs on the
 * response: the constraint moves from the request to the check.
 *
 * propertyOrdering is passed because Gemini generates fields in the order
 * given, and the schemas are written with the summary first for a reason.
 */
function toGeminiSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const out = {};
    if (schema.type) out.type = TYPES[schema.type] || String(schema.type).toUpperCase();
    if (schema.description) out.description = schema.description;
    if (Array.isArray(schema.enum)) out.enum = schema.enum.slice();

    if (schema.type === 'object' && schema.properties) {
        out.properties = {};
        for (const [k, v] of Object.entries(schema.properties)) {
            out.properties[k] = toGeminiSchema(v);
        }
        out.propertyOrdering = Object.keys(schema.properties);
        if (Array.isArray(schema.required)) out.required = schema.required.slice();
    }
    if (schema.type === 'array' && schema.items) out.items = toGeminiSchema(schema.items);

    return out;
}

/* ---- transport --------------------------------------------------- */

async function post(url, body, { timeout = REQUEST_TIMEOUT_MS } = {}) {
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout),
        });
    } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
            logFailure('timeout', 0, `no response within ${timeout}ms`);
            const err = new ModelError('timeout',
                'The Coach took too long to respond. Try again.', 504);
            err.kind = 'timeout';
            throw err;
        }
        throw fail('network', 0, (e && e.message) || 'fetch failed');
    }

    if (!res.ok) {
        const detail = await readError(res);
        throw fail(classifyFailure(res.status, detail), res.status, detail);
    }
    return res;
}

/**
 * Reads Gemini's SSE stream.
 *
 * Frames are `data: {...}` with text spread across candidates[0].content
 * .parts[]. finishReason arrives on the last frame and is the only signal
 * that the answer was cut short or refused.
 */
async function readStream(res, onDelta) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finish = null;

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl;
            while ((nl = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line || !line.startsWith('data:')) continue;

                const payload = line.slice(5).trim();
                if (payload === '[DONE]') return { text, finish };

                let frame;
                try { frame = JSON.parse(payload); } catch (e) { continue; }

                if (frame.error) {
                    const message = frame.error.message || 'stream error';
                    const status = Number(frame.error.code) || 502;
                    throw fail(classifyFailure(status, message), status, message);
                }

                const cand = (frame.candidates || [])[0];
                if (!cand) continue;
                if (cand.finishReason) finish = cand.finishReason;

                for (const part of ((cand.content && cand.content.parts) || [])) {
                    if (typeof part.text === 'string' && part.text) {
                        text += part.text;
                        if (typeof onDelta === 'function') onDelta(part.text);
                    }
                }
            }
        }
    } finally {
        try { reader.cancel(); } catch (e) { /* already closed */ }
    }

    return { text, finish };
}

function assertUsable(finish) {
    if (finish === 'MAX_TOKENS') {
        throw new ModelError('truncated',
            'The Coach ran out of room mid-answer. Try again.', 502);
    }
    if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') {
        throw new ModelError('refused',
            "The Coach couldn't respond to that. Try rephrasing.", 422);
    }
    if (finish === 'RECITATION') {
        throw new ModelError('refused',
            'The Coach stopped partway through that answer. Try asking differently.', 422);
    }
}

function extractJson(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    const attempts = [text];
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced) attempts.push(fenced[1].trim());
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));
    for (const c of attempts) {
        try { return JSON.parse(c); } catch (e) { /* next */ }
    }
    return null;
}

function streamUrl(model) {
    return `${API}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey())}`;
}

/* ---- the call shapes --------------------------------------------- */

/**
 * One structured call.
 *
 * The schema is enforced by Gemini where it can be and verified here
 * regardless, with one repair round-trip — the same discipline as the
 * OpenRouter path, because the evidence contract must not depend on
 * which provider the operator picked.
 */
async function structured({ system, user, schema, onActivity, parts, model }) {
    const userParts = Array.isArray(parts) ? parts : [{ text: user }];

    const request = (extraInstruction) => ({
        systemInstruction: { parts: [{ text: system + (extraInstruction || '') }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(schema),
        },
    });

    let fired = false;
    const res = await post(streamUrl(model || MODEL), request());
    const { text, finish } = await readStream(res, () => {
        if (!fired && typeof onActivity === 'function') { fired = true; onActivity(); }
    });
    assertUsable(finish);

    let parsed = extractJson(text);
    if (!parsed) {
        console.error('[gemini] response was not JSON', String(text).slice(0, 400));
        throw new ModelError('malformed',
            'The Coach returned an unreadable answer. Try again.', 502);
    }

    // additionalProperties could not be sent, so an extra field is the
    // expected failure and is safe to drop. A missing one is not repaired
    // here — filling it in would mean writing the coaching content.
    parsed = prune(parsed, schema);
    const errors = validate(parsed, schema);
    if (!errors.length) return parsed;

    console.warn(`[gemini] off-schema output, repairing: ${errors.join('; ')}`);

    const repairRes = await post(streamUrl(model || MODEL), {
        systemInstruction: { parts: [{ text: system }] },
        contents: [
            { role: 'user', parts: userParts },
            { role: 'model', parts: [{ text: JSON.stringify(parsed) }] },
            {
                role: 'user',
                parts: [{
                    text: 'That response did not match the required schema:\n'
                        + errors.map(e => `- ${e}`).join('\n')
                        + '\n\nReturn the corrected JSON object only. Do not invent findings '
                        + 'to fill a missing field — if you have no evidence for one, say so '
                        + 'honestly in that field.',
                }],
            },
        ],
        generationConfig: {
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(schema),
        },
    });

    const retried = await readStream(repairRes, null);
    assertUsable(retried.finish);
    const fixed = extractJson(retried.text);
    if (fixed) {
        const cleaned = prune(fixed, schema);
        if (!validate(cleaned, schema).length) return cleaned;
    }

    console.error('[gemini] could not produce valid output after one repair');
    throw new ModelError('malformed',
        'The Coach returned an answer that did not fit. Try again.', 502);
}

async function conversation({ system, messages, onDelta }) {
    const contents = messages.map(m => ({
        // Gemini calls the assistant "model".
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{
            text: typeof m.content === 'string'
                ? m.content
                : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join(''),
        }],
    }));

    const res = await post(streamUrl(MODEL), {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_TOKENS },
    });

    const { text, finish } = await readStream(res, onDelta);
    if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT') {
        throw new ModelError('refused',
            "The Coach couldn't answer that one. Try asking a different way.", 422);
    }
    return text;
}

/* ---- video ------------------------------------------------------- */

/**
 * Mints a resumable upload URL the browser can PUT bytes to directly.
 *
 * The video never passes through this server, which is both the privacy
 * story and the only way it can work: Vercel caps a function request body
 * at a few megabytes and a phone video is far larger.
 */
async function startVideoUpload({ displayName, mimeType, sizeBytes }) {
    if (!isFinite(sizeBytes) || sizeBytes <= 0) {
        throw new ModelError('bad_request', 'That file looks empty.', 400);
    }
    if (sizeBytes > MAX_VIDEO_BYTES) {
        const mb = Math.floor(MAX_VIDEO_BYTES / (1024 * 1024));
        throw new ModelError('too_large',
            `That video is too large — keep it under ${mb}MB. A single solve is enough.`, 413);
    }

    let res;
    try {
        res = await fetch(`${UPLOAD}?key=${encodeURIComponent(apiKey())}`, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
                'X-Goog-Upload-Header-Content-Type': mimeType || 'video/mp4',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file: { display_name: displayName || 'solve' } }),
            signal: AbortSignal.timeout(30000),
        });
    } catch (e) {
        throw fail('network', 0, (e && e.message) || 'fetch failed');
    }

    if (!res.ok) {
        const detail = await readError(res);
        throw fail(classifyFailure(res.status, detail), res.status, detail);
    }

    const uploadUrl = res.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
        throw fail('upstream', 0, 'upload started but no X-Goog-Upload-URL was returned');
    }
    return { uploadUrl };
}

/**
 * Asks Google whether the configured key and model actually work.
 *
 * One cheap GET, no generation. This is the check that would have caught
 * a retired model name before anyone tried to use the Coach, rather than
 * after — the configuration looked complete right up until the first
 * real request, because "set" and "valid" are different things.
 *
 * @returns {{ok: boolean, reason?: string, suggested?: string|null}}
 */
async function checkModel() {
    let key;
    try { key = apiKey(); }
    catch (e) { return { ok: false, reason: 'No API key is set.' }; }

    if (!MODEL) return { ok: false, reason: 'No model is set.' };

    let res;
    try {
        res = await fetch(
            `${API}/models/${encodeURIComponent(MODEL)}?key=${encodeURIComponent(key)}`,
            { signal: AbortSignal.timeout(15000) });
    } catch (e) {
        // Distinct from a bad config: we learned nothing either way, and
        // reporting "not usable" would send the operator changing
        // settings that were never the problem.
        return { ok: false, unreachable: true, reason: 'Could not reach the model API.' };
    }

    if (res.ok) return { ok: true };

    const detail = await readError(res);
    const kind = classifyFailure(res.status, detail);
    return {
        ok: false,
        reason: kind === 'auth'
            ? 'The API key was rejected.'
            : String(detail).slice(0, 300),
        suggested: extractSuggestedModel(detail),
    };
}

/**
 * Uploads video bytes from the server.
 *
 * The browser sending straight to Google is the better path — no bytes
 * through us, nothing stored, no platform body limit — but it depends on
 * Google accepting a cross-origin request carrying X-Goog-Upload-*
 * headers against a session URL, and in practice that has been refused
 * for at least one real browser. This is the fallback for when it is:
 * same two-step resumable exchange, run server-side where CORS does not
 * apply at all.
 *
 * Bounded by the caller to whatever the platform will accept as a
 * request body, so it is only ever a path for short clips.
 */
/**
 * Relays one chunk of a resumable upload.
 *
 * The protocol this adapter already speaks supports uploading in pieces
 * at byte offsets — `upload` for each chunk and `upload, finalize` on
 * the last. Using it properly is what lets a video exceed the few
 * megabytes a serverless request body can carry, without re-encoding
 * the file and destroying the very detail the analysis is looking at.
 *
 * @param {string} uploadUrl the session URL, already verified by caller
 * @returns {object|null} the file record on the finalising chunk
 */
async function uploadVideoChunk(uploadUrl, chunk, offset, isFinal) {
    let res;
    try {
        res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Length': String(chunk.length),
                'X-Goog-Upload-Offset': String(offset),
                'X-Goog-Upload-Command': isFinal ? 'upload, finalize' : 'upload',
            },
            body: chunk,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
            throw new ModelError('timeout',
                'That part of the upload timed out. Try again.', 504);
        }
        throw fail('network', 0, (e && e.message) || 'chunk upload failed');
    }

    if (!res.ok) {
        const detail = await readError(res);
        throw fail(classifyFailure(res.status, detail), res.status, detail);
    }

    // Only the finalising chunk returns a body worth reading.
    if (!isFinal) return null;

    const body = await res.json();
    const file = body.file || body;
    if (!file || !file.name) {
        throw fail('upstream', 0, 'upload finished but returned no file record');
    }
    return file;
}

async function uploadVideoBytes(buffer, mimeType, displayName) {
    const { uploadUrl } = await startVideoUpload({
        displayName, mimeType, sizeBytes: buffer.length,
    });

    let res;
    try {
        res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Length': String(buffer.length),
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
            },
            body: buffer,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
            throw new ModelError('timeout', 'The upload took too long. Try a shorter clip.', 504);
        }
        throw fail('network', 0, (e && e.message) || 'upload failed');
    }

    if (!res.ok) {
        const detail = await readError(res);
        throw fail(classifyFailure(res.status, detail), res.status, detail);
    }

    const body = await res.json();
    const file = body.file || body;
    if (!file || !file.name) {
        throw fail('upstream', 0, 'upload finished but returned no file record');
    }
    return file;
}

/** Current state of an uploaded file: PROCESSING, ACTIVE or FAILED. */
async function getVideoState(fileName) {
    const clean = String(fileName || '').replace(/^files\//, '');
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
        throw new ModelError('bad_request', 'That file reference is not valid.', 400);
    }

    let res;
    try {
        res = await fetch(`${API}/files/${clean}?key=${encodeURIComponent(apiKey())}`,
            { signal: AbortSignal.timeout(20000) });
    } catch (e) {
        throw fail('network', 0, (e && e.message) || 'fetch failed');
    }
    if (!res.ok) {
        const detail = await readError(res);
        throw fail(classifyFailure(res.status, detail), res.status, detail);
    }

    const body = await res.json();
    return { state: body.state, uri: body.uri, mimeType: body.mimeType, name: body.name };
}

/**
 * Analyses an uploaded solve video against the video observation schema.
 * The prompt comes from prompts.js; this only assembles the request.
 */
function analyseVideo({ system, fileUri, mimeType, schema, context, onActivity }) {
    return structured({
        system,
        schema,
        model: VIDEO_MODEL,
        onActivity,
        parts: [
            { fileData: { mimeType: mimeType || 'video/mp4', fileUri } },
            { text: context },
        ],
    });
}

/* ---- The CoachModel interface (spec §27) ------------------------ */

const CoachModel = {
    get id() { return MODEL; },

    analyseSession({ system, evidence, onActivity }) {
        return structured({
            system, onActivity,
            user: buildEvidenceMessage(evidence),
            schema: require('./schemas.js').COACH_ASSESSMENT_SCHEMA,
        });
    },

    generatePlan({ system, context, onActivity }) {
        return structured({
            system, onActivity,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').TRAINING_PLAN_SCHEMA,
        });
    },

    adaptPlan({ system, context, onActivity }) {
        return structured({
            system, onActivity,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').PLAN_REVISION_SCHEMA,
        });
    },

    chat({ system, messages, onDelta }) {
        return conversation({ system, messages, onDelta });
    },

    analyseVideo,
    startVideoUpload,
    uploadVideoBytes,
    uploadVideoChunk,
    getVideoState,
    checkModel,
};

/** Identical wording to the other providers, so switching does not
 *  quietly change what the model is told. */
function buildEvidenceMessage(payload) {
    return 'Here is everything known about this cuber. '
        + 'Treat "known" and "observed" as fact and "unknown" as genuinely '
        + 'unavailable. Do not introduce figures that are not here.\n\n'
        + '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
}

module.exports = {
    CoachModel, ModelError, structured, conversation, MODEL,
    EFFORT: null,
    _internal: {
        classifyFailure, toGeminiSchema, extractJson, readStream,
        startVideoUpload, uploadVideoBytes, uploadVideoChunk,
        getVideoState, checkModel,
        extractSuggestedModel,
        MAX_VIDEO_BYTES,
    },
};
