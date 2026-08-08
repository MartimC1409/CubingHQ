#!/usr/bin/env python3
"""Replace the iframe wcalive-view with a native 3-sub-view structure:
   - #wcalive-sub-dashboard (live + recent comps)
   - #wcalive-sub-comp (comp detail with events + schedule)
   - #wcalive-sub-event (event results with rounds)
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('index.html').read_text(encoding='utf-8')

# Find the existing wcalive section
import re
m = re.search(r'<section id="wcalive-view" class="view">.*?</section>', src, re.DOTALL)
if not m:
    print('ERROR: wcalive-view section not found')
    sys.exit(1)

old_block = m.group(0)

# New native structure
new_block = '''<section id="wcalive-view" class="view">
            <div class="wcalive-container native-wcalive">
                <header class="wcalive-header">
                    <div class="wcalive-title-block">
                        <span class="wcalive-dot live-pulse" aria-hidden="true"></span>
                        <h2>WCA Live</h2>
                        <span class="wcalive-subtitle">Live competitions &amp; real-time results</span>
                    </div>
                    <div class="wcalive-header-actions">
                        <button type="button" class="btn btn-ghost btn-sm" id="wcalive-refresh-btn" title="Refresh">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Refresh
                        </button>
                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Open WCA Live
                        </a>
                    </div>
                </header>

                <!-- ====== Sub-view 1: Dashboard ====== -->
                <div id="wcalive-sub-dashboard" class="wcalive-subview active">
                    <div class="wcalive-section">
                        <h3 class="wcalive-section-title">
                            <span class="wcalive-section-icon">🔴</span> Live Now
                            <span class="wcalive-section-count" id="wcalive-live-count">0</span>
                        </h3>
                        <div id="wcalive-list-live" class="wcalive-card-grid">
                            <div class="wcalive-loading-row"><div class="spinner"></div><span>Loading live competitions...</span></div>
                        </div>
                    </div>
                    <div class="wcalive-section">
                        <h3 class="wcalive-section-title">
                            <span class="wcalive-section-icon">📅</span> This Week
                            <span class="wcalive-section-count" id="wcalive-week-count">0</span>
                        </h3>
                        <div id="wcalive-list-week" class="wcalive-card-grid">
                            <div class="wcalive-loading-row"><div class="spinner"></div><span>Loading upcoming competitions...</span></div>
                        </div>
                    </div>
                    <div class="wcalive-section">
                        <h3 class="wcalive-section-title">
                            <span class="wcalive-section-icon">✅</span> Recently Completed
                            <span class="wcalive-section-count" id="wcalive-recent-count">0</span>
                        </h3>
                        <div id="wcalive-list-recent" class="wcalive-card-grid">
                            <div class="wcalive-loading-row"><div class="spinner"></div><span>Loading recent results...</span></div>
                        </div>
                    </div>
                </div>

                <!-- ====== Sub-view 2: Competition Detail ====== -->
                <div id="wcalive-sub-comp" class="wcalive-subview" style="display:none;">
                    <button class="wcalive-back-btn" data-target="dashboard" type="button">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Back to WCA Live
                    </button>
                    <div id="wca-comp-loading" class="wcalive-loading-row"><div class="spinner"></div><span>Loading competition...</span></div>
                    <div id="wca-comp-content" style="display:none;">
                        <div class="wcalive-comp-header" id="wca-comp-header"></div>
                        <div class="wcalive-comp-layout">
                            <div class="wcalive-comp-main">
                                <h3 class="wcalive-h3">Events</h3>
                                <div id="wca-comp-events" class="event-chips-grid wcalive-event-grid"></div>
                                <div id="wca-comp-podium-section" style="display:none;">
                                    <h3 class="wcalive-h3">Top Finishers</h3>
                                    <div id="wca-comp-podium" class="wcalive-podium-wrap"></div>
                                </div>
                            </div>
                            <aside class="wcalive-comp-sidebar">
                                <h3 class="wcalive-h3">Upcoming Activities</h3>
                                <ul id="wca-comp-schedule" class="wcalive-schedule-list"></ul>
                                <a id="wca-comp-outlink" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="margin-top: var(--space-md); display: inline-flex; width: 100%; justify-content: center;">
                                    Open on WCA Website →
                                </a>
                            </aside>
                        </div>
                    </div>
                </div>

                <!-- ====== Sub-view 3: Event Results ====== -->
                <div id="wcalive-sub-event" class="wcalive-subview" style="display:none;">
                    <button class="wcalive-back-btn" data-target="comp" type="button">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Back to Competition
                    </button>
                    <div id="wca-event-header" class="wcalive-event-header"></div>
                    <div id="wca-event-rounds" class="wcalive-rounds-tabs"></div>
                    <div id="wca-event-loading" class="wcalive-loading-row"><div class="spinner"></div><span>Loading results...</span></div>
                    <div class="records-table-wrap" id="wca-event-table-wrap" style="display:none;">
                        <table class="records-table-enhanced wcalive-results-table">
                            <thead id="wca-event-thead"></thead>
                            <tbody id="wca-event-results-body"></tbody>
                        </table>
                        <div class="records-footer-hint" id="wca-event-empty" style="display:none;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            Results will appear once this round is complete
                        </div>
                    </div>
                </div>
            </div>
        </section>'''

src = src.replace(old_block, new_block)
Path('index.html').write_text(src, encoding='utf-8')
print('index.html updated.')

# Verify
verify = Path('index.html').read_text(encoding='utf-8')
for needle in ['wcalive-sub-dashboard', 'wcalive-sub-comp', 'wcalive-sub-event', 'wcalive-card-grid', 'wcalive-back-btn', 'wcalive-podium-wrap']:
    print(f'  {needle}: {verify.count(needle)}')
print(f'Old iframe gone: {"wcalive-iframe" not in verify}')
