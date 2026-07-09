# -*- coding: utf-8 -*-
"""Add WCA Live view section in index.html (just before </main>)."""
from pathlib import Path

HTML = Path(r'D:\AI-TESTE\index.html')
src = HTML.read_text(encoding='utf-8')

# Anchor: the line just before </main> ends the algorithms/practice view
# The Battle view section is the last full <section> before </main>
# Use the end of the Battle view as our anchor
OLD = """        <!-- ====== CREATE ROOM MODAL ====== -->"""

NEW = """        <!-- ====== WCA LIVE VIEW ====== -->
        <section id="wcalive-view" class="view">
            <div class="wcalive-container">
                <div class="wcalive-header">
                    <div class="wcalive-title">
                        <span class="wcalive-dot" aria-hidden="true"></span>
                        <h2>WCA Live</h2>
                        <span class="wcalive-subtitle">Live competitions, results &amp; rankings</span>
                    </div>
                    <div class="wcalive-header-actions">
                        <button type="button" class="btn btn-ghost btn-sm" id="wcalive-reload-btn" title="Reload WCA Live">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Reload
                        </button>
                        <a href="https://live.worldcubeassociation.org/" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Open in new tab
                        </a>
                    </div>
                </div>
                <div class="wcalive-frame-wrap">
                    <div class="wcalive-loading" id="wcalive-loading">
                        <div class="spinner"></div>
                        <span>Loading WCA Live...</span>
                    </div>
                    <iframe
                        id="wcalive-iframe"
                        class="wcalive-frame"
                        src="https://live.worldcubeassociation.org/"
                        title="WCA Live"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        allow="clipboard-read; clipboard-write"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">
                    </iframe>
                </div>
            </div>
        </section>

        <!-- ====== CREATE ROOM MODAL ====== -->"""

if OLD not in src:
    print('FATAL: view anchor not found', flush=True)
    raise SystemExit(1)

new_src = src.replace(OLD, NEW, 1)
HTML.write_text(new_src, encoding='utf-8', newline='')

print(f'  Old size: {len(src)} chars')
print(f'  New size: {len(new_src)} chars')
print(f'  wcalive-view present: {new_src.count("wcalive-view")} hit(s)')
print(f'  wcalive-iframe present: {new_src.count("wcalive-iframe")} hit(s)')
print('OK')
