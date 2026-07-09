#!/usr/bin/env python3
"""Add native WCA Live JS to app.js.
   - Adds state.wcalive for cache + sub-view state
   - Adds fetchCached() helper
   - Adds switchWcaLiveSubView(), fetchWcaLiveDashboard(), openWcaLiveComp(),
     openWcaLiveEvent(), and the various render* functions
   - Replaces the old iframe code (#wcalive-iframe, #wcalive-reload-btn handlers)
   - Hooks into the existing nav-wcalive-btn so click re-initializes the dashboard
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('app.js').read_text(encoding='utf-8')
original = src

# === STEP 1: Add state.wcalive to the state object ===
# Insert after `state.currentView: 'home',` (or similar simple addition)
state_marker = "        currentView: 'home',\n"
state_replacement = "        currentView: 'home',\n        wcalive: {\n            currentSubView: 'dashboard',  // 'dashboard' | 'comp' | 'event'\n            cache: new Map(),              // { 'dashboard' | 'comp:ID' | 'results:ID:EVT' | 'schedule:ID': {data, expiry} }\n            selectedCompId: null,\n            selectedEventId: null,\n            selectedRoundIdx: 0,\n            resultsData: null,             // {rounds: [...]}\n        },\n"
if state_marker in src and 'wcalive: {' not in src:
    src = src.replace(state_marker, state_replacement, 1)
    print('  Added state.wcalive')
else:
    print('  state.wcalive already present or marker not found')

# === STEP 2: Replace the old iframe handlers (lines 1097-1111 area) ===
old_iframe_block = """        // WCA Live view: reload button + iframe load handler (hide loading overlay)
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
        }"""

new_native_block = """        // NATIVE WCA LIVE: sub-view router, dashboard, comp detail, event results
        initWcaLive();"""

if old_iframe_block in src:
    src = src.replace(old_iframe_block, new_native_block, 1)
    print('  Replaced iframe handlers with initWcaLive() call')
else:
    print('  Old iframe block not found (may have been replaced already)')

# === STEP 3: Append the native WCA Live module at the END of the file ===
# Make sure the file ends with `})();` and a newline
native_module = '''

    // ============================================================
    // NATIVE WCA LIVE — custom dashboard, comp pages, event results
    // ============================================================
    // Replaces the iframe with a native implementation using the WCA API.
    // Three sub-views: dashboard → comp detail → event results.
    // Cache TTL: 5 minutes for comp/event data, 1 minute for dashboard.
    // ============================================================

    function initWcaLive() {
        // Bind back buttons (event delegation, since the buttons may be re-rendered)
        document.querySelectorAll('.wcalive-back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                if (target === 'dashboard') switchWcaLiveSubView('dashboard');
                else if (target === 'comp') openWcaLiveComp(state.wcalive.selectedCompId);
            });
        });

        // Refresh button: refetch dashboard
        const refreshBtn = $('#wcalive-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                state.wcalive.cache.delete('dashboard');
                fetchWcaLiveDashboard();
                showToast('WCA Live refreshed', 'info');
            });
        }

        // Initial load
        switchWcaLiveSubView('dashboard');
        fetchWcaLiveDashboard();
    }

    // Sub-view router
    function switchWcaLiveSubView(name) {
        const ids = {
            'dashboard': 'wcalive-sub-dashboard',
            'comp': 'wcalive-sub-comp',
            'event': 'wcalive-sub-event',
        };
        Object.values(ids).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const target = document.getElementById(ids[name]);
        if (target) {
            target.style.display = 'block';
            target.style.animation = 'none';
            void target.offsetWidth; // reflow
            target.style.animation = 'fadeIn 0.3s ease';
        }
        state.wcalive.currentSubView = name;
    }

    // Cached fetch helper
    async function fetchCached(key, url, ttlMs = 5 * 60 * 1000) {
        const cached = state.wcalive.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const data = await res.json();
        state.wcalive.cache.set(key, { data, expiry: Date.now() + ttlMs });
        return data;
    }

    // Format WCA attempt value (centiseconds)
    function formatWcaAttempt(value) {
        if (value === -1) return { text: 'DNF', cls: 'attempt-dnf' };
        if (value === -2) return { text: 'DNS', cls: 'attempt-dns' };
        if (value === 0)  return { text: '—',   cls: 'attempt-zero' };
        if (value == null) return { text: '—',  cls: 'attempt-empty' };
        return { text: formatTime(value / 100), cls: '' };
    }

    // Compute best single + average (Mo3 or Ao5) for a result
    function computeResultStats(attempts, format) {
        const valid = attempts.filter(a => a > 0);
        if (valid.length === 0) return { best: -1, average: -1 };
        const best = Math.min(...valid);
        let average = -1;
        if (attempts.length === 5) {
            // Ao5: drop best + worst, average middle 3
            if (attempts.filter(a => a > 0).length >= 3) {
                const sorted = [...attempts].sort((a, b) => a - b);
                const middle = sorted.slice(1, 4).filter(a => a > 0);
                if (middle.length === 3) {
                    average = Math.round(middle.reduce((s, v) => s + v, 0) / 3);
                } else {
                    average = -1; // not enough valid
                }
            }
        } else if (attempts.length === 3) {
            // Mo3: average all 3 (if all valid)
            if (attempts.filter(a => a > 0).length === 3) {
                average = Math.round(attempts.reduce((s, v) => s + v, 0) / 3);
            } else {
                average = -1;
            }
        }
        return { best, average };
    }

    // ============== DASHBOARD ==============
    async function fetchWcaLiveDashboard() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const weekAhead = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];
        const weekBehind = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];

        // Live: end_date >= today AND start_date <= today
        // Upcoming: start_date > today AND start_date <= weekAhead
        // Recent: end_date < today AND end_date >= weekBehind
        // Fetch one window then bucket client-side (saves API calls)
        try {
            const data = await fetchCached(
                'dashboard',
                `${WCA_API}/competitions?start=${weekBehind}&end=${weekAhead}&per_page=50`,
                60 * 1000  // 1-minute cache for dashboard
            );
            const comps = Array.isArray(data) ? data : [];

            const live = [];
            const week = [];
            const recent = [];

            comps.forEach(c => {
                if (!c || c.cancelled_at) return;
                const start = c.start_date;
                const end = c.end_date || c.start_date;
                if (start <= todayStr && end >= todayStr) {
                    live.push(c);
                } else if (start > todayStr) {
                    week.push(c);
                } else {
                    recent.push(c);
                }
            });

            // Sort: live by start_date asc, week by start_date asc, recent by end_date desc
            live.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
            week.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
            recent.sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));

            renderWcaLiveList('wcalive-list-live', live, 'live');
            renderWcaLiveList('wcalive-list-week', week, 'upcoming');
            renderWcaLiveList('wcalive-list-recent', recent, 'completed');

            $('#wcalive-live-count').textContent = live.length;
            $('#wcalive-week-count').textContent = week.length;
            $('#wcalive-recent-count').textContent = recent.length;
        } catch (err) {
            console.error('WCA Live dashboard fetch failed:', err);
            ['wcalive-list-live', 'wcalive-list-week', 'wcalive-list-recent'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<div class="wcalive-empty">⚠️ Failed to load. <a href="#" onclick="fetchWcaLiveDashboard();return false;">Retry</a></div>';
            });
        }
    }

    function renderWcaLiveList(containerId, comps, status) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!comps || comps.length === 0) {
            container.innerHTML = '<div class="wcalive-empty">No competitions in this window.</div>';
            return;
        }

        const cardsHtml = comps.map(c => {
            const startDate = c.start_date || '';
            const endDate = c.end_date || c.start_date || '';
            const dateStr = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
            const events = Array.isArray(c.event_ids) ? c.event_ids : [];
            const eventsHtml = events.slice(0, 6).map(e =>
                `<span class="wcalive-event-tag">${EVENT_NAMES[e] || e}</span>`
            ).join('');
            const eventsMore = events.length > 6 ? `<span class="wcalive-event-tag">+${events.length - 6}</span>` : '';
            const statusClass = status === 'live' ? 'is-live' : status === 'upcoming' ? 'is-upcoming' : 'is-completed';
            const city = c.city || '';
            const iso2 = c.country_iso2 || '';
            return `
                <div class="wcalive-card ${statusClass}" data-comp-id="${c.id}" role="button" tabindex="0">
                    <div class="wcalive-card-head">
                        <div class="wcalive-card-name">${c.short_name || c.name || c.id}</div>
                    </div>
                    <div class="wcalive-card-events">${eventsHtml}${eventsMore}</div>
                    <div class="wcalive-card-meta">
                        ${countryFlagImg(iso2, 16)} ${city} · 👥 ${c.competitor_limit || '—'}
                    </div>
                    <div class="wcalive-card-dates">${dateStr}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;

        // Click handlers
        container.querySelectorAll('.wcalive-card').forEach(card => {
            const handler = () => openWcaLiveComp(card.dataset.compId);
            card.addEventListener('click', handler);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        });
    }

    // ============== COMP DETAIL ==============
    async function openWcaLiveComp(compId) {
        if (!compId) return;
        state.wcalive.selectedCompId = compId;
        state.wcalive.selectedEventId = null;
        switchWcaLiveSubView('comp');

        // Show loading, hide content
        const loading = $('#wca-comp-loading');
        const content = $('#wca-comp-content');
        if (loading) loading.style.display = 'flex';
        if (content) content.style.display = 'none';

        try {
            // Fetch comp detail + schedule in parallel
            const [detail, schedule] = await Promise.all([
                fetchCached(`comp:${compId}`, `${WCA_API}/competitions/${compId}`, 5 * 60 * 1000),
                fetchCached(`schedule:${compId}`, `${WCA_API}/competitions/${compId}/schedule`, 5 * 60 * 1000).catch(() => null)
            ]);

            renderWcaCompHeader(detail);
            renderWcaCompEvents(detail);
            renderWcaCompSchedule(schedule);
            renderWcaCompPodium(detail);

            // External link
            const outlink = $('#wca-comp-outlink');
            if (outlink) outlink.href = detail.url || `https://www.worldcubeassociation.org/competitions/${compId}`;

            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'block';
        } catch (err) {
            console.error('Comp detail fetch failed:', err);
            if (loading) {
                loading.innerHTML = `<span>⚠️ Could not load competition "${compId}". <a href="#" onclick="openWcaLiveComp('${compId}');return false;">Retry</a></span>`;
            }
        }
    }

    function renderWcaCompHeader(detail) {
        const container = $('#wca-comp-header');
        if (!container) return;
        const today = new Date().toISOString().split('T')[0];
        let status = 'upcoming', statusLabel = 'UPCOMING';
        if (detail.cancelled_at) { status = 'completed'; statusLabel = 'CANCELLED'; }
        else if (detail.start_date <= today && detail.end_date >= today) { status = 'live'; statusLabel = '🔴 LIVE NOW'; }
        else if (detail.end_date < today) { status = 'completed'; statusLabel = 'COMPLETED'; }

        const city = detail.city || '';
        const iso2 = detail.country_iso2 || '';
        const eventList = (Array.isArray(detail.event_ids) ? detail.event_ids : [])
            .map(e => EVENT_NAMES[e] || e).join(', ') || '—';
        const info = detail.information || '';

        container.innerHTML = `
            <div class="wcalive-comp-status is-${status}">${statusLabel}</div>
            <h2>${detail.name || detail.id}</h2>
            <div class="wcalive-comp-meta-row">
                <div class="meta-item"><span class="meta-label">📅</span> ${detail.start_date}${detail.end_date !== detail.start_date ? ' → ' + detail.end_date : ''}</div>
                <div class="meta-item"><span class="meta-label">📍</span> ${countryFlagImg(iso2, 18)} ${city}, ${iso2}</div>
                <div class="meta-item"><span class="meta-label">👥</span> Limit: ${detail.competitor_limit || '—'}</div>
                <div class="meta-item"><span class="meta-label">🏢</span> ${(detail.venue || '').replace(/\\[|\\]/g, '').slice(0, 60)}</div>
                <div class="meta-item"><span class="meta-label">🧩</span> ${eventList}</div>
            </div>
            ${info ? `<div class="wcalive-comp-info-text">${escapeHtml(info)}</div>` : ''}
        `;
    }

    function renderWcaCompEvents(detail) {
        const container = $('#wca-comp-events');
        if (!container) return;
        const events = Array.isArray(detail.event_ids) ? detail.event_ids : [];
        if (events.length === 0) {
            container.innerHTML = '<div class="wcalive-empty">No events listed for this competition.</div>';
            return;
        }
        container.innerHTML = events.map(evt => {
            const isMain = detail.main_event_id === evt;
            return `<button class="wcalive-event-chip ${isMain ? 'is-main' : ''}" data-event="${evt}"><span>${EVENT_NAMES[evt] || evt}</span>${isMain ? ' ⭐' : ''}</button>`;
        }).join('');
        container.querySelectorAll('.wcalive-event-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                openWcaLiveEvent(state.wcalive.selectedCompId, chip.dataset.event);
            });
        });
    }

    function renderWcaCompSchedule(schedule) {
        const container = $('#wca-comp-schedule');
        if (!container) return;
        if (!schedule || !schedule.venues || schedule.venues.length === 0) {
            container.innerHTML = '<li class="wcalive-schedule-empty">No schedule available.</li>';
            return;
        }
        // Flatten all activities and take next 5
        const activities = [];
        schedule.venues.forEach(v => {
            (v.rooms || []).forEach(r => {
                (r.activities || []).forEach(a => {
                    activities.push({ ...a, roomName: r.name, venueName: v.name });
                });
            });
        });
        // Sort by start time
        activities.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        // Take next 5 (filter out check-in/misc if too many; keep first 5 regardless)
        const next = activities.slice(0, 5);
        container.innerHTML = next.map(a => {
            const time = a.startTime ? new Date(a.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const isRound = a.activityCode && /^[a-z0-9]+-r\\d+$/i.test(a.activityCode);
            return `<li class="wcalive-schedule-item">
                <div class="wcalive-schedule-time">${time}${a.roomName ? ' · ' + a.roomName : ''}</div>
                <div class="wcalive-schedule-name ${isRound ? 'is-round' : ''}">${a.name || a.activityCode || '—'}</div>
            </li>`;
        }).join('');
    }

    function renderWcaCompPodium(detail) {
        // Render podium for main event (if results available)
        const section = $('#wca-comp-podium-section');
        const container = $('#wca-comp-podium');
        if (!section || !container) return;

        const mainEvt = detail.main_event_id;
        if (!mainEvt) {
            section.style.display = 'none';
            return;
        }

        // Try to fetch results; render when done
        fetchCached(`results:${detail.id}:${mainEvt}`, `${WCA_API}/competitions/${detail.id}/results/${mainEvt}`, 5 * 60 * 1000)
            .then(results => {
                const podium = computePodium(results, 3);
                if (!podium || podium.length === 0) {
                    section.style.display = 'none';
                    return;
                }
                section.style.display = 'block';
                const medals = ['🥇', '🥈', '🥉'];
                container.innerHTML = podium.map((p, i) => `
                    <div class="wcalive-podium-card rank-${i + 1}">
                        <div class="wcalive-podium-medal">${medals[i]}</div>
                        <div class="wcalive-podium-name">${escapeHtml(p.name)}</div>
                        <div class="wcalive-podium-time">${p.avgDisplay}</div>
                    </div>
                `).join('');
            })
            .catch(() => { section.style.display = 'none'; });
    }

    function computePodium(resultsData, top) {
        if (!resultsData || !Array.isArray(resultsData.rounds)) return null;
        // Find the final round (roundTypeId 'f')
        const finalRound = resultsData.rounds.find(r => r.roundTypeId === 'f')
            || resultsData.rounds[resultsData.rounds.length - 1];
        if (!finalRound || !Array.isArray(finalRound.results) || finalRound.results.length === 0) return null;

        // Each result has: person (object with name, wcaId, countryIso2), attempts (array), best, average
        const results = finalRound.results
            .map(r => {
                const stats = computeResultStats(r.attempts || [], (finalRound.results[0] && finalRound.results[0].attempts && finalRound.results[0].attempts.length === 3) ? 'mo3' : 'ao5');
                return {
                    name: r.person && r.person.name || 'Unknown',
                    wcaId: r.person && r.person.wcaId,
                    country: r.person && r.person.countryIso2,
                    attempts: r.attempts || [],
                    best: r.best != null ? r.best : stats.best,
                    average: r.average != null ? r.average : stats.average,
                };
            })
            // Sort: DNF results (average = -1) go to bottom
            .sort((a, b) => {
                if (a.average === -1 && b.average === -1) return (a.best || 0) - (b.best || 0);
                if (a.average === -1) return 1;
                if (b.average === -1) return -1;
                return a.average - b.average;
            })
            .slice(0, top);

        return results.map(r => ({
            ...r,
            avgDisplay: r.average > 0 ? formatTime(r.average / 100) : r.best > 0 ? `Best ${formatTime(r.best / 100)}` : 'DNF',
        }));
    }

    // ============== EVENT RESULTS ==============
    async function openWcaLiveEvent(compId, eventId) {
        if (!compId || !eventId) return;
        state.wcalive.selectedCompId = compId;
        state.wcalive.selectedEventId = eventId;
        state.wcalive.selectedRoundIdx = 0;
        switchWcaLiveSubView('event');

        const loading = $('#wca-event-loading');
        const wrap = $('#wca-event-table-wrap');
        const thead = $('#wca-event-thead');
        const body = $('#wca-event-results-body');
        if (loading) loading.style.display = 'flex';
        if (wrap) wrap.style.display = 'none';

        try {
            const [comp, results] = await Promise.all([
                fetchCached(`comp:${compId}`, `${WCA_API}/competitions/${compId}`, 5 * 60 * 1000),
                fetchCached(`results:${compId}:${eventId}`, `${WCA_API}/competitions/${compId}/results/${eventId}`, 5 * 60 * 1000),
            ]);
            state.wcalive.resultsData = results;

            // Event header
            const header = $('#wca-event-header');
            if (header) {
                header.innerHTML = `
                    <h2>${EVENT_NAMES[eventId] || eventId}</h2>
                    <div class="event-subtitle">${escapeHtml(comp.name || compId)}</div>
                `;
            }

            // Round tabs
            const tabs = $('#wca-event-rounds');
            if (tabs && results.rounds && results.rounds.length > 0) {
                const roundTypeNames = { '1': 'Round 1', '2': 'Round 2', '3': 'Semi-Final', 'f': 'Final' };
                tabs.innerHTML = results.rounds.map((r, i) => {
                    const label = roundTypeNames[r.roundTypeId] || `Round ${i + 1}`;
                    return `<button class="wcalive-round-tab ${i === 0 ? 'active' : ''}" data-round-idx="${i}">${label}</button>`;
                }).join('');
                tabs.querySelectorAll('.wcalive-round-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        tabs.querySelectorAll('.wcalive-round-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        state.wcalive.selectedRoundIdx = parseInt(tab.dataset.roundIdx, 10);
                        renderWcaLiveResultsBody(state.wcalive.resultsData, state.wcalive.selectedRoundIdx);
                    });
                });
            }

            renderWcaLiveResults(results, thead, body);
            if (loading) loading.style.display = 'none';
            if (wrap) wrap.style.display = 'block';
        } catch (err) {
            console.error('Event results fetch failed:', err);
            if (loading) loading.innerHTML = `<span>⚠️ Could not load results. <a href="#" onclick="openWcaLiveEvent('${compId}','${eventId}');return false;">Retry</a></span>`;
        }
    }

    function renderWcaLiveResults(results, thead, body) {
        if (!results || !Array.isArray(results.rounds) || results.rounds.length === 0) {
            if (thead) thead.innerHTML = '';
            if (body) body.innerHTML = '';
            document.getElementById('wca-event-empty').style.display = 'flex';
            document.getElementById('wca-event-empty').textContent = 'No rounds scheduled yet.';
            return;
        }
        const round = results.rounds[state.wcalive.selectedRoundIdx] || results.rounds[0];
        const attempts = (round.results && round.results[0] && Array.isArray(round.results[0].attempts)) ? round.results[0].attempts.length : 5;
        const useMo3 = attempts === 3;

        // Build table header
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
        }

        // Render body
        renderWcaLiveResultsBody(results, state.wcalive.selectedRoundIdx);
    }

    function renderWcaLiveResultsBody(results, roundIdx) {
        const body = $('#wca-event-results-body');
        const empty = $('#wca-event-empty');
        if (!body) return;
        if (!results || !results.rounds || results.rounds.length === 0) {
            body.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }
        const round = results.rounds[roundIdx] || results.rounds[0];
        if (!round.results || round.results.length === 0) {
            body.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';

        // Sort results
        const sorted = [...round.results].sort((a, b) => {
            const sa = computeResultStats(a.attempts || [], '');
            const sb = computeResultStats(b.attempts || [], '');
            if (sa.average === -1 && sb.average === -1) return sa.best - sb.best;
            if (sa.average === -1) return 1;
            if (sb.average === -1) return -1;
            return sa.average - sb.average;
        });

        const attempts = (sorted[0] && Array.isArray(sorted[0].attempts)) ? sorted[0].attempts.length : 5;

        body.innerHTML = sorted.map((r, idx) => {
            const attemptsArr = Array.isArray(r.attempts) ? r.attempts : [];
            const stats = computeResultStats(attemptsArr, '');
            const bestIdx = stats.best > 0 ? attemptsArr.indexOf(stats.best) : -1;

            // Attempts cells
            const attemptCells = [];
            for (let i = 0; i < attempts; i++) {
                const val = attemptsArr[i];
                const f = formatWcaAttempt(val);
                const cls = f.cls + (i === bestIdx && val > 0 ? ' attempt-best' : '');
                attemptCells.push(`<td class="${cls.trim()}">${f.text}</td>`);
            }

            const rank = idx + 1;
            const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
            const dnfRow = stats.average === -1 ? 'row-dnf' : '';
            const person = r.person || {};
            const personName = escapeHtml(person.name || 'Unknown');
            const wcaId = person.wcaId;
            const nameCell = wcaId
                ? `<a href="https://www.worldcubeassociation.org/persons/${wcaId}" target="_blank" rel="noopener noreferrer">${countryFlagImg(person.countryIso2, 14)} ${personName}</a>`
                : `${countryFlagImg(person.countryIso2, 14)} ${personName}`;

            const bestCell = stats.best > 0 ? formatTime(stats.best / 100) : '—';
            const avgCell = stats.average > 0 ? formatTime(stats.average / 100) : (stats.best > 0 ? 'DNF' : '—');
            const avgCls = stats.average > 0 ? 'wcalive-col-avg' : 'attempt-dnf';

            return `<tr class="${dnfRow}">
                <td class="podium-cell">${medal}${rank}</td>
                <td class="wcalive-col-name">${nameCell}</td>
                ${attemptCells.join('')}
                <td class="wcalive-col-best">${bestCell}</td>
                <td class="${avgCls}">${avgCell}</td>
                <td style="color: var(--clr-text-muted); font-size: 0.75rem;">${attemptsArr.filter(a => a > 0).length}/${attempts}</td>
            </tr>`;
        }).join('');
    }

    // HTML escape helper (used for user-supplied comp names / info)
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
'''

# Append to the end of the IIFE (before the final `})();`)
# Find the closing of the IIFE
# The structure is: (function () { ... })();
# We'll append inside the IIFE just before the final `})();`
end_marker = '    })();\n'
if src.rstrip().endswith('})();'):
    # Insert before the final `})();`
    idx = src.rstrip().rfind('})();')
    src = src[:idx] + native_module + '\n' + src[idx:]
    print('  Appended native WCA Live module before final })();')
else:
    # Append at end
    src = src + native_module
    print('  Appended native WCA Live module at end')

# === STEP 4: Update the wcalive nav click to also re-init when already on view ===
old_nav_handler = """        if ($('#nav-wcalive-btn')) {
            $('#nav-wcalive-btn').addEventListener('click', () => {
                switchView('wcalive');
            });
        }"""
new_nav_handler = """        if ($('#nav-wcalive-btn')) {
            $('#nav-wcalive-btn').addEventListener('click', () => {
                switchView('wcalive');
                // If already on wcalive view, just refresh dashboard; otherwise init will run via switchView path
                if (state.currentView === 'wcalive' && state.wcalive) {
                    state.wcalive.cache.delete('dashboard');
                    fetchWcaLiveDashboard();
                }
            });
        }"""
if old_nav_handler in src:
    src = src.replace(old_nav_handler, new_nav_handler, 1)
    print('  Updated nav-wcalive-btn handler to refresh on re-click')

# === STEP 5: Also call initWcaLive from handleHashRoute when entering wcalive ===
# Find the handleHashRoute function and add an init call
old_hash_route = """            if (targetView === 'battle') initBattle();
        }
    }"""
new_hash_route = """            if (targetView === 'battle') initBattle();
            if (targetView === 'wcalive' && state.wcalive && state.wcalive.currentSubView !== 'dashboard') {
                switchWcaLiveSubView('dashboard');
                fetchWcaLiveDashboard();
            }
        }
    }"""
if old_hash_route in src:
    src = src.replace(old_hash_route, new_hash_route, 1)
    print('  Updated handleHashRoute to init WCA Live on navigation')

# Write back
Path('app.js').write_text(src, encoding='utf-8')
print('app.js updated. Length now:', len(src), 'chars (was', len(original), ')')

# Verify
verify = Path('app.js').read_text(encoding='utf-8')
for needle in ['state.wcalive', 'function initWcaLive', 'function switchWcaLiveSubView', 'function fetchWcaLiveDashboard', 'function openWcaLiveComp', 'function openWcaLiveEvent', 'function renderWcaLiveResults', 'function computeResultStats', 'function computePodium', 'function escapeHtml', 'wcalive-card-grid']:
    print(f'  {needle}: {verify.count(needle)}')
