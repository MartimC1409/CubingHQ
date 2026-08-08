# -*- coding: utf-8 -*-
"""Add a 5th feature card 'WCA Live' to the home page (since we just added that view).

Current home page has 4 feature cards: Comp Simulation, Algorithm Database,
WCA Records, Competitions. This adds a 5th for WCA Live so each major nav item
has a discoverable entry point on the home page.
"""
from pathlib import Path

HTML = Path(r'D:\AI-TESTE\index.html')
src = HTML.read_text(encoding='utf-8')

OLD = """                    <div class="home-feature-card" onclick="window.location.href='index.html#competitions'" style="cursor: pointer;">
                        <h2 class="card-title"><span class="icon">📊</span> Competitions</h2>
                        <p class="card-desc">Track your progress and analyze your personal speedcubing stats.</p>
                    </div>
                </div>"""

NEW = """                    <div class="home-feature-card" onclick="window.location.href='index.html#competitions'" style="cursor: pointer;">
                        <h2 class="card-title"><span class="icon">📊</span> Competitions</h2>
                        <p class="card-desc">Track your progress and analyze your personal speedcubing stats.</p>
                    </div>
                    <div class="home-feature-card" onclick="document.getElementById('nav-wcalive-btn') && document.getElementById('nav-wcalive-btn').click()" style="cursor: pointer;">
                        <h2 class="card-title"><span class="icon">🔴</span> WCA Live</h2>
                        <p class="card-desc">Watch live competitions, real-time results, and rankings from around the world.</p>
                    </div>
                    <div class="home-feature-card" onclick="document.getElementById('nav-battle-btn') && document.getElementById('nav-battle-btn').click()" style="cursor: pointer;">
                        <h2 class="card-title"><span class="icon">⚔️</span> Battle</h2>
                        <p class="card-desc">Real-time head-to-head speedcubing against other cubers around the world.</p>
                    </div>
                </div>"""

if OLD not in src:
    raise SystemExit('FATAL: home feature card anchor not found')
src = src.replace(OLD, NEW, 1)
HTML.write_text(src, encoding='utf-8', newline='')
print(f'  Added 2 new home feature cards (WCA Live + Battle)')
print(f'  home-feature-card count: {src.count("home-feature-card")} (was 4, now 6)')
print('OK')
