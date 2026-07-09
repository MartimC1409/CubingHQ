import re

# === index.html: add volume bar + mute in dashboard, upcoming comps side-by-side, chat ===
h='index.html'
d=open(h,encoding='utf-8').read()

# 1) Add Volume/Mute controls to dashboard topbar (next to fullscreen button)
old_dash_actions = """                    <div class="dash-actions">
                        <button class="btn btn-ghost btn-sm" id="back-to-setup-btn" title="Back to Setup">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                            Setup
                        </button>
                        <button class="btn btn-ghost btn-sm" id="fullscreen-btn" title="Fullscreen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                    </div>"""

new_dash_actions = """                    <div class="dash-actions">
                        <div class="dash-volume-control" id="dash-volume-control" title="Competition ambient noise">
                            <button class="btn btn-ghost btn-sm" id="mute-noise-btn" title="Mute / Unmute competition noise" aria-label="Toggle ambient noise">
                                <svg id="mute-icon-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                                <svg id="mute-icon-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                            </button>
                            <input type="range" id="comp-volume-slider" min="0" max="1" step="0.01" value="0.4" aria-label="Competition noise volume" title="Volume">
                        </div>
                        <button class="btn btn-ghost btn-sm" id="back-to-setup-btn" title="Back to Setup">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                            Setup
                        </button>
                        <button class="btn btn-ghost btn-sm" id="fullscreen-btn" title="Fullscreen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                    </div>"""

if old_dash_actions in d:
    d = d.replace(old_dash_actions, new_dash_actions)
    print('dashboard volume/mute HTML: ADDED')
else:
    print('dashboard volume/mute HTML: pattern NOT FOUND')

# 2) Competitions view: put upcoming and past side-by-side using grid
old_comp_view_start = """                <div style="display: flex; justify-content: center; margin-bottom: var(--space-xl);">
                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">"""

new_comp_view_start = """                <div class="competitions-dual-grid">
                <div>
                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">"""

if 'competitions-dual-grid' not in d:
    d = d.replace(old_comp_view_start, new_comp_view_start)
    print('competitions dual-grid: WRAPPER START added')
else:
    print('competitions dual-grid: pattern NOT FOUND or already added')

# 3) Close the upcoming section wrapper properly.
old_upcoming = """                <!-- Upcoming Competitions (WCA Live style) -->
                <div class="upcoming-comps-section" id="upcoming-comps-section">
                    <div class="upcoming-comps-header">
                        <h3 class="upcoming-comps-title">📅 Upcoming Competitions</h3>
                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="upcoming-comps-link">View on WCA Live →</a>
                    </div>
                    <div class="upcoming-comps-list" id="upcoming-comps-list">
                        <div class="upcoming-comps-loading">
                            <div class="spinner"></div>
                            <span>Loading upcoming competitions...</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>"""

new_upcoming = """                </div><!-- /end past-comps column -->
                <!-- Upcoming Competitions (WCA Live style) -->
                <div>
                <div class="upcoming-comps-section" id="upcoming-comps-section">
                    <div class="upcoming-comps-header">
                        <h3 class="upcoming-comps-title">📅 Upcoming Competitions</h3>
                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="upcoming-comps-link">View on WCA Live →</a>
                    </div>
                    <div class="upcoming-comps-list" id="upcoming-comps-list">
                        <div class="upcoming-comps-loading">
                            <div class="spinner"></div>
                            <span>Loading upcoming competitions...</span>
                        </div>
                    </div>
                </div>
                </div><!-- /end upcoming-comps column -->
                </div><!-- /end competitions-dual-grid -->
            </div>
        </div>"""

if old_upcoming in d:
    d = d.replace(old_upcoming, new_upcoming)
    print('competitions dual-grid: WRAPPER END added')
else:
    print('competitions dual-grid closing: pattern NOT FOUND')

# 4) Battle chat panel - add right after the cross-table wrap (within right panel)
old_battle_right = """                        <div class="battle-cross-table-wrap" id="battle-cross-table-wrap">
                            <div class="battle-scores-empty">No solves yet — start solving!</div>
                        </div>
                    </div>
                </div>"""

new_battle_right = """                        <div class="battle-cross-table-wrap" id="battle-cross-table-wrap">
                            <div class="battle-scores-empty">No solves yet — start solving!</div>
                        </div>
                        <!-- Battle Chat Panel -->
                        <div class="battle-chat-panel">
                            <div class="battle-panel-header">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Chat
                            </div>
                            <div class="battle-chat-messages" id="battle-chat-messages"></div>
                            <div class="battle-chat-input-row">
                                <input type="text" id="battle-chat-input" class="battle-chat-input" placeholder="Say something..." maxlength="200" autocomplete="off">
                                <button class="btn btn-sm btn-primary" id="battle-chat-send-btn">Send</button>
                            </div>
                        </div>
                    </div>
                </div>"""

if old_battle_right in d:
    d = d.replace(old_battle_right, new_battle_right)
    print('battle chat HTML: ADDED')
else:
    print('battle chat HTML: pattern NOT FOUND')

open(h,'w',encoding
