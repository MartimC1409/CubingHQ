/* ============================================================
   Coach API — provider selection
   ------------------------------------------------------------
   The one place that decides which CoachModel implementation the
   handlers get. Everything above this file imports from here and
   stays provider-agnostic, which is the point of the interface in
   spec §27.

   COACH_PROVIDER=anthropic | openrouter

   When it is unset the provider is inferred from whichever API key
   exists, so a deployment that only ever sets OPENROUTER_API_KEY
   works without a second variable — and setting both keys without
   choosing is called out rather than resolved silently.

   Only the selected provider is require()d. That keeps an
   OpenRouter-only deployment from needing @anthropic-ai/sdk
   installed at all.
   ============================================================ */
'use strict';

const PROVIDERS = ['anthropic', 'openrouter', 'gemini'];

function choose() {
    const explicit = (process.env.COACH_PROVIDER || '').trim().toLowerCase();
    if (explicit) {
        if (!PROVIDERS.includes(explicit)) {
            console.error(`[model] COACH_PROVIDER="${explicit}" is not one of ${PROVIDERS.join(', ')} — falling back to anthropic`);
            return 'anthropic';
        }
        return explicit;
    }

    const present = [
        ['gemini', !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)],
        ['openrouter', !!process.env.OPENROUTER_API_KEY],
        ['anthropic', !!process.env.ANTHROPIC_API_KEY],
    ].filter(([, has]) => has).map(([name]) => name);

    if (present.length === 1) return present[0];
    if (present.length > 1) {
        // Several keys and no choice made. Picking silently would mean the
        // bill lands somewhere the operator did not intend.
        console.warn(`[model] keys present for ${present.join(', ')} and no COACH_PROVIDER set; using ${present[0]}. Set COACH_PROVIDER to be explicit.`);
        return present[0];
    }
    return 'anthropic';
}

const PROVIDER = choose();

// Written out rather than looked up by variable: Vercel decides what to
// bundle by tracing require() statically, and a computed path can leave
// the chosen provider out of the deployed function entirely.
function load(provider) {
    if (provider === 'gemini') return require('./gemini.js');
    if (provider === 'openrouter') return require('./openrouter.js');
    return require('./claude.js');
}
const impl = load(PROVIDER);

/** Which environment variable this provider's key lives in. */
const KEY_VAR = {
    gemini: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
};

/**
 * Whether the selected provider has a key — presence only.
 *
 * Deliberately returns a boolean and never any part of the value, so it
 * is safe to expose from the health endpoint.
 */
function hasKey() {
    if (PROVIDER === 'gemini') {
        return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    }
    return !!process.env[KEY_VAR[PROVIDER]];
}

// One line per cold start, so every later log line is interpretable.
// Without it nothing in the logs says which provider is even active, and
// the same user-facing message can come from any of the three.
console.log(`[model] provider=${PROVIDER} model=${impl.MODEL || '(unset)'} key=${hasKey() ? 'present' : 'MISSING'}`);

module.exports = {
    CoachModel: impl.CoachModel,
    ModelError: impl.ModelError,
    structured: impl.structured,
    conversation: impl.conversation,
    MODEL: impl.MODEL,
    EFFORT: impl.EFFORT,
    PROVIDER,
    hasKey,
    KEY_VAR: KEY_VAR[PROVIDER],
};
