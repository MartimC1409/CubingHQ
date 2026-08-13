/* ============================================================
   CubingHQ Coach — conversation
   ------------------------------------------------------------
   What stops this being a generic chatbot is the context block:
   the user's real profile, statistics, goal, plan and streak are
   attached to every turn, freshly computed. The transcript carries
   the conversation; the facts are re-derived each time so a long
   thread cannot drift off the user's actual numbers.

   Exposed as window.CoachChat.
   ============================================================ */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const UI = () => window.CoachUI;
    const A = () => window.CoachAnalytics;
    const Store = () => window.CoachStore;

    const HISTORY_KEY = 'chq_coach_chat_v1';
    const MAX_STORED = 40;

    let history = [];
    let busy = false;

    function load() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (Array.isArray(parsed)) history = parsed.slice(-MAX_STORED);
        } catch (e) { history = []; }
    }

    function persist() {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_STORED))); }
        catch (e) { /* the conversation is a convenience, not data to protect */ }
    }

    /** The authoritative facts, rebuilt per turn. */
    function buildContext() {
        const profile = Store().getProfile();
        if (!profile) return null;

        const event = profile.primaryEvent || '333';
        const solves = Store().solvesForEvent(event);
        const metrics = A().computeMetrics(solves, {
            event, mo3: UI().isMo3(event), goal: profile.goal,
        });
        const state = Store().get();
        const plan = Store().getPlan();
        const training = Store().getTraining();

        return {
            profile: {
                primaryEvent: event,
                eventLabel: UI().eventLabel(event),
                method: profile.method || null,
                experience: profile.experience || null,
                practiceFrequency: profile.practiceFrequency || null,
            },
            metrics,
            goal: profile.goal || null,
            plan: plan && plan.plan ? {
                title: plan.plan.title,
                currentPhaseId: plan.plan.currentPhaseId,
                phases: plan.plan.phases,
                today: plan.plan.today,
            } : null,
            recentTraining: training ? {
                focus: training.focus,
                drills: (training.drills || []).map(d => d.title),
                completed: (training.completedDrillIds || []).length,
            } : null,
            streak: state.progress.streak || null,
            observations: window.CoachEvidence ? window.CoachEvidence.getObservations(20) : [],
        };
    }

    const SUGGESTIONS = [
        ['coach.chat.q1', 'What should I practise today?'],
        ['coach.chat.q2', "What's holding me back?"],
        ['coach.chat.q3', 'How close am I to my goal?'],
        ['coach.chat.q4', 'Why is my Ao100 improving but my Ao5 is not?'],
        ['coach.chat.q5', 'Am I ready to learn full OLL?'],
    ];

    function renderSuggestions() {
        const host = $('#coach-suggestions');
        if (!host) return;
        // Only offered on an empty thread; once a conversation is going,
        // canned prompts are clutter.
        if (history.length) { host.innerHTML = ''; return; }
        host.innerHTML = SUGGESTIONS
            .map(([k, text]) => `<button type="button">${UI().esc(UI().T(k, text))}</button>`)
            .join('');
        host.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => send(b.textContent));
        });
    }

    function bubble(role, html, id) {
        const el = document.createElement('div');
        el.className = 'coach-msg coach-msg--' + (role === 'user' ? 'user' : 'coach');
        if (id) el.id = id;
        el.innerHTML = html;
        return el;
    }

    function render() {
        const log = $('#coach-chat-log');
        if (!log) return;

        if (!history.length) {
            const profile = Store().getProfile();
            const name = profile && profile.primaryEvent ? UI().eventLabel(profile.primaryEvent) : null;
            log.innerHTML = '';
            log.appendChild(bubble('coach', UI().richText(
                UI().T('coach.chat.intro',
                    "Ask me anything about your solving. I've got your sessions, your averages and your plan in front of me" +
                    (name ? `, for ${name}` : '') + '.')
            )));
        } else {
            log.innerHTML = '';
            for (const turn of history) {
                log.appendChild(bubble(turn.role,
                    turn.role === 'user' ? UI().esc(turn.content) : UI().richText(turn.content)));
            }
        }
        renderSuggestions();
        log.scrollTop = log.scrollHeight;
    }

    async function send(text) {
        const message = String(text || '').trim();
        if (!message || busy) return;

        const log = $('#coach-chat-log');
        const input = $('#coach-chat-input');
        const sendBtn = $('#coach-chat-send');

        if (!history.length && log) log.innerHTML = '';
        history.push({ role: 'user', content: message });
        persist();

        if (log) log.appendChild(bubble('user', UI().esc(message)));
        if (input) input.value = '';
        renderSuggestions();

        busy = true;
        if (sendBtn) sendBtn.disabled = true;

        const replyEl = bubble('coach', `<p class="coach-muted">${UI().esc(UI().T('coach.chat.thinking', 'Thinking…'))}</p>`, 'coach-streaming');
        if (log) { log.appendChild(replyEl); log.scrollTop = log.scrollHeight; }

        let answer = '';
        try {
            await window.CoachAPI.chat(
                {
                    message,
                    history: history.slice(0, -1).slice(-16),
                    context: buildContext(),
                },
                {
                    onDelta: (chunk) => {
                        answer += chunk;
                        replyEl.innerHTML = UI().richText(answer);
                        if (log) log.scrollTop = log.scrollHeight;
                    },
                }
            );

            if (!answer.trim()) throw new window.CoachAPI.CoachError('empty',
                UI().T('coach.chat.empty', "The Coach didn't have anything to add there. Try asking a different way."));

            history.push({ role: 'assistant', content: answer });
            persist();
        } catch (err) {
            // Drop the failed turn so a retry doesn't resend a dangling
            // user message the Coach never answered.
            history.pop();
            persist();
            replyEl.className = 'coach-msg coach-msg--coach';
            replyEl.innerHTML = UI().alert('error', '', err.message,
                `<button class="coach-btn coach-btn--ghost" id="coach-chat-retry">${UI().esc(UI().T('coach.retry', 'Try again'))}</button>`);
            const retry = document.getElementById('coach-chat-retry');
            if (retry) retry.addEventListener('click', () => { replyEl.remove(); send(message); });
        } finally {
            replyEl.removeAttribute('id');
            busy = false;
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.focus();
        }
    }

    function clear() {
        history = [];
        persist();
        render();
    }

    function init() {
        load();
        render();
        const form = $('#coach-chat-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                send($('#coach-chat-input').value);
            });
        }
    }

    window.CoachChat = { init, send, clear, render };
})();
