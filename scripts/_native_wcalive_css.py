#!/usr/bin/env python3
"""Append native WCA Live CSS to style.css. Designed to match the WCA Live aesthetic
   (clean cards, pulsing live dot, attempt tables) and adapt to dark/light theme.
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

css = Path('style.css').read_text(encoding='utf-8')

# The new block to append
new_block = '''

/* ============================================================
   NATIVE WCA LIVE (Custom Pages, no iframe)
   ============================================================ */
.native-wcalive {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-md) var(--space-xl) var(--space-2xl);
}

.wcalive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--clr-border);
}

.wcalive-title-block {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
}

.wcalive-title-block h2 {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
}

.wcalive-subtitle {
    color: var(--clr-text-muted);
    font-size: 0.9rem;
    margin-left: var(--space-sm);
}

.wcalive-header-actions {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
}

.wcalive-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--clr-text-muted);
    flex-shrink: 0;
    display: inline-block;
}

.wcalive-dot.live-pulse {
    background: var(--clr-danger);
    box-shadow: 0 0 12px var(--clr-danger-glow);
    animation: wcaLivePulse 1.5s infinite;
}

@keyframes wcaLivePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
}

/* Sub-view router */
.wcalive-subview {
    animation: fadeIn 0.3s ease;
}

.wcalive-subview[style*="display:none"] {
    display: none !important;
}

/* Back button */
.wcalive-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--clr-border);
    color: var(--clr-text-secondary);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: var(--space-md);
    transition: all var(--transition-fast);
}

.wcalive-back-btn:hover {
    color: var(--clr-text);
    border-color: var(--clr-primary);
    background: var(--clr-primary-glow);
}

/* Section blocks (dashboard) */
.wcalive-section {
    margin-bottom: var(--space-xl);
}

.wcalive-section-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--clr-text-secondary);
    margin-bottom: var(--space-md);
}

.wcalive-section-icon {
    font-size: 1rem;
}

.wcalive-section-count {
    margin-left: auto;
    background: var(--clr-surface);
    color: var(--clr-text-muted);
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
}

.wcalive-loading-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    color: var(--clr-text-muted);
    font-size: 0.85rem;
    justify-content: center;
}

/* Competition cards grid */
.wcalive-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-md);
}

.wcalive-card {
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    cursor: pointer;
    transition: all var(--transition-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    text-decoration: none;
    color: inherit;
    position: relative;
    overflow: hidden;
}

.wcalive-card:hover {
    border-color: var(--clr-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.wcalive-card.is-live {
    border-color: var(--clr-danger);
    border-left: 3px solid var(--clr-danger);
}

.wcalive-card.is-live::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    background: var(--clr-danger);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 2px 8px;
    border-bottom-left-radius: var(--radius-sm);
    animation: wcaLivePulse 1.5s infinite;
}

.wcalive-card.is-live::after {
    content: 'LIVE';
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 0.6rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.1em;
    z-index: 1;
}

.wcalive-card.is-completed {
    border-left: 3px solid var(--clr-success);
}

.wcalive-card.is-upcoming {
    border-left: 3px solid var(--clr-info);
}

.wcalive-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
    padding-right: 50px; /* avoid overlap with LIVE badge */
}

.wcalive-card-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--clr-text);
    line-height: 1.3;
    flex: 1;
}

.wcalive-card-events {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
}

.wcalive-event-tag {
    display: inline-block;
    padding: 2px 8px;
    background: var(--clr-surface);
    color: var(--clr-text-secondary);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    font-family: var(--font-mono);
}

.wcalive-card-meta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.82rem;
    color: var(--clr-text-secondary);
    flex-wrap: wrap;
}

.wcalive-card-meta .country-flag {
    margin-right: 4px;
}

.wcalive-card-dates {
    font-size: 0.8rem;
    color: var(--clr-text-muted);
    font-weight: 500;
    font-family: var(--font-mono);
}

.wcalive-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-xl);
    color: var(--clr-text-muted);
    font-size: 0.9rem;
}

/* Comp detail header */
.wcalive-comp-header {
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
    position: relative;
    overflow: hidden;
}

.wcalive-comp-header h2 {
    font-size: 1.8rem;
    font-weight: 800;
    margin: 0 0 var(--space-xs);
    letter-spacing: -0.01em;
}

.wcalive-comp-status {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin-bottom: var(--space-sm);
    text-transform: uppercase;
}

.wcalive-comp-status.is-live {
    background: var(--clr-danger-glow);
    color: var(--clr-danger);
    border: 1px solid var(--clr-danger);
}

.wcalive-comp-status.is-upcoming {
    background: var(--clr-primary-glow);
    color: var(--clr-primary-hover);
    border: 1px solid var(--clr-primary);
}

.wcalive-comp-status.is-completed {
    background: var(--clr-success-glow);
    color: var(--clr-success);
    border: 1px solid var(--clr-success);
}

.wcalive-comp-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-top: var(--space-sm);
    font-size: 0.9rem;
    color: var(--clr-text-secondary);
}

.wcalive-comp-meta-row .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.wcalive-comp-meta-row .meta-label {
    color: var(--clr-text-muted);
    font-size: 0.8rem;
}

.wcalive-comp-info-text {
    margin-top: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--clr-surface);
    border-left: 3px solid var(--clr-primary);
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--clr-text-secondary);
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
}

/* Comp detail layout */
.wcalive-comp-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--space-lg);
}

@media (max-width: 900px) {
    .wcalive-comp-layout {
        grid-template-columns: 1fr;
    }
}

.wcalive-comp-main,
.wcalive-comp-sidebar {
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
}

.wcalive-h3 {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clr-text-secondary);
    margin: 0 0 var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--clr-border);
}

/* Event chips (comp detail) */
.wcalive-event-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: var(--space-lg);
}

.wcalive-event-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-sm);
    color: var(--clr-text);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.wcalive-event-chip:hover {
    border-color: var(--clr-primary);
    background: var(--clr-primary-glow);
}

.wcalive-event-chip.is-main {
    border-color: var(--clr-accent);
    background: var(--clr-accent-glow);
    color: var(--clr-accent);
}

.wcalive-event-chip .event-name {
    color: var(--clr-text);
    font-family: var(--font-body);
}

.wcalive-event-chip.is-main .event-name {
    color: var(--clr-accent);
}

/* Podium */
.wcalive-podium-wrap {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
}

.wcalive-podium-card {
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    text-align: center;
    position: relative;
}

.wcalive-podium-card.rank-1 {
    border-color: #F7C948;
    background: linear-gradient(180deg, rgba(247,201,72,0.1) 0%, var(--clr-surface) 100%);
}

.wcalive-podium-card.rank-2 {
    border-color: #CBD5E1;
}

.wcalive-podium-card.rank-3 {
    border-color: #D97706;
}

.wcalive-podium-medal {
    font-size: 1.6rem;
    margin-bottom: 4px;
}

.wcalive-podium-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--clr-text);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.wcalive-podium-time {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--clr-primary);
}

.wcalive-podium-empty {
    color: var(--clr-text-muted);
    font-size: 0.85rem;
    text-align: center;
    padding: var(--space-md);
}

/* Schedule list */
.wcalive-schedule-list {
    list-style: none;
    margin: 0;
    padding: 0;
    margin-bottom: var(--space-md);
}

.wcalive-schedule-item {
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--clr-border);
    font-size: 0.85rem;
}

.wcalive-schedule-item:last-child {
    border-bottom: none;
}

.wcalive-schedule-time {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--clr-text-muted);
    margin-bottom: 2px;
}

.wcalive-schedule-name {
    color: var(--clr-text);
    font-weight: 500;
}

.wcalive-schedule-name.is-round {
    color: var(--clr-primary);
    font-weight: 600;
}

.wcalive-schedule-empty {
    color: var(--clr-text-muted);
    font-size: 0.85rem;
    text-align: center;
    padding: var(--space-md);
}

/* Event results */
.wcalive-event-header {
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-lg);
}

.wcalive-event-header h2 {
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0 0 var(--space-xs);
}

.wcalive-event-header .event-subtitle {
    color: var(--clr-text-muted);
    font-size: 0.9rem;
}

/* Round tabs */
.wcalive-rounds-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: var(--space-md);
    border-bottom: 1px solid var(--clr-border);
    overflow-x: auto;
    flex-wrap: nowrap;
}

.wcalive-round-tab {
    padding: 0.6rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--clr-text-muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-fast);
}

.wcalive-round-tab:hover {
    color: var(--clr-text);
}

.wcalive-round-tab.active {
    color: var(--clr-primary);
    border-bottom-color: var(--clr-primary);
}

/* Results table */
.wcalive-results-table {
    font-size: 0.85rem;
}

.wcalive-results-table th {
    text-align: center;
    padding: var(--space-sm) 8px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--clr-text-muted);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 2px solid var(--clr-border);
}

[data-theme="light"] .wcalive-results-table th {
    background: rgba(0, 0, 0, 0.02);
}

.wcalive-results-table th.wcalive-col-name {
    text-align: left;
    min-width: 180px;
}

.wcalive-results-table th.wcalive-col-rank {
    width: 50px;
}

.wcalive-results-table th.wcalive-col-best,
.wcalive-results-table th.wcalive-col-avg {
    color: var(--clr-text);
    min-width: 100px;
}

.wcalive-results-table td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--clr-border);
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--clr-text);
}

.wcalive-results-table td.wcalive-col-name {
    text-align: left;
    font-family: var(--font-body);
    font-weight: 500;
}

.wcalive-results-table td.wcalive-col-name a {
    color: var(--clr-text);
    text-decoration: none;
}

.wcalive-results-table td.wcalive-col-name a:hover {
    color: var(--clr-primary);
}

.wcalive-results-table td.attempt-best {
    color: var(--clr-success);
    font-weight: 700;
    background: var(--clr-success-glow);
}

.wcalive-results-table td.attempt-dnf {
    color: var(--clr-danger);
    font-weight: 700;
}

.wcalive-results-table td.attempt-dns {
    color: var(--clr-text-muted);
    font-style: italic;
}

.wcalive-results-table td.attempt-zero {
    color: var(--clr-text-muted);
}

.wcalive-results-table td.attempt-empty {
    color: rgba(255, 255, 255, 0.12);
}

.wcalive-results-table td.wcalive-col-best {
    color: var(--clr-success);
    font-weight: 700;
}

.wcalive-results-table td.wcalive-col-avg {
    color: var(--clr-primary);
    font-weight: 700;
}

.wcalive-results-table tr.row-dnf {
    opacity: 0.55;
}

.wcalive-results-table tr.row-user {
    background: var(--clr-primary-glow);
    border-left: 3px solid var(--clr-primary);
}

.wcalive-results-table .podium-cell {
    font-size: 1.1rem;
}

.wcalive-results-table .medal {
    margin-right: 4px;
}

/* Responsive */
@media (max-width: 768px) {
    .wcalive-card-grid {
        grid-template-columns: 1fr;
    }
    .wcalive-podium-wrap {
        grid-template-columns: 1fr;
    }
    .wcalive-title-block h2 {
        font-size: 1.3rem;
    }
    .wcalive-subtitle {
        display: none;
    }
    .wcalive-header-actions {
        flex-wrap: wrap;
    }
}
'''

# Append to style.css
css = css.rstrip() + '\n' + new_block
Path('style.css').write_text(css, encoding='utf-8')
print('style.css updated. Length now:', len(css), 'chars')

# Verify markers
verify = Path('style.css').read_text(encoding='utf-8')
for needle in ['native-wcalive', 'wcalive-card-grid', 'wcalive-podium-wrap', 'wcalive-rounds-tabs', 'attempt-best', 'attempt-dnf']:
    print(f'  {needle}: {verify.count(needle)}')
