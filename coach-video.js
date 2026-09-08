/* ============================================================
   CubingHQ Coach — solve video analysis
   ------------------------------------------------------------
   Uploads a solve video and turns it into evidence.

   By default the bytes go from this browser straight to Google: our
   server only mints the upload URL, so the video never touches CubingHQ
   and nothing is stored here. What comes back is a list of observations,
   not a file, and Google expires its copy within about two days.

   When that direct route is refused — measured, not assumed: the
   reachability probe has shown Google up while the upload itself got no
   response — the file goes through our own API instead, in slices. A
   serverless request body caps out a few megabytes up, so the fallback
   uses the byte offsets the resumable protocol already provides and the
   limit applies to one request rather than to the video. Even then
   nothing is stored; the bytes pass through.

   XMLHttpRequest rather than fetch for the upload itself: fetch still
   cannot report upload progress, and a silent bar during a 40MB send
   over mobile data reads as a hang.

   Exposed as window.CoachVideo.
   ============================================================ */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const UI = () => window.CoachUI;
    const Store = () => window.CoachStore;

    let busy = false;
    let lastAnalysis = null;

    /* ---------- upload ------------------------------------------- */

    // A large clip over a slow connection is legitimately slow, but a
    // stalled request with no timeout hangs forever behind a spinner.
    const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

    // Reachability probe. No API key, no upload, no side effect — the
    // endpoint answers an unauthenticated request with a readable 400
    // that carries CORS headers, which is all we need: whether the
    // browser can talk to the host at all.
    const PROBE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
    const PROBE_TIMEOUT_MS = 8000;


    /**
     * Can this browser reach the analysis service?
     *
     * A status-0 upload failure has two very different explanations —
     * something on the device blocking the host, or the request itself
     * being refused — and they point at opposite people. Guessing sends
     * the user hunting through browser extensions on a hunch, so this
     * finds out instead.
     *
     * Any HTTP response counts as reachable, including the 400 an
     * unauthenticated call earns. Only a rejected fetch means blocked.
     *
     * @returns {Promise<boolean|null>} null when it could not be decided
     */
    async function canReachService() {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
            try {
                await fetch(PROBE_URL, { method: 'GET', signal: controller.signal });
                return true;
            } finally { clearTimeout(timer); }
        } catch (e) {
            // An abort is inconclusive: a slow network is not a blocked
            // one, and saying "blocked" on a timeout would be the same
            // overclaim in a new place.
            if (e && e.name === 'AbortError') return null;
            return false;
        }
    }

    /**
     * Builds the failure, having first looked at what actually happened.
     *
     * `xhr.onerror` carries no status and no body, so the temptation is
     * to call everything "interrupted, check your connection". That was
     * the previous behaviour and it is a guess dressed as a diagnosis:
     * a request blocked by an extension, a corporate filter, or an
     * expired upload session all reached the user as advice to check a
     * connection that was working fine.
     *
     * Google permits reading X-Goog-Upload-Status cross-origin
     * (it is in the endpoint's access-control-expose-headers), so when
     * Google rejected the upload it can say so in its own words.
     */
    function uploadError(xhr, kind) {
        let googleStatus = null;
        try { googleStatus = xhr.getResponseHeader('X-Goog-Upload-Status'); } catch (e) { }

        const detail = {
            kind,
            status: xhr.status,
            statusText: xhr.statusText || null,
            googleUploadStatus: googleStatus,
            online: typeof navigator !== 'undefined' ? navigator.onLine : null,
            body: String(xhr.responseText || '').slice(0, 300) || null,
        };
        // The console gets everything; the page gets one clear sentence.
        console.error('[Coach] video upload failed', detail);

        const T = (k, fallback) => UI().T(k, fallback);
        let message;

        if (kind === 'timeout') {
            message = T('coach.video.errTimeout',
                'The upload timed out. A shorter clip, or a stronger connection, should go through.');
        } else if (kind === 'empty' || kind === 'unreadable') {
            // A 2xx that we could not make sense of. Reporting a status
            // code here would be misleading — the transfer succeeded.
            message = T('coach.video.errReply',
                'The upload finished but the reply could not be read. Try again.');
        } else if (xhr.status === 0) {
            // No response was readable at all. Which of the two possible
            // causes it is cannot be known here — analyse() probes for
            // that and replaces this message with a definite one. Stating
            // what was observed is the most that is true at this point.
            message = detail.online === false
                ? T('coach.video.errOffline',
                    'You appear to be offline. Reconnect and try again.')
                : T('coach.video.errNoResponse',
                    'The upload did not reach the analysis service.');
        } else if (xhr.status === 403 || xhr.status === 404 || xhr.status === 410) {
            // Resumable sessions expire. Retrying the same one never works.
            message = T('coach.video.errExpired',
                'That upload link expired. Choose the video again to start over.');
        } else if (xhr.status === 413) {
            message = T('coach.video.errTooLarge', 'That video is too large.');
        } else {
            message = `${T('coach.video.errRejected', 'The analysis service rejected the upload')} `
                + `(${xhr.status}${googleStatus ? ', ' + googleStatus : ''}).`;
        }

        const err = new Error(message);
        err.detail = detail;
        return err;
    }

    /**
     * The recorded failure, collapsed, for the reader to expand.
     *
     * The same facts already go to the console, but problems here get
     * reported by screenshot — and a screenshot cannot show a console
     * nobody opened. Putting it on the page means the next report
     * carries its own evidence.
     */
    function detailsBlock(detail) {
        if (!detail) return '';
        const rows = [
            ['status', detail.status],
            ['kind', detail.kind],
            ['online', detail.online],
            ['service reachable', detail.serviceReachable],
            ['upload status', detail.googleUploadStatus],
            ['response', detail.body],
            // The fallback's own answer. Every row above describes the
            // DIRECT attempt; when the fallback also fails it is the one
            // that got a real HTTP reply from our own server, and it was
            // being dropped on the floor — so the screenshot that should
            // have ended the investigation could not contain the answer.
            ['fallback', detail.fallback],
            ['fallback code', detail.fallbackCode],
            ['fallback status', detail.fallbackStatus],
            // Which server-side call failed. Opening the upload session
            // and sending a slice produce the identical code and the
            // identical sentence, so without this the two are told apart
            // only by reading the deploy logs.
            ['fallback step', detail.fallbackStep],
            // The upstream service's own words, redacted server-side.
            ['fallback detail', detail.fallbackDetail],
        ].filter(([, v]) => v !== null && v !== undefined && v !== '');

        if (!rows.length) return '';
        return `<details class="coach-video-detail">
            <summary>${UI().esc(UI().T('coach.video.details', 'Technical detail'))}</summary>
            <ul>${rows.map(([k, v]) =>
            `<li><b>${UI().esc(k)}:</b> ${UI().esc(String(v))}</li>`).join('')}</ul>
        </details>`;
    }

    /**
     * Sends the file to the resumable URL, reporting progress.
     * Resolves with Google's file record: { uri, name, state }.
     */
    function putFile(url, file, headers, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.timeout = UPLOAD_TIMEOUT_MS;

            for (const [k, v] of Object.entries(headers || {})) {
                // Content-Length is a forbidden header — the browser sets
                // it and assigning it throws. The rest are the upload
                // protocol's own, and are on Google's allowed list.
                if (k.toLowerCase() === 'content-length') continue;
                xhr.setRequestHeader(k, v);
            }

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    onProgress(e.loaded / e.total);
                }
            };
            xhr.onload = () => {
                if (xhr.status < 200 || xhr.status >= 300) {
                    return reject(uploadError(xhr, 'http'));
                }
                try {
                    const body = JSON.parse(xhr.responseText);
                    const f = body.file || body;
                    if (!f || !f.name) return reject(uploadError(xhr, 'empty'));
                    resolve(f);
                } catch (e) { reject(uploadError(xhr, 'unreadable')); }
            };
            xhr.onerror = () => reject(uploadError(xhr, 'error'));
            xhr.ontimeout = () => reject(uploadError(xhr, 'timeout'));
            xhr.onabort = () => reject(new Error(UI().T('coach.video.cancelled', 'Upload cancelled.')));
            xhr.send(file);
        });
    }

    /* ---------- render ------------------------------------------- */

    const CATEGORY_LABEL = {
        rotations: 'Rotations', regrips: 'Regrips', pauses: 'Pauses',
        inspection: 'Inspection', turning_quality: 'Turning',
        finger_tricks: 'Finger tricks', other: 'Other',
    };

    function setStatus(html, kind) {
        const host = $('#coach-video-status');
        if (!host) return;
        host.hidden = false;
        host.className = 'coach-video-status' + (kind ? ' is-' + kind : '');
        host.innerHTML = html;
    }

    /**
     * The standing honesty block, for video.
     *
     * Deliberately not CoachUI.dataGaps: that one closes by suggesting a
     * smart cube, which is the wrong advice for someone who has just
     * uploaded a video. The limits here are the camera's, not the data's.
     */
    function videoGaps(notVisible) {
        if (!notVisible || !notVisible.length) return '';
        return `<div class="coach-gaps">
            <strong style="font-size:13.5px">${UI().esc(UI().T('coach.video.notVisible', "What this clip couldn't show"))}</strong>
            <ul>${notVisible.map(g => `<li>${UI().esc(g)}</li>`).join('')}</ul>
            <p class="coach-sub" style="font-size:12.5px;margin-top:8px">
                ${UI().esc(UI().T('coach.video.gapsHint', 'A camera only shows what is in frame. Filming from the side, with your hands and the whole cube visible, lets me see more.'))}
            </p>
        </div>`;
    }

    function renderAnalysis(record) {
        const host = $('#coach-video-result');
        if (!host) return;

        const a = record && record.analysis;
        if (!a) { host.hidden = true; return; }
        host.hidden = false;

        if (!a.solveDetected) {
            host.innerHTML = UI().alert('warn',
                UI().T('coach.video.noSolve', "I couldn't find a solve in that clip."),
                a.whatWasSeen || '');
            return;
        }

        const tip = UI().T('coach.video.observedTip', 'Seen directly in the video you uploaded.');
        const items = (a.observations || []).map(o => `
            <li class="coach-video-obs">
                <div class="coach-video-obs-head">
                    <span class="coach-video-time">${UI().esc(o.timestamp || '')}</span>
                    <span class="coach-video-cat">${UI().esc(CATEGORY_LABEL[o.category] || o.category)}</span>
                    ${UI().evidenceChip(o.evidenceType, tip)}
                </div>
                <p>${UI().esc(o.observation)}</p>
                <p class="coach-muted coach-small">${UI().esc(o.basis || '')}</p>
            </li>`).join('');

        const gaps = videoGaps(a.notVisible);

        host.innerHTML = `
            <div class="coach-card">
                <p class="coach-eyebrow">${UI().esc(UI().T('coach.video.seen', 'What I saw'))}</p>
                <p>${UI().esc(a.whatWasSeen || '')}</p>
                <p style="margin-top:12px">${UI().esc(a.summary || '')}</p>
            </div>
            ${items ? `<ul class="coach-video-list">${items}</ul>` : ''}
            ${gaps}
        `;
    }

    /* ---------- the flow ------------------------------------------ */

    async function analyse(file) {
        if (busy) return;
        if (!file) return;

        const profile = Store().getProfile();
        if (!profile) {
            UI().toast(UI().T('coach.video.needProfile', 'Finish setting up first.'), 'error');
            return;
        }

        busy = true;
        const btn = $('#coach-video-pick');
        if (btn) btn.disabled = true;
        const result = $('#coach-video-result');
        if (result) result.hidden = true;

        let usedFallback = false;
        try {
            setStatus(UI().T('coach.video.preparing', 'Preparing the upload…'));

            // Android browsers routinely report an empty file.type. The
            // upload session is opened with whatever type we declare, so
            // the same value has to be used on both sides — the server
            // echoes it back rather than letting the two drift apart.
            const ticket = await window.CoachAPI.startVideoUpload({
                mimeType: file.type || 'video/mp4',
                sizeBytes: file.size,
            });

            let uploaded;
            try {
                uploaded = await putFile(ticket.uploadUrl, file, ticket.headers, (frac) => {
                    const pct = Math.round(frac * 100);
                    setStatus(`${UI().esc(UI().T('coach.video.uploading', 'Uploading…'))} ${pct}%`);
                });
            } catch (directErr) {
                // Direct-to-Google is the better path and stays the
                // default: no bytes through us, no size ceiling. But it
                // needs Google to accept a cross-origin request carrying
                // X-Goog-Upload-* headers, and for some browsers it does
                // not — the reachability probe has shown the host up and
                // the upload still refused. Falling back beats telling
                // the user their own browser is the problem.
                const d = directErr && directErr.detail;
                const worthRetrying = d && d.status === 0 && d.online !== false && d.kind !== 'timeout';
                if (!worthRetrying) throw directErr;

                console.warn('[Coach] direct upload refused, falling back through the server', d);
                setStatus(UI().esc(UI().T('coach.video.retrying',
                    'Direct upload was refused — sending it another way…')));

                try {
                    // Chunked, so the file size is no longer bounded by
                    // what one request body can carry.
                    uploaded = await window.CoachAPI.proxyVideoUpload(file, (frac) => {
                        const pct = Math.round(frac * 100);
                        setStatus(`${UI().esc(UI().T('coach.video.uploading', 'Uploading…'))} ${pct}%`);
                    });
                    usedFallback = true;
                } catch (proxyErr) {
                    // Both routes are gone. The fallback's reason is the
                    // more useful one — it is a real HTTP answer from our
                    // own server rather than a silent refusal — so it
                    // leads, while the direct failure stays attached for
                    // the detail block.
                    const err = new Error(proxyErr && proxyErr.message
                        ? proxyErr.message
                        : UI().T('coach.video.failed', "That didn't work. Try again."));
                    err.detail = Object.assign({}, d, {
                        fallback: 'failed',
                        // Carried explicitly. Without these the block shows
                        // only the direct attempt, and the server-side
                        // reason — the useful half — never reaches the page.
                        fallbackCode: (proxyErr && proxyErr.code) || 'none',
                        fallbackStatus: (proxyErr && proxyErr.status) || 0,
                        fallbackStep: (proxyErr && proxyErr.step) || null,
                        fallbackDetail: (proxyErr && proxyErr.detail) || null,
                    });
                    console.warn('[Coach] fallback upload failed', {
                        code: err.detail.fallbackCode,
                        status: err.detail.fallbackStatus,
                        step: err.detail.fallbackStep,
                        detail: err.detail.fallbackDetail,
                    }, proxyErr);
                    throw err;
                }
            }

            setStatus(UI().T('coach.video.analysing', 'Analysing your solve…'));

            let record = await window.CoachAPI.analyseVideo({
                fileName: uploaded.name,
                event: profile.primaryEvent,
                profile,
            }, { onProgress: (_, label) => { if (label) setStatus(UI().esc(label)); } });

            // Long clips can still be transcoding when the server's budget
            // runs out. That is a wait, not a failure.
            if (record && record.pending) {
                setStatus(UI().T('coach.video.stillProcessing',
                    'Still processing on Google\'s side. Give it a moment and try again.'), 'warn');
                return;
            }

            lastAnalysis = record;
            renderAnalysis(record);
            setStatus('', 'done');
            $('#coach-video-status').hidden = true;

            // The point of the whole feature: these become evidence, so
            // the next assessment can speak about pauses, regrips and
            // turning instead of listing them as things it cannot see.
            const added = window.CoachEvidence
                ? window.CoachEvidence.recordVideo(record.observations || []) : 0;
            if (added) {
                UI().toast(UI().T('coach.video.added',
                    'Added to your coaching evidence. Re-run your assessment to use it.'));
            }
        } catch (err) {
            console.warn('[Coach] video analysis failed', err);
            const detail = err && err.detail;
            let message = (err && err.message)
                || UI().T('coach.video.failed', "That didn't work. Try again.");

            // A status-0 failure is the one case where the cause is
            // genuinely ambiguous, so find out rather than assert. Only
            // here: an HTTP rejection already told us why, and firing an
            // extra request for it would be noise.
            // Probe on a status-0 failure so the detail block records
            // whether the service was reachable. Skipped when the file
            // was simply too big for the fallback: that message is
            // already exact, and a probe would add nothing.
            if (detail && detail.status === 0 && detail.online !== false
                && detail.kind !== 'timeout' && detail.fallback !== 'too_large') {
                setStatus(UI().esc(message) + ' '
                    + UI().esc(UI().T('coach.video.checking', 'Checking why…')));

                const reachable = await canReachService();
                detail.serviceReachable = reachable;

                // Only speak for the direct failure when nothing else
                // has. If the fallback ran and failed, its reason came
                // from our own server and is the more useful one, so it
                // keeps the floor.
                if (!detail.fallback) {
                    if (reachable === false) {
                        // Measured, not guessed — the browser cannot reach
                        // the host at all, so the block is on this device.
                        message = UI().T('coach.video.errBlocked',
                            'This browser cannot reach the analysis service at all. A browser '
                            + 'extension, VPN or network filter is blocking it — try a private '
                            + 'window or a different network.');
                    } else if (reachable === true) {
                        message = UI().T('coach.video.errRefused',
                            'The analysis service is reachable, but it refused this upload. '
                            + 'That is a problem on our side rather than your connection — '
                            + 'please report it.');
                    }
                }
            }

            setStatus(UI().esc(message) + detailsBlock(detail), 'error');
        } finally {
            busy = false;
            if (btn) btn.disabled = false;
            const input = $('#coach-video-file');
            // Cleared so re-picking the same file after a failure still
            // fires a change event.
            if (input) input.value = '';
        }
    }

    /* ---- consent, before any file is chosen ---------------------------
       A clip of someone solving is the most identifying thing this site
       handles: it shows their hands, their room, usually their face, often
       their voice, and it leaves our infrastructure entirely — it goes to
       Google to be analysed by a model. Everything else here is a number.

       So this is the one place that asks first, in as many words, and asks
       BEFORE the file picker opens rather than after a file is chosen —
       once someone has picked the video, the dialog reads as a formality
       to click past rather than a decision.

       The answer is stored with a timestamp, which is what "be able to
       demonstrate that the data subject has consented" (GDPR art. 7(1))
       means in practice. Withdrawing it is one button on the same dialog,
       and is as easy as giving it (art. 7(3)).
    ------------------------------------------------------------------- */

    const VIDEO_CONSENT_KEY = 'chq_coach_video_consent_v1';

    function hasVideoConsent() {
        try {
            const raw = JSON.parse(localStorage.getItem(VIDEO_CONSENT_KEY) || 'null');
            return !!(raw && raw.granted);
        } catch (e) { return false; }
    }

    function setVideoConsent(granted) {
        try {
            localStorage.setItem(VIDEO_CONSENT_KEY,
                JSON.stringify({ granted: !!granted, at: Date.now(), v: 1 }));
        } catch (e) { /* private mode: holds for this page only */ }
    }

    /** Resolves true if the person agreed, false if they backed out. */
    function askVideoConsent() {
        return new Promise((resolve) => {
            const T = (k, f) => UI().T(k, f);
            const wrap = document.createElement('div');
            wrap.className = 'coach-consent-backdrop';
            wrap.innerHTML =
                '<div class="coach-consent" role="dialog" aria-modal="true" ' +
                     'aria-labelledby="cv-consent-title" tabindex="-1">' +
                  '<h2 id="cv-consent-title">' + T('coach.video.consentTitle', 'Before you upload a video') + '</h2>' +
                  '<ul>' +
                    '<li>' + T('coach.video.consent1', 'Your clip is uploaded to <strong>Google</strong> and analysed by its Gemini model. It is not analysed on our own servers.') + '</li>' +
                    '<li>' + T('coach.video.consent2', 'A solving video usually shows your hands, your room, and often your face or voice.') + '</li>' +
                    '<li>' + T('coach.video.consent3', 'We delete the file as soon as the analysis finishes. We keep only the written observations.') + '</li>' +
                    '<li>' + T('coach.video.consent4', 'Only upload footage of yourself. Do not upload other people — especially other people\u2019s children — without their permission.') + '</li>' +
                  '</ul>' +
                  '<p class="coach-consent-more">' +
                    T('coach.video.consentMore', 'The <a href="/privacy.html">Privacy Policy</a> explains this in full. Every other part of the Coach works without a video.') +
                  '</p>' +
                  '<div class="coach-consent-actions">' +
                    '<button type="button" class="coach-btn coach-btn--primary" id="cv-agree">' +
                      T('coach.video.consentAgree', 'I agree — choose a video') + '</button>' +
                    '<button type="button" class="coach-btn" id="cv-cancel">' +
                      T('coach.video.consentCancel', 'Cancel') + '</button>' +
                  '</div>' +
                '</div>';

            const opener = document.activeElement;
            document.body.appendChild(wrap);
            const dialog = wrap.querySelector('.coach-consent');
            dialog.focus({ preventScroll: true });

            function close(answer) {
                document.removeEventListener('keydown', onKey, true);
                wrap.remove();
                if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
                resolve(answer);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
                if (e.key !== 'Tab') return;
                const stops = [...dialog.querySelectorAll('button, a[href]')];
                if (!stops.length) return;
                const first = stops[0], last = stops[stops.length - 1];
                if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                    e.preventDefault(); first.focus();
                }
            }
            document.addEventListener('keydown', onKey, true);

            wrap.querySelector('#cv-agree').addEventListener('click', () => { setVideoConsent(true); close(true); });
            wrap.querySelector('#cv-cancel').addEventListener('click', () => close(false));
            // Clicking the backdrop is the same as cancelling, never as agreeing.
            wrap.addEventListener('click', (e) => { if (e.target === wrap) close(false); });
        });
    }

    function init() {
        const input = $('#coach-video-file');
        const btn = $('#coach-video-pick');
        if (btn && input) {
            btn.addEventListener('click', async () => {
                if (!hasVideoConsent() && !await askVideoConsent()) return;
                input.click();
            });
        }
        if (input) {
            input.addEventListener('change', () => {
                const file = input.files && input.files[0];
                if (file) analyse(file);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.CoachVideo = {
        init, analyse, renderAnalysis,
        hasVideoConsent, askVideoConsent,
        /** Withdrawing is as easy as giving — GDPR art. 7(3). */
        withdrawVideoConsent: () => setVideoConsent(false),
        get last() { return lastAnalysis; },
    };
})();
