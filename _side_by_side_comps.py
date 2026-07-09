# -*- coding: utf-8 -*-
"""Put the past + upcoming competition search cards side-by-side (2-column grid).

Current layout: each card is in its own centered wrapper, so they stack vertically.
New layout: wrap both in a 2-column grid that goes side-by-side on desktop, single
column on mobile.
"""
from pathlib import Path

HTML = Path(r'D:\AI-TESTE\index.html')
src = HTML.read_text(encoding='utf-8')

# The past search card starts with the centered wrapper, and the upcoming card
# is in the next div. Wrap them both in a new .competitions-search-grid container.
# The simplest, most robust approach: find the exact start of the past card wrapper
# and the end of the upcoming card wrapper, and replace.

OLD = """                <div style="display: flex; justify-content: center; margin-bottom: var(--space-xl);">
                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">
                        <h3 class="card-title" style="justify-content: center;"><span class="icon">🔍</span> Search Past Competitions</h3>"""

NEW = """                <div class="competitions-search-grid">
                    <div class="setup-card" style="width: 100%; text-align: center; padding: 2.5rem 2rem;">
                        <h3 class="card-title" style="justify-content: center;"><span class="icon">🔍</span> Search Past Competitions</h3>"""

if OLD not in src:
    raise SystemExit('FATAL: past card anchor not found')
src = src.replace(OLD, NEW, 1)

# The upcoming card's closing div is followed by a comment about the upcoming-search-col
# Find the upcoming card's closing </div> and change max-width: 650px to width: 100% + add a sibling
# The upcoming card starts with: <div> followed by a setup-card with the "Search Upcoming" title
OLD2 = """                <!-- Upcoming Competitions for WCA ID -->
                <div>
                    <div class="setup-card" style="width: 100%; max-width: 650px; text-align: center; padding: 2.5rem 2rem;">
                        <h3 class="card-title" style="justify-content: center;"><span class="icon">&#128302;</span> Search Upcoming Registrations</h3>"""

NEW2 = """                <!-- Upcoming Competitions for WCA ID -->
                    <div class="setup-card" style="width: 100%; text-align: center; padding: 2.5rem 2rem;">
                        <h3 class="card-title" style="justify-content: center;"><span class="icon">&#128302;</span> Search Upcoming Registrations</h3>"""

if OLD2 not in src:
    raise SystemExit('FATAL: upcoming card anchor not found')
src = src.replace(OLD2, NEW2, 1)

# Close the .competitions-search-grid wrapper after the upcoming card's closing </div>
# The upcoming card ends with </div></div><!-- /upcoming-search-col -->
# We need to add an extra </div> to close the grid wrapper
OLD3 = """                </div><!-- /upcoming-search-col -->

                <!-- Upcoming Competitions (WCA Live style) -->"""

NEW3 = """                </div><!-- /.competitions-search-grid -->

                <!-- Upcoming Competitions (WCA Live style) -->"""

if OLD3 not in src:
    raise SystemExit('FATAL: upcoming card close anchor not found')
src = src.replace(OLD3, NEW3, 1)

HTML.write_text(src, encoding='utf-8', newline='')

print(f'  Old size: {len(src)} bytes')
print(f'  New size: {len(src)} bytes')
print(f'  competitions-search-grid present: {src.count("competitions-search-grid")} hit(s)')
print('OK')
