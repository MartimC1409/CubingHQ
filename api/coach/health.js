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

module.exports = function handler(req, res) {
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

    return sendJson(res, 200, {
        ok: keyPresent && modelSet,
        provider: PROVIDER,
        model: MODEL || null,
        hasKey: keyPresent,
        keyVar: KEY_VAR,
        hasStorage: rtdb.isConfigured(),
        videoCapable: typeof CoachModel.analyseVideo === 'function',
        diagnosis,
    });
};
