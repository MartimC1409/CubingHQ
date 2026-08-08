# -*- coding: utf-8 -*-
"""Append WCA Live view CSS rules to style.css (full-height iframe, dark theme header)."""
from pathlib import Path

CSS = Path(r'D:\AI-TESTE\style.css')
src = CSS.read_text(encoding='utf-8')

NEW_CSS = r"""

/* ============================================================
   WCA LIVE VIEW (embedded iframe of live.worldcubeassociation.org)
   ============================================================ */

.wcalive-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 80px);
    margin: 0 auto;
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    gap: var(--space-md);
}

.wcalive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    flex-shrink: 0;
}

.wcalive-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
}

.wcalive-title h2 {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0;
    color: var(--clr-text);
}

.wcalive-subtitle {
    font-size: 0.8rem;
    color: var(--clr-text-muted);
    font-weight: 500;
    letter-spacing: 0.02em;
}

.wcalive-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #EF4444;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    animation: wcalivePulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
}

@keyframes wcalivePulse {
    0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70%  { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.wcalive-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
}

.wcalive-frame-wrap {
    flex: 1 1 auto;
    position: relative;
    background: var(--clr-bg-card);
    border: 1px solid var(--clr-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    min-height: 0;  /* critical for flex child to shrink */
}

.wcalive-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    color: var(--clr-text-muted);
    font-size: 0.9rem;
    background: var(--clr-bg-card);
    z-index: 1;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.wcalive-loading[style*="display: none"] {
    opacity: 0;
}

.wcalive-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: #0B0D17;
}

/* Mobile: stack header title + actions */
@media (max-width: 600px) {
    .wcalive-container {
        padding: var(--space-sm);
    }
    .wcalive-header {
        flex-direction: column;
        align-items: flex-start;
        padding: var(--space-md);
    }
    .wcalive-subtitle {
        display: none;  /* save space on mobile */
    }
    .wcalive-header-actions {
        width: 100%;
        justify-content: flex-end;
    }
}
"""

# Append to end of file
if 'WCA LIVE VIEW' in src:
    print('  WCA Live CSS already present, skipping append')
else:
    new_src = src.rstrip() + '\n' + NEW_CSS
    CSS.write_text(new_src, encoding='utf-8', newline='')
    print(f'  Old size: {len(src)} bytes')
    print(f'  New size: {len(new_src)} bytes')
    print(f'  Appended WCA Live CSS block ({len(NEW_CSS)} chars)')
    print('OK')
