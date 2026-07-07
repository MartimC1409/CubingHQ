HTML_OLD = """                    <div class="setup-grid" style="margin-bottom: var(--space-xl);">
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 3rem; color: var(--clr-primary); margin-bottom: 0.5rem; font-weight: 800;" id="stat-comps-count">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Competitions</p>
                        </div>
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 3rem; color: #F7C948; margin-bottom: 0.5rem; font-weight: 800;" id="stat-gold">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Gold Medals</p>
                        </div>
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 3rem; color: #CBD5E1; margin-bottom: 0.5rem; font-weight: 800;" id="stat-silver">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Silver Medals</p>
                        </div>
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 3rem; color: #D97706; margin-bottom: 0.5rem; font-weight: 800;" id="stat-bronze">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Bronze Medals</p>
                        </div>
                    </div>"""

HTML_NEW = """                    <div class="setup-card" style="text-align: center; padding: 2rem; margin-bottom: var(--space-lg);">
                        <h2 style="font-size: 3rem; color: var(--clr-primary); margin-bottom: 0.5rem; font-weight: 800;" id="stat-comps-count">0</h2>
                        <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Competitions</p>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg); margin-bottom: var(--space-xl);">
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 2.5rem; color: #F7C948; margin-bottom: 0.5rem; font-weight: 800;" id="stat-gold">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Gold</p>
                        </div>
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 2.5rem; color: #CBD5E1; margin-bottom: 0.5rem; font-weight: 800;" id="stat-silver">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Silver</p>
                        </div>
                        <div class="setup-card" style="text-align: center; padding: 2rem;">
                            <h2 style="font-size: 2.5rem; color: #D97706; margin-bottom: 0.5rem; font-weight: 800;" id="stat-bronze">0</h2>
                            <p style="color: var(--clr-text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85rem;">Bronze</p>
                        </div>
                    </div>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Replaced stats grid")
else:
    print("Not found")
