# -*- coding: utf-8 -*-
"""Add WCA Live nav button to index.html (between Battle and Login)."""
from pathlib import Path

HTML = Path(r'D:\AI-TESTE\index.html')
src = HTML.read_text(encoding='utf-8')

# Find the Battle button's closing </button> followed by the Login button comment
OLD = """            Battle
        </button>
        <!-- Login Button -->"""

NEW = """            Battle
        </button>
        <!-- WCA Live Button -->
        <button class="nav-btn" id="nav-wcalive-btn" title="WCA Live">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
            WCA Live
        </button>
        <!-- Login Button -->"""

if OLD not in src:
    print('FATAL: nav anchor not found', flush=True)
    raise SystemExit(1)

new_src = src.replace(OLD, NEW, 1)
HTML.write_text(new_src, encoding='utf-8', newline='')

# Sanity check
print(f'  Old size: {len(src)} chars')
print(f'  New size: {len(new_src)} chars')
print(f'  nav-wcalive-btn present: {new_src.count("nav-wcalive-btn")} hit(s)')
print('OK')
