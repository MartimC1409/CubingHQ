#!/usr/bin/env python3
"""Append CSS for the WCA Live simulation overlay (same aesthetic as the
   comp simulation dashboard, but scoped to the WCA Live sub-event view).
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

css = Path('style.css').read_text(encoding='utf-8')

new_block = '''

/* ============================================================
   WCA LIVE SIMULATION OVERLAY (per-round practice)
   ============================================================ */
.wcalive-sim {
    margin-top: var(--space-md);
    animation: fadeIn 0.3s ease;
}

.wcalive-sim-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
}

@media (max-width: 1000px) {
    .wcalive-sim-grid {
        grid-template-columns: 1fr;
    }
}

.wcalive-sim-main,
.wcalive-sim-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.wcalive-sim-scramble-card,
.wcalive-sim-timer-card,
.wcalive-sim-scorecard-card,
.wcalive-sim-podium-card,
.wcalive-sim-leaderboard-card {
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color var(--transition-base);
}

.wcalive-sim-timer-card {
    border-color: var(--clr-border-active);
}

.wcalive-sim-scramble-card:hover,
.wcalive-sim-timer-card:hover,
.wcalive-sim-scorecard-card:hover,
.wcalive-sim-podium-card:hover,
.wcalive-sim-leaderboard-card:hover {
    border-color: var(--clr-border-active);
}

.wcalive-sim-round-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: var(--clr-accent-glow);
    color: var(--clr-accent);
    border: 1px solid rgba(249, 115, 22, 0.3);
}

.wcalive-sim-solve-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-lg);
    border-top: 1px solid var(--clr-border);
    background: var(--clr-surface);
    font-size: 0.8rem;
}

.wcalive-sim-solve-label {
    color: var(--clr-text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.7rem;
}

.wcalive-sim-solve-num {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--clr-text);
    font-size: 0.9rem;
}

.wcalive-sim-timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl) var(--space-lg);
    flex-grow: 1;
    min-height: 140px;
}

.wcalive-sim-scorecard-wrap {
    overflow: auto;
    flex-grow: 1;
    padding: var(--space-sm);
}

.wcalive-sim-podium {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
    padding: var(--space-md);
}

.wcalive-sim-podium-card-mini {
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    text-align: center;
    position: relative;
}

.wcalive-sim-podium-card-mini.rank-1 {
    border-color: #F7C948;
    background: linear-gradient(180deg, rgba(247,201,72,0.1) 0%, var(--clr-surface) 100%);
}

.wcalive-sim-podium-card-mini.rank-2 {
    border-color: #CBD5E1;
}

.wcalive-sim-podium-card-mini.rank-3 {
    border-color: #D97706;
}

.wcalive-sim-podium-medal {
    font-size: 1.2rem;
    margin-bottom: 2px;
}

.wcalive-sim-podium-name {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--clr-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
}

.wcalive-sim-podium-time {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--clr-primary);
}

.wcalive-sim-podium-empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--clr-text-muted);
    font-size: 0.82rem;
    padding: var(--space-md);
}

.wcalive-sim-leaderboard-wrap {
    overflow-y: auto;
    max-height: 360px;
}

.wcalive-sim-loading-row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    color: var(--clr-text-muted);
    font-size: 0.82rem;
    justify-content: center;
}

.wcalive-sim-lb-empty {
    text-align: center;
    color: var(--clr-text-muted);
    font-size: 0.85rem;
    padding: var(--space-md);
}

.wcalive-sim-lb-row.is-user {
    background: var(--clr-primary-glow);
}

.wcalive-sim-lb-row.is-user td {
    color: var(--clr-primary-hover);
    font-weight: 700;
}

/* Footer */
.wcalive-sim-footer {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding: var(--space-md) var(--space-md);
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
}

.wcalive-sim-hint {
    margin-left: auto;
    color: var(--clr-text-muted);
    font-size: 0.82rem;
    font-style: italic;
}

/* Reuse existing table styles from dashboard */
.wcalive-sim-scorecard-card .scorecard-table th {
    font-size: 0.7rem;
    padding: 8px 4px;
}

.wcalive-sim-scorecard-card .scorecard-table td {
    font-size: 0.82rem;
    padding: 8px 4px;
}
'''

# Append
css = css.rstrip() + '\n' + new_block
Path('style.css').write_text(css, encoding='utf-8')
print('style.css updated. Length now:', len(css), 'chars')

# Verify
verify = Path('style.css').read_text(encoding='utf-8')
for needle in ['wcalive-sim-grid', 'wcalive-sim-scramble-card', 'wcalive-sim-timer-card', 'wcalive-sim-scorecard-card', 'wcalive-sim-podium', 'wcalive-sim-leaderboard', 'wcalive-sim-footer']:
    print(f'  {needle}: {verify.count(needle)}')
