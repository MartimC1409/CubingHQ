# -*- coding: utf-8 -*-
"""Add CSS for .competitions-search-grid (2-column layout for past+upcoming comps)."""
from pathlib import Path

CSS = Path(r'D:\AI-TESTE\style.css')
src = CSS.read_text(encoding='utf-8')

NEW_CSS = r"""

/* ============================================================
   COMPETITIONS SEARCH GRID (Past + Upcoming side-by-side)
   ============================================================ */

.competitions-search-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    max-width: 1400px;
    margin-left: auto;
    margin-right: auto;
}

.competitions-search-grid > .setup-card {
    width: 100%;
}

@media (max-width: 768px) {
    .competitions-search-grid {
        grid-template-columns: 1fr;
    }
}
"""

if 'COMPETITIONS SEARCH GRID' in src:
    print('  Already present, skipping')
else:
    new_src = src.rstrip() + '\n' + NEW_CSS
    CSS.write_text(new_src, encoding='utf-8', newline='')
    print(f'  Appended {len(NEW_CSS)} chars')
    print(f'  Old: {len(src)} -> New: {len(new_src)}')
    print('OK')
