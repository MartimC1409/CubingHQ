NEW_CSS = """
/* ================================================================
   BATTLE — Cross-table (.bct) styles
   ================================================================ */

/* Container */
.battle-cross-table-wrap {
    flex: 1;
    overflow: auto;
    padding: 0;
    background: var(--clr-surface);
}

/* Table */
.bct {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    table-layout: fixed;
}

/* Columns */
.bct-th-num, .bct-td-num {
    width: 48px;
    min-width: 44px;
    text-align: center;
    font-weight: 700;
    font-size: 0.75rem;
    background: var(--clr-surface);
    color: var(--clr-text-muted);
    position: sticky;
    left: 0;
    z-index: 2;
    border-right: 1px solid var(--clr-border);
    padding: 6px 4px;
    white-space: nowrap;
}

.bct-th-player {
    padding: 8px 10px;
    text-align: center;
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--clr-text);
    border-bottom: 2px solid var(--clr-border);
    position: sticky;
    top: 0;
    background: var(--clr-surface);
    z-index: 3;
    min-width: 100px;
    line-height: 1.3;
}
.bct-th-player.bct-me {
    background: rgba(255, 107, 53, 0.06);
    border-bottom-color: #FF6B35;
}

.bct-player-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-right: 5px;
    vertical-align: middle;
}
.bct-you-tag {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--clr-text-muted);
}

/* Header row */
.bct-header-row th {
    position: sticky;
    top: 0;
    z-index: 4;
    background: var(--clr-surface);
    border-bottom: 2px solid var(--clr-border);
}
.bct-th-num.bct-td-num { z-index: 5; }

/* Stat rows (mean / wins) */
.bct-stat-row td {
    padding: 5px 8px;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--clr-text-muted);
}
.bct-td-stat { text-align: center; }
.bct-best-stat {
    color: #2ECC71;
    font-weight: 700;
}

/* Divider row */
.bct-divider-row td {
    height: 2px;
    background: var(--clr-border);
    padding: 0;
}

/* Solve rows */
.bct-row td {
    padding: 5px 8px;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.82rem;
    color: var(--clr-text);
    transition: background 0.15s;
}
.bct-row:hover td { background: rgba(255,255,255,0.03); }

/* Current scramble row */
.bct-current { background: rgba(255, 107, 53, 0.04); }
.bct-current td { background: rgba(255, 107, 53, 0.04); }
.bct-current-dot {
    display: inline-block;
    width: 6px; height: 6px;
    background: #FF6B35;
    border-radius: 50%;
    margin-left: 4px;
    vertical-align: middle;
    animation: pulse 1.2s ease-in-out infinite;
}

/* Winner highlight */
.bct-winner {
    color: #2ECC71 !important;
    font-weight: 700;
    background: rgba(46, 204, 113, 0.08) !important;
}

/* Me column */
.bct-me-time {
    background: rgba(255, 107, 53, 0.04);
}

/* Pending (current scramble, no solve yet) */
.bct-pending {
    color: rgba(255,255,255,0.15) !important;
    font-size: 1.2em;
}

/* Empty state */
.bct-empty {
    text-align: center;
    color: var(--clr-text-muted);
    padding: 2rem;
    font-size: 0.85rem;
}

/* Footer rows (single, ao5...) */
.bct-footer-row td {
    padding: 4px 8px;
    text-align: center;
    font-size: 0.75rem;
    color: var(--clr-text-muted);
    border-bottom: 1px solid rgba(255,255,255,0.03);
}
.bct-footer-row .bct-td-num {
    font-style: italic;
}
.bct-footer-row .bct-best-stat {
    color: #3498DB;
}

/* Right panel sizing */
.battle-room-right {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.battle-room-right .battle-panel-header {
    flex-shrink: 0;
}

@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
}
"""

content = open('d:/AI-TESTE/style.css', encoding='utf-8').read()
content += '\n' + NEW_CSS
open('d:/AI-TESTE/style.css', 'w', encoding='utf-8', newline='\n').write(content)
print('CSS done. Total chars:', len(content))
