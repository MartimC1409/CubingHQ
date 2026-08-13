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

const PROVIDERS = ['anthropic', 'openrouter'];

function choose() {
    const explicit = (process.env.COACH_PROVIDER || '').trim().toLowerCase();
    if (explicit) {
        if (!PROVIDERS.includes(explicit)) {
            console.error(`[model] COACH_PROVIDER="${explicit}" is not one of ${PROVIDERS.join(', ')} — falling back to anthropic`);
            return 'anthropic';
        }
        return explicit;
    }

    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    if (hasOpenRouter && !hasAnthropic) return 'openrouter';
    if (hasAnthropic && hasOpenRouter) {
        // Both keys present and no choice made. Picking silently would
        // mean the bill lands somewhere the operator did not intend.
        console.warn('[model] both ANTHROPIC_API_KEY and OPENROUTER_API_KEY are set; using anthropic. Set COACH_PROVIDER to be explicit.');
    }
    return 'anthropic';
}

const PROVIDER = choose();
const impl = PROVIDER === 'openrouter'
    ? require('./openrouter.js')
    : require('./claude.js');

module.exports = {
    CoachModel: impl.CoachModel,
    ModelError: impl.ModelError,
    structured: impl.structured,
    conversation: impl.conversation,
    MODEL: impl.MODEL,
    EFFORT: impl.EFFORT,
    PROVIDER,
};
