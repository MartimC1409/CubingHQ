# -*- coding: utf-8 -*-
"""Add battle chat JS to app.js with CORRECT anchors + reviewer polish.

Previous attempts failed because:
1. The battle-leave-btn uses a named function ref, not arrow fn
2. The room enter/leave display anchors needed to use the exact quote style
3. The CHAT_START comment anchor wasn't in the file (functions never actually added)

This script uses proven anchors and applies reviewer polish:
- getGuestId/getBattleChatUserName/getBattleChatUserId helpers
- Dedup via message-id Set
- orderBy fallback to plain GET
- Simplified loadBattleChat call (just battleState.currentRoomId)
- Clean var names (no underscore prefix)
"""
from pathlib import Path

JS = Path(r'D:\AI-TESTE\app.js')
src = JS.read_text(encoding='utf-8')

# ============ 1. Add chat state variables after RTDB const ============
OLD_RTDB = """    const RTDB = 'https://simulatecubing-default-rtdb.firebaseio.com';"""
NEW_RTDB = """    const RTDB = 'https://simulatecubing-default-rtdb.firebaseio.com';

    // Battle room chat state (RTDB-backed, polled every 3s)
    let battleChatInterval = null;
    let battleChatLastTimestamp = 0;
    let battleChatRoomId = null;
    let battleChatSeenIds = new Set();"""

if OLD_RTDB not in src:
    raise SystemExit('FATAL: RTDB anchor not found')
if "let battleChatInterval" in src:
    print('  Step 1: state vars already present, skipping')
else:
    src = src.replace(OLD_RTDB, NEW_RTDB, 1)
    print('  Step 1: added chat state vars')

# ============ 2. Add chat functions block before showToast ============
# Use a unique anchor: the showToast function signature (won't change)
OLD_SHOWTOAST = """    function showToast(message, type = 'info') {"""

CHAT_BLOCK = '''    // Get or create a stable guest ID for users without a WCA profile
    function getGuestId() {
        let id = localStorage.getItem('sc_guest_id');
        if (!id) {
            id = 'guest-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
            localStorage.setItem('sc_guest_id', id);
        }
        return id;
    }

    function getBattleChatUserName() {
        if (state.userProfile && state.userProfile.name) return state.userProfile.name;
        if (state.playerName) return state.playerName;
        return 'Guest';
    }

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

if "function loadBattleChat" in src:
    print('  Step 2: chat functions already present, skipping')
else:
    if OLD_SHOWTOAST not in src:
        raise SystemExit('FATAL: showToast anchor not found')
    src = src.replace(OLD_SHOWTOAST, CHAT_BLOCK + OLD_SHOWTOAST, 1)
    print('  Step 2: added chat functions block')

# ============ 3. Wire send button + Enter key after leave button handler ============
OLD_LEAVE = "$('#battle-leave-btn').addEventListener('click', leaveBattleRoom);"
NEW_LEAVE = """$('#battle-leave-btn').addEventListener('click', leaveBattleRoom);

        // Battle room chat: send on click + Enter key
        const bcSend = $('#battle-chat-send-btn');
        if (bcSend) bcSend.addEventListener('click', sendBattleChatMessage);
        const bcInput = $('#battle-chat-input');
        if (bcInput) {
            bcInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBattleChatMessage();
                }
            });
        }"""

if "bcSend.addEventListener" in src:
    print('  Step 3: send button wiring already present, skipping')
else:
    if OLD_LEAVE not in src:
        raise SystemExit('FATAL: battle-leave-btn anchor not found')
    src = src.replace(OLD_LEAVE, NEW_LEAVE, 1)
    print('  Step 3: wired send button + Enter key')

# ============ 4. Wire loadBattleChat at room enter ============
# The room enter has: `if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';`
# There might be multiple occurrences — we need the one inside enterBattleRoom
# Use a more specific anchor: the line just before
OLD_ENTER = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

        initBattleInputModeButtons();"""

NEW_ENTER = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';

        // Start chat polling for this room
        if (typeof loadBattleChat === 'function') {
            const _chatRoomId = (typeof battleState !== 'undefined' && battleState && battleState.currentRoomId) || null;
            if (_chatRoomId) loadBattleChat(_chatRoomId);
        }

        initBattleInputModeButtons();"""

if "loadBattleChat(_chatRoomId)" in src:
    print('  Step 4: room-enter wiring already present, skipping')
else:
    if OLD_ENTER not in src:
        # Try without the trailing line
        OLD_ENTER_FALLBACK = "        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'flex';"
        if OLD_ENTER_FALLBACK not in src:
            raise SystemExit('FATAL: room-enter anchor not found')
        src = src.replace(OLD_ENTER_FALLBACK, NEW_ENTER, 1)
        print('  Step 4: wired loadBattleChat at room enter (fallback anchor)')
    else:
        src = src.replace(OLD_ENTER, NEW_ENTER, 1)
        print('  Step 4: wired loadBattleChat at room enter')

# ============ 5. Wire stopBattleChat at room leave ============
# There are multiple display='none' lines. Find the one near "battle-room-view"
# and check it's in the leave context
LEAVE_ANCHORS = [
    "        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';\n\n        // Stop chat polling\n        stopBattleChat();",
    "        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';"
]

NEW_LEAVE = """        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';

        // Stop chat polling
        stopBattleChat();"""

# Check if already wired
if "stopBattleChat();" in src and "// Stop chat polling" in src:
    print('  Step 5: room-leave wiring already present, skipping')
else:
    # Find ALL occurrences of the leave display line and wire the first one that's NOT already wired
    leave_line = "        if ($('#battle-room-view')) $('#battle-room-view').style.display = 'none';"
    if leave_line not in src:
        raise SystemExit('FATAL: room-leave display=none anchor not found')
    # Wire all occurrences (there are likely 2: one in leaveBattleRoom, one in init/reset)
    src = src.replace(leave_line, NEW_LEAVE, -1)  # replace ALL
    print(f'  Step 5: wired stopBattleChat at room leave (all occurrences)')

JS.write_text(src, encoding='utf-8', newline='')

# Sanity check
n_open = src.count('{')
n_close = src.count('}')
print(f'\n  Brace balance: {{ {n_open}   }} {n_close}   delta={n_open - n_close}')
for needle in ['function getGuestId', 'function loadBattleChat', 'function pollBattleChat', 'function sendBattleChatMessage', 'function stopBattleChat', 'let battleChatRoomId', 'let battleChatSeenIds', 'loadBattleChat(_chatRoomId)', 'stopBattleChat();', 'bcSend.addEventListener']:
    print(f'  {needle!r:40s} : {src.count(needle)} hit(s)')
print(f'\n  New size: {len(src)} bytes')
print('OK')
