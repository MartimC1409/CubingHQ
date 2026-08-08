#!/usr/bin/env python3
"""Replace the static WCA Live event results table with a simulation overlay
   that reuses the same UI components as the comp simulation (scramble, timer,
   scorecard, leaderboard with real WCA data).
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('index.html').read_text(encoding='utf-8')

# Find the existing #wcalive-sub-event block
import re
m = re.search(
    r'(<div id="wcalive-sub-event" class="wcalive-subview" style="display:none;">)(.*?)(</div>\s*</div>\s*</section>)',
    src, re.DOTALL
)
if not m:
    print('ERROR: wcalive-sub-event block not found')
    sys.exit(1)

old_block = m.group(0)

# New structure: header + round tabs + simulation overlay
new_block = '''<div id="wcalive-sub-event" class="wcalive-subview" style="display:none;">
                    <button class="wcalive-back-btn" data-target="comp" type="button">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Back to Competition
                    </button>
                    <div id="wca-event-header" class="wcalive-event-header"></div>
                    <div id="wca-event-rounds" class="wcalive-rounds-tabs"></div>

                    <!-- ====== WCA Live Simulation Overlay ====== -->
                    <div class="wcalive-sim" id="wcalive-sim">
                        <div class="wcalive-sim-grid">
                            <!-- LEFT: Scramble + Timer + Scorecard -->
                            <div class="wcalive-sim-main">
                                <div class="wcalive-sim-scramble-card">
                                    <div class="card-header-bar">
                                        <h3 class="card-bar-title">📋 Scramble</h3>
                                        <span class="wcalive-sim-round-badge" id="wcalive-sim-round-badge">Round 1</span>
                                    </div>
                                    <div class="scramble-content">
                                        <p class="scramble-text" id="wcalive-sim-scramble-text">Press the timer to generate scramble...</p>
                                    </div>
                                    <div class="wcalive-sim-solve-info">
                                        <span class="wcalive-sim-solve-label">Solve</span>
                                        <span class="wcalive-sim-solve-num" id="wcalive-sim-solve-num">1/5</span>
                                    </div>
                                </div>

                                <div class="wcalive-sim-timer-card">
                                    <div class="card-header-bar">
                                        <h3 class="card-bar-title">⏱️ Timer</h3>
                                        <div class="timer-status ready" id="wcalive-sim-status">READY</div>
                                    </div>
                                    <div class="wcalive-sim-timer-display">
                                        <input type="text" id="wcalive-sim-time-input" class="manual-time-input" placeholder="0.00" autocomplete="off" inputmode="numeric" style="font-size: clamp(2.5rem, 5vw, 4rem);">
                                        <p class="timer-hint">Type time (e.g. 954 = 9.54s) and press Enter</p>
                                    </div>
                                    <div class="penalty-bar">
                                        <button class="penalty-btn active" data-wcalive-pen="none">OK</button>
                                        <button class="penalty-btn" data-wcalive-pen="+2">+2</button>
                                        <button class="penalty-btn" data-wcalive-pen="dnf">DNF</button>
                                        <div class="penalty-divider"></div>
                                        <button class="btn btn-accent btn-sm" id="wcalive-sim-submit-btn">Submit Solve</button>
                                    </div>
                                </div>

                                <div class="wcalive-sim-scorecard-card">
                                    <div class="card-header-bar">
                                        <h3 class="card-bar-title">📝 Your Scorecard</h3>
                                        <span class="card-bar-info" id="wcalive-sim-scorecard-info">0/5 solves</span>
                                    </div>
                                    <div class="wcalive-sim-scorecard-wrap">
                                        <table class="scorecard-table" id="wcalive-sim-scorecard-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Time</th>
                                                    <th>Pen</th>
                                                    <th>Result</th>
                                                </tr>
                                            </thead>
                                            <tbody id="wcalive-sim-scorecard-body"></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <!-- RIGHT: Real WCA Leaderboard + Podium -->
                            <div class="wcalive-sim-sidebar">
                                <div class="wcalive-sim-podium-card">
                                    <div class="card-header-bar">
                                        <h3 class="card-bar-title">🏆 Top Finishers</h3>
                                    </div>
                                    <div class="wcalive-sim-podium" id="wcalive-sim-podium">
                                        <div class="wcalive-sim-loading-row"><div class="spinner"></div><span>Loading...</span></div>
                                    </div>
                                </div>
                                <div class="wcalive-sim-leaderboard-card">
                                    <div class="card-header-bar">
                                        <h3 class="card-bar-title">📊 Live Leaderboard</h3>
                                        <span class="card-bar-info" id="wcalive-sim-lb-count">0 competitors</span>
                                    </div>
                                    <div class="wcalive-sim-leaderboard-wrap">
                                        <table class="leaderboard-table">
                                            <thead>
                                                <tr>
                                                    <th class="lb-rank">#</th>
                                                    <th class="lb-name">Name</th>
                                                    <th class="lb-best">Best</th>
                                                    <th class="lb-avg">Average</th>
                                                </tr>
                                            </thead>
                                            <tbody id="wcalive-sim-lb-body"></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="wcalive-sim-footer">
                            <button class="btn btn-ghost btn-sm" id="wcalive-sim-new-scramble-btn">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                New Scramble
                            </button>
                            <button class="btn btn-ghost btn-sm" id="wcalive-sim-clear-btn">Clear Solves</button>
                            <span class="wcalive-sim-hint">Practice this round against the real WCA competitors</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>'''

# Replace the old block
# The regex captured the full section closing, so we just replace the match with the new block
src = src.replace(old_block, new_block, 1)
Path('index.html').write_text(src, encoding='utf-8')
print('index.html updated.')

# Verify
verify = Path('index.html').read_text(encoding='utf-8')
for needle in ['wcalive-sim-grid', 'wcalive-sim-scramble-card', 'wcalive-sim-timer-card', 'wcalive-sim-scorecard-card', 'wcalive-sim-podium', 'wcalive-sim-leaderboard', 'wcalive-sim-solve-num', 'wcalive-sim-submit-btn', 'wcalive-sim-new-scramble-btn']:
    print(f'  {needle}: {verify.count(needle)}')
print(f'Old static table removed: {"wca-event-results-body" not in verify}')
