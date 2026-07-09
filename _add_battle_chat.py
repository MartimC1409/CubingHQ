# -*- coding: utf-8 -*-
"""Add battle room chat: HTML panel + CSS styles + JS functions (RTDB poll).

HTML: chat panel inside .battle-room-right, below .battle-scores-panel
CSS: append to style.css
JS: insert chat functions + wiring near the bottom of app.js
"""
from pathlib import Path

HTML = Path(r'D:\AI-TESTE\index.html')
JS = Path(r'D:\AI-TESTE\app.js')
CSS = Path(r'D:\AI-TESTE\style.css')

# ============ HTML: add chat panel to battle room right column ============
html_src = HTML.read_text(encoding='utf-8')

OLD_HTML = """                        <div class="battle-cross-table-wrap" id="battle-cross-table-wrap">
                            <div class="battle-scores-empty">No solves yet — start solving!</div>
                        </div>
                    </div>"""

NEW_HTML = """                        <div class="battle-cross-table-wrap" id="battle-cross-table-wrap">
                            <div class="battle-scores-empty">No solves yet — start solving!</div>
                        </div>
                    </div>
                    <!-- Battle Room Chat (RTDB-backed) -->
                    <div class="battle-chat-panel" id="battle-chat-panel">
                        <div class="battle-panel-header">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Room Chat
                            <span class="battle-chat-status" id="battle-chat-status">connecting…</span>
                        </div>
                        <div class="battle-chat-messages" id="battle-chat-messages">
                            <div class="battle-chat-empty">No messages yet — say hi!</div>
                        </div>
                        <div class="battle-chat-input-row">
                            <input type="text" id="battle-chat-input" placeholder="Type a message…" maxlength="500" autocomplete="off" aria-label="Chat message">
                            <button id="battle-chat-send-btn" class="btn btn-primary btn-sm" aria-label="Send message">Send</button>
                        </div>
                    </div>"""

if OLD_HTML not in html_src:
    raise SystemExit('FATAL: battle scores anchor not found in index.html')
html_src = html_src.replace(OLD_HTML, NEW_HTML, 1)
HTML.write_text(html_src, encoding='utf-8', newline='')
print(f'  HTML: {html_src.count("battle-chat-panel")} battle-chat-panel hit(s)')

# ============ CSS: append battle chat styles ============
css_src = CSS.read_text(encoding='utf-8')

NEW_CSS = r"""

/* ============================================================
   BATTLE ROOM CHAT
   ============================================================ */

.battle-chat-panel {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    height: 220px;
    border-top: 1px solid var(--clr-border);
    background: var(--clr-surface);
}

.battle-chat-status {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--clr-text-muted);
    text-transform: none;
    letter-spacing: 0;
}

.battle-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    scroll-behavior: smooth;
}

.battle-chat-empty {
    text-align: center;
    color: var(--clr-text-muted);
    font-size: 0.8rem;
    padding: var(--space-lg) var(--space-sm);
    line-height: 1.5;
}

.battle-chat-message {
    font-size: 0.82rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 6px 10px;
    border-radius: 8px;
    word-wrap: break-word;
    line-height: 1.4;
    border-left: 2px solid var(--clr-primary);
}

.battle-chat-message .chat-user {
    font-weight: 700;
    color: var(--clr-primary);
    margin-right: 4px;
    font-size: 0.78rem;
}

.battle-chat-message .chat-time {
    font-size: 0.65rem;
    color: var(--clr-text-muted);
    float: right;
    margin-top: 3px;
    margin-left: 6px;
}

.battle-chat-message .chat-text {
    color: var(--clr-text);
}

.battle-chat-input-row {
    display: flex;
    gap: 6px;
    padding: var(--space-sm);
    border-top: 1px solid var(--clr-border);
    background: var(--clr-bg-elevated);
}

.battle-chat-input-row input {
    flex: 1;
    min-width: 0;
    background: var(--clr-bg);
    border: 1px solid var(--clr-border);
    color: var(--clr-text);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: var(--font-body);
    transition: border-color var(--transition-fast);
}

.battle-chat-input-row input:focus {
    border-color: var(--clr-primary);
    outline: none;
    box-shadow: 0 0 0 2px var(--clr-primary-glow);
}

.battle-chat-input-row input:disabled,
.battle-chat-input-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.battle-chat-input-row button {
    flex-shrink: 0;
    padding: 6px 14px;
}
"""

if 'BATTLE ROOM CHAT' in css_src:
    print('  CSS already present, skipping')
else:
    css_src = css_src.rstrip() + '\n' + NEW_CSS
    CSS.write_text(css_src, encoding='utf-8', newline='')
    print(f'  CSS: appended {len(NEW_CSS)} chars')
    print(f'  Old: {len(css_src) - len(NEW_CSS)} -> New: {len(css_src)}')

# ============ JS: add chat functions + wiring ============
js_src = JS.read_text(encoding='utf-8')

# 1. Add chat state variables after `const RTDB = ...` line
OLD_RTDB = """    const RTDB = 'https://simulatecubing-default-rtdb.firebaseio.com';"""
NEW_RTDB = """    const RTDB = 'https://simulatecubing-default-rtdb.firebaseio.com';

    // Battle room chat state (RTDB-backed, polled every 3s)
    let battleChatInterval = null;
    let battleChatLastTimestamp = 0;
    let battleChatRoomId = null;"""

if OLD_RTDB not in js_src:
    raise SystemExit('FATAL: RTDB anchor not found in app.js')
js_src = js_src.replace(OLD_RTDB, NEW_RTDB, 1)

# 2. Add chat functions: insert right before "// ========== BATTLE FEATURE ==========" or similar
# Find a good anchor - use the existing battle-create-room-btn click handler area
# Actually, let's insert before the IIFE closing - find the end of the file
# Use the last function definition as anchor
OLD_END = """    function showToast(message, type = 'info') {"""

NEW_END = """    // ========== BATTLE CHAT (RTDB-backed, polled) ==========
    async function loadBattleChat(roomId) {
        if (!roomId) return;
        battleChatRoomId = roomId;
        battleChatLastTimestamp = 0;
        // Render initial empty state
        const messagesEl = $('#battle-chat-messages');
        if (messagesEl) messagesEl.innerHTML = '<div class="battle-chat-empty">No messages yet \u2014 say hi!</div>';
        updateBattleChatStatus('connecting\u2026');
        // Initial fetch + start polling
        await pollBattleChat();
        if (battleChatInterval) clearInterval(battleChatInterval);
        battleChatInterval = setInterval(pollBattleChat, 3000);
    }

    async function pollBattleChat() {
        if (!battleChatRoomId) return;
        try {
            const url = `${RTDB}/battle_chats/${battleChatRoomId}.json?orderBy="timestamp"&limitToLast=50`;
            const res = await fetch(url);
            if (!res.ok) {
                updateBattleChatStatus('offline');
                return;
            }
            const data = await res.json();
            updateBattleChatStatus('live');
            if (!data) {
                // No messages yet
                const el = $('#battle-chat-messages');
                if (el && !el.querySelector('.battle-chat-message')) {
                    el.innerHTML = '<div class="battle-chat-empty">No messages yet \u2014 say hi!</div>';
                }
                return;
            }
            const messages = Object.entries(data)
                .map(([id, m]) => ({ id, ...m }))
                .filter(m => m && m.text && m.timestamp)
                .sort((a, b) => a.timestamp - b.timestamp);
            if (messages.length > 0 && messages[messages.length - 1].timestamp > battleChatLastTimestamp) {
                battleChatLastTimestamp = messages[messages.length - 1].timestamp;
                renderBattleChat(messages);
            }
        } catch (e) {
            updateBattleChatStatus('offline');
        }
    }

    function renderBattleChat(messages) {
        const container = $('#battle-chat-messages');
        if (!container) return;
        container.innerHTML = '';
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'battle-chat-message';
            // Use textContent for user-supplied fields to prevent XSS
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeSpan = document.createElement('span');
            timeSpan.className = 'chat-time';
            timeSpan.textContent = timeStr;
            const userSpan = document.createElement('span');
            userSpan.className = 'chat-user';
            userSpan.textContent = (msg.userName || 'Guest') + ':';
            const textSpan = document.createElement('span');
            textSpan.className = 'chat-text';
            textSpan.textContent = msg.text;
            div.appendChild(timeSpan);
            div.appendChild(userSpan);
            div.appendChild(textSpan);
            container.appendChild(div);
        });
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async function sendBattleChatMessage() {
        if (!battleChatRoomId) return;
        const input = $('#battle-chat-input');
        const btn = $('#battle-chat-send-btn');
        if (!input || !btn) return;
        const text = (input.value || '').trim().substring(0, 500);
        if (!text) return;
        input.disabled = true;
        btn.disabled = true;
        try {
            // Identity: prefer WCA profile (logged-in), then player name, then guest
            const userId = (state.userProfile && state.userProfile.wca_id)
                || (state.playerWcaId || '')
                || ('guest-' + (localStorage.getItem('sc_guest_id') || (localStorage.setItem('sc_guest_id', Math.random().toString(36).slice(2, 10)), localStorage.getItem('sc_guest_id'))));
            const userName = (state.userProfile && state.userProfile.name)
                || state.playerName
                || (state.competitors && state.competitors[0] && state.competitors[0].name)
                || 'Guest';
            const payload = {
                userId: userId,
                userName: userName,
                text: text,
                timestamp: Date.now()
            };
            const res = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                input.value = '';
                // Optimistic render: immediately fetch to show the new message
                pollBattleChat();
            } else {
                console.error('Chat send failed:', res.status);
            }
        } catch (e) {
            console.error('Failed to send chat message', e);
        } finally {
            input.disabled = false;
            btn.disabled = false;
            input.focus();
        }
    }

    function stopBattleChat() {
        if (battleChatInterval) {
            clearInterval(battleChatInterval);
            battleChatInterval = null;
        }
        battleChatRoomId = null;
        battleChatLastTimestamp = 0;
    }

    function updateBattleChatStatus(status) {
        const el = $('#battle-chat-status');
        if (el) el.textContent = status;
    }

    function showToast(message, type = 'info') {"""

if OLD_END not in js_src:
    raise SystemExit('FATAL: showToast anchor not found in app.js')
js_src = js_src.replace(OLD_END, NEW_END, 1)

# 3. Wire chat send button + Enter key in bindEvents
OLD_BATTLE_LEAVE = """        $('#battle-leave-btn').addEventListener('click', () => {"""
NEW_BATTLE_LEAVE = """        // Battle room chat: send on click + Enter key
        const battleChatSend = $('#battle-chat-send-btn');
        if (battleChatSend) {
            battleChatSend.addEventListener('click', sendBattleChatMessage);
        }
        const battleChatInput = $('#battle-chat-input');
        if (battleChatInput) {
            battleChatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBattleChatMessage();
                }
            });
        }
        $('#battle-leave-btn').addEventListener('click', () => {"""

if OLD_BATTLE_LEAVE not in js_src:
    raise SystemExit('FATAL: battle-leave-btn anchor not found')
js_src = js_src.replace(OLD_BATTLE_LEAVE, NEW_BATTLE_LEAVE, 1)

# 4. Call loadBattleChat on room enter + stopBattleChat on room leave
# Find the room enter handler (around line 3614: $('#battle-room-view').style.display = 'flex')
OLD_ROOM_ENTER = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';"""
NEW_ROOM_ENTER = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

        // Start chat polling for this room
        if (roomData && roomData.id) {
            loadBattleChat(roomData.id);
        }"""

if OLD_ROOM_ENTER not in js_src:
    raise SystemExit('FATAL: room enter anchor not found')
js_src = js_src.replace(OLD_ROOM_ENTER, NEW_ROOM_ENTER, 1)

# 5. Stop chat on room leave
OLD_ROOM_LEAVE = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';"""
NEW_ROOM_LEAVE = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';

        // Stop chat polling
        stopBattleChat();"""

if OLD_ROOM_LEAVE not in js_src:
    raise SystemExit('FATAL: room leave anchor not found')
js_src = js_src.replace(OLD_ROOM_LEAVE, NEW_ROOM_LEAVE, 1)

JS.write_text(js_src, encoding='utf-8', newline='')
n_open = js_src.count('{')
n_close = js_src.count('}')
print(f'  JS brace balance: {{ {n_open}   }} {n_close}   delta={n_open - n_close}')
print(f'  JS chat functions: loadBattleChat={js_src.count("function loadBattleChat")}, pollBattleChat={js_src.count("function pollBattleChat")}, sendBattleChatMessage={js_src.count("function sendBattleChatMessage")}, stopBattleChat={js_src.count("function stopBattleChat")}')
print(f'  JS wiring: loadBattleChat(roomData.id)={js_src.count("loadBattleChat(roomData.id)")}, stopBattleChat()={js_src.count("stopBattleChat();")}')
print('OK')
