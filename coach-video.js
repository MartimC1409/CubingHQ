/* ============================================================
   CubingHQ Coach — solve video analysis
   ------------------------------------------------------------
   Uploads a solve video and turns it into evidence.

   The bytes go from this browser straight to Google. Our server only
   mints the upload URL, so the video never touches CubingHQ and nothing
   is stored here — what comes back is a list of observations, not a
   file. Google expires its copy on its own within about two days.

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
            // Status 0 means no response was readable at all. Whether the
            // network is down or something blocked the request are
            // different problems with different fixes.
            message = detail.online === false
                ? T('coach.video.errOffline',
                    'You appear to be offline. Reconnect and try again.')
                : T('coach.video.errBlocked',
                    'The upload was blocked before it reached the analysis service. '
                    + 'A browser extension, VPN or network filter is the usual cause — '
                    + 'try another network or a private window.');
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

            const uploaded = await putFile(ticket.uploadUrl, file, ticket.headers, (frac) => {
                const pct = Math.round(frac * 100);
                setStatus(`${UI().esc(UI().T('coach.video.uploading', 'Uploading…'))} ${pct}%`);
            });

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
            setStatus(UI().esc(err && err.message
                ? err.message
                : UI().T('coach.video.failed', "That didn't work. Try again.")), 'error');
        } finally {
            busy = false;
            if (btn) btn.disabled = false;
            const input = $('#coach-video-file');
            // Cleared so re-picking the same file after a failure still
            // fires a change event.
            if (input) input.value = '';
        }
    }

    function init() {
        const input = $('#coach-video-file');
        const btn = $('#coach-video-pick');
        if (btn && input) btn.addEventListener('click', () => input.click());
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
        get last() { return lastAnalysis; },
    };
})();
