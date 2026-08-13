/* ============================================================
   CubingHQ Coach — state
   ------------------------------------------------------------
   Single source of truth for coaching data.

   localStorage is authoritative and always written first, so the
   Coach works fully signed-out and keeps working when the network
   or the server does not. When the user is signed in with WCA, a
   debounced copy is pushed to /api/coach/profile — the browser has
   no database credential, so the server is the only writer.

   Exposed as window.CoachStore.
   ============================================================ */
(function () {
    'use strict';

    const KEY = 'chq_coach_v1';
    const WCA_TOKEN_KEY = 'wca_access_token';   // set by app.js's OAuth flow
    const SYNC_DEBOUNCE_MS = 2500;

    const EMPTY = () => ({
        version: 1,
        profile: null,        // { primaryEvent, goal, method, ... }
        sessions: {},         // id -> { id, source, event, name, importedAt, solves[] }
        assessments: [],      // newest last
        plan: null,           // { generatedAt, goal, plan }
        training: {},         // 'YYYY-MM-DD' -> { drills, completedDrillIds, ... }
        progress: {           // streak, milestones, and the goal-metric history
            streak: { current: 0, longest: 0, lastTrained: null },
            milestones: [],
            metricHistory: [],
        },
        updatedAt: 0,
    });

    let state = EMPTY();
    let syncTimer = null;
    let syncState = 'idle';   // idle | pending | syncing | error | local-only

    // ---------- persistence -------------------------------------
    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                state = Object.assign(EMPTY(), parsed);
                // Guard against a half-written record from an older build.
                if (!state.progress) state.progress = EMPTY().progress;
                if (!state.sessions) state.sessions = {};
            }
        } catch (e) {
            console.warn('[Coach] could not read saved data', e);
        }
    }

    function persist() {
        state.updatedAt = Date.now();
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
            // Quota is the realistic failure here — a few thousand solves
            // plus history. Say so rather than failing silently.
            console.error('[Coach] could not save locally', e);
            emit('coach-storage-full', {});
        }
    }

    function emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function changed(reason) {
        persist();
        emit('coach-changed', { reason, state });
        scheduleSync();
    }

    // ---------- identity ----------------------------------------
    function token() {
        try { return localStorage.getItem(WCA_TOKEN_KEY) || null; } catch (e) { return null; }
    }
    const isSignedIn = () => !!token();

    // ---------- sync --------------------------------------------
    function scheduleSync() {
        if (!isSignedIn()) { setSyncState('local-only'); return; }
        setSyncState('pending');
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => { syncNow().catch(() => { }); }, SYNC_DEBOUNCE_MS);
    }

    function setSyncState(next) {
        if (syncState === next) return;
        syncState = next;
        emit('coach-sync', { state: next });
    }

    async function syncNow() {
        if (!isSignedIn() || !window.CoachAPI) { setSyncState('local-only'); return; }
        setSyncState('syncing');
        try {
            await window.CoachAPI.saveProfile({
                profile: state.profile,
                sessions: state.sessions,
                assessments: state.assessments,
                plan: state.plan,
                training: state.training,
                progress: state.progress,
            });
            setSyncState('idle');
        } catch (err) {
            // A deployment without cloud sync configured is a normal state,
            // not an error to nag the user about.
            setSyncState(err && err.code === 'sync_unavailable' ? 'local-only' : 'error');
            throw err;
        }
    }

    /**
     * Pulls server state on sign-in. The newer `updatedAt` wins; local
     * edits made while signed out are not silently discarded.
     */
    async function pull() {
        if (!isSignedIn() || !window.CoachAPI) return { applied: false, reason: 'signed-out' };
        let remote;
        try {
            remote = await window.CoachAPI.loadProfile();
        } catch (err) {
            setSyncState(err && err.code === 'sync_unavailable' ? 'local-only' : 'error');
            return { applied: false, reason: 'unavailable' };
        }
        const data = remote && remote.data;
        if (!data) {
            // Nothing stored yet — push what we have.
            if (hasAnyData()) scheduleSync();
            return { applied: false, reason: 'empty' };
        }
        const remoteAt = Number(data.updatedAt) || 0;
        if (remoteAt > (state.updatedAt || 0)) {
            state = Object.assign(EMPTY(), data);
            persist();
            emit('coach-changed', { reason: 'pulled', state });
            return { applied: true, reason: 'remote-newer' };
        }
        if (hasAnyData()) scheduleSync();
        return { applied: false, reason: 'local-newer' };
    }

    function hasAnyData() {
        return !!(state.profile || Object.keys(state.sessions).length || state.plan);
    }

    // ---------- reads --------------------------------------------
    const get = () => state;
    const getProfile = () => state.profile;
    const getPlan = () => state.plan;
    const hasOnboarded = () => !!(state.profile && state.profile.goal && state.profile.primaryEvent);
    const latestAssessment = () => state.assessments.length
        ? state.assessments[state.assessments.length - 1] : null;

    function listSessions() {
        return Object.values(state.sessions)
            .sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
    }

    /**
     * All solves for one event in chronological order — the input to
     * every statistic the Coach quotes.
     */
    function solvesForEvent(event) {
        const out = [];
        for (const sess of Object.values(state.sessions)) {
            if (event && sess.event !== event) continue;
            if (Array.isArray(sess.solves)) out.push(...sess.solves);
        }
        // Solves without timestamps (a plain-text import) keep their
        // insertion order rather than being shuffled to the front.
        return out.sort((a, b) => {
            const at = a.timestamp || 0, bt = b.timestamp || 0;
            if (at && bt) return at - bt;
            return 0;
        });
    }

    const todayKey = () => new Date().toISOString().slice(0, 10);
    const getTraining = (day) => state.training[day || todayKey()] || null;

    // ---------- writes -------------------------------------------
    function setProfile(patch) {
        state.profile = Object.assign({}, state.profile, patch, { updatedAt: Date.now() });
        if (!state.profile.createdAt) state.profile.createdAt = Date.now();
        changed('profile');
        return state.profile;
    }

    function setGoal(goal) {
        return setProfile({ goal: Object.assign({ setAt: Date.now() }, goal) });
    }

    function addSession(session) {
        const id = session.id || ('sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        state.sessions[id] = Object.assign({ importedAt: Date.now() }, session, {
            id,
            solveCount: (session.solves || []).length,
        });
        changed('session-added');
        return state.sessions[id];
    }

    function removeSession(id) {
        if (!state.sessions[id]) return false;
        delete state.sessions[id];
        changed('session-removed');
        return true;
    }

    function addSolveToSession(sessionId, solve) {
        const sess = state.sessions[sessionId];
        if (!sess) return false;
        sess.solves.push(solve);
        sess.solveCount = sess.solves.length;
        changed('solve-added');
        return true;
    }

    function addAssessment(record) {
        state.assessments.push(record);
        // Keep the history bounded; the dashboard only ever shows the
        // latest and a short trail.
        if (state.assessments.length > 20) state.assessments = state.assessments.slice(-20);
        changed('assessment');
        return record;
    }

    function setPlan(record) {
        state.plan = record;
        changed('plan');
        return record;
    }

    function setTraining(day, value) {
        state.training[day || todayKey()] = value;
        changed('training');
        return value;
    }

    function completeDrill(drillId, day) {
        const key = day || todayKey();
        const t = state.training[key];
        if (!t) return false;
        t.completedDrillIds = t.completedDrillIds || [];
        if (!t.completedDrillIds.includes(drillId)) t.completedDrillIds.push(drillId);
        changed('drill-complete');
        return true;
    }

    /** Marks today as trained and recomputes the streak. */
    function markTrained(day) {
        const key = day || todayKey();
        state.progress.trainedDays = state.progress.trainedDays || [];
        if (!state.progress.trainedDays.includes(key)) state.progress.trainedDays.push(key);
        if (window.CoachAnalytics) {
            state.progress.streak = window.CoachAnalytics.computeStreak(state.progress.trainedDays);
        }
        changed('trained');
        return state.progress.streak;
    }

    function addMilestones(list) {
        if (!list || !list.length) return [];
        state.progress.milestones = state.progress.milestones.concat(list);
        changed('milestones');
        return list;
    }

    const seenMilestoneIds = () => (state.progress.milestones || []).map(m => m.id);

    /** Records the goal metric over time, for the progress trail. */
    function recordMetricPoint(metric, valueMs) {
        if (!isFinite(valueMs)) return;
        const hist = state.progress.metricHistory;
        const last = hist[hist.length - 1];
        // One point per day is plenty; overwrite the day's latest.
        const day = todayKey();
        if (last && last.day === day && last.metric === metric) last.valueMs = valueMs;
        else hist.push({ day, metric, valueMs, at: Date.now() });
        if (hist.length > 400) state.progress.metricHistory = hist.slice(-400);
        changed('metric-point');
    }

    // ---------- deletion (§39) -----------------------------------
    async function reset(scope) {
        if (scope === 'sessions') state.sessions = {};
        else if (scope === 'assessments') state.assessments = [];
        else if (scope === 'plan') state.plan = null;
        else if (scope === 'training') state.training = {};
        else state = EMPTY();

        persist();
        emit('coach-changed', { reason: 'reset', state });

        if (isSignedIn() && window.CoachAPI) {
            try { await window.CoachAPI.deleteProfile(scope || 'all'); }
            catch (e) { console.warn('[Coach] server delete failed', e); throw e; }
        }
    }

    // ---------- boot ---------------------------------------------
    load();
    setSyncState(isSignedIn() ? 'idle' : 'local-only');

    window.CoachStore = {
        get, getProfile, getPlan, hasOnboarded, latestAssessment,
        listSessions, solvesForEvent, getTraining, todayKey,
        setProfile, setGoal,
        addSession, removeSession, addSolveToSession,
        addAssessment, setPlan, setTraining, completeDrill,
        markTrained, addMilestones, seenMilestoneIds, recordMetricPoint,
        reset, pull, syncNow,
        isSignedIn, hasAnyData,
        get syncState() { return syncState; },
        STORAGE_KEY: KEY,
    };
})();
