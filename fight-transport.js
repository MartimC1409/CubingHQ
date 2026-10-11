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

    window.FightTransport = { createLocalTransport, deviceClock, emitter };
})();
