import re

f = 'app.js'
d = open(f, encoding='utf-8').read()

# 1) Add volume + mute handlers in bindEvents() - look for the sound-toggle block
old_sound = (
    "        // Toggle scramble colors\n"
    "        const toggleColorsBtn = $('#toggle-scramble-colors-btn');\n"
    "        if (toggleColorsBtn) {\n"
    "            toggleColorsBtn.addEventListener('click', () => {\n"
    "                const visual = $('#scramble-visual');\n"
    "                if (visual) visual.classList.toggle('show-colors');\n"
    "            });\n"
    "        }"
)
new_sound = old_sound + (
    "\n\n"
    "        // ====== COMP NOISE VOLUME + MUTE ======\n"
    "        const volumeSlider = $('#comp-volume-slider');\n"
    "        const muteBtn = $('#mute-noise-btn');\n"
    "        const volControl = $('#dash-volume-control');\n"
    "        function applyMuteIcons() {\n"
    "            const on = $('#mute-icon-on');\n"
    "            const off = $('#mute-icon-off');\n"
    "            if (!on || !off) return;\n"
    "            if (ambientNoise.volume === 0) {\n"
    "                on.style.display = 'none';\n"
    "                off.style.display = '';\n"
    "                if (volControl) volControl.classList.add('muted');\n"
    "            } else {\n"
    "                on.style.display = '';\n"
    "                off.style.display = 'none';\n"
    "                if (volControl) volControl.classList.remove('muted');\n"
    "            }\n"
    "        }\n"
    "        if (volumeSlider) {\n"
    "            // Load saved volume\n"
    "            const savedVol = parseFloat(localStorage.getItem('sc_comp_volume') || '0.4');\n"
    "            state.compVolume = isNaN(savedVol) ? 0.4 : savedVol;\n"
    "            ambientNoise.volume = state.compVolume;\n"
    "            volumeSlider.value = state.compVolume;\n"
    "            applyMuteIcons();\n"
    "            volumeSlider.addEventListener('input', (e) => {\n"
    "                state.compVolume = parseFloat(e.target.value);\n"
    "                ambientNoise.volume = state.compVolume;\n"
    "                localStorage.setItem('sc_comp_volume', String(state.compVolume));\n"
    "                applyMuteIcons();\n"
    "            });\n"
    "        }\n"
    "        if (muteBtn) {\n"
    "            muteBtn.addEventListener('click', () => {\n"
    "                if (ambientNoise.volume > 0) {\n"
    "                    state._lastVolume = ambientNoise.volume;\n"
    "                    ambientNoise.volume = 0;\n"
    "                    if (volumeSlider) volumeSlider.value = 0;\n"
    "                    localStorage.setItem('sc_comp_volume', '0');\n"
    "                } else {\n"
    "                    const v = state._lastVolume || 0.4;\n"
    "                    ambientNoise.volume = v;\n"
    "                    state.compVolume = v;\n"
    "                    if (volumeSlider) volumeSlider.value = v;\n"
    "                    localStorage.setItem('sc_comp_volume', String(v));\n"
    "                }\n"
    "                applyMuteIcons();\n"
    "            });\n"
    "        }\n"
    "        applyMuteIcons();"
)
if old_sound in d:
    d = d.replace(old_sound, new_sound)
    print('volume/mute bindings: ADDED')
else:
    print('volume/mute bindings: pattern NOT FOUND')

# 2) Battle chat (Firebase-based) - append helpers + bindings before the very last close brace
#    We add: chat setup on join, send handler, message receive via Firebase listener.
# Find a stable insertion point: right after 'initBattleInputModeButtons();' line in initBattle
old_chat_anchor = (
    "        initBattleInputModeButtons();\n"
)
new_chat_anchor = (
    old_chat_anchor
    + (
        "\n"
        "        // ====== BATTLE CHAT (Firebase RTDB) ======\n"
        "        setupBattleChat();\n"
    )
)
if old_chat_anchor in d:
    d = d.replace(old_chat_anchor, new_chat_anchor, 1)
    print('battle chat setup call: ADDED')
else:
    print('battle chat setup call: pattern NOT FOUND')

# 3) Append chat functions helper inside the IIFE - find function initBattle scope end (just before the bottom of initBattle)
#    Easier: append at the end of file (before the closing IIFE })
chat_helpers = (
    "\n    // ========== BATTLE CHAT ==========\n"
    "    let _chatFbInterval = null;\n"
    "    let _chatLastSeenTs = 0;\n"
    "    function setupBattleChat() {\n"
    "        const input = $('#battle-chat-input');\n"
    "        const sendBtn = $('#battle-chat-send-btn');\n"
    "        if (!input || !sendBtn) return;\n"
    "        const send = async () => {\n"
    "            const txt = (input.value || '').trim();\n"
    "            if (!txt) return;\n"
    "            const uid = (window.getBattleUserId && window.getBattleUserId()) || localStorage.getItem('battle_uid') || 'guest';\n"
    "            const name = (state.userProfile && state.userProfile.name) || (localStorage.getItem('battle_name') || ('Guest-' + uid.slice(-4)));\n"
    "            const msg = {\n"
    "                uid,\n"
    "                name,\n"
    "                text: txt,\n"
    "                ts: Date.now()\n"
    "            };\n"
    "            try {\n"
    "                const roomId = state.battleRoomId || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
    "                if (!roomId) {\n"
    "                    appendChatMessage({ uid: 'system', name: 'System', text: 'Not in a battle room.', ts: Date.now() });\n"
    "                    return;\n"
    "                }\n"
    "                await fetch(`${RTDB}/battle_rooms/${roomId}/chat/${msg.ts}_${uid}.json`, {\n"
    "                    method: 'PUT',\n"
    "                    headers: { 'Content-Type': 'application/json' },\n"
    "                    body: JSON.stringify(msg)\n"
    "                });\n"
    "                input.value = '';\n"
    "            } catch (e) {\n"
    "                appendChatMessage({ uid: 'system', name: 'System', text: 'Failed to send.', ts: Date.now() });\n"
    "            }\n"
    "        };\n"
    "        sendBtn.addEventListener('click', send);\n"
    "        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });\n"
    "        // Poll for new messages (every 2s while in room)\n"
    "        if (_chatFbInterval) clearInterval(_chatFbInterval);\n"
    "        _chatLastSeenTs = 0;\n"
    "        _chatFbInterval = setInterval(pollChat, 2000);\n"
    "        // Welcome system message\n"
    "        appendChatMessage({ uid: 'system', name: 'System', text: 'Chat ready \u2014 be respectful!', ts: Date.now() });\n"
    "    }\n"
    "    async function pollChat() {\n"
    "        const roomId = state.battleRoomId || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
    "        if (!roomId) return;\n"
    "        try {\n"
    "            const res = await fetch(`${RTDB}/battle_rooms/${roomId}/chat.json`);\n"
    "            if (!res.ok) return;\n"
    "            const data = await res.json() || {};\n"
    "            const entries = Object.entries(data).map(([k, v]) => ({ k, ...v })).sort((a, b) => a.ts - b.ts);\n"
    "            for (const m of entries) {\n"
    "                if (m.ts > _chatLastSeenTs) {\n"
    "                    appendChatMessage(m);\n"
    "                    _chatLastSeenTs = m.ts;\n"
    "                }\n"
    "            }\n"
    "        } catch (e) { /* offline ok */ }\n"
    "    }\n"
    "    function appendChatMessage(m) {\n"
    "        const list = $('#battle-chat-messages');\n"
    "        if (!list) return;\n"
    "        const myUid = (window.getBattleUserId && window.getBattleUserId()) || '';\n"
    "        const div = document.createElement('div');\n"
    "        div.className = 'battle-chat-msg' + (m.uid === 'system' ? ' system' : (m.uid === myUid ? ' is-mine' : ''));\n"
    "        const meta = document.createElement('span');\n"
    "        meta.className = 'battle-chat-meta';\n"
    "        meta.textContent = (m.uid === 'system') ? 'System' : (m.name || 'Guest');\n"
    "        div.appendChild(meta);\n"
    "        const body = document.createElement('span');\n"
    "        body.textContent = m.text || '';\n"
    "        div.appendChild(body);\n"
    "        list.appendChild(div);\n"
    "        list.scrollTop = list.scrollHeight;\n"
    "    }\n"
    "    function stopBattleChat() {\n"
    "        if (_chatFbInterval) { clearInterval(_chatFbInterval); _chatFbInterval = null; }\n"
    "        const list = $('#battle-chat-messages');\n"
    "        if (list) list.innerHTML = '';\n"
    "    }\n"
)

# Insert before the very closing of IIFE: 'init(); })();'
# Find the last occurrence of '})();'
idx = d.rfind('})();')
if idx >= 0:
    d = d[:idx] + chat_helpers + '\n' + d[idx:]
    print('battle chat helpers: APPENDED')
else:
    print('battle chat helpers: IIFE END NOT FOUND')

# 4) Guest-to-login: when userProfile becomes available AND they are in a battle room as guest,
#    automatically leave the room so the new (logged-in) identity can join.
#    Hook into fetchWCAProfile (or handleHashRoute) - we'll add a flag check at top of fetchWCAProfile
old_wca_login_fetch = (
    "    async function fetchWCAProfile() {\n"
    "        const token = localStorage.getItem('wca_access_token');\n"
    "        if (!token) return;\n"
)
new_wca_login_fetch = (
    "    async function fetchWCAProfile() {\n"
    "        const token = localStorage.getItem('wca_access_token');\n"
    "        if (!token) return;\n"
    "        // GUEST-TO-LOGIN GUARD: if a guest is currently in a battle room and they\n"
    "        // sign in via OAuth, leave the battle room so they can rejoin cleanly as\n"
    "        // the authenticated user.\n"
    "        const prevUidBefore = localStorage.getItem('battle_uid');\n"
    "        const isGuest = prevUidBefore && prevUidBefore.startsWith('g_');\n"
    "        const inBattle = state.currentView === 'battle' && state.battleRoomId;\n"
    "        if (isGuest && inBattle) {\n"
    "            try { leaveBattleRoom(true); } catch (e) { /* swallow */ }\n"
    "        }\n"
)
if old_wca_login_fetch in d:
    d = d.replace(old_wca_login_fetch, new_wca_login_fetch, 1)
    print('guest-to-login guard: ADDED in fetchWCAProfile')
else:
    print('guest-to-login guard: pattern NOT FOUND')

open(f, 'w', encoding='utf-8').write(d)
print('-- app.js done --')
