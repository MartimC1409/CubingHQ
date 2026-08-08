# -*- coding: utf-8 -*-
"""Fix the battle chat wiring + apply reviewer polish.

Previous run failed because:
1. The battle-leave-btn anchor was wrong (uses named fn, not arrow fn)
2. The room enter/leave display anchors used wrong quote style

This script:
1. Replaces the entire chat block (between RTDB and showToast) with polished versions:
   - Extract getGuestId() helper
   - Use `>=` for timestamp + dedupe by message id
   - Add orderBy fallback (plain GET if orderBy fails)
   - Better identity chain
2. Wires loadBattleChat() at the correct room-enter anchor
3. Wires stopBattleChat() at the correct room-leave anchor
4. Wires send button + Enter key after the leave button handler
"""
from pathlib import Path

JS = Path(r'D:\AI-TESTE\app.js')
src = JS.read_text(encoding='utf-8')

# ============ 1. Replace the existing chat block with polished versions ============
# The block starts with the comment "// ========== BATTLE CHAT (RTDB-backed, polled) =========="
# and ends right before "function showToast(message, type = 'info') {"

CHAT_START = "    // ========== BATTLE CHAT (RTDB-backed, polled) =========="
CHAT_END = "    function showToast(message, type = 'info') {"

start_idx = src.find(CHAT_START)
end_idx = src.find(CHAT_END)
if start_idx < 0:
    raise SystemExit('FATAL: CHAT_START not found')
if end_idx < 0 or end_idx < start_idx:
    raise SystemExit('FATAL: CHAT_END not found after CHAT_START')

NEW_CHAT_BLOCK = '''    // ========== BATTLE CHAT (RTDB-backed, polled every 3s) ==========
    // Get or create a stable guest ID for users without a WCA profile
    function getGuestId() {
        let id = localStorage.getItem('sc_guest_id');
        if (!id) {
            id = 'guest-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
            localStorage.setItem('sc_guest_id', id);
        }
        return id;
    }

    // Resolve the current user's display name (prefers WCA profile, then player name, then guest)
    function getBattleChatUserName() {
        if (state.userProfile && state.userProfile.name) return state.userProfile.name;
        if (state.playerName) return state.playerName;
        return 'Guest';
    }

    // Resolve the current user's stable ID
    function getBattleChatUserId() {
        if (state.userProfile && state.userProfile.wca_id) return state.userProfile.wca_id;
        if (state.playerWcaId) return state.playerWcaId;
        return getGuestId();
    }

    function loadBattleChat(roomId) {
        if (!roomId) return;
        battleChatRoomId = roomId;
        battleChatLastTimestamp = 0;
        battleChatSeenIds = new Set();
        const messagesEl = $('#battle-chat-messages');
        if (messagesEl) messagesEl.innerHTML = '<div class="battle-chat-empty">No messages yet \\u2014 say hi!</div>';
        updateBattleChatStatus('connecting\\u2026');
        // Immediate fetch, then poll every 3s
        pollBattleChat();
        if (battleChatInterval) clearInterval(battleChatInterval);
        battleChatInterval = setInterval(pollBattleChat, 3000);
    }

    async function pollBattleChat() {
        if (!battleChatRoomId) return;
        try {
            // Try server-side ordering first; fall back to plain GET if the DB
            // rejects the orderBy (some RTDBs require an index rule for new paths).
            let data = null;
            try {
                const r = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json?orderBy="timestamp"&limitToLast=50`);
                if (r.ok) data = await r.json();
            } catch (_) { /* fall through to plain GET */ }
            if (data === null) {
                const r2 = await fetch(`${RTDB}/battle_chats/${battleChatRoomId}.json`);
                if (r2.ok) data = await r2.json();
            }
            if (data === null) {
                updateBattleChatStatus('offline');
                return;
            }
            updateBattleChatStatus('live');

            if (!data) {
                const el = $('#battle-chat-messages');
                if (el && !el.querySelector('.battle-chat-message')) {
                    el.innerHTML = '<div class="battle-chat-empty">No messages yet \\u2014 say hi!</div>';
                }
                return;
            }
            const messages = Object.entries(data)
                .map(([id, m]) => ({ id, ...m }))
                .filter(m => m && m.text && m.timestamp)
                .sort((a, b) => a.timestamp - b.timestamp);

            // Dedupe by message id AND only re-render if there are new messages
            const newOnes = messages.filter(m => !battleChatSeenIds.has(m.id));
            if (newOnes.length > 0) {
                messages.forEach(m => battleChatSeenIds.add(m.id));
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
            // Use textContent for all user-supplied fields to prevent XSS
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
            const payload = {
                userId: getBattleChatUserId(),
                userName: getBattleChatUserName(),
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
                pollBattleChat(); // immediate visual update
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
        battleChatSeenIds = new Set();
    }

    function updateBattleChatStatus(status) {
        const el = $('#battle-chat-status');
        if (el) el.textContent = status;
    }

    '''

new_src = src[:start_idx] + NEW_CHAT_BLOCK + src[end_idx:]
print(f'  Step 1: Replaced chat block ({end_idx - start_idx} chars -> {len(NEW_CHAT_BLOCK)} chars)')

# ============ 2. Wire send button + Enter key after the leave button handler ============
# The actual anchor: `$('#battle-leave-btn').addEventListener('click', leaveBattleRoom);`
OLD_LEAVE = "$('#battle-leave-btn').addEventListener('click', leaveBattleRoom);"
NEW_LEAVE = """$('#battle-leave-btn').addEventListener('click', leaveBattleRoom);

        // Battle room chat: send on click + Enter key
        const _bcSend = $('#battle-chat-send-btn');
        if (_bcSend) _bcSend.addEventListener('click', sendBattleChatMessage);
        const _bcInput = $('#battle-chat-input');
        if (_bcInput) {
            _bcInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBattleChatMessage();
                }
            });
        }"""

if OLD_LEAVE not in new_src:
    raise SystemExit('FATAL: battle-leave-btn anchor not found in new_src')
new_src = new_src.replace(OLD_LEAVE, NEW_LEAVE, 1)
print(f'  Step 2: Wired send button + Enter key')

# ============ 3. Add battleChatSeenIds to state variables (next to battleChatInterval) ============
# The current state vars are: battleChatInterval, battleChatLastTimestamp, battleChatRoomId
# Add battleChatSeenIds
OLD_STATE = """    // Battle room chat state (RTDB-backed, polled every 3s)
    let battleChatInterval = null;
    let battleChatLastTimestamp = 0;
    let battleChatRoomId = null;"""
NEW_STATE = """    // Battle room chat state (RTDB-backed, polled every 3s)
    let battleChatInterval = null;
    let battleChatLastTimestamp = 0;
    let battleChatRoomId = null;
    let battleChatSeenIds = new Set();"""

if OLD_STATE not in new_src:
    raise SystemExit('FATAL: chat state vars not found in new_src')
new_src = new_src.replace(OLD_STATE, NEW_STATE, 1)
print(f'  Step 3: Added battleChatSeenIds state var')

# ============ 4. Wire loadBattleChat at room enter ============
# The actual line: `if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';`
OLD_ENTER = "if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';"
NEW_ENTER = """if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

        // Start chat polling for this room
        if (typeof battleChatRoomId !== 'undefined') {
            loadBattleChat(battleChatRoomId || (battleState && battleState.currentRoomId) || null);
        }"""

# There might be multiple occurrences (enter + leave) - we need the FIRST one (enter)
# Actually, the enter and leave use different display values (flex vs none), so they're distinct
if OLD_ENTER not in new_src:
    raise SystemExit('FATAL: room enter display=flex anchor not found')
new_src = new_src.replace(OLD_ENTER, NEW_ENTER, 1)
print(f'  Step 4: Wired loadBattleChat at room enter')

# ============ 5. Wire stopBattleChat at room leave ============
OLD_LEAVE_DISPLAY = "if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';"
NEW_LEAVE_DISPLAY = """if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';

        // Stop chat polling
        stopBattleChat();"""

if OLD_LEAVE_DISPLAY not in new_src:
    raise SystemExit('FATAL: room leave display=none anchor not found')
new_src = new_src.replace(OLD_LEAVE_DISPLAY, NEW_LEAVE_DISPLAY, 1)
print(f'  Step 5: Wired stopBattleChat at room leave')

JS.write_text(new_src, encoding='utf-8', newline='')

# Sanity check
n_open = new_src.count('{')
n_close = new_src.count('}')
print(f'\n  Brace balance: {{ {n_open}   }} {n_close}   delta={n_open - n_close}')
for needle in ['function getGuestId', 'function getBattleChatUserName', 'function getBattleChatUserId', 'function loadBattleChat', 'function pollBattleChat', 'function renderBattleChat', 'function sendBattleChatMessage', 'function stopBattleChat', 'function updateBattleChatStatus', 'battleChatSeenIds', 'loadBattleChat(battleChatRoomId', 'stopBattleChat();', '_bcSend.addEventListener', '_bcInput.addEventListener']:
    print(f'  {needle!r:45s} : {new_src.count(needle)} hit(s)')
print(f'\n  New size: {len(new_src)} bytes')
print('OK')
