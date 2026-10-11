/* ============================================================
   Cube Fights — server side
   ------------------------------------------------------------
   The referee for online fights. Every change to a fight comes
   through here: the stored state is loaded, FightEngine (the same
   file the page runs for local fights) applies the action with the
   SERVER's clock, and the result is written back only if nobody
   else wrote in between (Firebase ETag conditional writes). So two
   players submitting at the same instant cannot overwrite each
   other, and neither device's clock decides when a round starts
   or whether a time counts.

   Layout in the Realtime Database:

     /fights/{id}              the fight, as FightEngine state. The
                               only part a browser may read directly
                               (a read-only rule lets the page stream
                               it); ids are 20 random characters.
     /fight_private/{id}       server only: who holds each seat, the
                               next round's scramble (so nobody can
                               read it early), matches already recorded
     /fight_codes/{CODE}       6-character join code -> fight id
     /fight_index/{id}         creation time + code, for clean-up
     /fight_history/{uid}/{k}  finished matches, keyed so $key order
                               is time order (no index rule needed)
     /fight_stats/{uid}        played / won / lost / rounds / best

   Seats are claimed by signed-in account. The fight stores only an
   HMAC of the uid per seat, so the public copy names nobody's
   account; the uids themselves live in /fight_private.

   Scrambles: random-state, from the cubing.js scramble program — the
   one ScrambleEngine runs in the browser — formatted by
   ScrambleEngine's own formatter so they read exactly as a local
   fight's do. If the program cannot run, ScrambleEngine's offline
   generator stands in, as it does in the browser.
   ============================================================ */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Engine = require('../../fight-engine.js');
const { authorize } = require('./firebase-auth.js');

const DEFAULT_DB_URL = 'https://simulatecubing-default-rtdb.firebaseio.com';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
const CODE_LENGTH = 6;
const FIGHT_TTL_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 50;
const CLEANUP_BATCH = 20;

class FightError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/* ======================= storage ======================= */

/**
 * Firebase REST, with conditional writes.
 *
 * get() asks for an ETag; put(..., { ifMatch }) sends it back, and the
 * database answers 412 if the node changed since. That is the whole
 * concurrency story: read, decide, write-if-unchanged, retry.
 */
function createFirebaseStore(dbUrl) {
    const base = String(dbUrl || process.env.FIREBASE_DB_URL || DEFAULT_DB_URL).replace(/\/$/, '');

    async function call(method, p, { body, etag, ifMatch, query } = {}) {
        const auth = await authorize();
        if (auth.kind === 'service_account_failed') {
            throw new FightError(503, 'not_configured', 'The fights database is not reachable from the server right now.');
        }
        const qs = [auth.query, query].filter(Boolean).join('&');
        const url = `${base}/${p}.json${qs ? `?${qs}` : ''}`;
        const headers = Object.assign({}, auth.headers);
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (etag) headers['X-Firebase-ETag'] = 'true';
        if (ifMatch) headers['if-match'] = ifMatch;
        let res;
        try {
            res = await fetch(url, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(15000),
            });
        } catch (e) {
            throw new FightError(504, 'unreachable', 'The fights database is temporarily unreachable.');
        }
        if (res.status === 412) return { conflict: true };
        const text = await res.text().catch(() => '');
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                console.error(`[fights] ${method} /${p} denied by the database (auth: ${auth.kind})`);
                throw new FightError(503, 'denied', 'The fights database refused this request.');
            }
            console.error(`[fights] ${method} /${p} -> HTTP ${res.status} ${text.slice(0, 200)}`);
            throw new FightError(502, 'db_error', 'The fights database could not complete that request.');
        }
        let value = null;
        if (text) {
            try { value = JSON.parse(text); } catch (e) { value = null; }
        }
        return { value, etag: res.headers.get('etag') || null };
    }

    return {
        async get(p, opts = {}) {
            const r = await call('GET', p, { etag: !!opts.etag, query: opts.query });
            return { value: r.value, etag: r.etag };
        },
        async put(p, value, opts = {}) {
            const r = await call('PUT', p, { body: value, ifMatch: opts.ifMatch });
            return r.conflict ? { conflict: true } : { ok: true };
        },
        async patch(p, value) { await call('PATCH', p, { body: value }); },
        async del(p) { await call('DELETE', p); },
    };
}

/**
 * The same interface in memory, for the tests and the local end-to-end
 * harness. Values are deep-copied in and out, nulls and empty objects are
 * dropped the way Firebase drops them, and ETags are real, so conflicts
 * behave as they do against the database.
 */
function createMemoryStore() {
    const data = {};
    const etags = new Map();
    let counter = 0;

    function strip(v) {
        if (Array.isArray(v)) {
            const a = v.map(strip).filter(x => x !== undefined);
            return a.length ? a : undefined;
        }
        if (v && typeof v === 'object') {
            const o = {};
            for (const [k, x] of Object.entries(v)) {
                const y = strip(x);
                if (y !== undefined) o[k] = y;
            }
            return Object.keys(o).length ? o : undefined;
        }
        return v === null ? undefined : v;
    }
    const segs = (p) => String(p).split('/').filter(Boolean);
    function read(p) {
        let node = data;
        for (const s of segs(p)) {
            if (!node || typeof node !== 'object' || !(s in node)) return null;
            node = node[s];
        }
        return node === undefined ? null : JSON.parse(JSON.stringify(node));
    }
    function write(p, value) {
        const parts = segs(p);
        let node = data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
            node = node[parts[i]];
        }
        const v = strip(JSON.parse(JSON.stringify(value === undefined ? null : value)));
        if (v === undefined) delete node[parts[parts.length - 1]];
        else node[parts[parts.length - 1]] = v;
        // Any write invalidates the ETag of the node and its ancestors.
        for (const key of [...etags.keys()]) {
            if (key === p || p.startsWith(key + '/') || key.startsWith(p + '/')) etags.delete(key);
        }
    }
    function etagOf(p) {
        if (!etags.has(p)) etags.set(p, `m${++counter}`);
        return etags.get(p);
    }
    return {
        data,
        async get(p) { return { value: read(p), etag: etagOf(p) }; },
        async put(p, value, opts = {}) {
            if (opts.ifMatch && opts.ifMatch !== etagOf(p)) return { conflict: true };
            write(p, value);
            return { ok: true };
        },
        async patch(p, value) {
            for (const [k, v] of Object.entries(value || {})) write(`${p}/${k}`, v);
        },
        async del(p) { write(p, null); },
    };
}

/** Read, change, write-if-unchanged; retried on a conflict. */
async function transact(store, p, fn, tries = 8) {
    for (let i = 0; i < tries; i++) {
        const { value, etag } = await store.get(p, { etag: true });
        const out = await fn(value);
        if (out === undefined) return { value, written: false };
        const res = await store.put(p, out, { ifMatch: etag });
        if (!res.conflict) return { value: out, written: true };
    }
    throw new FightError(409, 'busy', 'That fight is busy — try again.');
}

/* ======================= scrambles ======================= */

let scrambleEngine = null;
/** ScrambleEngine (the browser file) loaded for its formatter and fallback. */
function loadScrambleEngine() {
    if (scrambleEngine) return scrambleEngine;
    const root = path.join(__dirname, '..', '..');
    const sandbox = {
        window: { requestIdleCallback: () => {} },   // no prewarm: it would reach for a CDN
        console,
        setTimeout,
        Math,
    };
    vm.createContext(sandbox);
    // square1-drawer.js first: ScrambleEngine formats Square-1 with it.
    for (const file of ['square1-drawer.js', 'scramble-engine.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
    }
    scrambleEngine = sandbox.window.ScrambleEngine;
    return scrambleEngine;
}

let cubingScramble = null;
async function cubing() {
    if (!cubingScramble) {
        cubingScramble = import('cubing/scramble').catch(err => {
            cubingScramble = null;
            throw err;
        });
    }
    return cubingScramble;
}

/** A WCA random-state scramble for an event, as ScrambleEngine would show it. */
async function generateScramble(eventId, opts = {}) {
    const SE = loadScrambleEngine();
    const wcaId = SE.wcaEventId(eventId);
    if (opts.generator) return opts.generator(wcaId);
    try {
        const { randomScrambleForEvent } = await cubing();
        const alg = await Promise.race([
            randomScrambleForEvent(wcaId),
            new Promise((_, rej) => setTimeout(() => rej(new Error('scramble timeout')), 12000)),
        ]);
        return SE.formatForEvent(wcaId, alg.toString());
    } catch (err) {
        console.error(`[fights] random-state scramble failed for ${wcaId}, using the fallback:`, err.message);
        return SE.fallbackScramble(wcaId);
    }
}

/* ======================= identity ======================= */

function seatSecret() {
    return process.env.AUTH_SIGNING_SECRET
        || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        || process.env.FIREBASE_DB_SECRET
        || 'cubinghq-fights-dev';
}

/** What the public fight stores to recognise a seat's account. */
function seatKey(uid) {
    return crypto.createHmac('sha256', seatSecret()).update(`fight-seat:${uid}`).digest('base64url').slice(0, 22);
}

function seatOf(state, uid) {
    const key = seatKey(uid);
    return Engine.SEATS.find(seat => state.players[seat] && state.players[seat].key === key) || null;
}

/** Firebase keys cannot contain . $ # [ ] /; uids are already safe, but be sure. */
function safeKey(s) {
    return String(s).replace(/[.$#[\]/\x00-\x1f\x7f]/g, '_').slice(0, 128);
}

function randomId(len) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
}

function randomCode() {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out;
}

function normalizeCode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === CODE_LENGTH && [...c].every(ch => CODE_ALPHABET.includes(ch)) ? c : null;
}

/* ======================= the service ======================= */

function createFightService({ store, now = () => Date.now(), scrambleGenerator = null } = {}) {
    const db = store || createFirebaseStore();
    const scramble = (event) => generateScramble(event, { generator: scrambleGenerator });

    /** Splits engine state into the public fight and the private queue. */
    function split(state) {
        const pub = JSON.parse(JSON.stringify(state));
        const next = pub.nextScramble || null;
        delete pub.nextScramble;
        return { pub, next };
    }

    /** Fills whatever scramble the state is waiting on. */
    async function fillScrambles(state, t) {
        let s = state;
        const need = Engine.needsScramble(s);
        if (need.current) {
            const text = await scramble(s.settings.event);
            s = Engine.reduce(s, { type: 'SCRAMBLE', target: 'current', scramble: text }, t).state;
        }
        // A round that took its scramble from a queue the previous request
        // had not finished refilling would repeat an old one. Never.
        const round = Engine.current(s);
        if (round && round.scramble && Object.values(s.rounds).some(r => r !== round && r.scramble === round.scramble)
            && s.phase === 'prepare') {
            round.scramble = await scramble(s.settings.event);
        }
        if (Engine.needsScramble(s).next) {
            const text = await scramble(s.settings.event);
            s = Engine.reduce(s, { type: 'SCRAMBLE', target: 'next', scramble: text }, t).state;
        }
        return s;
    }

    async function loadPrivate(id) {
        const { value } = await db.get(`fight_private/${id}`);
        return value || {};
    }

    /** Cleans up fights older than a day. Best effort, a few per call. */
    async function cleanup(t) {
        try {
            const { value } = await db.get('fight_index');
            if (!value) return;
            const old = Object.entries(value)
                .filter(([, v]) => !v || typeof v.at !== 'number' || t - v.at > FIGHT_TTL_MS)
                .slice(0, CLEANUP_BATCH);
            for (const [id, v] of old) {
                await db.del(`fights/${id}`);
                await db.del(`fight_private/${id}`);
                if (v && v.code) {
                    const { value: c } = await db.get(`fight_codes/${v.code}`);
                    if (c && c.id === id) await db.del(`fight_codes/${v.code}`);
                }
                await db.del(`fight_index/${id}`);
            }
        } catch (e) {
            console.warn('[fights] clean-up skipped:', e.message);
        }
    }

    async function create(user, settingsInput) {
        const t = now();
        const id = randomId(20);
        let state = Engine.create({
            mode: 'online',
            settings: settingsInput,
            host: { name: user.name, wcaId: user.wcaId },
            now: t,
        });
        state.players.p1.key = seatKey(user.uid);

        // A code nobody is using (or whose room is long gone).
        let code = null;
        for (let i = 0; i < 6 && !code; i++) {
            const candidate = randomCode();
            const res = await transact(db, `fight_codes/${candidate}`, (cur) => {
                if (cur && typeof cur.at === 'number' && t - cur.at < FIGHT_TTL_MS) return undefined;
                return { id, at: t };
            });
            if (res.written) code = candidate;
        }
        if (!code) throw new FightError(503, 'no_code', 'Could not find a free room code. Try again.');
        state.code = code;

        state = await fillScrambles(state, t);
        const { pub, next } = split(state);
        await db.put(`fights/${id}`, pub);
        await db.put(`fight_private/${id}`, { seats: { p1: user.uid }, next, recorded: {} });
        await db.put(`fight_index/${id}`, { at: t, code });
        cleanup(t);   // not awaited: the person creating the room is not the janitor
        return { fightId: id, code, seat: 'p1', state: pub, serverNow: now() };
    }

    async function resolveCode(codeInput) {
        const code = normalizeCode(codeInput);
        if (!code) throw new FightError(400, 'bad_code', 'That is not a room code. Codes are 6 letters and numbers.');
        const { value } = await db.get(`fight_codes/${code}`);
        if (!value || !value.id) throw new FightError(404, 'no_fight', 'No fight with that code.');
        return { code, id: value.id };
    }

    async function join(user, codeInput) {
        const { code, id } = await resolveCode(codeInput);
        const priv = await loadPrivate(id);
        let seat = null;
        let joinError = null;
        let finalState = null;
        await transact(db, `fights/${id}`, async (pubIn) => {
            if (!pubIn) { joinError = new FightError(404, 'no_fight', 'That fight no longer exists.'); return undefined; }
            const t = now();
            let state = Engine.normalize(Object.assign({}, pubIn, { nextScramble: priv.next || null }));
            const mine = seatOf(state, user.uid);
            if (mine) {
                // Back again (another tab, another device, a reload).
                seat = mine;
                state = Engine.reduce(state, { type: 'SEEN', seat }, t).state;
            } else {
                const r = Engine.reduce(state, { type: 'JOIN', player: { name: user.name, wcaId: user.wcaId } }, t);
                if (r.error) {
                    joinError = r.error === 'full'
                        ? new FightError(409, 'full', 'That fight already has two players.')
                        : new FightError(410, 'closed', 'That fight is over or has expired.');
                    return undefined;
                }
                state = r.state;
                state.players.p2.key = seatKey(user.uid);
                seat = 'p2';
            }
            state = await fillScrambles(state, t);
            const { pub, next } = split(state);
            priv.next = next;
            finalState = pub;
            return pub;
        });
        if (joinError) throw joinError;
        priv.seats = Object.assign({}, priv.seats, { [seat]: user.uid });
        await db.put(`fight_private/${id}`, priv);
        return { fightId: id, code, seat, state: finalState, serverNow: now() };
    }

    /**
     * Applies one player action. 'SEEN' doubles as the heartbeat and the
     * poll: it changes nothing but the player's last-seen time, and the
     * reply carries the current state.
     */
    async function act(user, fightId, action) {
        if (!/^[A-Za-z0-9]{20}$/.test(String(fightId || ''))) {
            throw new FightError(400, 'bad_fight', 'That is not a fight id.');
        }
        const type = String((action && action.type) || '');
        const allowed = ['SEEN', 'READY', 'START', 'SUBMIT', 'PENALTY', 'PENALTY_REPLY', 'CONTINUE', 'REMATCH', 'LEAVE'];
        if (!allowed.includes(type)) throw new FightError(400, 'bad_action', 'That is not something you can do in a fight.');

        const priv = await loadPrivate(fightId);
        let seat = null;
        let actionError = null;
        let before = null;
        let finalState = null;
        await transact(db, `fights/${fightId}`, async (pubIn) => {
            if (!pubIn) { actionError = new FightError(404, 'no_fight', 'That fight no longer exists.'); return undefined; }
            const t = now();
            const state = Engine.normalize(Object.assign({}, pubIn, { nextScramble: priv.next || null }));
            seat = seatOf(state, user.uid);
            if (!seat) { actionError = new FightError(403, 'not_a_player', 'You are not in this fight.'); return undefined; }
            before = state;
            // Only what a player may say; never the seat, never a scramble.
            const clean = { type, seat };
            if (type === 'READY') clean.ready = action.ready !== false;
            if (type === 'START') clean.penalty = action.penalty;
            if (type === 'SUBMIT') { clean.ms = action.ms; clean.penalty = action.penalty; }
            if (type === 'PENALTY') { clean.target = action.target; clean.penalty = action.penalty; }
            if (type === 'PENALTY_REPLY') clean.accept = !!action.accept;
            const r = Engine.reduce(state, clean, t);
            let next = r.state;
            if (r.error) {
                actionError = new FightError(409, r.error, r.error);
                // Time may still have moved the fight on (a forfeit, a
                // countdown ending); keep that even though the action failed.
                if (JSON.stringify(Engine.tick(state, t)) === JSON.stringify(state)) return undefined;
                next = Engine.tick(state, t);
                next.seq = state.seq + 1;   // clients order updates by seq
            }
            next = await fillScrambles(next, t);
            const { pub, next: queued } = split(next);
            priv.next = queued;
            finalState = pub;
            return pub;
        });
        if (actionError && actionError.code === 'no_fight') throw actionError;
        if (actionError && actionError.code === 'not_a_player') throw actionError;

        if (finalState) {
            const queued = priv.next || null;
            await db.patch(`fight_private/${fightId}`, { next: queued });
            await recordIfFinished(fightId, before, finalState, priv);
        }
        const state = finalState || before;
        return {
            fightId, seat, state: state ? split(state).pub : null, serverNow: now(),
            error: actionError ? actionError.code : null,
        };
    }

    /* ---------- history & stats ---------- */

    function historyKey(at, id) {
        return `${Math.floor(at).toString(36).padStart(9, '0')}_${safeKey(id)}`;
    }

    function serverRecord(fightId, state, seat) {
        const res = state.result || {};
        const rounds = Object.values(state.rounds || {})
            .filter(r => r.final)
            .sort((a, b) => a.n - b.n)
            .map(r => ({
                n: r.n,
                p1: r.solves && r.solves.p1 ? { ms: r.solves.p1.ms, penalty: r.solves.p1.penalty } : null,
                p2: r.solves && r.solves.p2 ? { ms: r.solves.p2.ms, penalty: r.solves.p2.penalty } : null,
                winner: r.winner,
            }));
        return {
            id: `online-${fightId}-${state.match}`,
            at: res.at || now(),
            mode: 'online',
            event: state.settings.event,
            bestOf: state.settings.bestOf,
            inspection: state.settings.inspection,
            players: { p1: state.players.p1 ? state.players.p1.name : '', p2: state.players.p2 ? state.players.p2.name : '' },
            seat,
            winner: res.winner || null,
            reason: res.reason || 'score',
            score: Object.assign({ p1: 0, p2: 0 }, res.score || state.score),
            rounds,
        };
    }

    async function recordIfFinished(fightId, before, after, priv) {
        if (!after || after.phase !== 'ended' || !after.result) return;
        if (before && before.phase === 'ended' && before.match === after.match) return;
        const match = String(after.match);
        // Claim the match before writing, so two requests that both saw it
        // end cannot count it twice.
        const claim = await transact(db, `fight_private/${fightId}/recorded/${match}`, (cur) => (cur ? undefined : true));
        if (!claim.written) return;
        const seats = (priv && priv.seats) || {};
        for (const seat of Engine.SEATS) {
            const uid = seats[seat];
            if (!uid) continue;
            const record = serverRecord(fightId, after, seat);
            await db.put(`fight_history/${safeKey(uid)}/${historyKey(record.at, record.id)}`, record);
            if (!after.result.winner) continue;   // abandoned before anything was played
            await transact(db, `fight_stats/${safeKey(uid)}`, (cur) => {
                const s = Object.assign({ played: 0, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0, best: null }, cur || {});
                s.played += 1;
                if (after.result.winner === seat) s.wins += 1; else s.losses += 1;
                for (const r of record.rounds) {
                    if (r.winner === seat) s.roundsWon += 1;
                    else if (r.winner && r.winner !== 'tie') s.roundsLost += 1;
                    const mine = r[seat];
                    if (mine && mine.penalty !== 'DNF' && typeof mine.ms === 'number') {
                        const eff = mine.penalty === '+2' ? mine.ms + 2000 : mine.ms;
                        if (!s.best || !s.best[record.event] || eff < s.best[record.event]) {
                            s.best = Object.assign({}, s.best, { [record.event]: eff });
                        }
                    }
                }
                return s;
            });
        }
    }

    /** A same-device fight, kept in the signed-in player's history. Not in the stats. */
    async function saveLocal(user, recordIn) {
        const r = recordIn || {};
        const clean = {
            id: `local-${safeKey(String(r.id || '').replace(/^local-/, '')).slice(0, 60)}`,
            at: Math.min(Number(r.at) || now(), now()),
            mode: 'local',
            event: Engine.EVENTS.includes(r.event) ? r.event : '333',
            bestOf: Engine.BEST_OF.includes(Number(r.bestOf)) ? Number(r.bestOf) : 3,
            inspection: !!r.inspection,
            players: {
                p1: Engine.cleanName(r.players && r.players.p1, 'Player 1'),
                p2: Engine.cleanName(r.players && r.players.p2, 'Player 2'),
            },
            seat: null,
            winner: r.winner === 'p1' || r.winner === 'p2' ? r.winner : null,
            reason: 'score',
            score: {
                p1: Math.max(0, Math.min(7, Number(r.score && r.score.p1) || 0)),
                p2: Math.max(0, Math.min(7, Number(r.score && r.score.p2) || 0)),
            },
            rounds: (Array.isArray(r.rounds) ? r.rounds : []).slice(0, 30).map((x, i) => ({
                n: i + 1,
                p1: cleanSolve(x && x.p1),
                p2: cleanSolve(x && x.p2),
                winner: ['p1', 'p2', 'tie'].includes(x && x.winner) ? x.winner : null,
            })),
        };
        await db.put(`fight_history/${safeKey(user.uid)}/${historyKey(clean.at, clean.id)}`, clean);
        return clean;
    }

    function cleanSolve(s) {
        if (!s) return null;
        const ms = typeof s.ms === 'number' && isFinite(s.ms) ? Math.max(0, Math.min(Math.round(s.ms), 3600000)) : null;
        const penalty = s.penalty === '+2' || s.penalty === 'DNF' ? s.penalty : '';
        return { ms, penalty: ms === null ? 'DNF' : penalty };
    }

    async function history(user) {
        const uid = safeKey(user.uid);
        const [{ value: h }, { value: stats }] = await Promise.all([
            db.get(`fight_history/${uid}`, { query: `orderBy=${encodeURIComponent('"$key"')}&limitToLast=${HISTORY_LIMIT}` }),
            db.get(`fight_stats/${uid}`),
        ]);
        const records = Object.values(h || {}).sort((a, b) => b.at - a.at).slice(0, HISTORY_LIMIT);
        return { records, stats: stats || null };
    }

    return { create, join, act, history, saveLocal, resolveCode, _internal: { split, fillScrambles, seatOf } };
}

module.exports = {
    createFightService,
    createFirebaseStore,
    createMemoryStore,
    generateScramble,
    loadScrambleEngine,
    seatKey,
    normalizeCode,
    FightError,
    CODE_ALPHABET,
};
