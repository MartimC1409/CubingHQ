#!/usr/bin/env python3
"""Apply code-review fixes for the native WCA Live feature.

1. XSS in dashboard cards: escape comp names
2. Dead `format` parameter in computeResultStats: remove the param (and caller passes)
3. Back-to-comp re-fetches: change handler to just switchWcaLiveSubView('comp')
4. Empty-attempt edge case in renderWcaLiveResults: guard before reading .attempts.length
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('app.js').read_text(encoding='utf-8')
original_len = len(src)
fixes_applied = []

# === FIX 1: XSS in dashboard cards ===
# renderWcaLiveList uses c.short_name || c.name || c.id without escape
old1 = """                        <div class="wcalive-card-name">${c.short_name || c.name || c.id}</div>"""
new1 = """                        <div class="wcalive-card-name">${escapeHtml(c.short_name || c.name || c.id)}</div>"""
if old1 in src:
    src = src.replace(old1, new1, 1)
    fixes_applied.append('FIX 1: XSS in dashboard cards (escape comp names)')
else:
    fixes_applied.append('FIX 1: pattern not found (may have been fixed)')

# Also escape city/iso2 in the meta line (defense in depth)
old1b = """                    <div class="wcalive-card-meta">
                        ${countryFlagImg(iso2, 16)} ${city} · 👥 ${c.competitor_limit || '—'}
                    </div>"""
new1b = """                    <div class="wcalive-card-meta">
                        ${countryFlagImg(iso2, 16)} ${escapeHtml(city)} · 👥 ${c.competitor_limit || '—'}
                    </div>"""
if old1b in src:
    src = src.replace(old1b, new1b, 1)
    fixes_applied.append('FIX 1b: escape city in card meta')

# === FIX 2: Dead `format` parameter in computeResultStats ===
# The function signature is computeResultStats(attempts, format) but format is unused
old2 = """    // Compute best single + average (Mo3 or Ao5) for a result
    function computeResultStats(attempts, format) {"""
new2 = """    // Compute best single + average (Mo3 or Ao5) for a result.
    // Format is auto-detected from attempts.length (3 = Mo3, 5 = Ao5).
    function computeResultStats(attempts) {"""
if old2 in src:
    src = src.replace(old2, new2, 1)
    fixes_applied.append('FIX 2: removed dead format param from computeResultStats')

# Also update the callers that pass the dead param
old2a = "computeResultStats(a.attempts || [], '');"
new2a = "computeResultStats(a.attempts || []);"
old2b = "computeResultStats(b.attempts || [], '');"
new2b = "computeResultStats(b.attempts || []);"
old2c = "const stats = computeResultStats(attemptsArr, '');"
new2c = "const stats = computeResultStats(attemptsArr);"
for o, n in [(old2a, new2a), (old2b, new2b), (old2c, new2c)]:
    if o in src:
        src = src.replace(o, n, 1)
        fixes_applied.append(f'FIX 2caller: removed dead arg ({o[:30]}...)')

# Also fix the computePodium caller that uses the format-detection pattern
old2d = "const stats = computeResultStats(r.attempts || [], (finalRound.results[0] && finalRound.results[0].attempts && finalRound.results[0].attempts.length === 3) ? 'mo3' : 'ao5');"
new2d = "const stats = computeResultStats(r.attempts || []);"
if old2d in src:
    src = src.replace(old2d, new2d, 1)
    fixes_applied.append('FIX 2podium: removed dead arg in computePodium')

# === FIX 3: Back-to-comp re-fetches unnecessarily ===
# initWcaLive binds back buttons. The 'comp' target currently calls openWcaLiveComp
# which re-fetches. Change to just switchWcaLiveSubView.
old3 = """        document.querySelectorAll('.wcalive-back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                if (target === 'dashboard') switchWcaLiveSubView('dashboard');
                else if (target === 'comp') openWcaLiveComp(state.wcalive.selectedCompId);
            });
        });"""
new3 = """        document.querySelectorAll('.wcalive-back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                if (target === 'dashboard') {
                    switchWcaLiveSubView('dashboard');
                } else if (target === 'comp') {
                    // Don't re-fetch; just restore the cached comp view.
                    switchWcaLiveSubView('comp');
                }
            });
        });"""
if old3 in src:
    src = src.replace(old3, new3, 1)
    fixes_applied.append('FIX 3: back-to-comp just switches subview (no re-fetch)')

# === FIX 4: Empty-attempt edge case in renderWcaLiveResults ===
# Currently: const attempts = (round.results && round.results[0] && Array.isArray(round.results[0].attempts)) ? round.results[0].attempts.length : 5;
# If the round is a Mo3 event (e.g. 666, 777) but the result entries have no `attempts` field yet, we default to 5.
# Better: use the round type or event metadata. For now, guard more carefully: if .length is 0/undefined, default to 5.
# Also: skip rendering attempts columns if results is empty (already handled by wca-event-empty).
old4 = """        // Build table header
        if (thead) {
            let headerHtml = `<tr>
                <th class="wcalive-col-rank">#</th>
                <th class="wcalive-col-name">Name</th>`;
            for (let i = 1; i <= attempts; i++) {
                headerHtml += `<th>${i}</th>`;
            }
            headerHtml += `<th class="wcalive-col-best">Best</th>
                <th class="wcalive-col-avg">${useMo3 ? 'Mean' : 'Average'}</th>
                <th>Solves</th>
                </tr>`;
            thead.innerHTML = headerHtml;
        }"""
new4 = """        // Build table header
        if (thead) {
            let headerHtml = `<tr>
                <th class="wcalive-col-rank">#</th>
                <th class="wcalive-col-name">Name</th>`;
            // Cap at 5 (WCA max for Ao5); also handle Mo3 events gracefully.
            const numCols = Math.min(Math.max(attempts, 0), 5);
            for (let i = 1; i <= numCols; i++) {
                headerHtml += `<th>${i}</th>`;
            }
            headerHtml += `<th class="wcalive-col-best">Best</th>
                <th class="wcalive-col-avg">${useMo3 ? 'Mean' : 'Average'}</th>
                <th>Solves</th>
                </tr>`;
            thead.innerHTML = headerHtml;
        }"""
if old4 in src:
    src = src.replace(old4, new4, 1)
    fixes_applied.append('FIX 4: cap attempt columns to [0,5] and add guard')

# Also harden the attempts.length read in renderWcaLiveResults
old4b = "        const attempts = (round.results && round.results[0] && Array.isArray(round.results[0].attempts)) ? round.results[0].attempts.length : 5;"
new4b = "        const firstResult = round.results && round.results[0];\n        const attempts = (firstResult && Array.isArray(firstResult.attempts) && firstResult.attempts.length > 0) ? firstResult.attempts.length : 5;"
if old4b in src:
    src = src.replace(old4b, new4b, 1)
    fixes_applied.append('FIX 4b: harden attempts.length read')

# Write back
Path('app.js').write_text(src, encoding='utf-8')

print('=== Fixes applied ===')
for f in fixes_applied:
    print('  ' + f)
print(f'\napp.js: {len(src)} chars (was {original_len})')

# Verify
verify = Path('app.js').read_text(encoding='utf-8')
print('\n=== Sanity checks ===')
print(f'  XSS escape in card: {verify.count("escapeHtml(c.short_name || c.name || c.id)")} (expected 1)')
print(f'  computeResultStats has format param: {", format" in verify.split("function computeResultStats")[1].split("}")[0] if "function computeResultStats" in verify else "N/A"} (expected False)')
print(f'  Back-btn switches subview (no re-fetch): {"switchWcaLiveSubView(\"comp\");" in verify}')
print(f'  Attempts cap to 5: {"Math.min(Math.max(attempts" in verify}')
