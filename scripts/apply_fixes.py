import re

f = 'app.js'
d = open(f, encoding='utf-8').read()
h_file = 'index.html'
h = open(h_file, encoding='utf-8').read()

# ---------- FIX 1: file:// OAuth bug ----------
old_oauth_pattern = re.compile(
    r"let\s+OAUTH_REDIRECT_URI;[\s\S]*?OAUTH_REDIRECT_URI\s*=\s*o\s*\+\s*\(window\.location\.pathname\s*\|\|\s*'/'\);\s*\}",
    re.MULTILINE
)
new_oauth_block = (
    "let OAUTH_REDIRECT_URI;\n"
    "    try {\n"
    "        if (window.location.protocol === 'file:') {\n"
    "            // file:// has no origin host; WCA OAuth requires http(s). Substitute placeholder.\n"
    "            let p = window.location.pathname || '';\n"
    "            const last = (p.split('/').pop() || '');\n"
    "            if (last && !/\.[a-z0-9]+$/i.test(last)) p += '/';\n"
    "            OAUTH_REDIRECT_URI = 'http://localhost' + (p || '/');\n"
    "        } else {\n"
    "            const u = new URL(window.location.href);\n"
    "            let p = u.pathname || '/';\n"
    "            const last = (p.split('/').pop() || '');\n"
    "            if (last && !/\.[a-z0-9]+$/i.test(last)) p += '/';\n"
    "            OAUTH_REDIRECT_URI = u.origin + p;\n"
    "        }\n"
    "    } catch (e) {\n"
    "        const origin = window.location.protocol === 'file:' ? 'http://localhost' : (window.location.origin || '');\n"
    "        OAUTH_REDIRECT_URI = origin + (window.location.pathname || '/');\n"
    "    }"
)

m = old_oauth_pattern.search(d)
if m:
    d = d[:m.start()] + new_oauth_block + d[m.end():]
    print('FIX 1 (OAuth file://): APPLIED')
else:
    print('FIX 1: PATTERN NOT FOUND')

# ---------- FIX 2 + 3: chat uses battleState.currentRoomId + bootstrap ----------
old_chat_send = (
    "const roomId = state.battleRoomId || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
    "                if (!roomId) {\n"
)
new_chat_send = (
    "const roomId = (typeof battleState !== 'undefined' && battleState.currentRoomId) || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
    "                if (!roomId) {\n"
)
n = d.count(old_chat_send)
d = d.replace(old_chat_send, new_chat_send)
print(f'FIX 2 (chat roomId source): {n} replacements')

# pollChat signature + bootstrap
old_poll_body = (
    "    async function pollChat() {\n"
    "        const roomId = state.battleRoomId || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
)
new_poll_body = (
    "    async function pollChat(isInitial) {\n"
    "        const roomId = (typeof battleState !== 'undefined' && battleState.currentRoomId) || (location.hash.match(/battle-([^&]+)/) || [])[1] || '';\n"
)
n = d.count(old_poll_body)
d = d.replace(old_poll_body, new_poll_body)
print(f'FIX 3 (pollChat signature): {n} replacements')

# bootstrap cursor
old_poll_setup = (
    "// Welcome system message\n"
    "        appendChatMessage({ uid: 'system', name: 'System', text: 'Chat ready \u2014 be respectful!', ts: Date.now() });\n"
    "    }\n"
    "    async function pollChat(isInitial) {\n"
)
new_poll_setup = (
    "// Bootstrap: load last 60s of messages before freezing the cursor.\n"
    "        pollChat(true).then(() => { _chatLastSeenTs = Date.now() - 60000; });\n"
    "        // Welcome system message\n"
    "        appendChatMessage({ uid: 'system', name: 'System', text: 'Chat ready \u2014 be respectful!', ts: Date.now() });\n"
    "    }\n"
    "    async function pollChat(isInitial) {\n"
)
n = d.count(old_poll_setup)
d = d.replace(old_poll_setup, new_poll_setup)
print(f'FIX 3b (chat bootstrap cursor): {n} replacements')

# ---------- FIX 4: stopBattleChat() called from leaveBattleRoom ----------
old_leave_start = (
    "    async function leaveBattleRoom() {\n"
    "        const roomId = battleState.currentRoomId;\n"
)
new_leave_start = (
    "    async function leaveBattleRoom() {\n"
    "        try { stopBattleChat(); } catch (e) { /* ignore */ }\n"
    "        const roomId = battleState.currentRoomId;\n"
)
n = d.count(old_leave_start)
d = d.replace(old_leave_start, new_leave_start)
print(f'FIX 4 (stopBattleChat on leave): {n} replacements')

# ---------- FIX 6: regenerate battle_uid from userProfile.wca_id on login ----------
old_profile_set = (
    "showToast(`Welcome back, ${data.me.name.split(' ')[0]}!`, 'success');\n"
    "                if ($('#login-modal')) $('#login-modal').style.display = 'none';\n"
    "                if ($('#signup-modal')) $('#signup-modal').style.display = 'none';\n"
)
new_profile_set = (
    "showToast(`Welcome back, ${data.me.name.split(' ')[0]}!`, 'success');\n"
    "                if ($('#login-modal')) $('#login-modal').style.display = 'none';\n"
    "                if ($('#signup-modal')) $('#signup-modal').style.display = 'none';\n"
    "                // Promote guest battle_uid (\"g_<random>\") to a stable per-user id\n"
    "                // (\"u_<wcaId>\") so getBattleUserId() returns the same identity across sessions.\n"
    "                try {\n"
    "                    const prevUid = localStorage.getItem('battle_uid');\n"
    "                    if (prevUid && prevUid.startsWith('g_') && data.me.wca_id) {\n"
    "                        localStorage.setItem('battle_uid', 'u_' + data.me.wca_id);\n"
    "                        localStorage.setItem('battle_name', data.me.name);\n"
    "                    }\n"
    "                } catch (e) { /* ignore */ }\n"
)
n = d.count(old_profile_set)
d = d.replace(old_profile_set, new_profile_set)
print(f'FIX 6 (battle_uid promotion): {n} replacements')

# Fix the in-battle check in the OAuth guard to use battleState
old_in_battle = (
    "const inBattle = state.currentView === 'battle' && state.battleRoomId;\n"
)
new_in_battle = (
    "const inBattle = state.currentView === 'battle' && (typeof battleState !== 'undefined' && battleState.currentRoomId);\n"
)
n = d.count(old_in_battle)
d = d.replace(old_in_battle, new_in_battle)
print(f'FIX 2b (login guard inBattle check): {n} replacements')

# ---------- FIX 5: Clock lift pins cap at 2 ----------
old_lift = (
    "// 0+ pins lifted (UR DR DL UL) - WCA allows 0+, 1+, 2+, 3+, 4+, 5+\n"
    "        const liftPins = ['UR', 'DR', 'DL', 'UL'];\n"
    "        const lifted = [];\n"
    "        for (let i = 0; i < liftPins.length; i++) {\n"
    "            if (Math.random() < 0.33) {\n"
    "                const v = 1 + Math.floor(Math.random() * 5);\n"
    "                lifted.push(`${liftPins[i]}${v}+`);\n"
    "            }\n"
    "        }\n"
    "        if (lifted.length) moves.push(lifted.join(' '));\n"
)
new_lift = (
    "// 0+ pins lifted (UR DR DL UL) - WCA spec: pick 0, 1, or 2 pins; each +1..+5\n"
    "        const liftPins = ['UR', 'DR', 'DL', 'UL'];\n"
    "        const liftCount = Math.random() < 0.33 ? (Math.random() < 0.5 ? 1 : 2) : 0;\n"
    "        const lifted = [];\n"
    "        if (liftCount > 0) {\n"
    "            const pool = liftPins.slice();\n"
    "            for (let i = pool.length - 1; i > 0; i--) {\n"
    "                const j = Math.floor(Math.random() * (i + 1));\n"
    "                [pool[i], pool[j]] = [pool[j], pool[i]];\n"
    "            }\n"
    "            for (let i = 0; i < liftCount; i++) {\n"
    "                const v = 1 + Math.floor(Math.random() * 5);\n"
    "                lifted.push(`${pool[i]}${v}+`);\n"
    "            }\n"
    "        }\n"
    "        if (lifted.length) moves.push(lifted.join(' '));\n"
)
n = d.count(old_lift)
d = d.replace(old_lift, new_lift)
print(f'FIX 5 (clock lift cap 2): {n} replacements')

# ---------- MINOR: tighten partialAvg ----------
old_partial = (
    "const valid = c.solves.filter(s => s.penalty !== 'dnf');\n"
    "            if (valid.length === 0) return Infinity;\n"
    "            const sum = valid.reduce((acc, s) => acc + (s.result !== undefined ? s.result : (s.time || 0)), 0);\n"
    "            return sum / valid.length;\n"
)
new_partial = (
    "const valid = c.solves\n"
    "                .filter(s => s.penalty !== 'dnf')\n"
    "                .map(s => (s.result !== undefined ? s.result : (typeof s.time === 'number' ? s.time : null)))\n"
    "                .filter(v => v !== null && Number.isFinite(v));\n"
    "            if (valid.length === 0) return Infinity;\n"
    "            const sum = valid.reduce((acc, v) => acc + v, 0);\n"
    "            return sum / valid.length;\n"
)
n = d.count(old_partial)
d = d.replace(old_partial, new_partial)
print(f'MINOR (partialAvg tightened): {n} replacements')

# ---------- MINOR: aria-label on volume slider ----------
old_slider = '<input type="range" id="comp-volume-slider" min="0" max="1" step="0.01" value="0.4" title="Volume">'
new_slider = '<input type="range" id="comp-volume-slider" min="0" max="1" step="0.01" value="0.4" title="Volume" aria-label="Competition noise volume">'
n = h.count(old_slider)
h = h.replace(old_slider, new_slider)
print(f'MINOR (slider aria-label): {n} replacements')

# ---------- MINOR: Remove redundant trailing applyMuteIcons() call ----------
old_redundant = (
    "applyMuteIcons();\n"
    "            }\n"
    "        }\n"
    "        applyMuteIcons();"
)
new_redundant = (
    "applyMuteIcons();\n"
    "            }\n"
    "        }"
)
n = d.count(old_redundant)
d = d.replace(old_redundant, new_redundant)
print(f'MINOR (redundant applyMuteIcons removed): {n} replacements')

open(f, 'w', encoding='utf-8').write(d)
open(h_file, 'w', encoding='utf-8').write(h)
print('-- ALL FIXES APPLIED --')
