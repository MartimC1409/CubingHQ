# -*- coding: utf-8 -*-
"""Register the wcalive view in app.js:
- Add 'wcalive' to VIEW_TO_HASH and HASH_TO_VIEW
- Add 'wcalive' case in switchView() to highlight nav-wcalive-btn
- Add click handler in bindEvents() for nav-wcalive-btn
- Add load handler to hide the loading overlay once the iframe loads
- Add click handler for the in-view Reload button
"""
from pathlib import Path

JS = Path(r'D:\AI-TESTE\app.js')
src = JS.read_text(encoding='utf-8')

# 1. Add to VIEW_TO_HASH
OLD_VTH = """    const VIEW_TO_HASH = {
        'home': '#home', 'setup': '#simulation', 'dashboard': '#simulation',
        'statistics': '#stats', 'records': '#records', 'history': '#history', 'competitions': '#competitions', 'algorithms': '#algorithms', 'practice': '#practice', 'battle': '#battle'
    };"""
NEW_VTH = """    const VIEW_TO_HASH = {
        'home': '#home', 'setup': '#simulation', 'dashboard': '#simulation',
        'statistics': '#stats', 'records': '#records', 'history': '#history', 'competitions': '#competitions', 'algorithms': '#algorithms', 'practice': '#practice', 'battle': '#battle', 'wcalive': '#wcalive'
    };"""
if OLD_VTH not in src:
    raise SystemExit('FATAL: VIEW_TO_HASH anchor not found')
src = src.replace(OLD_VTH, NEW_VTH, 1)

# 2. Add to HASH_TO_VIEW
OLD_HTV = """    const HASH_TO_VIEW = {
        '#home': 'home', '#simulation': 'setup', '#stats': 'statistics', '#records': 'records', '#history': 'history', '#competitions': 'competitions', '#algorithms': 'algorithms', '#practice': 'practice', '#battle': 'battle', '': 'home'
    };"""
NEW_HTV = """    const HASH_TO_VIEW = {
        '#home': 'home', '#simulation': 'setup', '#stats': 'statistics', '#records': 'records', '#history': 'history', '#competitions': 'competitions', '#algorithms': 'algorithms', '#practice': 'practice', '#battle': 'battle', '#wcalive': 'wcalive', '': 'home'
    };"""
if OLD_HTV not in src:
    raise SystemExit('FATAL: HASH_TO_VIEW anchor not found')
src = src.replace(OLD_HTV, NEW_HTV, 1)

# 3. Add 'wcalive' case in switchView's nav-btn highlighting chain
OLD_SV = """        } else if (viewName === 'battle') {
            if ($('#nav-battle-btn')) $('#nav-battle-btn').classList.add('active');
        }"""
NEW_SV = """        } else if (viewName === 'battle') {
            if ($('#nav-battle-btn')) $('#nav-battle-btn').classList.add('active');
        } else if (viewName === 'wcalive') {
            if ($('#nav-wcalive-btn')) $('#nav-wcalive-btn').classList.add('active');
        }"""
if OLD_SV not in src:
    raise SystemExit('FATAL: switchView anchor not found')
src = src.replace(OLD_SV, NEW_SV, 1)

# 4. Add the click handler in bindEvents (right after the Battle button click handler)
OLD_BE = """        if ($('#nav-battle-btn')) {
            $('#nav-battle-btn').addEventListener('click', () => {
                switchView('battle');
                initBattle();
            });
        }
        \n        // Guest battle removed"""
NEW_BE = """        if ($('#nav-battle-btn')) {
            $('#nav-battle-btn').addEventListener('click', () => {
                switchView('battle');
                initBattle();
            });
        }
        if ($('#nav-wcalive-btn')) {
            $('#nav-wcalive-btn').addEventListener('click', () => {
                switchView('wcalive');
            });
        }

        // Guest battle removed"""
if OLD_BE not in src:
    raise SystemExit('FATAL: bindEvents anchor not found')
src = src.replace(OLD_BE, NEW_BE, 1)

# 5. Add iframe load handler + reload button handler (alongside other one-off handlers)
# Append just before the line that ends the bindEvents function (right after the History clear button)
OLD_HIST = """        // History
        $('#clear-history-btn').addEventListener('click', clearHistory);
    }"""
NEW_HIST = """        // History
        $('#clear-history-btn').addEventListener('click', clearHistory);

        // WCA Live view: reload button + iframe load handler (hide loading overlay)
        const wcaLiveIframe = $('#wcalive-iframe');
        const wcaLiveLoading = $('#wcalive-loading');
        if (wcaLiveIframe) {
            wcaLiveIframe.addEventListener('load', () => {
                if (wcaLiveLoading) wcaLiveLoading.style.display = 'none';
            });
        }
        const wcaLiveReload = $('#wcalive-reload-btn');
        if (wcaLiveReload && wcaLiveIframe) {
            wcaLiveReload.addEventListener('click', () => {
                if (wcaLiveLoading) wcaLiveLoading.style.display = 'flex';
                // Re-assigning src forces a reload; cache-bust to avoid stale content
                const base = 'https://live.worldcubeassociation.org/';
                wcaLiveIframe.src = base + '?_=' + Date.now();
            });
        }
    }"""
if OLD_HIST not in src:
    raise SystemExit('FATAL: clear-history anchor not found')
src = src.replace(OLD_HIST, NEW_HIST, 1)

JS.write_text(src, encoding='utf-8', newline='')

# Sanity check
n_open = src.count('{')
n_close = src.count('}')
print(f'  Brace balance: {{ {n_open}   }} {n_close}   delta={n_open - n_close}')
for needle in ["'wcalive': '#wcalive'", "'#wcalive': 'wcalive'", "$('#nav-wcalive-btn')", "wcalive-reload-btn", "wcalive-iframe", "wcalive-loading"]:
    print(f'  {needle!r:50s} : {src.count(needle)} hit(s)')
print(f'  New size: {len(src)} bytes')
print('OK')
