#!/usr/bin/env python3
"""Refactor: USE THE SAME OVERLAY (dashboard view) instead of a parallel mini-simulation.

Steps:
1. Revert the mini-simulation HTML (keep event header + round tabs, remove sim overlay).
2. Revert the mini-simulation CSS.
3. Remove the 10 mini-simulation JS functions.
4. Modify openWcaLiveEvent: on round tab click, pre-populate state from WCA results
   and call the existing startSimulation() (which switches to the dashboard view).
5. Modify generateCompetitors to respect pre-populated competitors (so the user's
   WCA results become the leaderboard).
6. Modify the back-to-setup button to return to WCA Live when launched from there.
"""
import sys, re
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

# ============================================================
# STEP 1: REVERT HTML — restore the simple event results view
# (keep event header + round tabs; add a "Practice This Round" button per round)
# ============================================================
html = Path('index.html').read_text(encoding='utf-8')
html_orig = html

# Find and replace the wcalive-sub-event block
m = re.search(
    r'(<div id="wcalive-sub-event" class="wcalive-subview" style="display:none;">)(.*?)(</div>\s*</div>\s*</section>)',
    html, re.DOTALL
)
if not m:
    print('ERROR: wcalive-sub-event block not found')
    sys.exit(1)

old_event = m.group(0)
new_event = '''<div id="wcalive-sub-event" class="wcalive-subview" style="display:none;">
                    <button class="wcalive-back-btn" data-target="comp" type="button">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Back to Competition
                    </button>
                    <div id="wca-event-header" class="wcalive-event-header"></div>
                    <div id="wca-event-rounds" class="wcalive-rounds-tabs"></div>
                    <div id="wca-event-loading" class="wcalive-loading-row"><div class="spinner"></div><span>Loading rounds...</span></div>
                    <div class="wcalive-rounds-list" id="wca-rounds-list" style="display:none;">
                        <!-- Rounds populated by JS; each row has a "Practice This Round" button
                             that pre-populates state and calls startSimulation() -->
                    </div>
                </div>
            </div>
        </section>'''
html = html.replace(old_event, new_event, 1)
print('STEP 1: HTML reverted to simple event view (header + rounds + practice buttons)')

# ============================================================
# STEP 2: REVERT CSS — remove all .wcalive-sim* styles
# ============================================================
css = Path('style.css').read_text(encoding='utf-8')
css_orig = css

# Find the WCA LIVE SIMULATION OVERLAY block and remove it
css_marker = "\n/* ============================================================\n   WCA LIVE SIMULATION OVERLAY (per-round practice)\n   ============================================================ */"
m_css = css.find(css_marker)
if m_css >= 0:
    # Find the end of the block (next /* === or end of file)
    end_marker = "\n/* ============================================================"
    m_end = css.find(end_marker, m_css + len(css_marker))
    if m_end < 0:
        m_end = len(css)
    css = css[:m_css] + css[m_end:]
    print('STEP 2: CSS .wcalive-sim* block removed')
else:
    print('STEP 2: CSS marker not found (may have been removed already)')

# Add a small style for the rounds list (one card per round with practice button)
extra_css = '''

/* WCA Live: rounds list (each round has a Practice button) */
.wcalive-rounds-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-md);
}

.wcalive-round-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-md);
    transition: all var(--transition-base);
}

.wcalive-round-row:hover {
    border-color: var(--clr-primary);
    transform: translateX(2px);
}

.wcalive-round-info {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex: 1;
}

.wcalive-round-label {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--clr-text);
}

.wcalive-round-meta {
    font-size: 0.82rem;
    color: var(--clr-text-muted);
}

.wcalive-round-practice-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.5rem 1rem;
    background: var(--clr-primary);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.wcalive-round-practice-btn:hover {
    background: var(--clr-primary-hover);
    box-shadow: 0 4px 16px var(--clr-primary-glow);
    transform: translateY(-1px);
}
'''
css = css.rstrip() + extra_css
Path('style.css').write_text(css, encoding='utf-8')
print(f'STEP 2: CSS updated. {len(css_orig)} -> {len(css)} chars')

# ============================================================
# STEP 3: REVERT JS — remove the 10 mini-simulation functions
# ============================================================
js = Path('app.js').read_text(encoding='utf-8')
js_orig = js

# The new openWcaLiveEvent + 10 sim functions were inserted as one block.
# Find the marker "// ============== WCA LIVE PER-ROUND SIMULATION =============="
# and remove from "async function openWcaLiveEvent" up to the function before the
# end of that block (before "function escapeHtml").
sim_block_start = js.find('async function openWcaLiveEvent(')
if sim_block_start < 0:
    print('ERROR: openWcaLiveEvent not found')
    sys.exit(1)
# Find the end: "function escapeHtml" is the next function after our block
escape_start = js.find('function escapeHtml(', sim_block_start)
if escape_start < 0:
    print('ERROR: escapeHtml not found')
    sys.exit(1)

# Remove everything from sim_block_start to escape_start
js = js[:sim_block_start] + js[escape_start:]
print(f'STEP 3a: Removed mini-simulation block. {len(js_orig)} -> {len(js)} chars')

# ============================================================
# STEP 4: Add a CLEAN openWcaLiveEvent that uses the existing dashboard view
# ============================================================
new_event_fn = '''async function openWcaLiveEvent(compId, eventId) {
        if (!compId || !eventId) return;
        state.wcalive.selectedCompId = compId;
        state.wcalive.selectedEventId = eventId;
        switchWcaLiveSubView('event');

        const loading = $('#wca-event-loading');
        const roundsList = $('#wca-rounds-list');
        if (loading) loading.style.display = 'flex';
        if (roundsList) roundsList.style.display = 'none';

        try {
            const [comp, results] = await Promise.all([
                fetchCached(`comp:${compId}`, `${WCA_API}/competitions/${compId}`, 5 * 60 * 1000),
                fetchCached(`results:${compId}:${eventId}`, `${WCA_API}/competitions/${compId}/results/${eventId}`, 5 * 60 * 1000),
            ]);
            state.wcalive.resultsData = results;
            state.wcalive.selectedCompName = comp.name || compId;

            // Event header
            const header = $('#wca-event-header');
            if (header) {
                header.innerHTML = `
                    <h2>${escapeHtml(EVENT_NAMES[eventId] || eventId)}</h2>
                    <div class="event-subtitle">${escapeHtml(comp.name || compId)}</div>
                `;
            }

            // Rounds list — each row has a "Practice This Round" button that
            // pre-populates state and calls the existing startSimulation() (the same
            // dashboard overlay used by the comp simulation).
            if (roundsList) {
                const roundTypeNames = { '1': 'Round 1', '2': 'Round 2', '3': 'Semi-Final', 'f': 'Final' };
                roundsList.innerHTML = results.rounds.map((r, i) => {
                    const label = roundTypeNames[r.roundTypeId] || `Round ${i + 1}`;
                    const hasResults = r.results && r.results.length > 0;
                    const competitorCount = hasResults ? r.results.length : 0;
                    const meta = hasResults
                        ? `${competitorCount} competitors · ${r.results[0] && r.results[0].attempts ? r.results[0].attempts.length : 5} attempts`
                        : 'No results yet';
                    return `<div class="wcalive-round-row" data-round-idx="${i}">
                        <div class="wcalive-round-info">
                            <span class="wcalive-round-label">${label}</span>
                            <span class="wcalive-round-meta">${meta}</span>
                        </div>
                        <button class="wcalive-round-practice-btn" data-round-idx="${i}" type="button">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Practice This Round
                        </button>
                    </div>`;
                }).join('');
                roundsList.style.display = 'flex';

                // Wire up practice buttons: pre-populate state and call startSimulation()
                roundsList.querySelectorAll('.wcalive-round-practice-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const roundIdx = parseInt(btn.dataset.roundIdx, 10);
                        startWcaLiveRound(compId, eventId, roundIdx, comp, results);
                    });
                });
            }

            if (loading) loading.style.display = 'none';
        } catch (err) {
            console.error('Event results fetch failed:', err);
            if (loading) loading.innerHTML = `<span>⚠️ Could not load results. <a href="#" onclick="openWcaLiveEvent('${compId}','${eventId}');return false;">Retry</a></span>`;
        }
    }

    // Launch the existing comp simulation dashboard for a WCA Live round.
    // Pre-populates state from the WCA API data so the leaderboard shows real
    // competitors, then calls startSimulation() — the same UI used by the
    // comp simulation feature.
    function startWcaLiveRound(compId, eventId, roundIdx, comp, results) {
        const round = results.rounds[roundIdx];
        if (!round) return;

        // Determine numSolves from the round's results (if any) or event type
        let numSolves = 5;
        if (round.results && round.results[0] && Array.isArray(round.results[0].attempts)) {
            numSolves = round.results[0].attempts.length;
        } else if (MEAN_OF_3_EVENTS && MEAN_OF_3_EVENTS.includes(eventId)) {
            numSolves = 3;
        }

        // Build competitors from the WCA results (real best/average per competitor).
        // This is the same shape used by the main comp simulation's generateCompetitors().
        const realCompetitors = (round.results || []).map(r => {
            const person = r.person || {};
            const stats = computeResultStats(r.attempts || []);
            const prAvg = stats.average > 0 ? stats.average / 100 : (stats.best > 0 ? stats.best / 100 : 15);
            const prSingle = stats.best > 0 ? stats.best / 100 : prAvg;
            return {
                name: person.name || 'Unknown',
                wcaId: person.wcaId || null,
                country: person.countryIso2 || '',
                prSingle: prSingle,
                prAvg: prAvg,
                compAvg: prAvg,
                solves: [],
                currentSolve: 0,
                status: 'finished', // they've already finished this round IRL
                initialBest: stats.best > 0 ? stats.best : null,
                initialAvg: stats.average > 0 ? stats.average : null,
            };
        });

        // Pre-populate the simulation state. startSimulation() will generate
        // scrambles, reset solves, and render the dashboard.
        state.compId = compId;
        state.compName = (comp && comp.name) || compId;
        state.compData = comp;
        state.wcifData = null; // not used here
        state.event = eventId;
        state.round = roundIdx + 1; // 1-indexed for ROUND_NAMES
        state.numSolves = numSolves;
        state.numCompetitors = Math.max(realCompetitors.length, 2);
        // Pre-populate competitors so generateCompetitors() uses them
        state.preservedCompetitors = realCompetitors;
        // Mark that we came from WCA Live so the back button can return there
        state.wcalive.fromWcaLive = { compId, eventId, roundIdx };

        // Launch the existing simulation (switches to dashboard view)
        startSimulation();
        showToast(`🏁 Practicing ${EVENT_NAMES[eventId]} - Round ${roundIdx + 1} of ${comp.name || compId}`, 'info');
    }

    '''

# Insert before "function escapeHtml("
js = js.replace('function escapeHtml(', new_event_fn + '    function escapeHtml(')
print('STEP 4: Added clean openWcaLiveEvent + startWcaLiveRound')

# ============================================================
# STEP 5: Modify generateCompetitors to respect pre-populated competitors
# ============================================================
old_gen = '''    function generateCompetitors() {
        state.competitors = [];

        let wcifCompetitors = [];'''
new_gen = '''    function generateCompetitors() {
        // If competitors were pre-populated (e.g. from WCA Live real results),
        // use them instead of regenerating.
        if (Array.isArray(state.preservedCompetitors) && state.preservedCompetitors.length > 0) {
            state.competitors = state.preservedCompetitors;
            state.preservedCompetitors = null; // consume once
            return;
        }

        state.competitors = [];

        let wcifCompetitors = [];'''
if old_gen in js:
    js = js.replace(old_gen, new_gen, 1)
    print('STEP 5: generateCompetitors now respects pre-populated competitors')
else:
    print('ERROR: generateCompetitors not found')

# ============================================================
# STEP 6: Modify back-to-setup button to return to WCA Live when applicable
# ============================================================
old_back = """        // Dashboard buttons
        $('#back-to-setup-btn').addEventListener('click', () => { clearSimState(); switchView('setup'); });"""
new_back = """        // Dashboard buttons — returns to WCA Live if launched from there
        $('#back-to-setup-btn').addEventListener('click', () => {
            const fromWca = state.wcalive && state.wcalive.fromWcaLive;
            clearSimState();
            if (fromWca) {
                const { compId } = fromWca;
                state.wcalive.fromWcaLive = null;
                switchView('wcalive');
                openWcaLiveComp(compId);
            } else {
                switchView('setup');
            }
        });"""
if old_back in js:
    js = js.replace(old_back, new_back, 1)
    print('STEP 6: Back button now returns to WCA Live when applicable')
else:
    print('ERROR: back-to-setup-btn handler not found')

# Save files
Path('index.html').write_text(html, encoding='utf-8')
Path('app.js').write_text(js, encoding='utf-8')
print(f'\nindex.html: {len(html_orig)} -> {len(html)} chars')
print(f'app.js:     {len(js_orig)} -> {len(js)} chars')

# ============================================================
# VERIFY
# ============================================================
print('\n=== VERIFY ===')
html = Path('index.html').read_text(encoding='utf-8')
for needle in ['wcalive-rounds-list', 'wcalive-round-row', 'wcalive-round-practice-btn', 'wca-rounds-list']:
    print(f'  HTML {needle}: {html.count(needle)}')
for needle in ['wcalive-rounds-list', 'wcalive-round-row', 'wcalive-round-practice-btn']:
    print(f'  CSS  {needle}: {css.count(needle)}')
# Mini-sim should be GONE
for needle in ['wcalive-sim-grid', 'wcalive-sim-scramble-card', 'wcalive-sim-timer-card', 'wcalive-sim-scorecard-card', 'wcalive-sim-podium']:
    print(f'  (should be 0) HTML {needle}: {html.count(needle)}')
    print(f'  (should be 0) CSS  {needle}: {css.count(needle)}')
js = Path('app.js').read_text(encoding='utf-8')
for needle in ['function startWcaLiveRound', 'state.preservedCompetitors', 'state.wcalive.fromWcaLive', 'openWcaLiveComp(compId)']:
    print(f'  JS {needle}: {js.count(needle)}')
for needle in ['function startWcaLiveSim', 'function bindWcaLiveSimUI', 'function submitWcaLiveSimSolve', 'function renderWcaLiveSimScramble', 'function renderWcaLiveSimScorecard', 'function renderWcaLiveSimPodium', 'function renderWcaLiveSimLeaderboard', 'function buildUserEntry']:
    print(f'  (should be 0) JS {needle}: {js.count(needle)}')
