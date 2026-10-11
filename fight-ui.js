/* ============================================================
   CubingHQ — Cube Fights (the page)
   ------------------------------------------------------------
   Head-to-head fights: two players, one scramble, best of N.

     Same device — the screen split in two, player 2's half turned
       to face them, one touch zone each. Runs entirely on this
       device (FightTransport.createLocalTransport), offline too.
     Online — two devices, the server as referee
       (FightTransport.createOnlineTransport). Needs an account.

   The rules are FightEngine's and the timing is TimerCore's — one
   TimerCore per player, so each half of a split screen is exactly
   the solo timer, twice. This file only draws and listens.

   Entered from app.js's router: #fights, or #fight/CODE for an
   invite link.
   ============================================================ */
(function () {
    'use strict';

    const E = window.FightEngine;
    const TC = window.TimerCore;
    const FT = window.FightTransport;

    const t = (key, fallback) => (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);
    const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    const app = () => window.CubingHQApp || {};
    const $ = (s, root) => (root || document).querySelector(s);
    const $$ = (s, root) => Array.from((root || document).querySelectorAll(s));

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const EVENT_LABELS = {
        '333': '3x3', '222': '2x2', '444': '4x4', '555': '5x5', '666': '6x6', '777': '7x7',
        '333oh': '3x3 OH', 'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1',
        'minx': 'Megaminx', 'clock': 'Clock',
    };

    // Short buzzes where the platform has them (not iOS Safari). Purely
    // additive: every cue is also on screen.
    function haptic(pattern) {
        try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
    }

    /* ======================= settings ======================= */

    const SETTINGS_KEY = 'chq_fight_settings';
    const settings = Object.assign(
        { event: '333', bestOf: 3, inspection: true, p1Name: '', p2Name: '', layout: 'auto' },
        (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { return {}; } })(),
    );
    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
    }
    function fightSettings() {
        return E.normalizeSettings({ event: settings.event, bestOf: settings.bestOf, inspection: settings.inspection });
    }

    /* ======================= history ======================= */
    // Finished fights. Local ones live on this device; online ones are
    // written by the server for signed-in players (see FightHistory in
    // the online section) and merged in for display.

    const HISTORY_KEY = 'chq_fight_history';
    const HISTORY_MAX = 50;

    function localHistory() {
        try {
            const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    /** A finished match as a history record, from either seat's point of view. */
    function recordFor(state, mySeat) {
        const res = state.result || {};
        const rounds = Object.values(state.rounds || {})
            .filter(r => r.final)
            .sort((a, b) => a.n - b.n)
            .map(r => ({
                n: r.n,
                p1: r.solves.p1 ? { ms: r.solves.p1.ms, penalty: r.solves.p1.penalty } : null,
                p2: r.solves.p2 ? { ms: r.solves.p2.ms, penalty: r.solves.p2.penalty } : null,
                winner: r.winner,
            }));
        return {
            id: `${state.mode}-${state.createdAt}-${state.match}`,
            at: Date.now(),
            mode: state.mode,
            event: state.settings.event,
            bestOf: state.settings.bestOf,
            inspection: state.settings.inspection,
            players: {
                p1: state.players.p1 ? state.players.p1.name : '',
                p2: state.players.p2 ? state.players.p2.name : '',
            },
            seat: mySeat || null,
            winner: res.winner || null,
            reason: res.reason || 'score',
            score: Object.assign({ p1: 0, p2: 0 }, res.score || state.score),
            rounds,
        };
    }

    function saveLocalRecord(record) {
        const list = localHistory().filter(r => r.id !== record.id);
        list.unshift(record);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) { /* full */ }
        if (window.FightOnline && window.FightOnline.syncLocalRecord) window.FightOnline.syncLocalRecord(record);
        renderHistory();
    }

    /* ======================= per-seat display ======================= */

    function solveText(sv) {
        if (!sv) return '';
        if (sv.penalty === 'DNF') return sv.ms ? `DNF (${TC.fmt(sv.ms)})` : 'DNF';
        if (sv.penalty === '+2') return `${TC.fmt(sv.ms + 2000)}+`;
        return TC.fmt(sv.ms);
    }

    /**
     * What one seat's panel shows right now. Shared by the split screen and
     * the online arena, so both describe a moment of the fight the same way.
     */
    function seatView(view, seat, timer, now) {
        const round = E.current(view) || {};
        const solve = round.solves && round.solves[seat];
        const opp = E.other(seat);
        const p = view.players[seat] || {};
        const out = { zone: 'idle', time: '', status: '', canTime: false };

        switch (view.phase) {
            case 'lobby':
                out.status = t('fight.waitingOpponent', 'Waiting for an opponent…');
                break;
            case 'prepare':
                out.time = p.ready ? '✓' : '';
                out.status = p.ready
                    ? t('fight.readyWaiting', 'Ready — waiting for the other player')
                    : t('fight.scrambleThenReady', 'Scramble your cube, then tap Ready');
                out.zone = p.ready ? 'armed' : 'idle';
                break;
            case 'countdown': {
                const left = E.countdownLeft(view, now);
                out.time = left === null ? '' : (left > 3000 ? '…' : String(Math.max(1, Math.ceil(left / 1000))));
                out.status = t('fight.getReady', 'Get ready');
                out.zone = 'countdown';
                break;
            }
            case 'inspection':
            case 'solving':
            case 'review':
            case 'ended':
                if (solve) {
                    out.time = solveText(solve);
                    out.zone = 'done';
                    out.status = view.phase === 'review' || view.phase === 'ended' ? ''
                        : fill(t('fight.waitingFor', 'Waiting for {name}…'), { name: (view.players[opp] || {}).name || '' });
                    break;
                }
                if (view.phase === 'review' || view.phase === 'ended') break;
                out.canTime = true;
                if (!timer) break;
                switch (timer.phase) {
                    case 'inspecting': {
                        const left = timer.inspectionLeft(now);
                        out.time = left > 0 ? String(Math.ceil(left / 1000)) : (left > -2000 ? '+2' : 'DNF');
                        out.status = t('fight.inspectHold', 'Inspect — hold to start');
                        out.zone = left > 0 ? 'inspecting' : 'warning';
                        break;
                    }
                    case 'holding':
                        out.time = '0.00';
                        out.status = t('fight.keepHolding', 'Keep holding…');
                        out.zone = 'holding';
                        break;
                    case 'ready':
                        out.time = '0.00';
                        out.status = t('fight.releaseToStart', 'Release to start');
                        out.zone = 'ready';
                        break;
                    case 'running':
                        out.time = TC.fmt(timer.elapsed(now));
                        out.status = t('fight.tapToStop', 'Tap to stop');
                        out.zone = 'running';
                        break;
                    case 'stopped':
                    case 'inspection_dnf':
                        out.time = timer.result ? solveText(timer.result) : '';
                        out.zone = 'done';
                        break;
                    default:
                        out.time = '0.00';
                        out.status = t('fight.holdToStart', 'Hold to start');
                        out.zone = 'idle';
                }
                break;
            default:
                break;
        }
        return out;
    }

    /** Round or match outcome for a seat: 'win' | 'loss' | 'tie' | null. */
    function outcomeFor(view, seat) {
        if (view.phase === 'ended' && view.result) {
            if (!view.result.winner) return null;
            return view.result.winner === seat ? 'win' : 'loss';
        }
        if (view.phase === 'review') {
            const r = E.current(view);
            if (!r || !r.winner) return null;
            if (r.winner === 'tie') return 'tie';
            return r.winner === seat ? 'win' : 'loss';
        }
        return null;
    }

    function badgeHtml(outcome, isMatch) {
        if (!outcome) return '';
        // Never colour alone: a word and a shape say who won.
        if (outcome === 'win') {
            return `<span class="fight-badge fight-badge--win"><span aria-hidden="true">👑</span> ${esc(isMatch ? t('fight.winner', 'WINNER') : t('fight.roundWin', 'Round win'))}</span>`;
        }
        if (outcome === 'tie') {
            return `<span class="fight-badge fight-badge--tie"><span aria-hidden="true">=</span> ${esc(t('fight.tie', 'Tie — replay'))}</span>`;
        }
        return `<span class="fight-badge fight-badge--loss"><span aria-hidden="true">✕</span> ${esc(isMatch ? t('fight.lost', 'Lost') : t('fight.roundLoss', 'Round lost'))}</span>`;
    }

    function penaltyButtonsHtml(view, seat) {
        const r = E.current(view);
        const sv = r && r.solves && r.solves[seat];
        if (!sv) return '';
        const sev = { '': 0, '+2': 1, 'DNF': 2 };
        return `<div class="fight-penalties" role="group" aria-label="${esc(t('fight.penalty', 'Penalty'))}">` +
            [['', 'OK'], ['+2', '+2'], ['DNF', 'DNF']].map(([p, label]) => {
                const pressed = sv.penalty === p;
                const disabled = sev[p] < sev[sv.auto || ''];
                return `<button type="button" class="fight-pen-btn${pressed ? ' active' : ''}" data-pen="${p}" data-seat="${seat}" aria-pressed="${pressed}"${disabled ? ' disabled' : ''}>${label}</button>`;
            }).join('') + '</div>';
    }

    /** innerHTML, but only when it actually changes — a button rebuilt under
        a finger loses the press, and focus with it. */
    function setHtml(el, html) {
        if (el && el._html !== html) { el.innerHTML = html; el._html = html; }
    }

    /* ======================= timers + touch ======================= */

    /**
     * One TimerCore per seat, armed by the fight's phase, plus the touch
     * zone that drives it. Multi-touch safe: each zone tracks its own
     * pointer ids, so two thumbs on two halves never interfere.
     */
    function createSeatTimer(seat, transport, hooks) {
        const timer = TC.createSolveTimer({
            holdMs: 300,
            inspection: false,           // inspection is started by the round, not a press
            inspectionRule: 'wca',
            now: transport.now,
            onChange(phase, prev, info) {
                if (phase === 'ready') haptic(15);
                if (phase === 'running') {
                    haptic(25);
                    transport.dispatch({ type: 'START', seat, penalty: timer.startPenalty });
                } else if (phase === 'stopped') {
                    haptic(45);
                    lockUntil = transport.now() + 700;
                    transport.dispatch({ type: 'SUBMIT', seat, ms: info.ms, penalty: info.penalty });
                } else if (phase === 'inspection_dnf') {
                    haptic([40, 40, 40]);
                    transport.dispatch({ type: 'SUBMIT', seat, ms: null, penalty: 'DNF' });
                }
                hooks.changed();
            },
        });
        let armedRound = 0;
        let lockUntil = 0;
        const pointers = new Set();

        /** Line the timer up with the fight: a new round resets it, the round's start arms it. */
        function sync(view) {
            const r = E.current(view);
            if (!r) return;
            if (view.phase === 'prepare' || view.phase === 'countdown' || view.phase === 'lobby') {
                if (timer.phase !== 'idle') timer.reset();
                armedRound = 0;
                return;
            }
            if ((view.phase === 'inspection' || view.phase === 'solving') && armedRound !== r.n) {
                armedRound = r.n;
                timer.reset();
                if (view.settings.inspection && !(r.solves && r.solves[seat])) {
                    timer.startInspection(r.startAt);
                }
            }
        }

        function canPress(view) {
            if (view.phase !== 'inspection' && view.phase !== 'solving') return false;
            const r = E.current(view);
            if (!r || (r.solves && r.solves[seat])) return false;
            if (transport.now() < lockUntil) return false;
            if (view.settings.inspection && timer.phase === 'idle') return false;
            return !['stopped', 'inspection_dnf'].includes(timer.phase);
        }

        function down(id, view) {
            if (!canPress(view)) return false;
            pointers.add(id);
            if (pointers.size === 1) timer.press(transport.now());
            return true;
        }
        function up(id) {
            if (!pointers.delete(id) || pointers.size) return;
            timer.release(transport.now());
        }

        return { seat, timer, sync, down, up, canPress, reset: () => { timer.reset(); armedRound = 0; pointers.clear(); } };
    }

    /** Wires a zone element to a seat timer with pointer events. */
    function bindZone(zone, seatTimer, getView) {
        const opts = { passive: false };
        zone.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button, a, input, select')) return;
            if (!seatTimer.down(e.pointerId, getView())) return;
            e.preventDefault();
            try { zone.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        }, opts);
        const lift = (e) => seatTimer.up(e.pointerId);
        zone.addEventListener('pointerup', lift);
        zone.addEventListener('pointercancel', lift);
        zone.addEventListener('lostpointercapture', lift);
        // A long press must not open a context menu or start a text selection.
        zone.addEventListener('contextmenu', (e) => e.preventDefault());
        zone.addEventListener('touchstart', (e) => { if (!e.target.closest('button')) e.preventDefault(); }, opts);
    }

    /* ======================= split screen ======================= */

    const local = {
        transport: null,
        root: null,
        seats: {},
        raf: null,
        lastKey: '',
        lastPhase: '',
        lastRound: 0,
        confirmExit: false,
        savedMatch: 0,
        armAt: 0,
    };

    function layoutFor() {
        if (settings.layout === 'face' || settings.layout === 'side') return settings.layout;
        return window.matchMedia && window.matchMedia('(orientation: landscape)').matches ? 'side' : 'face';
    }

    function startLocal() {
        const me = app().profile ? app().profile() : null;
        const p1 = (settings.p1Name || '').trim() || (me && me.name) || t('fight.player1', 'Player 1');
        const p2 = (settings.p2Name || '').trim() || t('fight.player2', 'Player 2');
        local.transport = FT.createLocalTransport({ settings: fightSettings(), p1: { name: p1 }, p2: { name: p2 } });
        local.lastKey = '';
        local.lastPhase = '';
        local.lastRound = 0;
        local.confirmExit = false;
        local.savedMatch = 0;

        const root = $('#fight-local');
        local.root = root;
        root.innerHTML = `
            <div class="fl-arena" data-layout="${layoutFor()}">
                ${['p2', 'p1'].map(seat => `
                    <section class="fl-half fl-${seat}" data-seat="${seat}" aria-label="">
                        <div class="fl-zone" data-seat="${seat}" data-state="idle">
                            <div class="fl-head"><span class="fl-name"></span><span class="fl-score" aria-label=""></span></div>
                            <div class="fl-scramble" aria-live="off"></div>
                            <div class="fl-badge-slot"></div>
                            <div class="fl-time" role="timer" aria-live="off">0.00</div>
                            <div class="fl-status"></div>
                            <div class="fl-actions"></div>
                        </div>
                    </section>`).join('')}
                <div class="fl-bar">
                    <button type="button" class="fl-bar-btn fl-exit" aria-label="${esc(t('fight.exit', 'Leave fight'))}">✕</button>
                    <div class="fl-bar-info">
                        <span class="fl-round"></span>
                        <span class="fl-bar-score"></span>
                    </div>
                    <div class="fl-bar-actions"></div>
                    <button type="button" class="fl-bar-btn fl-layout" aria-label="${esc(t('fight.layout', 'Switch layout'))}" title="${esc(t('fight.layout', 'Switch layout'))}">⇅</button>
                    <div class="fl-live fight-sr-only" aria-live="polite"></div>
                </div>
            </div>`;
        root.hidden = false;
        document.body.classList.add('fight-arena-open');

        ['p1', 'p2'].forEach(seat => {
            local.seats[seat] = createSeatTimer(seat, local.transport, { changed: () => renderLocal(true) });
            bindZone($(`.fl-zone[data-seat="${seat}"]`, root), local.seats[seat], () => localView());
        });

        root.addEventListener('click', onLocalClick);
        local.transport.subscribe(() => renderLocal(true));
        if (window.AppWakeLock) window.AppWakeLock.acquire();
        try {
            const el = document.documentElement;
            if (el.requestFullscreen && !document.fullscreenElement && window.matchMedia('(pointer: coarse)').matches) {
                el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
            }
        } catch (e) { /* not available */ }

        renderLocal(true);
        localFrame();
    }

    function localView() {
        const tr = local.transport;
        return E.tick(tr.state, tr.now());
    }

    function closeLocal() {
        if (local.raf) cancelAnimationFrame(local.raf);
        local.raf = null;
        if (local.transport) local.transport.close();
        local.transport = null;
        Object.values(local.seats).forEach(s => s.reset());
        local.seats = {};
        if (local.root) {
            local.root.removeEventListener('click', onLocalClick);
            local.root.innerHTML = '';
            local.root.hidden = true;
        }
        document.body.classList.remove('fight-arena-open');
        try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
        renderHistory();
    }

    function localFrame() {
        local.raf = requestAnimationFrame(localFrame);
        const tr = local.transport;
        if (!tr) return;
        tr.tick();
        const view = localView();
        const now = tr.now();
        ['p1', 'p2'].forEach(seat => {
            const st = local.seats[seat];
            st.sync(view);
            st.timer.tick(now);
            const sv = seatView(view, seat, st.timer, now);
            const zone = $(`.fl-zone[data-seat="${seat}"]`, local.root);
            if (!zone) return;
            const timeEl = $('.fl-time', zone);
            if (timeEl.textContent !== sv.time) timeEl.textContent = sv.time;
            if (zone.dataset.state !== sv.zone) zone.dataset.state = sv.zone;
            const statusEl = $('.fl-status', zone);
            if (statusEl.textContent !== sv.status) statusEl.textContent = sv.status;
        });
        // Countdown buzz, once per second.
        if (view.phase === 'countdown') {
            const left = E.countdownLeft(view, now);
            const sec = left !== null && left <= 3000 ? Math.ceil(left / 1000) : 0;
            if (sec && sec !== local.lastBuzz) { local.lastBuzz = sec; haptic(30); }
        } else {
            local.lastBuzz = 0;
        }
        renderLocal(false, view);
    }

    function renderLocal(force, viewArg) {
        const tr = local.transport;
        if (!tr || !local.root) return;
        const view = viewArg || localView();
        const round = E.current(view) || {};
        const key = JSON.stringify([view.phase, view.seq, round.n, round.scramble, local.confirmExit,
            view.players.p1 && view.players.p1.ready, view.players.p2 && view.players.p2.ready,
            local.seats.p1 && local.seats.p1.timer.phase, local.seats.p2 && local.seats.p2.timer.phase]);
        if (!force && key === local.lastKey) return;
        local.lastKey = key;

        const arena = $('.fl-arena', local.root);
        const need = E.winsNeeded(view.settings.bestOf);

        ['p1', 'p2'].forEach(seat => {
            const p = view.players[seat];
            const half = $(`.fl-half[data-seat="${seat}"]`, arena);
            half.setAttribute('aria-label', p.name);
            $('.fl-name', half).textContent = p.name;
            const score = $('.fl-score', half);
            score.textContent = String(view.score[seat]);
            score.setAttribute('aria-label', fill(t('fight.scoreOf', '{n} of {need} wins'), { n: view.score[seat], need }));

            const scr = $('.fl-scramble', half);
            const showScramble = ['prepare', 'countdown', 'inspection', 'solving'].includes(view.phase);
            const text = showScramble ? (round.scramble || t('fight.scrambling', 'Generating scramble…')) : '';
            if (scr.textContent !== text) scr.textContent = text;
            scr.classList.toggle('fl-scramble--long', text.length > 90);
            scr.hidden = !text;

            const outcome = outcomeFor(view, seat);
            $('.fl-badge-slot', half).innerHTML = badgeHtml(outcome, view.phase === 'ended');

            let actionsHtml = '';
            if (view.phase === 'prepare') {
                const ready = !!p.ready;
                actionsHtml = `<button type="button" class="btn ${ready ? 'btn-secondary' : 'btn-primary'} fight-ready-btn" data-ready="${seat}" ${round.scramble ? '' : 'disabled'} aria-pressed="${ready}">${esc(ready ? t('fight.notReady', 'Not ready') : t('fight.ready', 'Ready'))}</button>`;
            } else if (view.phase === 'review') {
                actionsHtml = penaltyButtonsHtml(view, seat);
            }
            setHtml($('.fl-actions', half), actionsHtml);
        });

        $('.fl-round', arena).textContent = view.phase === 'ended'
            ? t('fight.matchOver', 'Match over')
            : fill(t('fight.roundOf', 'Round {n} · Best of {bo}'), { n: round.n || 1, bo: view.settings.bestOf });
        $('.fl-bar-score', arena).textContent = `${view.score.p1} – ${view.score.p2}`;
        $('.fl-bar-score', arena).setAttribute('aria-label',
            `${view.players.p1.name} ${view.score.p1}, ${view.players.p2.name} ${view.score.p2}`);

        let barHtml = '';
        if (local.confirmExit) {
            barHtml = `<span class="fl-confirm-text">${esc(t('fight.leaveConfirm', 'Leave this fight?'))}</span>
                <button type="button" class="btn btn-sm fight-btn-danger" data-act="exit-yes">${esc(t('fight.leave', 'Leave'))}</button>
                <button type="button" class="btn btn-sm btn-secondary" data-act="exit-no">${esc(t('fight.stay', 'Stay'))}</button>`;
        } else if (view.phase === 'review') {
            barHtml = `<button type="button" class="btn btn-primary" data-act="next">${esc(t('fight.nextRound', 'Next round'))}</button>`;
        } else if (view.phase === 'ended') {
            barHtml = `<button type="button" class="btn btn-primary" data-act="rematch">${esc(t('fight.rematch', 'Rematch'))}</button>
                <button type="button" class="btn btn-secondary" data-act="new">${esc(t('fight.newFight', 'New fight'))}</button>`;
        }
        setHtml($('.fl-bar-actions', arena), barHtml);

        // Announce what changed, once.
        if (view.phase !== local.lastPhase || round.n !== local.lastRound) {
            announceLocal(view, round);
            if (view.phase === 'review' || view.phase === 'ended') haptic([60, 40, 60]);
            // Penalty and next-round buttons appear the instant the last
            // solve stops, under the finger that stopped it; that tap must
            // not land on them.
            if (view.phase === 'review' || view.phase === 'ended') local.armAt = Date.now() + 500;
            local.lastPhase = view.phase;
            local.lastRound = round.n;
        }

        if (view.phase === 'ended' && local.savedMatch !== view.match) {
            local.savedMatch = view.match;
            saveLocalRecord(recordFor(view, null));
        }
    }

    function announceLocal(view, round) {
        const live = $('.fl-live', local.root);
        if (!live) return;
        let msg = '';
        if (view.phase === 'review' && round.winner) {
            const t1 = solveText(round.solves.p1), t2 = solveText(round.solves.p2);
            msg = round.winner === 'tie'
                ? fill(t('fight.sayTie', 'Round {n} is a tie: {t1} and {t2}.'), { n: round.n, t1, t2 })
                : fill(t('fight.sayRound', 'Round {n} to {name}: {t1} against {t2}.'), {
                    n: round.n,
                    name: view.players[round.winner].name,
                    t1: round.winner === 'p1' ? t1 : t2,
                    t2: round.winner === 'p1' ? t2 : t1,
                });
        } else if (view.phase === 'ended' && view.result && view.result.winner) {
            msg = fill(t('fight.sayMatch', '{name} wins the match {a} to {b}.'), {
                name: view.players[view.result.winner].name,
                a: Math.max(view.score.p1, view.score.p2),
                b: Math.min(view.score.p1, view.score.p2),
            });
        } else if (view.phase === 'countdown') {
            msg = fill(t('fight.sayStart', 'Round {n} starting.'), { n: round.n });
        }
        if (msg) live.textContent = msg;
    }

    function onLocalClick(e) {
        const btn = e.target.closest('button');
        if (!btn || !local.transport) return;
        if (Date.now() < local.armAt && !btn.classList.contains('fl-exit')) return;
        const tr = local.transport;
        if (btn.classList.contains('fl-exit')) {
            const phase = tr.state.phase;
            if (phase === 'ended') { closeLocal(); return; }
            local.confirmExit = true;
            renderLocal(true);
            return;
        }
        if (btn.classList.contains('fl-layout')) {
            const arena = $('.fl-arena', local.root);
            const next = arena.dataset.layout === 'face' ? 'side' : 'face';
            arena.dataset.layout = next;
            settings.layout = next;
            saveSettings();
            return;
        }
        if (btn.dataset.ready) {
            const seat = btn.dataset.ready;
            const ready = !(tr.state.players[seat] && tr.state.players[seat].ready);
            tr.dispatch({ type: 'READY', seat, ready });
            return;
        }
        if (btn.dataset.pen !== undefined && btn.dataset.seat) {
            tr.dispatch({ type: 'PENALTY', seat: btn.dataset.seat, target: btn.dataset.seat, penalty: btn.dataset.pen });
            return;
        }
        switch (btn.dataset.act) {
            case 'exit-yes': closeLocal(); break;
            case 'exit-no': local.confirmExit = false; renderLocal(true); break;
            case 'next': tr.dispatch({ type: 'CONTINUE', seat: 'p1', both: true }); break;
            case 'rematch': tr.dispatch({ type: 'REMATCH', seat: 'p1', both: true }); break;
            case 'new': closeLocal(); break;
            default: break;
        }
    }

    // Keyboard for two players at one desk: A for the left/bottom player,
    // L for the other. Space does nothing here on purpose — it would be
    // ambiguous.
    const KEY_SEATS = { KeyA: 'p1', KeyL: 'p2' };
    document.addEventListener('keydown', (e) => {
        if (!local.transport || e.repeat) return;
        const seat = KEY_SEATS[e.code];
        if (!seat) return;
        if (local.seats[seat].down('key-' + e.code, localView())) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
        if (!local.transport) return;
        const seat = KEY_SEATS[e.code];
        if (seat) local.seats[seat].up('key-' + e.code);
    });

    /* ======================= home ======================= */

    let homeBound = false;

    function bindHome() {
        if (homeBound) return;
        homeBound = true;
        const eventSel = $('#fight-event');
        if (eventSel) {
            eventSel.innerHTML = E.EVENTS.map(id =>
                `<option value="${id}">${esc(EVENT_LABELS[id] || id)}</option>`).join('');
            eventSel.value = settings.event;
            eventSel.addEventListener('change', () => { settings.event = eventSel.value; saveSettings(); });
        }
        chipGroup('#fight-bestof', 'bestof', String(settings.bestOf), v => { settings.bestOf = Number(v); saveSettings(); });
        chipGroup('#fight-inspection', 'inspection', settings.inspection ? 'on' : 'off', v => { settings.inspection = v === 'on'; saveSettings(); });

        ['p1', 'p2'].forEach(seat => {
            const input = $(`#fight-${seat}-name`);
            if (!input) return;
            input.value = settings[`${seat}Name`] || '';
            input.addEventListener('input', () => { settings[`${seat}Name`] = input.value.slice(0, 24); saveSettings(); });
        });

        const startBtn = $('#fight-local-start');
        if (startBtn) startBtn.addEventListener('click', startLocal);

        document.addEventListener('app-language-changed', () => {
            if (isFightsView()) renderHome();
        });
        document.addEventListener('chq-auth-changed', () => {
            if (isFightsView()) renderHome();
        });
    }

    function chipGroup(sel, key, current, onPick) {
        const row = $(sel);
        if (!row) return;
        $$('[data-' + key + ']', row).forEach(c => {
            const on = c.dataset[key] === current;
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', String(on));
        });
        row.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-' + key + ']');
            if (!chip) return;
            $$('[data-' + key + ']', row).forEach(c => {
                c.classList.toggle('active', c === chip);
                c.setAttribute('aria-pressed', String(c === chip));
            });
            onPick(chip.dataset[key]);
        });
    }

    function isFightsView() {
        const v = $('#fights-view');
        return !!(v && v.classList.contains('active'));
    }

    function renderHome() {
        const p1 = $('#fight-p1-name');
        const me = app().profile ? app().profile() : null;
        if (p1) p1.placeholder = (me && me.name) || t('fight.player1', 'Player 1');
        if (window.FightOnline && window.FightOnline.renderHomeCard) window.FightOnline.renderHomeCard();
        renderHistory();
    }

    function historyRowHtml(r) {
        const ev = EVENT_LABELS[r.event] || r.event;
        const date = new Date(r.at).toLocaleDateString();
        const mine = r.seat;
        let title, outcome;
        if (r.mode === 'online' && mine) {
            const opp = r.players[E.other(mine)] || '?';
            title = fill(t('fight.vs', 'vs {name}'), { name: opp });
            outcome = !r.winner ? 'none' : (r.winner === mine ? 'win' : 'loss');
        } else {
            title = `${r.players.p1} – ${r.players.p2}`;
            outcome = r.winner ? 'local' : 'none';
        }
        const a = mine ? r.score[mine] : r.score.p1;
        const b = mine ? r.score[E.other(mine)] : r.score.p2;
        const label = outcome === 'win' ? t('fight.histWin', 'Win')
            : outcome === 'loss' ? t('fight.histLoss', 'Loss')
            : outcome === 'local' ? fill(t('fight.histWinner', '{name} won'), { name: r.players[r.winner] })
            : t('fight.histNoResult', 'No result');
        const reason = r.reason && r.reason !== 'score'
            ? ` · ${esc({ disconnect: t('fight.reasonDisconnect', 'opponent disconnected'), left: t('fight.reasonLeft', 'opponent left') }[r.reason] || r.reason)}`
            : '';
        const rounds = (r.rounds || []).map(x => {
            const s1 = solveText(x.p1), s2 = solveText(x.p2);
            return `<li>${esc(fill(t('fight.histRound', 'R{n}'), { n: x.n }))}: ${esc(s1 || '—')} / ${esc(s2 || '—')}${x.winner === 'tie' ? ' (=)' : ''}</li>`;
        }).join('');
        return `<li class="fight-hist-row fight-hist-row--${outcome}">
            <details>
                <summary>
                    <span class="fight-hist-title">${esc(title)}</span>
                    <span class="fight-hist-score">${a}–${b}</span>
                    <span class="fight-hist-outcome">${esc(label)}</span>
                    <span class="fight-hist-meta">${esc(ev)} · Bo${r.bestOf} · ${r.mode === 'online' ? esc(t('fight.online', 'Online')) : esc(t('fight.sameDevice', 'Same device'))} · ${esc(date)}${reason}</span>
                </summary>
                <ol class="fight-hist-rounds">${rounds}</ol>
            </details>
        </li>`;
    }

    function renderHistory() {
        const list = $('#fight-history-list');
        if (!list) return;
        const online = (window.FightOnline && window.FightOnline.historyRecords) ? window.FightOnline.historyRecords() : [];
        const seen = new Set();
        const all = online.concat(localHistory())
            .filter(r => !seen.has(r.id) && seen.add(r.id))
            .sort((a, b) => b.at - a.at)
            .slice(0, 30);
        const empty = $('#fight-history-empty');
        if (empty) empty.hidden = all.length > 0;
        list.innerHTML = all.map(historyRowHtml).join('');
        if (window.FightOnline && window.FightOnline.renderStats) window.FightOnline.renderStats();
    }

    /* ======================= entry ======================= */

    function enter(route) {
        bindHome();
        renderHome();
        if (window.FightOnline && window.FightOnline.enter) window.FightOnline.enter(route || {});
    }

    function leave() {
        if (local.transport) closeLocal();
        if (window.FightOnline && window.FightOnline.leave) window.FightOnline.leave();
    }

    window.CubeFights = {
        enter,
        leave,
        // Shared with the online arena (FightOnline) and the tests.
        _shared: {
            t, fill, esc, $, $$, EVENT_LABELS, haptic, seatView, outcomeFor, badgeHtml,
            penaltyButtonsHtml, solveText, createSeatTimer, setHtml, bindZone, recordFor,
            saveLocalRecord, renderHistory, settings, saveSettings, fightSettings,
        },
        _local: local,
    };
})();
