/* ============================================================
   CubingHQ — Cube Fights transports
   ------------------------------------------------------------
   The only part of Cube Fights that differs between the two modes.
   Both transports hand the page the same object:

     state            the fight as last known (FightEngine state)
     now()            the fight's clock, in ms
     seat             'p1' | 'p2' online; null locally (both seats here)
     dispatch(a)      apply an action; resolves to an error code or null
     tick()           let time move the fight on (countdown, timeouts)
     subscribe(fn)    called with the state whenever it changes
     close()

   Local: the engine runs right here, on this device's clock. No
   network, so it works offline. Scrambles come from ScrambleEngine,
   the same generator the timer uses.

   Online (createOnlineTransport, further down): the server owns the
   state and the clock. See that section.
   ============================================================ */
(function () {
    'use strict';

    const E = window.FightEngine;

    // Monotonic and epoch-based: survives the system clock being changed
    // mid-fight, and is comparable with server timestamps once offset.
    function deviceClock() {
        return (performance.timeOrigin || 0) + performance.now();
    }

    function emitter() {
        const subs = new Set();
        return {
            on(fn) { subs.add(fn); return () => subs.delete(fn); },
            emit(v) { subs.forEach(fn => { try { fn(v); } catch (e) { console.error('[fights]', e); } }); },
            clear() { subs.clear(); },
        };
    }

    /* ======================= local ======================= */

    function createLocalTransport({ settings, p1, p2 }) {
        const now = deviceClock;
        let state = E.create({ mode: 'local', settings, host: p1, guest: p2, now: now() });
        const changes = emitter();
        let generating = { current: false, next: false };
        let closed = false;

        function commit(next) {
            if (next === state) return;
            state = next;
            changes.emit(state);
            fillScrambles();
        }

        // Keep the round's scramble and the next one ready. The next one
        // is generated during the current round, so a round never waits
        // on the scramble worker.
        function fillScrambles() {
            if (closed) return;
            const need = E.needsScramble(state);
            ['current', 'next'].forEach(target => {
                if (!need[target] || generating[target]) return;
                generating[target] = true;
                const engine = window.ScrambleEngine;
                const job = engine ? engine.get(state.settings.event) : Promise.resolve("R U R' U'");
                job.then(scramble => {
                    generating[target] = false;
                    if (closed) return;
                    const r = E.reduce(state, { type: 'SCRAMBLE', target, scramble }, now());
                    if (!r.error) commit(r.state);
                }).catch(err => {
                    generating[target] = false;
                    console.error('[fights] scramble failed', err);
                });
            });
        }

        const api = {
            mode: 'local',
            seat: null,
            now,
            deviceNow: deviceClock,
            toDevice: (t) => t,
            get state() { return state; },
            dispatch(action) {
                if (closed) return Promise.resolve('closed');
                const r = E.reduce(state, action, now());
                if (!r.error) commit(r.state);
                return Promise.resolve(r.error);
            },
            tick() {
                // Only these phases change with time alone locally; review
                // waits for the players and online presence does not apply.
                if (closed || !['countdown', 'inspection', 'solving'].includes(state.phase)) return;
                const next = E.tick(state, now());
                if (next.phase !== state.phase || JSON.stringify(next) !== JSON.stringify(state)) commit(next);
            },
            subscribe: changes.on,
            close() { closed = true; changes.clear(); },
        };
        fillScrambles();
        return api;
    }

    /* ======================= online ======================= */
    //
    // The server owns the fight: every action goes to /api/fight/act and
    // the reply is the fight after it. Between actions the page learns of
    // changes in one of two ways:
    //
    //   - streamed straight from the database (EventSource on the fight's
    //     node), when the read rule for /fights is in place — near-instant
    //     and costs no function calls;
    //   - otherwise by polling the same endpoint, about once a second while
    //     a round is live.
    //
    // Either way a heartbeat ('SEEN') goes out every few seconds; a device
    // that goes quiet shows as disconnected and, after the grace period,
    // forfeits. Hidden tabs throttle timers, which is exactly the "phone
    // locked" case the grace period exists for.
    //
    // Clock: every reply carries the server's time. The offset to this
    // device's clock is estimated NTP-style, keeping the sample with the
    // shortest round trip, so the 3-2-1 and inspection start on both devices
    // at the same server instant. Solves themselves are timed on the device
    // clock (deviceNow) and never shifted by the offset.

    const RTDB_URL = 'https://simulatecubing-default-rtdb.firebaseio.com';
    const HEARTBEAT_MS = 4000;
    const POLL_ACTIVE_MS = 1000;
    const POLL_IDLE_MS = 3000;
    const OFFLINE_AFTER_MS = 8000;

    function authHeaders() {
        const app = window.CubingHQApp;
        const token = app && app.authToken ? app.authToken() : null;
        const h = { 'Content-Type': 'application/json' };
        if (token) h.Authorization = `Bearer ${token}`;
        return h;
    }

    /** One call to /api/fight/<action>, timed for the clock estimate. */
    async function callApi(action, body, method = 'POST') {
        const t0 = deviceClock();
        let res;
        try {
            res = await fetch(`/api/fight/${action}`, {
                method,
                headers: authHeaders(),
                body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
            });
        } catch (e) {
            return { ok: false, status: 0, error: { code: 'network', message: 'No connection.' } };
        }
        const t1 = deviceClock();
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }
        if (!res.ok) {
            return { ok: false, status: res.status, error: (data && data.error) || { code: 'http_' + res.status, message: 'Something went wrong.' } };
        }
        return { ok: true, status: res.status, data, t0, t1 };
    }

    /** Applies a Firebase streaming event (put/patch at a path) to a copy. */
    function applyStream(base, type, path, data) {
        const segs = String(path || '/').split('/').filter(Boolean);
        if (!segs.length) {
            if (type === 'put') return data === null ? null : JSON.parse(JSON.stringify(data));
            return Object.assign({}, base || {}, JSON.parse(JSON.stringify(data || {})));
        }
        const root = JSON.parse(JSON.stringify(base || {}));
        let node = root;
        for (let i = 0; i < segs.length - 1; i++) {
            if (!node[segs[i]] || typeof node[segs[i]] !== 'object') node[segs[i]] = {};
            node = node[segs[i]];
        }
        const last = segs[segs.length - 1];
        if (type === 'put') {
            if (data === null) delete node[last]; else node[last] = JSON.parse(JSON.stringify(data));
        } else {
            node[last] = Object.assign({}, node[last] || {}, JSON.parse(JSON.stringify(data || {})));
        }
        return root;
    }

    function createOnlineTransport(opts) {
        const { fightId, seat, code } = opts;
        const changes = emitter();
        const statusChanges = emitter();
        let state = E.normalize(JSON.parse(JSON.stringify(opts.state)));
        let raw = JSON.parse(JSON.stringify(opts.state));   // the database's copy, for stream patches
        let offset = 0;
        let bestRtt = Infinity;
        let closed = false;
        let lastOk = deviceClock();
        let lastSent = 0;
        let status = 'ok';
        let es = null;
        let streaming = false;
        let pollTimer = null;
        let inflight = 0;

        function learnClock(serverNow, t0, t1) {
            if (typeof serverNow !== 'number' || typeof t0 !== 'number') return;
            const rtt = t1 - t0;
            // A shorter round trip is a tighter bound on the offset. Older
            // samples age out slowly so a long-lived page can still adapt.
            bestRtt += 5;
            if (rtt <= bestRtt) {
                bestRtt = rtt;
                offset = serverNow - (t0 + t1) / 2;
            }
        }
        if (opts.serverNow && opts.t0) learnClock(opts.serverNow, opts.t0, opts.t1);
        else if (opts.serverNow) offset = opts.serverNow - deviceClock();

        function setStatus(next) {
            if (next === status) return;
            status = next;
            statusChanges.emit(status);
        }

        function accept(next) {
            if (!next || closed) return;
            const n = E.normalize(JSON.parse(JSON.stringify(next)));
            if (n.seq < state.seq) return;          // an older reply arriving late
            const changed = n.seq !== state.seq || JSON.stringify(n) !== JSON.stringify(state);
            state = n;
            if (changed) changes.emit(state);
        }

        async function send(action) {
            inflight++;
            lastSent = deviceClock();
            const r = await callApi('act', { fightId, action });
            inflight--;
            if (closed) return 'closed';
            if (!r.ok) {
                if (r.status === 0 || r.status >= 500) {
                    if (deviceClock() - lastOk > OFFLINE_AFTER_MS) setStatus('reconnecting');
                } else if (r.status === 404 || r.status === 403) {
                    setStatus('gone');
                }
                return (r.error && r.error.code) || 'error';
            }
            lastOk = deviceClock();
            setStatus('ok');
            learnClock(r.data.serverNow, r.t0, r.t1);
            if (r.data.state) {
                raw = r.data.state;
                accept(r.data.state);
            }
            return r.data.error || null;
        }

        function pollDelay() {
            const live = ['countdown', 'inspection', 'solving', 'review', 'prepare'].includes(state.phase);
            if (streaming) return HEARTBEAT_MS;
            return live ? POLL_ACTIVE_MS : POLL_IDLE_MS;
        }

        function schedule() {
            if (closed) return;
            clearTimeout(pollTimer);
            pollTimer = setTimeout(async () => {
                // A heartbeat that also fetches the fight. Skipped while
                // another request is in flight or one went out just now.
                if (!inflight && deviceClock() - lastSent > Math.min(pollDelay(), HEARTBEAT_MS) - 50) {
                    await send({ type: 'SEEN' });
                } else if (deviceClock() - lastOk > OFFLINE_AFTER_MS) {
                    setStatus('reconnecting');
                }
                schedule();
            }, pollDelay());
        }

        function startStream() {
            if (typeof EventSource === 'undefined') return;
            // CHQ_RTDB_URL lets the end-to-end harness stand in for Firebase.
            const dbUrl = opts.dbUrl || window.CHQ_RTDB_URL || RTDB_URL;
            try {
                es = new EventSource(`${dbUrl}/fights/${encodeURIComponent(fightId)}.json`);
            } catch (e) { es = null; return; }
            const onEvent = (type) => (ev) => {
                let msg;
                try { msg = JSON.parse(ev.data); } catch (e) { return; }
                if (!msg) return;
                raw = applyStream(raw, type, msg.path, msg.data);
                if (!raw) return;
                if (!streaming) { streaming = true; schedule(); }
                accept(raw);
            };
            es.addEventListener('put', onEvent('put'));
            es.addEventListener('patch', onEvent('patch'));
            // Refused by the rules (or revoked): polling it is.
            const stop = () => {
                streaming = false;
                if (es) es.close();
                es = null;
                schedule();
            };
            es.addEventListener('cancel', stop);
            es.addEventListener('auth_revoked', stop);
            es.onerror = () => {
                // Never connected at all: no read rule, or blocked. EventSource
                // would keep retrying forever; stop and poll instead.
                if (!streaming) stop();
            };
        }

        const api = {
            mode: 'online',
            seat,
            fightId,
            code,
            now: () => deviceClock() + offset,
            deviceNow: deviceClock,
            toDevice: (t) => t - offset,
            get state() { return state; },
            get status() { return status; },
            get streaming() { return streaming; },
            dispatch(action) {
                if (closed) return Promise.resolve('closed');
                return send(Object.assign({}, action, { seat: undefined }));
            },
            tick() { /* the server decides; the page derives the view with FightEngine.tick */ },
            subscribe: changes.on,
            onStatus: statusChanges.on,
            close() {
                closed = true;
                clearTimeout(pollTimer);
                if (es) es.close();
                es = null;
                changes.clear();
                statusChanges.clear();
            },
        };

        startStream();
        schedule();
        return api;
    }

    window.FightTransport = {
        createLocalTransport,
        createOnlineTransport,
        callApi,
        applyStream,
        deviceClock,
        emitter,
        RTDB_URL,
    };
})();
