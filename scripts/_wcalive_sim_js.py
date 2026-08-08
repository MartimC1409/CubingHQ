#!/usr/bin/env python3
"""Add the WCA Live simulation JS: state, init, scramble, submit, scorecard,
   and leaderboard (with real WCA data) for each round.
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('app.js').read_text(encoding='utf-8')
original_len = len(src)
fixes_applied = []

# === FIX 1: Extend state.wcalive with simulation state ===
old_state = """        wcalive: {
            currentSubView: 'dashboard',  // 'dashboard' | 'comp' | 'event'
            cache: new Map(),              // { 'dashboard' | 'comp:ID' | 'results:ID:EVT' | 'schedule:ID': {data, expiry} }
            selectedCompId: null,
            selectedEventId: null,
            selectedRoundIdx: 0,
            resultsData: null,             // {rounds: [...]}
        },"""
new_state = """        wcalive: {
            currentSubView: 'dashboard',  // 'dashboard' | 'comp' | 'event'
            cache: new Map(),              // { 'dashboard' | 'comp:ID' | 'results:ID:EVT' | 'schedule:ID': {data, expiry} }
            selectedCompId: null,
            selectedEventId: null,
            selectedCompName: null,
            selectedRoundIdx: 0,
            resultsData: null,             // {rounds: [...]}
            // ===== Per-round simulation state (scoped to WCA Live) =====
            sim: {
                compId: null,
                eventId: null,
                roundIdx: 0,
                roundLabel: '',
                numSolves: 5,
                currentSolve: 0,
                scrambles: [],          // generated scramble per solve
                solves: [],             // [{time, penalty, value}] - user's solves
                selectedPenalty: 'none',
                resultsData: null,      // cached /competitions/{id}/results/{evt}
                roundType: 'ao5',
            },
        },"""
if old_state in src:
    src = src.replace(old_state, new_state, 1)
    fixes_applied.append('Extended state.wcalive with sim state')
else:
    fixes_applied.append('WARN: state.wcalive block not found')

# === FIX 2: Update openWcaLiveEvent to use the simulation instead of the static table ===
# Find the existing function and replace it
import re
# Match from "async function openWcaLiveEvent" to the next standalone closing "}\n    function" or "})();"
m = re.search(r'async function openWcaLiveEvent\(compId, eventId\) \{[\s\S]*?\n    \}\n', src)
if m:
    old_func = m.group(0)
    print(f'Found openWcaLiveEvent ({len(old_func)} chars), replacing...')
else:
    print('WARN: openWcaLiveEvent not found, trying alternate match')
    m = re.search(r'async function openWcaLiveEvent\(compId, eventId\) \{[\s\S]*?\n    \}\s*\n', src)
    if m:
        old_func = m.group(0)
        print(f'Found openWcaLiveEvent (alt match) ({len(old_func)} chars)')

if m:
    new_func = '''async function openWcaLiveEvent(compId, eventId) {
        if (!compId || !eventId) return;
        state.wcalive.selectedCompId = compId;
        state.wcalive.selectedEventId = eventId;
        state.wcalive.selectedRoundIdx = 0;
        switchWcaLiveSubView('event');

        const loading = $('#wca-event-loading');
        const wrap = $('#wca-event-table-wrap');
        const thead = $('#wca-event-thead');
        const body = $('#wca-event-results-body');
        if (loading) loading.style.display = 'flex';
        if (wrap) wrap.style.display = 'none';

        try {
            const [comp, results] = await Promise.all([
                fetchCached(`comp:${compId}`, `${WCA_API}/competitions/${compId}`, 5 * 60 * 1000),
                fetchCached(`results:${compId}:${eventId}`, `${WCA_API}/competitions/${compId}/results/${eventId}`, 5 * 60 * 1000),
            ]);
            state.wcalive.resultsData = results;
            state.wcalive.selectedCompName = comp.name || compId;

            // Event header (kept for context)
            const header = $('#wca-event-header');
            if (header) {
                header.innerHTML = `
                    <h2>${escapeHtml(EVENT_NAMES[eventId] || eventId)}</h2>
                    <div class="event-subtitle">${escapeHtml(comp.name || compId)}</div>
                `;
            }

            // Round tabs (kept for context)
            const tabs = $('#wca-event-rounds');
            if (tabs && results.rounds && results.rounds.length > 0) {
                const roundTypeNames = { '1': 'Round 1', '2': 'Round 2', '3': 'Semi-Final', 'f': 'Final' };
                tabs.innerHTML = results.rounds.map((r, i) => {
                    const label = roundTypeNames[r.roundTypeId] || `Round ${i + 1}`;
                    return `<button class="wcalive-round-tab ${i === 0 ? 'active' : ''}" data-round-idx="${i}">${label}</button>`;
                }).join('');
                tabs.querySelectorAll('.wcalive-round-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        tabs.querySelectorAll('.wcalive-round-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        state.wcalive.selectedRoundIdx = parseInt(tab.dataset.roundIdx, 10);
                        startWcaLiveSim();
                    });
                });
            }

            if (loading) loading.style.display = 'none';
            if (wrap) wrap.style.display = 'block';

            // Start the per-round simulation (replaces the static results table)
            startWcaLiveSim();
        } catch (err) {
            console.error('Event results fetch failed:', err);
            if (loading) loading.innerHTML = `<span>⚠️ Could not load results. <a href="#" onclick="openWcaLiveEvent('${compId}','${eventId}');return false;">Retry</a></span>`;
        }
    }

    // ============== WCA LIVE PER-ROUND SIMULATION ==============
    // Reuses the same UI components as the main comp simulation (scramble,
    // timer/manual-input, scorecard, leaderboard) but scoped to the WCA Live
    // sub-event view. The leaderboard is populated from the real WCA results
    // for the selected round, so the user can see their position vs. the
    // actual competitors.

    function startWcaLiveSim() {
        const sim = state.wcalive.sim;
        const evt = state.wcalive.selectedEventId;
        const compId = state.wcalive.selectedCompId;
        const results = state.wcalive.resultsData;

        if (!evt || !results || !results.rounds || results.rounds.length === 0) {
            return;
        }

        const roundIdx = Math.min(state.wcalive.selectedRoundIdx, results.rounds.length - 1);
        const round = results.rounds[roundIdx];
        const roundTypeNames = { '1': 'Round 1', '2': 'Round 2', '3': 'Semi-Final', 'f': 'Final' };
        const roundLabel = roundTypeNames[round.roundTypeId] || `Round ${roundIdx + 1}`;

        // Detect Mo3 vs Ao5 from the round's results (if any)
        let numSolves = 5;
        let roundType = 'ao5';
        if (round.results && round.results[0] && Array.isArray(round.results[0].attempts)) {
            numSolves = round.results[0].attempts.length;
            roundType = numSolves === 3 ? 'mo3' : 'ao5';
        } else if (MEAN_OF_3_EVENTS && MEAN_OF_3_EVENTS.includes(evt)) {
            numSolves = 3;
            roundType = 'mo3';
        }

        // Initialize or preserve sim state for this (comp, event, round) combo
        const simKey = `${compId}::${evt}::${roundIdx}`;
        if (sim._key !== simKey) {
            sim._key = simKey;
            sim.compId = compId;
            sim.eventId = evt;
            sim.roundIdx = roundIdx;
            sim.roundLabel = roundLabel;
            sim.numSolves = numSolves;
            sim.roundType = roundType;
            sim.currentSolve = 0;
            sim.scrambles = [];
            sim.solves = [];
            sim.selectedPenalty = 'none';
            sim.resultsData = results;
            // Pre-generate the first scramble
            for (let i = 0; i < numSolves; i++) {
                sim.scrambles.push(generateScramble(evt));
            }
        }

        // Bind UI events (idempotent — bind once)
        bindWcaLiveSimUI();

        // Render all parts
        renderWcaLiveSimScramble();
        renderWcaLiveSimScorecard();
        renderWcaLiveSimPodium(round);
        renderWcaLiveSimLeaderboard(round);
        updateWcaLiveSimSolveNum();
        updateWcaLiveSimPenalty();
        // Reset manual input
        const input = $('#wcalive-sim-time-input');
        if (input) input.value = '';
    }

    function bindWcaLiveSimUI() {
        if (bindWcaLiveSimUI._done) return;
        bindWcaLiveSimUI._done = true;

        // Submit solve
        const submitBtn = $('#wcalive-sim-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitWcaLiveSimSolve);
        }

        // New scramble
        const newScrambleBtn = $('#wcalive-sim-new-scramble-btn');
        if (newScrambleBtn) {
            newScrambleBtn.addEventListener('click', () => {
                const sim = state.wcalive.sim;
                if (sim.currentSolve < sim.numSolves) {
                    sim.scrambles[sim.currentSolve] = generateScramble(sim.eventId);
                    renderWcaLiveSimScramble();
                }
            });
        }

        // Clear solves
        const clearBtn = $('#wcalive-sim-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!confirm('Clear all solves for this round?')) return;
                const sim = state.wcalive.sim;
                sim.currentSolve = 0;
                sim.solves = [];
                for (let i = 0; i < sim.numSolves; i++) {
                    sim.scrambles[i] = generateScramble(sim.eventId);
                }
                sim.selectedPenalty = 'none';
                renderWcaLiveSimScramble();
                renderWcaLiveSimScorecard();
                updateWcaLiveSimSolveNum();
                updateWcaLiveSimPenalty();
                const input = $('#wcalive-sim-time-input');
                if (input) input.value = '';
            });
        }

        // Manual time input
        const input = $('#wcalive-sim-time-input');
        if (input) {
            input.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\\D/g, '');
                if (!val) { e.target.value = ''; return; }
                const num = parseInt(val, 10);
                e.target.value = (num / 100).toFixed(2);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitWcaLiveSimSolve();
                }
            });
        }

        // Penalty buttons
        document.querySelectorAll('[data-wcalive-pen]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sim = state.wcalive.sim;
                sim.selectedPenalty = btn.dataset.wcalivePen;
                updateWcaLiveSimPenalty();
            });
        });
    }

    function updateWcaLiveSimPenalty() {
        const sim = state.wcalive.sim;
        document.querySelectorAll('[data-wcalive-pen]').forEach(btn => {
            if (btn.dataset.wcalivePen === sim.selectedPenalty) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function updateWcaLiveSimSolveNum() {
        const sim = state.wcalive.sim;
        const el = $('#wcalive-sim-solve-num');
        const info = $('#wcalive-sim-scorecard-info');
        if (el) el.textContent = `${Math.min(sim.currentSolve + 1, sim.numSolves)}/${sim.numSolves}`;
        if (info) info.textContent = `${sim.solves.length}/${sim.numSolves} solves`;
    }

    function renderWcaLiveSimScramble() {
        const sim = state.wcalive.sim;
        const el = $('#wcalive-sim-scramble-text');
        const badge = $('#wcalive-sim-round-badge');
        if (badge) badge.textContent = sim.roundLabel;
        if (el) {
            if (sim.currentSolve >= sim.numSolves) {
                el.textContent = 'Round complete! Clear solves or switch rounds to continue.';
            } else {
                el.textContent = sim.scrambles[sim.currentSolve] || 'Generating...';
            }
        }
        // Status indicator
        const status = $('#wcalive-sim-status');
        if (status) {
            if (sim.currentSolve >= sim.numSolves) {
                status.textContent = 'DONE';
                status.className = 'timer-status stopped';
            } else {
                status.textContent = 'READY';
                status.className = 'timer-status ready';
            }
        }
    }

    function submitWcaLiveSimSolve() {
        const sim = state.wcalive.sim;
        if (sim.currentSolve >= sim.numSolves) return;

        const inputEl = $('#wcalive-sim-time-input');
        const raw = inputEl ? inputEl.value.trim() : '';
        const timeNum = parseFloat(raw);
        if (!raw || isNaN(timeNum) || timeNum <= 0) {
            showToast('Enter a valid time (e.g. 954 = 9.54s)', 'error');
            return;
        }

        // Store solve in centiseconds (WCA format)
        const cs = Math.round(timeNum * 100);
        const penalty = sim.selectedPenalty;
        let value = cs;
        if (penalty === '+2') value = cs + 200;
        else if (penalty === 'dnf') value = -1;

        sim.solves.push({
            time: timeNum,
            penalty: penalty,
            value: value,    // centiseconds; -1 = DNF
            cs: cs,          // raw centiseconds
        });
        sim.currentSolve += 1;
        sim.selectedPenalty = 'none';

        // Clear input + render
        if (inputEl) inputEl.value = '';
        renderWcaLiveSimScramble();
        renderWcaLiveSimScorecard();
        renderWcaLiveSimLeaderboard(sim.resultsData.rounds[sim.roundIdx]);
        updateWcaLiveSimSolveNum();
        updateWcaLiveSimPenalty();
    }

    function renderWcaLiveSimScorecard() {
        const sim = state.wcalive.sim;
        const body = $('#wcalive-sim-scorecard-body');
        if (!body) return;
        if (sim.solves.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 12px; color: var(--clr-text-muted);">No solves yet</td></tr>';
            return;
        }
        body.innerHTML = sim.solves.map((s, i) => {
            const timeStr = s.penalty === 'dnf' ? 'DNF' : formatTime(s.time);
            const penStr = s.penalty === 'none' ? '' : (s.penalty === '+2' ? '+2' : 'DNF');
            const resultStr = s.penalty === 'dnf' ? 'DNF' : formatTime((s.cs + (s.penalty === '+2' ? 200 : 0)) / 100);
            const isCurrent = i === sim.solves.length - 1 && sim.currentSolve < sim.numSolves;
            return `<tr class="${isCurrent ? 'current-solve' : 'completed'}">
                <td>${i + 1}</td>
                <td>${timeStr}</td>
                <td>${penStr}</td>
                <td>${resultStr}</td>
            </tr>`;
        }).join('');
    }

    function renderWcaLiveSimPodium(round) {
        const container = $('#wcalive-sim-podium');
        if (!container) return;
        const podium = computePodium({ rounds: [round] }, 3);
        if (!podium || podium.length === 0) {
            container.innerHTML = '<div class="wcalive-sim-podium-empty">No results yet for this round.</div>';
            return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        container.innerHTML = podium.map((p, i) => `
            <div class="wcalive-sim-podium-card-mini rank-${i + 1}">
                <div class="wcalive-sim-podium-medal">${medals[i]}</div>
                <div class="wcalive-sim-podium-name" title="${escapeHtml(p.name)}">${countryFlagImg(p.country, 12)} ${escapeHtml(p.name)}</div>
                <div class="wcalive-sim-podium-time">${p.avgDisplay}</div>
            </div>
        `).join('');
    }

    function renderWcaLiveSimLeaderboard(round) {
        const body = $('#wcalive-sim-lb-body');
        const count = $('#wcalive-sim-lb-count');
        if (!body) return;
        if (!round.results || round.results.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="wcalive-sim-lb-empty">No results available yet</td></tr>';
            if (count) count.textContent = '0 competitors';
            return;
        }

        // Sort WCA results by average (best first)
        const sorted = [...round.results].sort((a, b) => {
            const sa = computeResultStats(a.attempts || []);
            const sb = computeResultStats(b.attempts || []);
            if (sa.average === -1 && sb.average === -1) return sa.best - sb.best;
            if (sa.average === -1) return 1;
            if (sb.average === -1) return -1;
            return sa.average - sb.average;
        });

        // Build user's running entry (if they have any solves)
        const sim = state.wcalive.sim;
        const userEntry = sim.solves.length > 0 ? buildUserEntry(sim) : null;

        // Merge user's entry into the sorted list at the correct rank
        let merged = sorted;
        if (userEntry) {
            const userStats = userEntry._stats;
            merged = [...sorted, userEntry].sort((a, b) => {
                const sa = a._stats;
                const sb = b._stats;
                if (sa.average === -1 && sb.average === -1) return sa.best - sb.best;
                if (sa.average === -1) return 1;
                if (sb.average === -1) return -1;
                return sa.average - sb.average;
            });
        }

        if (count) count.textContent = `${merged.length} competitors`;

        body.innerHTML = merged.map((r, idx) => {
            const person = r.person || {};
            const name = person.name || 'Unknown';
            const wcaId = person.wcaId;
            const isUser = r._isUser === true;
            const stats = r._stats;
            const best = stats.best > 0 ? formatTime(stats.best / 100) : '—';
            const avg = stats.average > 0 ? formatTime(stats.average / 100) : (stats.best > 0 ? 'DNF' : '—');
            const rank = idx + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
            const nameHtml = wcaId
                ? `<a href="https://www.worldcubeassociation.org/persons/${wcaId}" target="_blank" rel="noopener noreferrer">${countryFlagImg(person.countryIso2, 12)} ${escapeHtml(name)}</a>`
                : `${countryFlagImg(person.countryIso2, 12)} ${escapeHtml(name)}`;
            return `<tr class="wcalive-sim-lb-row ${isUser ? 'is-user' : ''}">
                <td class="lb-rank">${medal}</td>
                <td class="lb-name">${nameHtml}${isUser ? ' <span style="opacity:0.7;font-size:0.7rem;font-weight:600;">(YOU)</span>' : ''}</td>
                <td class="lb-best">${best}</td>
                <td class="lb-avg">${avg}</td>
            </tr>`;
        }).join('');
    }

    function buildUserEntry(sim) {
        // Compute user's current best + average from their solves
        const attempts = sim.solves.map(s => s.value); // cs values, with -1 for DNF, +200 for +2
        const stats = computeResultStats(attempts);
        return {
            _isUser: true,
            _stats: stats,
            person: {
                name: 'You',
                wcaId: null,
                countryIso2: null,
            },
        };
    }

    '''
    src = src.replace(old_func, new_func, 1)
    fixes_applied.append('Replaced openWcaLiveEvent to use simulation instead of static table')
else:
    fixes_applied.append('ERROR: openWcaLiveEvent not found, could not replace')

# Write back
Path('app.js').write_text(src, encoding='utf-8')
print(f'app.js updated. {original_len} -> {len(src)} chars')
for f in fixes_applied:
    print(f'  {f}')

# Verify
verify = Path('app.js').read_text(encoding='utf-8')
for needle in ['sim: {', 'function startWcaLiveSim', 'function bindWcaLiveSimUI', 'function submitWcaLiveSimSolve', 'function renderWcaLiveSimScramble', 'function renderWcaLiveSimScorecard', 'function renderWcaLiveSimPodium', 'function renderWcaLiveSimLeaderboard', 'function buildUserEntry', 'function updateWcaLiveSimPenalty', 'function updateWcaLiveSimSolveNum', 'bindWcaLiveSimUI._done']:
    print(f'  {needle}: {verify.count(needle)}')
print(f'Old static table code removed: {"renderWcaLiveResults" not in verify and "renderWcaLiveResultsBody" not in verify}')
