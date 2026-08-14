/* ============================================================
   Coach API — model adapter
   ------------------------------------------------------------
   The CoachModel interface, so the product is not welded to one
   provider. Everything above this file talks in terms of
   analyseSession / generatePlan / adaptPlan / chat and never
   touches a vendor SDK directly.

   Notes that matter for the model in use (claude-opus-5):
     - Thinking is on by default, and max_tokens caps thinking AND
       response text together, so max_tokens is set generously and
       every call streams to avoid a request timeout.
     - temperature / top_p / top_k / budget_tokens are rejected by
       this model. Do not add them back.
     - Structured output comes from output_config.format, which
       constrains the response to the schema rather than asking for
       JSON and hoping.
     - Safety classifiers can decline a request: that arrives as a
       normal 200 with stop_reason "refusal", so stop_reason is
       checked before content is read.
   ============================================================ */
'use strict';

const SDK = require('@anthropic-ai/sdk');
const Anthropic = SDK.default || SDK;

const MODEL = process.env.COACH_MODEL || 'claude-opus-5';
const EFFORT = process.env.COACH_EFFORT || 'high';
const MAX_TOKENS = parseInt(process.env.COACH_MAX_TOKENS || '16000', 10);

class ModelError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.name = 'ModelError';
        this.code = code;
        this.status = status;
    }
}

let _client = null;
function client() {
    if (!process.env.ANTHROPIC_API_KEY) {
        // Worth naming loudly: with no COACH_PROVIDER and no keys at all,
        // provider selection falls back to this one, so an operator who
        // configured Gemini and mistyped the provider name lands here and
        // sees a message about a provider they never chose.
        console.error('[claude] ANTHROPIC_API_KEY is not set on this deployment. '
            + 'If you meant to use a different provider, set COACH_PROVIDER '
            + '(anthropic | openrouter | gemini) and redeploy.');
        throw new ModelError('not_configured',
            'The Coach is not configured on this deployment yet.', 503);
    }
    if (!_client) _client = new Anthropic();
    return _client;
}

/** Turns SDK/network failures into something the UI can say out loud. */
function toModelError(e) {
    if (e instanceof ModelError) return e;
    const status = e && e.status;
    if (status === 401 || status === 403) {
        console.error('[claude] auth rejected — check ANTHROPIC_API_KEY');
        return new ModelError('not_configured', 'The Coach is not configured correctly.', 503);
    }
    if (status === 429) {
        return new ModelError('rate_limited',
            'The Coach is busy right now. Try again in a moment.', 429);
    }
    if (status && status >= 500) {
        return new ModelError('upstream', 'The Coach had a problem. Try again shortly.', 502);
    }
    if (e && (e.name === 'APIConnectionTimeoutError' || e.name === 'AbortError')) {
        return new ModelError('timeout', 'The Coach took too long to respond. Try again.', 504);
    }
    console.error('[claude] unexpected error', e);
    return new ModelError('unknown', 'Something went wrong reaching the Coach.', 502);
}

function assertUsable(message) {
    if (message.stop_reason === 'refusal') {
        // Rare here — coaching content is benign — but reading content[0]
        // on a refusal would throw, so handle it explicitly.
        throw new ModelError('refused',
            "The Coach couldn't respond to that. Try rephrasing.", 422);
    }
    if (message.stop_reason === 'max_tokens') {
        throw new ModelError('truncated',
            'The Coach ran out of room mid-answer. Try again.', 502);
    }
}

function textOf(message) {
    return (message.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
}

/**
 * One structured call. `schema` constrains the output shape.
 * `onActivity` fires when the model actually starts producing, so the
 * UI's progress states advance because something real happened rather
 * than on a timer.
 */
async function structured({ system, user, schema, effort = EFFORT, onActivity }) {
    let message;
    try {
        const stream = client().messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: {
                effort,
                format: { type: 'json_schema', schema },
            },
        });

        if (typeof onActivity === 'function') {
            let fired = false;
            stream.on('text', () => {
                if (!fired) { fired = true; onActivity(); }
            });
        }

        message = await stream.finalMessage();
    } catch (e) {
        throw toModelError(e);
    }

    assertUsable(message);

    const raw = textOf(message);
    try {
        return JSON.parse(raw);
    } catch (e) {
        // With output_config.format this should not happen; if it does,
        // failing loudly beats handing the UI a half-parsed object.
        console.error('[claude] schema-constrained output did not parse', raw.slice(0, 400));
        throw new ModelError('malformed', 'The Coach returned an unreadable answer. Try again.', 502);
    }
}

/**
 * Conversational call, streaming text deltas out as they arrive.
 * `onDelta(text)` is called for each chunk; resolves with the full text.
 */
async function conversation({ system, messages, onDelta, effort = 'medium' }) {
    let message;
    try {
        const stream = client().messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system,
            messages,
            output_config: { effort },
        });

        if (typeof onDelta === 'function') stream.on('text', onDelta);
        message = await stream.finalMessage();
    } catch (e) {
        throw toModelError(e);
    }

    if (message.stop_reason === 'refusal') {
        throw new ModelError('refused',
            "The Coach couldn't answer that one. Try asking a different way.", 422);
    }
    return textOf(message);
}

/* ---- The CoachModel interface (spec §27) ------------------------ */

const CoachModel = {
    id: MODEL,

    /** @returns {Promise<CoachAssessment>} */
    analyseSession({ system, evidence, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(evidence),
            schema: require('./schemas.js').COACH_ASSESSMENT_SCHEMA,
            onActivity,
        });
    },

    /** @returns {Promise<TrainingPlan>} */
    generatePlan({ system, context, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').TRAINING_PLAN_SCHEMA,
            onActivity,
        });
    },

    /** @returns {Promise<TrainingPlanUpdate>} */
    adaptPlan({ system, context, onActivity }) {
        return structured({
            system,
            user: buildEvidenceMessage(context),
            schema: require('./schemas.js').PLAN_REVISION_SCHEMA,
            onActivity,
        });
    },

    /** @returns {Promise<string>} */
    chat({ system, messages, onDelta }) {
        return conversation({ system, messages, onDelta });
    },
};

/**
 * The model's entire factual input, as JSON in a single user turn.
 * Sending structured data rather than prose keeps the model from having
 * to parse numbers out of sentences — and makes it obvious, when reading
 * a log, exactly what it was told.
 */
function buildEvidenceMessage(payload) {
    return 'Here is everything known about this cuber. '
        + 'Treat "known" and "observed" as fact and "unknown" as genuinely '
        + 'unavailable. Do not introduce figures that are not here.\n\n'
        + '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
}

module.exports = { CoachModel, ModelError, structured, conversation, MODEL, EFFORT };
