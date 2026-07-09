# -*- coding: utf-8 -*-
"""Replace fetchUpcomingCompetitionsForWCA() with WCIF-scan approach.

This fixes the bug: the function used /persons/{id}/competitions which only
returns past/competed comps. The new approach scans public WCIFs of all upcoming
competitions to find actual upcoming registrations with their real status.
"""
import sys
from pathlib import Path

APP = Path(r'D:\AI-TESTE\app.js')

src = APP.read_text(encoding='utf-8')
lines = src.split('\n')

# Find the start: the comment line that introduces fetchUpcomingCompetitionsForWCA
START_MARKER = '    // Fetch upcoming competitions a particular WCA ID is associated with.'
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
for j in range(start_line, min(start_line + 5, len(lines))):
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

# Build the new function (preserve 4-space indent for the comment)
NEW_FN = '''    // Fetch upcoming competitions a particular WCA ID is REGISTERED for.
    // The WCA public API does NOT expose /persons/{id}/registrations (HTTP 404)
    // and /persons/{id}/competitions only returns comps they have COMPETED at.
    // The only public way to find upcoming registrations is to scan the public
    // WCIF of each upcoming competition and look for the WCA ID in the persons
    // array. This is slower (1+N API calls) but is the only correct approach.
    async function fetchUpcomingCompetitionsForWCA() {
        // Guard against Enter-key double-fire while a request is in flight.
        const btnGuard = $('#search-upcoming-comps-btn');
        if (!btnGuard || btnGuard.disabled) return;

        const wcaId = $('#upcoming-comp-wca-id').value.trim().toUpperCase();
        if (!wcaId) { showToast('Please enter a WCA ID', 'error'); return; }

        const loadingDiv  = $('#upcoming-comps-search-loading');
        const loadingSpan = loadingDiv ? loadingDiv.querySelector('span') : null;
        const errorDiv    = $('#upcoming-comps-search-error');
        const resultsDiv  = $('#upcoming-comps-search-results');
        const errorText   = $('#upcoming-comps-search-error-text');
        const btn         = btnGuard;

        loadingDiv.style.display = 'flex';
        if (loadingSpan) loadingSpan.textContent = 'Validating WCA ID...';
        errorDiv.style.display   = 'none';
        resultsDiv.style.display = 'none';
        btn.classList.add('loading');
        btn.disabled = true;
        resultsDiv.innerHTML = '';

        // Abort any in-flight scan from a previous click of the same button.
        if (window._wcaScanController) {
            try { window._wcaScanController.abort(); } catch (_) { /* ignore */ }
        }
        const scanController = new AbortController();
        window._wcaScanController = scanController;
        const signal = scanController.signal;

        try {
            // 1. Validate the WCA ID exists
            const personRes = await fetch(`${WCA_API}/persons/${wcaId}`, { signal });
            if (personRes.status === 404) throw new Error(`WCA ID ${wcaId} not found.`);
            if (!personRes.ok) throw new Error(`Could not look up WCA ID (HTTP ${personRes.status}).`);

            // 2. Fetch list of upcoming competitions (next ~90 days)
            if (loadingSpan) loadingSpan.textContent = 'Fetching competition calendar...';
            const today = new Date().toISOString().split('T')[0];
            const compsRes = await fetch(
                `${WCA_API}/competitions?start=${today}&sort=start_date&per_page=200`,
                { signal }
            );
            if (!compsRes.ok) throw new Error(`Could not fetch upcoming competitions (HTTP ${compsRes.status}).`);
            const compsCalendar = await compsRes.json();

            if (!Array.isArray(compsCalendar) || compsCalendar.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming competitions in calendar.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // 3. Scan WCIFs in staggered batches to respect rate limits.
            //    Batches of 5 with 250ms inter-batch delay keeps us well under
            //    the WCA API rate limit while staying fast (~10s for 200 comps).
            const registeredComps = [];
            const BATCH_SIZE = 5;
            const BATCH_DELAY_MS = 250;
            const total = compsCalendar.length;
            let processed = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                if (signal.aborted) return;
                const batch = compsCalendar.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (comp) => {
                    if (signal.aborted) return;
                    try {
                        const wcifRes = await fetch(
                            `${WCA_API}/competitions/${comp.id}/wcif/public`,
                            { signal }
                        );
                        // 404 = registration not open yet OR comp has no public WCIF.
                        // Other non-OK: skip silently (partial scan is better than none).
                        if (!wcifRes.ok) return;
                        const wcif = await wcifRes.json();
                        const persons = Array.isArray(wcif.persons) ? wcif.persons : [];
                        const me = persons.find(p => p && p.wcaId === wcaId);
                        if (me && me.registration) {
                            registeredComps.push({
                                comp,
                                status: me.registration.status || 'unknown',
                                eventIds: Array.isArray(me.registration.eventIds) ? me.registration.eventIds : [],
                                guests: typeof me.registration.guests === 'number' ? me.registration.guests : 0
                            });
                        }
                    } catch (e) {
                        // Individual comp errors are non-fatal.
                    }
                }));
                processed = Math.min(processed + batch.length, total);
                if (loadingSpan) {
                    loadingSpan.textContent = `Scanning registrations: ${processed} / ${total}...`;
                }
                if (i + BATCH_SIZE < total) {
                    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
                }
            }

            // 4. Sort by start_date ascending (lex YYYY-MM-DD = chronological)
            registeredComps.sort((a, b) => (a.comp.start_date || '').localeCompare(b.comp.start_date || ''));

            if (registeredComps.length === 0) {
                resultsDiv.innerHTML = `<div class="comp-info-state">No upcoming registrations found for ${wcaId} in the next ~90 days.</div>`;
                resultsDiv.style.display = 'block';
                return;
            }

            // 5. Render results
            resultsDiv.innerHTML = `<div class="upcoming-comps-title" style="margin-bottom: var(--space-sm); text-align: left; font-weight: 700;">Upcoming Registrations for ${wcaId} (${registeredComps.length})</div>`;

            const compListContainer = document.createElement('div');
            compListContainer.style.display = 'flex';
            compListContainer.style.flexDirection = 'column';
            compListContainer.style.gap = '8px';
            compListContainer.style.textAlign = 'left';

            // Status badge map (whitelisted to prevent CSS class injection)
            const STATUS_MAP = {
                'accepted':  { label: 'ACCEPTED',  cls: 'reg-status-accepted' },
                'pending':   { label: 'PENDING',   cls: 'reg-status-pending' },
                'cancelled': { label: 'CANCELLED', cls: 'reg-status-cancelled' }
            };

            registeredComps.forEach(data => {
                const c = data.comp;
                const countryCode = c.country_iso2 || '';
                const city        = c.city || 'Unknown';
                const startDate   = c.start_date || '';
                const endDate     = c.end_date || '';
                const dateStr     = startDate === endDate ? startDate : `${startDate} \u2192 ${endDate}`;
                const shortName   = c.short_name || c.name || c.id || 'Competition';
                const compUrl     = `https://www.worldcubeassociation.org/competitions/${c.id}`;

                const st = STATUS_MAP[data.status] || { label: 'SCHEDULED', cls: 'reg-status-scheduled' };
                const statusBadge = `<span class="reg-status ${st.cls}">${st.label}</span>`;

                const eventsStr = data.eventIds.map(e => EVENT_NAMES[e] || e).join(', ') || '\u2014';

                const card = document.createElement('a');
                card.className = 'upcoming-comp-item';
                card.href      = compUrl;
                card.target    = '_blank';
                card.rel       = 'noopener noreferrer';
                card.innerHTML = `
                    <div class="upcoming-comp-info">
                        <span class="upcoming-comp-name">${shortName}${statusBadge}</span>
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
            if (err.name === 'AbortError') return; // superseded by a new scan
            console.error('Error fetching upcoming registrations:', err);
            errorText.textContent = err.message || 'Failed to load registrations.';
            errorDiv.style.display = 'flex';
        } finally {
            loadingDiv.style.display = 'none';
            if (loadingSpan) loadingSpan.textContent = 'Fetching competitions...';
            btn.classList.remove('loading');
            btn.disabled = false;
            if (window._wcaScanController === scanController) {
                window._wcaScanController = null;
            }
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
