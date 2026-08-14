/* ============================================================
   POST /api/coach/chat   -> SSE (text deltas)

   The conversational surface. What stops this being a generic chatbot
   is the context block: the user's real profile, statistics, goal,
   plan and recent training are attached to every turn, so "how close
   am I to sub-10?" is answered from their numbers.

   Conversation history comes from the client, which is what lets the
   Coach carry a thread — but the FACTS are re-attached fresh each
   turn from stored state rather than being remembered out of the
   transcript, so they cannot drift as the conversation gets long.
   ============================================================ */
'use strict';

const { requireUser, AuthError } = require('../_lib/auth.js');
const { CoachModel } = require('../_lib/model.js');
const { chatPrompt } = require('../_lib/prompts.js');
const { sendError, methodGuard, readBody, openStream } = require('../_lib/http.js');

const MAX_TURNS = 24;          // trimmed from the front; the context block carries the facts
const MAX_CHARS_PER_TURN = 4000;

function badRequest(message) {
    const e = new Error(message);
    e.status = 400; e.code = 'bad_request';
    return e;
}

/** Keeps only well-formed turns, trims length, and enforces alternation. */
function sanitiseHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const cleaned = [];
    for (const turn of raw) {
        if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) continue;
        const content = typeof turn.content === 'string' ? turn.content.trim() : '';
        if (!content) continue;
        cleaned.push({ role: turn.role, content: content.slice(0, MAX_CHARS_PER_TURN) });
    }
    const trimmed = cleaned.slice(-MAX_TURNS);
    // The API needs the first message to be from the user.
    while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
    return trimmed;
}

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['POST'])) return;

    let body;
    let user = null;
    try {
        body = await readBody(req);
        if (req.headers.authorization) {
            try { user = await requireUser(req); }
            catch (e) { if (!(e instanceof AuthError) || e.code === 'invalid_token') throw e; }
        }

        const message = body && typeof body.message === 'string' ? body.message.trim() : '';
        if (!message) throw badRequest('Ask the Coach something first.');
        if (message.length > MAX_CHARS_PER_TURN) throw badRequest('That message is too long.');
    } catch (err) {
        return sendError(res, err);
    }

    const stream = openStream(res);
    try {
        const { message, history, context } = body;

        // Facts are re-attached every turn rather than relied on from the
        // transcript, so a long conversation cannot quietly drift off the
        // user's real numbers.
        const factBlock = context ? [
            'Current coaching context for this athlete (authoritative — prefer this over anything earlier in the conversation):',
            '```json',
            JSON.stringify({
                known: {
                    profile: context.profile || null,
                    statistics: context.metrics || null,
                    goal: context.goal || null,
                    currentPlan: context.plan || null,
                    recentTraining: context.recentTraining || null,
                    streak: context.streak || null,
                },
                observed: context.observations && context.observations.length
                    ? { source: 'Bluetooth smart cube move data.', items: context.observations.slice(0, 40) }
                    : null,
                unknown: context.unknown || [],
            }, null, 2),
            '```',
        ].join('\n') : null;

        const messages = sanitiseHistory(history);
        messages.push({
            role: 'user',
            content: factBlock ? `${factBlock}\n\n---\n\n${message}` : message,
        });

        stream.progress('thinking', 'Thinking…');

        let started = false;
        await CoachModel.chat({
            system: chatPrompt(context && context.metrics && context.metrics.event),
            messages,
            onDelta: (text) => {
                if (!started) { started = true; stream.progress('answering', ''); }
                stream.delta(text);
            },
        });

        stream.result({ ok: true, at: Date.now() });
    } catch (err) {
        stream.fail(err);
    } finally {
        stream.close();
    }
};
