/* ============================================================
   CubingHQ — Cube Fights, online
   ------------------------------------------------------------
   Two devices, one fight, the server as referee. Create a room and
   send the code or link; the opponent joins; both scramble, both
   mark ready, a synced 3-2-1, then each player times their own
   solve on their own device and the server compares.

   Both players need an account (same-device fights need none).
   The engine, the timer and the per-seat display are the same ones
   the split screen uses (fight-engine.js, timer-core.js,
   CubeFights._shared); this file is the online arena and the home
   page's online card and history.
   ============================================================ */
(function () {
    'use strict';

    const E = window.FightEngine;
    const FT = window.FightTransport;
    const S = window.CubeFights && window.CubeFights._shared;
    if (!E || !FT || !S) return;
    const { t, fill, esc, $, EVENT_LABELS, haptic, seatView, outcomeFor, badgeHtml,
        penaltyButtonsHtml, solveText, createSeatTimer, bindZone, setHtml } = S;

    const app = () => window.CubingHQApp || {};
    const signedIn = () => !!(app().isSignedIn && app().isSignedIn());
    const CURRENT_KEY = 'chq_fight_current';

    const online = {
        transport: null,
        seatTimer: null,
        raf: null,
        section: '',
        lastPhase: '',
        lastRound: 0,
        confirmLeave: false,
        pendingJoin: null,
        busy: false,
        history: [],
        stats: null,
        historyFor: null,
        armAt: 0,
    };

    /* ---------- errors ---------- */

    function errorText(code, fallback) {
        const map = {
            sign_in_required: t('fight.errSignIn', 'Sign in to fight online.'),
            bad_code: t('fight.errBadCode', 'That is not a room code. Codes are 6 letters and numbers.'),
            no_fight: t('fight.errNoFight', 'No fight with that code. Check it and try again.'),
            full: t('fight.errFull', 'That fight already has two players.'),
            closed: t('fight.errClosed', 'That fight is over or has expired.'),
            rate_limited: t('fight.errRate', 'Too many requests — give it a minute.'),
            network: t('fight.errNetwork', 'No connection. Check your internet and try again.'),
            not_configured: t('fight.errServer', 'Online fights are unavailable right now.'),
            denied: t('fight.errServer', 'Online fights are unavailable right now.'),
            unreachable: t('fight.errServer', 'Online fights are unavailable right now.'),
        };
        return map[code] || fallback || t('fight.errGeneric', 'Something went wrong. Try again.');
    }

    function showCardError(msg) {
        const el = $('#fight-online-error');
        if (!el) return;
        el.textContent = msg || '';
        el.hidden = !msg;
    }

    /* ---------- home card ---------- */

    let homeBound = false;
    function bindHome() {
        if (homeBound) return;
        homeBound = true;
        const signIn = $('#fight-signin-btn');
        if (signIn) signIn.addEventListener('click', () => { if (app().openLogin) app().openLogin(); });
        const create = $('#fight-create-btn');
        if (create) create.addEventListener('click', createFight);
        const join = $('#fight-join-btn');
        const code = $('#fight-join-code');
        if (join && code) {
            join.addEventListener('click', () => joinFight(code.value));
            code.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinFight(code.value); });
            code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
        }
        document.addEventListener('chq-auth-changed', () => {
            online.historyFor = null;
            renderHomeCard();
            if (signedIn() && online.pendingJoin) {
                const c = online.pendingJoin;
                online.pendingJoin = null;
                joinFight(c);
            }
        });
    }

    function renderHomeCard() {
        bindHome();
        const outEl = $('#fight-online-signed-out');
        const inEl = $('#fight-online-signed-in');
        const yes = signedIn();
        if (outEl) outEl.hidden = yes;
        if (inEl) inEl.hidden = !yes;
        if (!yes && online.pendingJoin) {
            showCardError(fill(t('fight.signInToJoin', 'Sign in to join fight {code}.'), { code: online.pendingJoin }));
        }
        if (yes) loadHistory();
    }

    /* ---------- history ---------- */

    async function loadHistory() {
        const me = app().profile ? app().profile() : null;
        const who = me ? (me.uid || me.wca_id || me.id) : null;
        if (!who || online.historyFor === who) return;
        online.historyFor = who;
        const r = await FT.callApi('history', null, 'GET');
        if (!r.ok) { online.historyFor = null; return; }
        online.history = Array.isArray(r.data.records) ? r.data.records : [];
        online.stats = r.data.stats || null;
        S.renderHistory();
    }

    function historyRecords() {
        return signedIn() ? online.history : [];
    }

    function renderStats() {
        const el = $('#fight-stats');
        if (!el) return;
        const st = signedIn() ? online.stats : null;
        el.textContent = st && st.played
            ? fill(t('fight.statsLine', 'Online: {w} W · {l} L · rounds {rw}–{rl}'), {
                w: st.wins || 0, l: st.losses || 0, rw: st.roundsWon || 0, rl: st.roundsLost || 0,
            })
            : '';
    }

    /** A same-device fight, copied into the signed-in player's history. */
    function syncLocalRecord(record) {
        if (!signedIn()) return;
        FT.callApi('local-result', { record }).then(r => {
            if (r.ok && r.data && r.data.record) {
                online.history = [r.data.record].concat(online.history.filter(x => x.id !== r.data.record.id));
            }
        });
    }

    /* ---------- create / join ---------- */

    async function createFight() {
        if (online.busy) return;
        if (!signedIn()) { if (app().openLogin) app().openLogin(); return; }
        online.busy = true;
        showCardError('');
        const btn = $('#fight-create-btn');
        if (btn) btn.disabled = true;
        const r = await FT.callApi('create', { settings: S.fightSettings() });
        online.busy = false;
        if (btn) btn.disabled = false;
        if (!r.ok) { showCardError(errorText(r.error && r.error.code, r.error && r.error.message)); return; }
        openArena(r);
    }

    async function joinFight(codeInput) {
        const code = String(codeInput || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!code) return;
        if (!signedIn()) {
            online.pendingJoin = code;
            renderHomeCard();
            // A saved sign-in may still be restoring (an invite link opened in
            // a fresh tab): give it a moment before asking anyone to sign in.
            const restoring = app().authToken && app().authToken();
            setTimeout(() => {
                if (!signedIn() && online.pendingJoin === code && app().openLogin) app().openLogin();
            }, restoring ? 4000 : 0);
            return;
        }
        if (online.busy) return;
        online.busy = true;
        showCardError('');
        const r = await FT.callApi('join', { code });
        online.busy = false;
        if (!r.ok) {
            showCardError(errorText(r.error && r.error.code, r.error && r.error.message));
            if (r.error && ['no_fight', 'closed'].includes(r.error.code)) forgetCurrent(code);
            return;
        }
        openArena(r);
    }

    function rememberCurrent(tr) {
        try {
            localStorage.setItem(CURRENT_KEY, JSON.stringify({
                code: tr.code, fightId: tr.fightId, phase: tr.state.phase, at: Date.now(),
            }));
        } catch (e) { /* private mode */ }
    }
    function forgetCurrent(code) {
        try {
            const cur = JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null');
            if (!code || (cur && cur.code === code)) localStorage.removeItem(CURRENT_KEY);
        } catch (e) { /* ignore */ }
    }
    function storedCurrent() {
        try {
            const cur = JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null');
            if (!cur || !cur.code) return null;
            if (['ended', 'expired'].includes(cur.phase) || Date.now() - cur.at > 2 * 60 * 60 * 1000) return null;
            return cur;
        } catch (e) { return null; }
    }

    /* ---------- arena ---------- */

    function inviteLink(code) {
        return `${location.origin}${location.pathname}#fight/${code}`;
    }

    function openArena(r) {
        closeArena();
        const d = r.data;
        const tr = FT.createOnlineTransport({
            fightId: d.fightId, seat: d.seat, code: d.code, state: d.state,
            serverNow: d.serverNow, t0: r.t0, t1: r.t1,
        });
        online.transport = tr;
        online.section = '';
        online.lastPhase = '';
        online.lastRound = 0;
        online.confirmLeave = false;
        rememberCurrent(tr);
        // The invite link is the address while the fight is open, so a
        // reload or a shared tab lands back in it.
        const hash = `#fight/${d.code}`;
        if (location.hash !== hash) history.replaceState(null, '', hash);

        const home = $('#fights-home');
        const root = $('#fight-online');
        if (home) home.hidden = true;
        root.hidden = false;
        root.innerHTML = `
            <div class="fo-top">
                <div><span class="fo-code-label">${esc(t('fight.room', 'Room'))}</span> <span class="fo-code">${esc(d.code)}</span></div>
                <div class="fo-top-actions">
                    <button type="button" class="btn btn-secondary" data-act="share">${esc(t('fight.shareLink', 'Share link'))}</button>
                    <button type="button" class="btn btn-secondary" data-act="leave">${esc(t('fight.leave', 'Leave'))}</button>
                </div>
            </div>
            <div class="setup-card fo-players">
                <div class="fo-player fo-player--me"><span class="fo-player-name"></span><span class="fo-player-state"></span></div>
                <div class="fo-score" aria-live="off"></div>
                <div class="fo-player fo-player--opp"><span class="fo-player-name"></span><span class="fo-player-state"></span></div>
            </div>
            <div class="fo-banner" role="status" hidden></div>
            <div class="fo-confirm" hidden></div>
            <div class="fo-main"></div>
            <div class="fo-live fight-sr-only" aria-live="polite"></div>`;
        root.addEventListener('click', onClick);

        online.seatTimer = createSeatTimer(d.seat, tr, { changed: () => render(true) });
        tr.subscribe(() => { rememberCurrent(tr); render(true); });
        tr.onStatus(() => render(true));
        if (window.AppWakeLock) window.AppWakeLock.acquire();
        render(true);
        frame();
        window.scrollTo(0, 0);
    }

    function closeArena() {
        if (online.raf) cancelAnimationFrame(online.raf);
        online.raf = null;
        if (online.transport) online.transport.close();
        online.transport = null;
        if (online.seatTimer) online.seatTimer.reset();
        online.seatTimer = null;
        const root = $('#fight-online');
        if (root) {
            root.removeEventListener('click', onClick);
            root.innerHTML = '';
            root.hidden = true;
        }
        const home = $('#fights-home');
        if (home) home.hidden = false;
    }

    function view() {
        const tr = online.transport;
        return E.tick(tr.state, tr.now());
    }

    function frame() {
        online.raf = requestAnimationFrame(frame);
        const tr = online.transport;
        if (!tr || !online.seatTimer) return;
        const v = view();
        const st = online.seatTimer;
        st.sync(v);
        const dnow = st.deviceNow();
        st.timer.tick(dnow);
        const zone = $('#fight-online .fo-zone');
        if (zone) {
            const sv = seatView(v, tr.seat, st.timer, tr.now(), dnow);
            const timeEl = $('.fl-time', zone);
            if (timeEl && timeEl.textContent !== sv.time) timeEl.textContent = sv.time;
            if (zone.dataset.state !== sv.zone) zone.dataset.state = sv.zone;
            const statusEl = $('.fl-status', zone);
            if (statusEl && statusEl.textContent !== sv.status) statusEl.textContent = sv.status;
        }
        if (v.phase === 'countdown') {
            const left = E.countdownLeft(v, tr.now());
            const sec = left !== null && left <= 3000 ? Math.ceil(left / 1000) : 0;
            if (sec && sec !== online.lastBuzz) { online.lastBuzz = sec; haptic(30); }
        } else {
            online.lastBuzz = 0;
        }
        render(false, v);
    }

    function presenceText(v, seat, now) {
        const tr = online.transport;
        if (seat === tr.seat) {
            if (tr.status === 'reconnecting') return { away: true, text: t('fight.reconnecting', 'Reconnecting…') };
            return { away: false, text: t('fight.connected', 'Connected') };
        }
        if (!v.players[seat]) return { away: true, text: t('fight.notJoined', 'Not joined yet') };
        const p = E.presence(v, seat, now);
        if (p.away) {
            return { away: true, text: fill(t('fight.awayFor', 'Disconnected · {s}s left'), { s: Math.ceil(p.graceLeft / 1000) }) };
        }
        return { away: false, text: t('fight.connected', 'Connected') };
    }

    function opponentProgress(v, opp) {
        const r = E.current(v);
        if (!r) return '';
        if (r.solves && r.solves[opp]) return t('fight.oppDone', 'finished ✓');
        if (typeof (r.started || {})[opp] === 'number') return t('fight.oppSolving', 'solving…');
        if (v.phase === 'inspection') return t('fight.oppInspecting', 'inspecting');
        if (v.phase === 'prepare') return v.players[opp] && v.players[opp].ready ? t('fight.oppReady', 'ready ✓') : t('fight.oppScrambling', 'scrambling');
        return '';
    }

    function render(force, vArg) {
        const tr = online.transport;
        const root = $('#fight-online');
        if (!tr || !root || root.hidden) return;
        const v = vArg || view();
        const now = tr.now();
        const me = tr.seat;
        const opp = E.other(me);
        const r = E.current(v) || {};
        const presence = presenceText(v, opp, now);
        const mine = presenceText(v, me, now);

        // Everything below is cheap string building; only touch the DOM when
        // something visible changed.
        const key = JSON.stringify([v.phase, v.seq, r.n, r.scramble, online.confirmLeave, tr.status,
            presence.text, mine.text, online.seatTimer && online.seatTimer.timer.phase,
            v.phase === 'review' ? Math.ceil((r.phaseAt + E.TIMING.REVIEW_AUTO_MS - now) / 1000) : 0,
            v.phase === 'lobby' && v.expiresAt ? Math.ceil((v.expiresAt - now) / 1000) : 0]);
        if (!force && key === online.renderKey) return;
        online.renderKey = key;

        // Players and score.
        const meP = v.players[me] || {};
        const oppP = v.players[opp];
        $('.fo-player--me .fo-player-name', root).textContent = fill(t('fight.youName', 'You · {name}'), { name: meP.name || '' });
        $('.fo-player--opp .fo-player-name', root).textContent = oppP ? oppP.name : t('fight.opponent', 'Opponent');
        setHtml($('.fo-player--me .fo-player-state', root), `<span class="fo-dot${mine.away ? ' fo-dot--away' : ''}" aria-hidden="true"></span>${esc(mine.text)}`);
        const prog = oppP ? opponentProgress(v, opp) : '';
        setHtml($('.fo-player--opp .fo-player-state', root), `<span class="fo-dot${presence.away ? ' fo-dot--away' : ''}" aria-hidden="true"></span>${esc(presence.text)}${prog ? ' · ' + esc(prog) : ''}`);
        const score = $('.fo-score', root);
        score.textContent = `${v.score[me]} – ${v.score[opp]}`;
        score.setAttribute('aria-label', fill(t('fight.scoreAria', 'You {a}, {name} {b}'), { a: v.score[me], b: v.score[opp], name: oppP ? oppP.name : '' }));

        // Banner: connection trouble on either side.
        const banner = $('.fo-banner', root);
        let bannerText = '';
        if (tr.status === 'reconnecting') bannerText = t('fight.bannerReconnecting', 'Connection lost — reconnecting. Your fight is kept for 30 seconds.');
        else if (tr.status === 'gone') bannerText = t('fight.bannerGone', 'This fight is no longer available.');
        else if (presence.away && oppP && ['prepare', 'countdown', 'inspection', 'solving', 'review'].includes(v.phase)) {
            bannerText = fill(t('fight.bannerOppAway', '{name} lost connection. If they are not back in {s}s, you win by forfeit.'), {
                name: oppP.name, s: Math.ceil(E.presence(v, opp, now).graceLeft / 1000),
            });
        }
        banner.textContent = bannerText;
        banner.hidden = !bannerText;

        // Leave confirmation.
        const confirm = $('.fo-confirm', root);
        const active = ['prepare', 'countdown', 'inspection', 'solving', 'review'].includes(v.phase);
        if (online.confirmLeave) {
            setHtml(confirm, `<div class="setup-card fo-proposal">
                <span>${esc(active && oppP ? t('fight.leaveForfeit', 'Leaving now forfeits the match.') : t('fight.leaveConfirm', 'Leave this fight?'))}</span>
                <button type="button" class="btn fight-btn-danger" data-act="leave-yes">${esc(t('fight.leave', 'Leave'))}</button>
                <button type="button" class="btn btn-secondary" data-act="leave-no">${esc(t('fight.stay', 'Stay'))}</button></div>`);
            confirm.hidden = false;
        } else {
            setHtml(confirm, '');
            confirm.hidden = true;
        }

        // Main section by phase.
        const main = $('.fo-main', root);
        const section = v.phase === 'lobby' ? 'lobby'
            : ['prepare', 'countdown', 'inspection', 'solving'].includes(v.phase) ? 'play'
            : v.phase === 'review' ? 'review' : 'ended';
        if (section !== online.section) {
            online.section = section;
            main.innerHTML = skeleton(section);
            main._html = null;
            if (section === 'play') {
                bindZone($('.fo-zone', main), online.seatTimer, view);
            }
        }
        if (section === 'lobby') renderLobby(main, v, now);
        else if (section === 'play') renderPlay(main, v, r);
        else if (section === 'review') renderReview(main, v, r, now);
        else renderEnded(main, v);

        if (v.phase !== online.lastPhase || r.n !== online.lastRound) {
            announce(v, r);
            if (v.phase === 'review' || v.phase === 'ended') {
                haptic([60, 40, 60]);
                online.armAt = Date.now() + 500;
            }
            if (v.phase === 'prepare' && online.lastPhase === 'lobby') haptic(80);
            online.lastPhase = v.phase;
            online.lastRound = r.n;
        }
    }

    function skeleton(section) {
        if (section === 'lobby') {
            return `<div class="setup-card fo-lobby">
                <p class="fo-note">${esc(t('fight.sendCode', 'Send this code or link to your opponent'))}</p>
                <div class="fo-big-code"></div>
                <div class="fo-link"></div>
                <div class="fo-actions">
                    <button type="button" class="btn btn-primary" data-act="share">${esc(t('fight.shareLink', 'Share link'))}</button>
                    <button type="button" class="btn btn-secondary" data-act="copy">${esc(t('fight.copyCode', 'Copy code'))}</button>
                </div>
                <p class="fo-note fo-expiry"></p>
                <p class="fo-note fo-settings"></p>
            </div>`;
        }
        if (section === 'play') {
            return `<div class="setup-card fo-scramble" aria-label="${esc(t('fight.scramble', 'Scramble'))}"></div>
                <div class="fo-zone" data-state="idle">
                    <div class="fl-time" role="timer" aria-live="off">0.00</div>
                    <div class="fl-status"></div>
                    <div class="fl-actions fo-play-actions"></div>
                    <div class="fo-hint">${esc(t('fight.spaceHint', 'Touch and hold this area, or hold the space bar.'))}</div>
                </div>
                <p class="fo-note fo-round"></p>`;
        }
        if (section === 'review') {
            return `<div class="setup-card fo-review">
                <div class="fo-review-head"></div>
                <div class="fo-review-rows"></div>
                <div class="fo-proposal-slot"></div>
                <div class="fo-actions fo-review-actions"></div>
                <p class="fo-note fo-auto"></p>
            </div>`;
        }
        return `<div class="setup-card fo-lobby fo-ended">
            <div class="fo-ended-badge"></div>
            <div class="fo-big-code fo-final-score"></div>
            <p class="fo-note fo-ended-reason"></p>
            <div class="fo-actions fo-ended-actions"></div>
        </div>`;
    }

    function settingsLine(v) {
        return fill(t('fight.settingsLine', '{event} · Best of {bo} · Inspection {insp}'), {
            event: EVENT_LABELS[v.settings.event] || v.settings.event,
            bo: v.settings.bestOf,
            insp: v.settings.inspection ? t('fight.on', 'On') : t('fight.off', 'Off'),
        });
    }

    function renderLobby(main, v, now) {
        const tr = online.transport;
        $('.fo-big-code', main).textContent = tr.code;
        $('.fo-link', main).textContent = inviteLink(tr.code);
        const left = v.expiresAt ? Math.max(0, v.expiresAt - now) : 0;
        const mm = Math.floor(left / 60000), ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        $('.fo-expiry', main).textContent = v.phase === 'lobby'
            ? fill(t('fight.expiresIn', 'Waiting for your opponent · the room closes in {t}'), { t: `${mm}:${ss}` })
            : '';
        $('.fo-settings', main).textContent = settingsLine(v);
    }

    function renderPlay(main, v, r) {
        const tr = online.transport;
        const me = tr.seat;
        const scr = $('.fo-scramble', main);
        const text = r.scramble || t('fight.scrambling', 'Generating scramble…');
        if (scr.textContent !== text) scr.textContent = text;
        let actions = '';
        if (v.phase === 'prepare') {
            const ready = !!(v.players[me] && v.players[me].ready);
            actions = `<button type="button" class="btn ${ready ? 'btn-secondary' : 'btn-primary'} fight-ready-btn" data-act="ready" ${r.scramble ? '' : 'disabled'} aria-pressed="${ready}">${esc(ready ? t('fight.notReady', 'Not ready') : t('fight.ready', 'Ready'))}</button>`;
        }
        setHtml($('.fo-play-actions', main), actions);
        $('.fo-round', main).textContent = `${fill(t('fight.roundOf', 'Round {n} · Best of {bo}'), { n: r.n || 1, bo: v.settings.bestOf })} · ${EVENT_LABELS[v.settings.event] || v.settings.event}`;
    }

    function renderReview(main, v, r, now) {
        const tr = online.transport;
        const me = tr.seat;
        const opp = E.other(me);
        const outcome = outcomeFor(v, me);
        setHtml($('.fo-review-head', main), `${badgeHtml(outcome, false)} <span class="fo-note">${esc(fill(t('fight.roundOf', 'Round {n} · Best of {bo}'), { n: r.n, bo: v.settings.bestOf }))}</span>`);

        const row = (seat) => {
            const p = v.players[seat] || {};
            const sv = r.solves && r.solves[seat];
            let extra = '';
            if (seat === me) {
                extra = penaltyButtonsHtml(v, me);
            } else if (sv) {
                const pending = r.proposals && r.proposals[opp];
                extra = `<div class="fo-propose"><span>${esc(t('fight.suggestPenalty', 'Suggest a penalty:'))}</span>` +
                    [['', 'OK'], ['+2', '+2'], ['DNF', 'DNF']].map(([pen, label]) =>
                        `<button type="button" class="btn btn-secondary btn-sm" data-propose="${pen}"${pending && pending.penalty === pen ? ' aria-pressed="true"' : ''}>${label}</button>`).join('') +
                    (pending ? `<span>${esc(fill(t('fight.proposalSent', 'Waiting for {name} to answer.'), { name: p.name }))}</span>` : '') +
                    '</div>';
            }
            return `<div class="fo-review-row">
                <span class="fo-review-name">${esc(seat === me ? fill(t('fight.youName', 'You · {name}'), { name: p.name }) : p.name)}</span>
                <span class="fo-review-time">${esc(solveText(sv) || '—')}</span>
                ${extra}
            </div>`;
        };
        setHtml($('.fo-review-rows', main), row(me) + row(opp));

        const prop = r.proposals && r.proposals[me];
        setHtml($('.fo-proposal-slot', main), prop
            ? `<div class="fo-proposal" role="alert"><span>${esc(fill(t('fight.proposalIn', '{name} suggests {pen} on your solve.'), { name: (v.players[opp] || {}).name, pen: prop.penalty || 'OK' }))}</span>
                <button type="button" class="btn btn-primary btn-sm" data-act="accept">${esc(t('fight.accept', 'Accept'))}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-act="decline">${esc(t('fight.decline', 'Decline'))}</button></div>`
            : '');

        const waiting = r.cont && r.cont[me];
        setHtml($('.fo-review-actions', main), waiting
            ? `<span class="fo-note">${esc(fill(t('fight.waitingFor', 'Waiting for {name}…'), { name: (v.players[opp] || {}).name }))}</span>`
            : `<button type="button" class="btn btn-primary" data-act="continue" ${prop ? 'disabled' : ''}>${esc(t('fight.continue', 'Continue'))}</button>`);
        const left = Math.max(0, Math.ceil((r.phaseAt + E.TIMING.REVIEW_AUTO_MS - now) / 1000));
        $('.fo-auto', main).textContent = Object.keys(r.proposals || {}).length
            ? t('fight.autoPaused', 'Waiting on a penalty answer.')
            : fill(t('fight.autoIn', 'Next round in {s}s'), { s: left });
    }

    function renderEnded(main, v) {
        const tr = online.transport;
        const me = tr.seat;
        const opp = E.other(me);
        const res = v.result || {};
        const outcome = outcomeFor(v, me);
        setHtml($('.fo-ended-badge', main), outcome ? badgeHtml(outcome, true)
            : `<span class="fight-badge fight-badge--tie">${esc(t('fight.noResult', 'No result'))}</span>`);
        $('.fo-final-score', main).textContent = `${v.score[me]} – ${v.score[opp]}`;
        const oppName = (v.players[opp] || {}).name || t('fight.opponent', 'Opponent');
        const reasons = {
            score: '',
            disconnect: res.winner === me
                ? fill(t('fight.endDisconnectWin', '{name} disconnected and did not come back.'), { name: oppName })
                : t('fight.endDisconnectLoss', 'You were disconnected for too long.'),
            left: res.winner === me
                ? fill(t('fight.endLeftWin', '{name} left the fight.'), { name: oppName })
                : t('fight.endLeftLoss', 'You left the fight.'),
            abandoned: t('fight.endAbandoned', 'The fight ended before a round was played.'),
            expired: t('fight.endExpired', 'Nobody joined in time, so the room closed.'),
            host_left: t('fight.endHostLeft', 'The room was closed.'),
        };
        $('.fo-ended-reason', main).textContent = v.phase === 'expired' ? reasons.expired : (reasons[res.reason] || '');

        const canRematch = v.phase === 'ended' && res.reason !== 'abandoned' && res.reason !== 'left'
            && v.players[opp] && !v.players[opp].left && !v.players[me].left;
        let actions = '';
        if (canRematch) {
            const asked = v.rematch && v.rematch[me];
            const theyAsked = v.rematch && v.rematch[opp];
            actions += asked
                ? `<span class="fo-note">${esc(fill(t('fight.rematchWaiting', 'Rematch asked — waiting for {name}.'), { name: oppName }))}</span>`
                : `<button type="button" class="btn btn-primary" data-act="rematch">${esc(theyAsked ? fill(t('fight.rematchAccept', 'Accept {name}’s rematch'), { name: oppName }) : t('fight.rematch', 'Rematch'))}</button>`;
        }
        actions += `<button type="button" class="btn btn-secondary" data-act="home">${esc(t('fight.backToFights', 'Back to Cube Fights'))}</button>`;
        setHtml($('.fo-ended-actions', main), actions);
        if (v.phase === 'ended' || v.phase === 'expired') forgetCurrent(tr.code);
    }

    function announce(v, r) {
        const live = $('#fight-online .fo-live');
        if (!live) return;
        const tr = online.transport;
        const me = tr.seat, opp = E.other(me);
        const oppName = (v.players[opp] || {}).name || '';
        let msg = '';
        if (v.phase === 'prepare' && r.n === 1 && online.lastPhase === 'lobby') {
            msg = fill(t('fight.sayJoined', '{name} joined. Scramble your cube and tap Ready.'), { name: oppName });
        } else if (v.phase === 'countdown') {
            msg = fill(t('fight.sayStart', 'Round {n} starting.'), { n: r.n });
        } else if (v.phase === 'review' && r.winner) {
            msg = r.winner === 'tie'
                ? fill(t('fight.sayTieOnline', 'Round {n} is a tie.'), { n: r.n })
                : r.winner === me
                    ? fill(t('fight.sayYouWonRound', 'You won round {n}: {a} against {b}.'), { n: r.n, a: solveText(r.solves[me]), b: solveText(r.solves[opp]) })
                    : fill(t('fight.sayTheyWonRound', '{name} won round {n}: {b} against {a}.'), { name: oppName, n: r.n, a: solveText(r.solves[me]), b: solveText(r.solves[opp]) });
        } else if (v.phase === 'ended' && v.result) {
            msg = v.result.winner === me ? t('fight.sayYouWon', 'You won the match.')
                : v.result.winner ? fill(t('fight.sayTheyWon', '{name} won the match.'), { name: oppName })
                : t('fight.noResult', 'No result');
        }
        if (msg) live.textContent = msg;
    }

    async function share(code) {
        const link = inviteLink(code);
        const text = fill(t('fight.shareText', 'Cube Fight me on CubingHQ — room {code}'), { code });
        try {
            if (navigator.share) { await navigator.share({ title: 'Cube Fights', text, url: link }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        copy(link);
    }

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            if (app().toast) app().toast(t('fight.copied', 'Copied'), 'success');
        } catch (e) {
            if (app().toast) app().toast(text, 'info');
        }
    }

    async function onClick(e) {
        const btn = e.target.closest('button');
        const tr = online.transport;
        if (!btn || !tr) return;
        if (Date.now() < online.armAt && !['leave', 'share', 'copy'].includes(btn.dataset.act)) return;
        const act = btn.dataset.act;
        const run = async (action) => {
            const err = await tr.dispatch(action);
            if (err && err !== 'closed' && app().toast) {
                const quiet = ['wrong_phase', 'already_done'];
                if (!quiet.includes(err)) app().toast(errorText(err, t('fight.errGeneric', 'Something went wrong. Try again.')), 'error');
            }
            render(true);
        };
        if (btn.dataset.pen !== undefined && btn.dataset.seat) {
            return run({ type: 'PENALTY', target: tr.seat, penalty: btn.dataset.pen });
        }
        if (btn.dataset.propose !== undefined) {
            return run({ type: 'PENALTY', target: E.other(tr.seat), penalty: btn.dataset.propose });
        }
        switch (act) {
            case 'share': return share(tr.code);
            case 'copy': return copy(tr.code);
            case 'ready': {
                const ready = !(tr.state.players[tr.seat] && tr.state.players[tr.seat].ready);
                return run({ type: 'READY', ready });
            }
            case 'accept': return run({ type: 'PENALTY_REPLY', accept: true });
            case 'decline': return run({ type: 'PENALTY_REPLY', accept: false });
            case 'continue': return run({ type: 'CONTINUE' });
            case 'rematch': return run({ type: 'REMATCH' });
            case 'leave': {
                const phase = view().phase;
                if (phase === 'ended' || phase === 'expired') { goHome(true); return; }
                online.confirmLeave = true;
                render(true);
                return;
            }
            case 'leave-no': online.confirmLeave = false; render(true); return;
            case 'leave-yes': goHome(true); return;
            case 'home': goHome(true); return;
            default: return;
        }
    }

    /** Back to the Cube Fights page. `leave` tells the server, so the opponent knows. */
    function goHome(leave) {
        const tr = online.transport;
        if (tr && leave) {
            tr.dispatch({ type: 'LEAVE' });
            forgetCurrent(tr.code);
        }
        closeArena();
        if (location.hash !== '#fights') history.replaceState(null, '', '#fights');
        renderHomeCard();
        S.renderHistory();
        online.historyFor = null;
        loadHistory();
    }

    // The space bar times your own solve on a keyboard.
    document.addEventListener('keydown', (e) => {
        if (!online.transport || !online.seatTimer || e.code !== 'Space' || e.repeat) return;
        if (e.target && e.target.closest && e.target.closest('input, textarea, select, button')) return;
        if (online.seatTimer.down('key-space', view())) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        if (!online.transport || !online.seatTimer || e.code !== 'Space') return;
        online.seatTimer.up('key-space');
    });

    /* ---------- entry ---------- */

    function enter(route) {
        renderHomeCard();
        if (route && route.join) {
            if (online.transport && online.transport.code === route.join) return;
            joinFight(route.join);
            return;
        }
        if (online.transport) return;
        const cur = storedCurrent();
        if (cur && signedIn()) joinFight(cur.code);   // back into a fight left mid-way
    }

    function leave() {
        // Navigating away is not leaving the fight: the grace period covers
        // a quick look elsewhere, and coming back rejoins the same seat.
        closeArena();
    }

    window.FightOnline = {
        enter,
        leave,
        renderHomeCard,
        historyRecords,
        renderStats,
        syncLocalRecord,
        _state: online,
    };
})();
