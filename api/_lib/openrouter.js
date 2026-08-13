/* ============================================================
   Coach API — OpenRouter model adapter
   ------------------------------------------------------------
   The same CoachModel interface as claude.js, against OpenRouter's
   OpenAI-compatible endpoint. Selected with COACH_PROVIDER=openrouter.

   Deliberately built on global fetch rather than the `openai` SDK:
   the whole surface used here is one POST and an SSE parse, and this
   repo's one dependency already had to be version-corrected once
   after it broke a deploy. No new dependency to install or pin.

   What differs from the Anthropic path, and why the code is shaped
   the way it is:

     - OpenRouter routes to whichever provider serves the model, and
       support for response_format varies by model. The primary call
       asks for a strict json_schema; if no endpoint supports that,
       it falls back to JSON mode with the schema in the prompt.
     - Because the fallback makes the schema advisory rather than
       enforced, every structured response is validated (validate.js)
       and one repair round-trip is allowed. The evidence contract
       does not get to depend on which model the operator picked.
     - Free models are heavily rate limited per *account*, not per
       user, so 429 is an expected condition here rather than an
       exceptional one, and is surfaced as such.
   ============================================================ */
'use strict';

const { validate, prune } = require('./validate.js');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// No default model: OpenRouter's catalogue changes constantly and free
// slugs come and go, so guessing one here would produce a confusing
// runtime failure months from now. Better to say plainly what is missing.
const MODEL = process.env.COACH_MODEL || '';
const EFFORT = process.env.COACH_EFFORT || 'high';
const MAX_TOKENS = parseInt(process.env.COACH_MAX_TOKENS || '16000', 10);

// Opt-in: only reasoning models accept this, and sending it to one that
// does not can cost you every provider for that model.
const REASONING_EFFORT = process.env.COACH_REASONING_EFFORT || '';

// Vercel's function ceiling is 300s (vercel.json); stop short of it so a
// slow model surfaces as a clean timeout rather than a killed function.
const REQUEST_TIMEOUT_MS = parseInt(process.env.COACH_TIMEOUT_MS || '240000', 10);

// Sent for attribution on OpenRouter's dashboards. Harmless if wrong.
const REFERER = process.env.COACH_SITE_URL || 'https://www.cubinghq.online';
const TITLE = 'CubingHQ Coach';

class ModelError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.name = 'ModelError';
        this.code = code;
        this.status = status;
    }
}

function assertConfigured() {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new ModelError('not_configured',
            'The Coach is not configured on this deployment yet.', 503);
    }
    if (!MODEL) {
        console.error('[openrouter] COACH_MODEL is not set — pick a slug from https://openrouter.ai/models');
        throw new ModelError('not_configured',
            'The Coach has no model selected on this deployment yet.', 503);
    }
}

/* ---- error mapping ---------------------------------------------- */

/**
 * OpenRouter reports "nothing can serve this request" and "your model
 * slug is wrong" with overlapping status codes, and the difference
 * matters: the first is worth retrying without the schema, the second
 * is a configuration mistake that retrying will never fix.
 */
function classifyFailure(status, message) {
    const m = String(message || '').toLowerCase();

    if (/not a valid model|invalid model|no endpoints found for/.test(m)) {
        return 'bad_model';
    }
    if (/response_format|structured output|json_schema|require_parameters|no endpoints found that support/.test(m)) {
        return 'no_schema_support';
    }
    if (status === 402 || /credit|quota|insufficient/.test(m)) return 'no_credit';
    if (status === 429 || /rate limit/.test(m)) return 'rate_limited';
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500) return 'upstream';
    return 'unknown';
}

function toModelError(kind, message) {
    switch (kind) {
        case 'bad_model':
            console.error(`[openrouter] model rejected: ${message} — check COACH_MODEL against https://openrouter.ai/models`);
            return new ModelError('not_configured',
                'The Coach is pointed at a model that does not exist. Check the model name.', 503);
        case 'auth':
            console.error('[openrouter] auth rejected — check OPENROUTER_API_KEY');
            return new ModelError('not_configured', 'The Coach is not configured correctly.', 503);
        case 'no_credit':
            console.error(`[openrouter] out of credit / quota: ${message}`);
            return new ModelError('rate_limited',
                "The Coach has used up its allowance for now. Try again later.", 429);
        case 'rate_limited':
            return new ModelError('rate_limited',
                'The Coach is busy right now. Try again in a moment.', 429);
        case 'upstream':
            return new ModelError('upstream', 'The Coach had a problem. Try again shortly.', 502);
        case 'no_schema_support':
            // Expected and handled by structured(), which retries in JSON
            // mode. Logged there, once, with the model name — not here, or
            // every fallback would read as a crash in the logs.
            return new ModelError('upstream',
                'The Coach could not use the requested response format.', 502);
        default:
            console.error('[openrouter] unexpected error', message);
            return new ModelError('unknown', 'Something went wrong reaching the Coach.', 502);
    }
}

/* ---- transport --------------------------------------------------- */

async function post(body) {
    assertConfigured();

    let res;
    try {
        res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': REFERER,
                'X-Title': TITLE,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
            throw new ModelError('timeout',
                'The Coach took too long to respond. Try again.', 504);
        }
        throw new ModelError('upstream', 'Could not reach the Coach. Try again shortly.', 502);
    }

    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json();
            detail = (body && body.error && body.error.message) || JSON.stringify(body);
        } catch (e) {
            try { detail = await res.text(); } catch (e2) { detail = `HTTP ${res.status}`; }
        }
        const kind = classifyFailure(res.status, detail);
        // Signalled rather than thrown: structured() decides whether a
        // missing-schema-support failure is worth retrying differently.
        const err = toModelError(kind, detail);
        err.kind = kind;
        throw err;
    }

    return res;
}

/**
 * Reads an OpenAI-style SSE stream to completion.
 *
 * OpenRouter interleaves `: OPENROUTER PROCESSING` comment lines as
 * keepalives during long waits, and can deliver an error object mid
 * stream after a 200 — both are handled here rather than surfacing as
 * a parse failure.
 *
 * @returns {Promise<{text: string, finish: string|null}>}
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

            // Frames are newline-delimited; keep the trailing partial.
            let nl;
            while ((nl = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);

                if (!line || line.startsWith(':')) continue;       // keepalive
                if (!line.startsWith('data:')) continue;

                const payload = line.slice(5).trim();
                if (payload === '[DONE]') return { text, finish };

                let frame;
                try { frame = JSON.parse(payload); } catch (e) { continue; }

                if (frame.error) {
                    const message = frame.error.message || 'stream error';
                    const err = toModelError(classifyFailure(frame.error.code || 502, message), message);
                    err.kind = classifyFailure(frame.error.code || 502, message);
                    throw err;
                }

                const choice = (frame.choices || [])[0];
                if (!choice) continue;
                if (choice.finish_reason) finish = choice.finish_reason;

                const piece = choice.delta && choice.delta.content;
                if (piece) {
                    text += piece;
                    if (typeof onDelta === 'function') onDelta(piece);
                }
            }
        }
    } finally {
        try { reader.cancel(); } catch (e) { /* already closed */ }
    }

    return { text, finish };
}

function assertUsable(finish) {
    if (finish === 'length') {
        throw new ModelError('truncated',
            'The Coach ran out of room mid-answer. Try again.', 502);
    }
    if (finish === 'content_filter') {
        throw new ModelError('refused',
            "The Coach couldn't respond to that. Try rephrasing.", 422);
    }
}

/* ---- JSON recovery ----------------------------------------------- */

/**
 * Pulls an object out of a model response that may not be bare JSON.
 *
 * Only used on the fallback path, where the model was asked for JSON
 * rather than constrained to it, so fenced code blocks and a sentence
 * of preamble are both common. Anything recovered here still has to
 * pass validation, so being permissive at this step costs nothing.
 */
function extractJson(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    const attempts = [text];

    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced) attempts.push(fenced[1].trim());

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

    for (const candidate of attempts) {
        try { return JSON.parse(candidate); } catch (e) { /* next */ }
    }
    return null;
}

function schemaInstruction(schema) {
    return [
        'Reply with a single JSON object and nothing else — no prose, no code fence.',
        'It must conform exactly to this JSON Schema:',
        '```json',
        JSON.stringify(schema, null, 2),
        '```',
        'Every field listed in "required" must be present. Fields with an "enum"',
        'must use one of the listed values verbatim.',
    ].join('\n');
}

/* ---- the two call shapes ----------------------------------------- */

function baseBody(messages, extra) {
    const body = {
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        stream: true,
        ...extra,
    };
    if (REASONING_EFFORT) body.reasoning = { effort: REASONING_EFFORT };
    return body;
}

async function runStructured({ system, user, schema, name, onActivity, useSchema }) {
    const messages = [
        { role: 'system', content: useSchema ? system : `${system}\n\n${schemaInstruction(schema)}` },
        { role: 'user', content: user },
    ];

    const extra = useSchema
        ? {
            response_format: {
                type: 'json_schema',
                json_schema: { name, strict: true, schema },
            },
            // Only route to providers that actually honour the schema —
            // otherwise the request silently succeeds as unconstrained
            // text and we lose the guarantee without being told.
            provider: { require_parameters: true },
        }
        : { response_format: { type: 'json_object' } };

    const res = await post(baseBody(messages, extra));

    let fired = false;
    const { text, finish } = await readStream(res, () => {
        if (!fired && typeof onActivity === 'function') { fired = true; onActivity(); }
    });

    assertUsable(finish);
    return text;
}

/**
 * One structured call, with the schema enforced whichever way the
 * chosen model allows — and verified either way.
 */
async function structured({ system, user, schema, effort = EFFORT, onActivity, _name }) {
    const name = _name || 'coach_response';

    let raw;
    let constrained = true;
    try {
        raw = await runStructured({ system, user, schema, name, onActivity, useSchema: true });
    } catch (e) {
        if (e && e.kind === 'no_schema_support') {
            console.warn(`[openrouter] ${MODEL} has no endpoint supporting json_schema — falling back to JSON mode`);
            constrained = false;
            raw = await runStructured({ system, user, schema, name, onActivity, useSchema: false });
        } else {
            throw e;
        }
    }

    let parsed = extractJson(raw);
    if (!parsed) {
        console.error('[openrouter] response was not JSON', String(raw).slice(0, 400));
        throw new ModelError('malformed',
            'The Coach returned an unreadable answer. Try again.', 502);
    }

    // On the fallback path the model was never constrained, so an extra
    // field is likely. Drop those before validating; a missing one still
    // fails, because inventing coaching content is not ours to do.
    if (!constrained) parsed = prune(parsed, schema);

    let errors = validate(parsed, schema);
    if (errors.length) {
        console.warn(`[openrouter] ${MODEL} returned off-schema output, repairing:`, errors.join('; '));

        const repair = [
            { role: 'system', content: `${system}\n\n${schemaInstruction(schema)}` },
            { role: 'user', content: user },
            { role: 'assistant', content: JSON.stringify(parsed) },
            {
                role: 'user',
                content: 'That response did not match the schema:\n'
                    + errors.map(e => `- ${e}`).join('\n')
                    + '\n\nReturn the corrected JSON object only. Do not add commentary, '
                    + 'and do not invent findings to fill a missing field — if you have no '
                    + 'evidence for one, say so in the field honestly.',
            },
        ];

        const res = await post(baseBody(repair, { response_format: { type: 'json_object' } }));
        const { text, finish } = await readStream(res, null);
        assertUsable(finish);

        const retried = extractJson(text);
        if (retried) {
            const pruned = prune(retried, schema);
            const stillWrong = validate(pruned, schema);
            if (!stillWrong.length) return pruned;
            errors = stillWrong;
        }

        console.error(`[openrouter] ${MODEL} could not produce valid output:`, errors.join('; '));
        throw new ModelError('malformed',
            'The Coach returned an answer that did not fit. Try again, or pick a different model.', 502);
    }

    return parsed;
}

/** Conversational call, streaming text deltas out as they arrive. */
async function conversation({ system, messages, onDelta, effort = 'medium' }) {
    const chatMessages = [
        { role: 'system', content: system },
        ...messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
                ? m.content
                : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join(''),
        })),
    ];

    const res = await post(baseBody(chatMessages, {}));
    const { text, finish } = await readStream(res, onDelta);

    if (finish === 'content_filter') {
        throw new ModelError('refused',
            "The Coach couldn't answer that one. Try asking a different way.", 422);
    }
    return text;
}

/* ---- The CoachModel interface (spec §27) ------------------------ */

const CoachModel = {
    get id() { return MODEL; },

    analyseSession({ system, evidence, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(evidence),
            schema: require('./schemas.js').COACH_ASSESSMENT_SCHEMA,
            _name: 'coach_assessment',
            onActivity,
        });
    },

    generatePlan({ system, context, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').TRAINING_PLAN_SCHEMA,
            _name: 'training_plan',
            onActivity,
        });
    },

    adaptPlan({ system, context, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').PLAN_REVISION_SCHEMA,
            _name: 'plan_revision',
            onActivity,
        });
    },

    chat({ system, messages, onDelta }) {
        return conversation({ system, messages, onDelta });
    },
};

/** Identical wording to the Anthropic path, so switching provider does
 *  not quietly change what the model is told. */
function buildEvidenceMessage(payload) {
    return 'Here is everything known about this cuber. '
        + 'Treat "known" and "observed" as fact and "unknown" as genuinely '
        + 'unavailable. Do not introduce figures that are not here.\n\n'
        + '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
}

module.exports = {
    CoachModel, ModelError, structured, conversation, MODEL, EFFORT,
    _internal: { classifyFailure, extractJson, readStream, schemaInstruction },
};
