import re

h_file = 'index.html'
h = open(h_file, encoding='utf-8').read()

# 1) Dashboard volume/mute
old_dash = (
    '                    <div class="dash-actions">\n'
    '                        <button class="btn btn-ghost btn-sm" id="back-to-setup-btn" title="Back to Setup">\n'
    '                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>\n'
    '                            Setup\n'
    '                        </button>\n'
    '                        <button class="btn btn-ghost btn-sm" id="fullscreen-btn" title="Fullscreen">\n'
    '                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>\n'
    '                        </button>\n'
    '                    </div>'
)
if old_dash in h:
    new_dash = old_dash.replace(
        '                    <div class="dash-actions">',
        (
            '                    <div class="dash-actions">\n'
            '                        <div class="dash-volume-control" id="dash-volume-control">\n'
            '                            <button class="btn btn-ghost btn-sm" id="mute-noise-btn" title="Mute / Unmute competition noise">\n'
            '                                <svg id="mute-icon-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>\n'
            '                                <svg id="mute-icon-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>\n'
            '                            </button>\n'
            '                            <input type="range" id="comp-volume-slider" min="0" max="1" step="0.01" value="0.4" title="Volume">\n'
            '                        </div>'
        )
    )
    h = h.replace(old_dash, new_dash)
    print('dashboard volume/mute HTML: ADDED')
else:
    print('dashboard: pattern NOT FOUND')

# 2) Competitions dual-grid wrapper (start)
if 'competitions-dual-grid' not in h:
    old_past_open = '                <div style="display: flex; justify-content: center; margin-bottom: var(--space-xl);">\n                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">'
    new_past_open = '                <div class="competitions-dual-grid">\n                <div>\n                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">'
    if old_past_open in h:
        h = h.replace(old_past_open, new_past_open)
        print('dual-grid START: ADDED')

# 3) Competitions dual-grid wrapper (end)
old_upcoming = (
    '                <!-- Upcoming Competitions (WCA Live style) -->\n'
    '                <div class="upcoming-comps-section" id="upcoming-comps-section">\n'
    '                    <div class="upcoming-comps-header">\n'
    '                        <h3 class="upcoming-comps-title">\U0001f4c5 Upcoming Competitions</h3>\n'
    '                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="upcoming-comps-link">View on WCA Live \u2192</a>\n'
    '                    </div>\n'
    '                    <div class="upcoming-comps-list" id="upcoming-comps-list">\n'
    '                        <div class="upcoming-comps-loading">\n'
    '                            <div class="spinner"></div>\n'
    '                            <span>Loading upcoming competitions...</span>\n'
    '                        </div>\n'
    '                    </div>\n'
    '                </div>\n\n'
    '            </div>\n'
    '        </div>'
)
if old_upcoming in h:
    new_upcoming = (
        '                </div><!-- /past-col -->\n'
        '                <!-- Upcoming Competitions (WCA Live style) -->\n'
        '                <div>\n'
        '                <div class="upcoming-comps-section" id="upcoming-comps-section">\n'
        '                    <div class="upcoming-comps-header">\n'
        '                        <h3 class="upcoming-comps-title">\U0001f4c5 Upcoming Competitions</h3>\n'
        '                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="upcoming-comps-link">View on WCA Live \u2192</a>\n'
        '                    </div>\n'
        '                    <div class="upcoming-comps-list" id="upcoming-comps-list">\n'
        '                        <div class="upcoming-comps-loading">\n'
        '                            <div class="spinner"></div>\n'
        '                            <span>Loading upcoming competitions...</span>\n'
        '                        </div>\n'
        '                    </div>\n'
        '                </div>\n'
        '                </div><!-- /upcoming-col -->\n'
        '                </div><!-- /competitions-dual-grid -->\n\n'
        '            </div>\n'
        '        </div>'
    )
    h = h.replace(old_upcoming, new_upcoming)
    print('dual-grid END: ADDED')
else:
    print('dual-grid END: pattern NOT FOUND')

# 4) Battle chat panel
old_chat = (
    '                        <div class="battle-cross-table-wrap" id="battle-cross-table-wrap">\n'
    '                            <div class="battle-scores-empty">No solves yet \u2014 start solving!</div>\n'
    '                        </div>\n'
    '                    </div>\n'
    '                </div>'
)
if old_chat in h:
    new_chat = old_chat.replace(
        '                    </div>\n                </div>',
        (
            '                        <!-- Battle Chat Panel -->\n'
            '                        <div class="battle-chat-panel">\n'
            '                            <div class="battle-panel-header">\n'
            '                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>\n'
            '                                Chat\n'
            '                            </div>\n'
            '                            <div class="battle-chat-messages" id="battle-chat-messages"></div>\n'
            '                            <div class="battle-chat-input-row">\n'
            '                                <input type="text" id="battle-chat-input" class="battle-chat-input" placeholder="Say something..." maxlength="200" autocomplete="off">\n'
            '                                <button class="btn btn-sm btn-primary" id="battle-chat-send-btn">Send</button>\n'
            '                            </div>\n'
            '                        </div>\n'
            '                    </div>\n'
            '                </div>'
        )
    )
    h = h.replace(old_chat, new_chat)
    print('battle chat HTML: ADDED')
else:
    print('battle chat: pattern NOT FOUND')

open(h_file, 'w', encoding='utf-8').write(h)
print('-- HTML done --')

# === style.css ===
s_file = 'style.css'
sd = open(s_file, encoding='utf-8').read()
add = []
add.append('.dash-volume-control { display: inline-flex; align-items: center; gap: 8px; background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 4px 10px; height: 32px; }')
add.append('.dash-volume-control #mute-noise-btn { padding: 4px 6px; border: none; background: transparent; color: var(--clr-text-secondary); cursor: pointer; }')
add.append('.dash-volume-control #mute-noise-btn:hover { color: var(--clr-primary); }')
add.append('.dash-volume-control #comp-volume-slider { -webkit-appearance: none; appearance: none; width: 90px; height: 4px; background: var(--clr-border); border-radius: 999px; outline: none; cursor: pointer; }')
add.append('.dash-volume-control #comp-volume-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--clr-primary); cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 6px rgba(99,102,241,0.45); }')
add.append('.dash-volume-control #comp-volume-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--clr-primary); cursor: pointer; border: 2px solid #fff; }')
add.append('.dash-volume-control.muted #comp-volume-slider { opacity: 0.4; pointer-events: none; }')
add.append('.competitions-dual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl); margin-bottom: var(--space-xl); align-items: start; }')
add.append('@media (max-width: 980px) { .competitions-dual-grid { grid-template-columns: 1fr; } }')
add.append('.battle-chat-panel { border-top: 1px solid var(--clr-border); background: var(--clr-bg-card); display: flex; flex-direction: column; min-height: 180px; max-height: 280px; flex-shrink: 0; }')
add.append('.battle-chat-messages { flex: 1; overflow-y: auto; padding: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; scroll-behavior: smooth; }')
add.append('.battle-chat-msg { max-width: 85%; padding: 0.4rem 0.65rem; border-radius: 10px; word-wrap: break-word; animation: fadeIn 0.2s ease; }')
add.append('.battle-chat-msg.is-mine { align-self: flex-end; background: linear-gradient(135deg,#FF6B35,#E74C3C); color: #fff; border-bottom-right-radius: 4px; }')
add.append('.battle-chat-msg:not(.is-mine) { align-self: flex-start; background: var(--clr-surface); color: var(--clr-text); border-bottom-left-radius: 4px; }')
add.append('.battle-chat-msg .battle-chat-meta { display: block; font-size: 0.65rem; opacity: 0.75; margin-bottom: 2px; font-weight: 700; }')
add.append('.battle-chat-msg.is-mine .battle-chat-meta { color: rgba(255,255,255,0.85); }')
add.append('.battle-chat-msg.system { align-self: center; background: transparent; color: var(--clr-text-muted); font-style: italic; font-size: 0.72rem; }')
add.append('.battle-chat-input-row { display: flex; gap: 0.5rem; padding: 0.5rem 0.6rem; border-top: 1px solid var(--clr-border); background: var(--clr-surface); }')
add.append('.battle-chat-input { flex: 1; padding: 0.45rem 0.7rem; background: var(--clr-bg-elevated); border: 1px solid var(--clr-border); border-radius: 8px; color: var(--clr-text); font-family: var(--font-body); font-size: 0.8rem; outline: none; transition: border-color 0.2s; }')
add.append('.battle-chat-input:focus { border-color: #FF6B35; }')
if 'dash-volume-control' not in sd:
    sd += '\n' + '\n'.join(add) + '\n'
    open(s_file, 'w', encoding='utf-8').write(sd)
    print('style.css: ADDED', len(add), 'rules')
else:
    print('style.css: already present')

print('-- ALL DONE --')
