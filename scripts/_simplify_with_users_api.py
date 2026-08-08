# -*- coding: utf-8 -*-
"""Replace the WCIF-scan function with the simpler /users/{wcaId}?upcoming_competitions=true
approach inspired by upcomingcomps.netlify.app.

The /users endpoint returns user info + upcoming_competitions array + ongoing_competitions array
in a SINGLE API call. The response includes full comp data (id, name, start_date, end_date,
city, country_iso2, event_ids, short_name) so we don't need to scan WCIFs at all.

Limitations (acceptable for v1):
- WCA IDs without a WCA account return 404 (e.g. some very old competitors like Feliks Zemdegs).
  All modern registrations require a WCA account, so this is fine for the "upcoming" use case.
"""
import sys
from pathlib import Path

APP = Path(r'D:\AI-TESTE\app.js')
src = APP.read_text(encoding='utf-8')
lines = src.split('\n')

# Find the start: the comment line that introduces fetchUpcomingCompetitionsForWCA
START_MARKER = '    // Fetch upcoming competitions a particular WCA ID is REGISTERED for.'
start_line = None
for i, l in enumerate(lines):
    if START_MARKER in l:
        start_line = i
        break
if start_line is None:
    print('FATAL: start marker not found', file=sys.stderr)
    sys.exit(1)

# Find the function body end: walk braces from the async function line
fn_start = None
for j in range(start_line, min(start_line + 8, len(lines))):
    if 'async function fetchUpcomingCompetitionsForWCA' in lines[j]:
        fn_start = j
        break
if fn_start is None:
    print('FATAL: function signature not found', file=sys.stderr)
    sys.exit(1)

# Walk braces to find the matching close
depth = 0
opened = False
end_line = None
for k in range(fn_start, len(lines)):
    for ch in lines[k]:
        if ch == '{':
            depth += 1
            opened = True
        elif ch == '}':
            depth -= 1
            if opened and depth == 0:
                end_line = k
                break
    if end_line is not None:
        break
if end_line is None:
    print('FATAL: could not find function end', file=sys.stderr)
    sys.exit(1)

print(f'Replacing lines {start_line+1} to {end_line+1} ({end_line - start_line + 1} lines)')

# Build the new function (4-space indent for the comment)
NEW_FN = '''    // Fetch upcoming competitions a particular WCA ID is REGISTERED for.
    // Uses the /users/{wcaId}?upcoming_competitions=true endpoint (inspired by
    // upcomingcomps.netlify.app) - a single API call returns the user's profile
    // plus an array of upcoming competitions they're registered for. This is
    // dramatically simpler/faster than the previous WCIF scan approach.
    // Note: returns 404 for WCA IDs without a WCA account (rare; all modern
    // registrations require an account).
    async function fetchUpcomingCompetitionsForWCA() {
        // Guard against Enter-key double-fire while a request is in flight.
        const btnGuard = $('#search-upcoming-comps-btn');
        if (!btnGuard || btnGuard.disabled) return;

        const wcaId = $('#upcoming-comp-wca-id').value.trim().toUpperCase();
        if (!wcaId) { showToast('Please enter a WCA ID', 'error'); return; }

        const loadingDiv = $('#upcoming-comps-search-loading');
        const errorDiv   = $('#upcoming-comps-search-error');
        const resultsDiv = $('#upcoming-comps-search-results');
        const errorText  = $('#upcoming-comps-search-error-text');
        const btn        = btnGuard;

        loadingDiv.style.display = 'flex';
        errorDiv.style.display   = 'none';
        resultsDiv.style.display = 'none';
        btn.classList.add('loading');
        btn.disabled = true;
        resultsDiv.innerHTML = '';

        try {
            // Single API call: returns user profile + upcoming_competitions + ongoing_competitions.
            // Inspired by upcomingcomps.netlify.app (open source).
            const res = await fetch(
                `${WCA_API}/users/${wcaId}?upcoming_competitions=true&ongoing_competitions=true`
            );
            if (res.status === 404) {
                throw new Error(`No upcoming registrations found for ${wcaId} (no WCA account or no registrations).`);
            }
            if (!res.ok) {
                throw new Error(`Could not fetch registrations (HTTP ${res.status}).`);
            }

            const data = await res.json();
            const upcoming = Array.isArray(data.upcoming_competitions)
                ? data.upcoming_competitions
                : [];

            if (upcoming.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming registrations found for ${wcaId}.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // Sort by start_date ascending (lex YYYY-MM-DD = chronological).
            // The API may already do this, but be defensive.
            const sortedUpcoming = upcoming
                .filter(c => c && c.start_date)
                .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

            if (sortedUpcoming.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming registrations found for ${wcaId}.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // Render
            resultsDiv.innerHTML = `<div class="upcoming-comps-title" style="margin-bottom: var(--space-sm); text-align: left; font-weight: 700;">Upcoming Registrations for ${wcaId} (${sortedUpcoming.length})</div>`;

            const compListContainer = document.createElement('div');
            compListContainer.style.display = 'flex';
            compListContainer.style.flexDirection = 'column';
            compListContainer.style.gap = '8px';
            compListContainer.style.textAlign = 'left';

            sortedUpcoming.forEach(c => {
                const countryCode = c.country_iso2 || '';
                const city        = c.city || 'Unknown';
                const startDate   = c.start_date || '';
                const endDate     = c.end_date || '';
                const dateStr     = startDate === endDate ? startDate : `${startDate} \\u2192 ${endDate}`;
                const shortName   = c.short_name || c.name || c.id || 'Competition';
                const compUrl     = `https://www.worldcubeassociation.org/competitions/${c.id}`;
                const eventsStr   = (Array.isArray(c.event_ids) ? c.event_ids : [])
                    .map(e => EVENT_NAMES[e] || e)
                    .join(', ') || '\\u2014';

                const card = document.createElement('a');
                card.className = 'upcoming-comp-item';
                card.href      = compUrl;
                card.target    = '_blank';
                card.rel       = 'noopener noreferrer';
                card.innerHTML = `
                    <div class="upcoming-comp-info">
                        <span class="upcoming-comp-name">${shortName}</span>
                        <span class="upcoming-comp-meta">${countryFlagImg(countryCode, 14)} ${city}</span>
                        <span class="upcoming-comp-meta" style="font-size: 0.75rem; opacity: 0.85; margin-top: 2px;"><strong style="opacity: 0.7;">Events:</strong> ${eventsStr}</span>
                    </div>
                    <span class="upcoming-comp-date">${dateStr}</span>
                `;
                compListContainer.appendChild(card);
            });

            resultsDiv.appendChild(compListContainer);
            resultsDiv.style.display = 'block';

        } catch (err) {
            console.error('Error fetching upcoming registrations:', err);
            errorText.textContent = err.message;
            errorDiv.style.display = 'flex';
        } finally {
            loadingDiv.style.display = 'none';
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }'''

new_lines = lines[:start_line] + NEW_FN.split('\n') + lines[end_line + 1:]
new_src = '\n'.join(new_lines)
APP.write_text(new_src, encoding='utf-8', newline='')

# Sanity check
n = new_src.count('{')
m = new_src.count('}')
print(f'  Brace balance: {{ {n}   }} {m}   delta={n-m}')
print(f'  Wrote {len(new_src)} bytes to {APP}')
print('OK')
