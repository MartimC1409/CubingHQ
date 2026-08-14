/* ============================================================
   GET /api/coach/health

   What is configured on this deployment, as booleans.

   Exists because "The Coach is not switched on for this deployment yet"
   has five possible causes — no key, wrong provider, invalid key, a
   model name that does not exist, or an environment variable added
   without a redeploy — and they are indistinguishable from the browser.
   Diagnosing that by screenshot takes a round trip per guess. This takes
   one request.

   Returns presence, never values: no key, no fragment of a key, no
   database URL. `model` is a public model identifier and `provider` is
   a name, neither of which is a secret. Unauthenticated on purpose —
   a health check that needs a working config to answer is useless
   exactly when it is needed.
   ============================================================ */
'use strict';

const rtdb = require('../_lib/rtdb.js');
const { CoachModel, PROVIDER, MODEL, hasKey, KEY_VAR } = require('../_lib/model.js');
const { sendJson, methodGuard } = require('../_lib/http.js');

module.exports = async function handler(req, res) {
    if (!methodGuard(req, res, ['GET'])) return;

    const keyPresent = hasKey();
    const modelSet = !!MODEL;

    // Said in words as well as flags, so the answer does not depend on
    // the reader knowing which combination means what.
    let diagnosis;
    if (!keyPresent) {
        diagnosis = `${KEY_VAR} is not set for provider "${PROVIDER}". `
            + 'Add it in the Vercel project settings, then REDEPLOY — environment '
            + 'variables are read at boot, so an existing deployment will not pick it up.';
    } else if (!modelSet) {
        diagnosis = `COACH_MODEL is not set, and provider "${PROVIDER}" has no default.`;
    } else {
        diagnosis = 'Configuration looks complete. If the Coach still reports it is not '
            + 'switched on, the key is being rejected or the model name does not exist — '
            + `check the Vercel logs for "[${PROVIDER}]".`;
    }

    const body = {
        ok: keyPresent && modelSet,
        provider: PROVIDER,
        model: MODEL || null,
        hasKey: keyPresent,
        keyVar: KEY_VAR,
        hasStorage: rtdb.isConfigured(),
        videoCapable: typeof CoachModel.analyseVideo === 'function',
        diagnosis,
    };

    // ?live=1 asks the provider whether the key and model actually work.
    //
    // Everything above is presence, and presence is not validity: a
    // retired model name looks perfectly configured right up until the
    // first real request. One cheap GET closes that gap, and it stays
    // opt-in so the default answer is instant and costs nothing.
    const wantsLive = req.query
        ? (req.query.live === '1' || req.query.live === 'true')
        : /[?&]live=(1|true)\b/.test(req.url || '');

    if (wantsLive && keyPresent && modelSet && typeof CoachModel.checkModel === 'function') {
        try {
            const live = await CoachModel.checkModel();

            if (live.unreachable) {
                // We learned nothing. Saying the configuration is wrong
                // would be a guess, and an expensive one to act on.
                body.live = { ok: null, reason: live.reason };
                return sendJson(res, 200, body);
            }

            body.live = { ok: live.ok };
            if (!live.ok) {
                body.ok = false;
                body.live.reason = live.reason;
                body.diagnosis = live.suggested
                    ? `The model "${MODEL}" is not usable: ${live.reason} `
                      + `Set COACH_MODEL=${live.suggested} and redeploy.`
                    : `The model "${MODEL}" is not usable: ${live.reason}`;
            } else {
                body.diagnosis = 'Key and model both verified against the provider. '
                    + 'The Coach should work.';
            }
        } catch (e) {
            // A failed check is not a failed configuration; say which it is.
            body.live = { ok: null, reason: 'The live check could not complete.' };
        }
    } else if (wantsLive) {
        body.live = {
            ok: null,
            reason: !keyPresent || !modelSet
                ? 'Skipped — configuration is incomplete, see diagnosis.'
                : `Skipped — provider "${PROVIDER}" has no live check.`,
        };
    }

    return sendJson(res, 200, body);
};
