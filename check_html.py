HTML_OLD = """                        <div class="lb-wrapper" style="margin-top: 0; border: none; background: transparent;">
                            <table class="lb-table" style="margin: 0; text-align: center;">
                                <thead>
                                    <tr>
                                        <th style="text-align: center;">Event</th>
                                        <th style="text-align: center;">Single</th>
                                        <th style="text-align: center;">Average</th>
                                        <th style="text-align: center;">National Rank</th>
                                        <th style="text-align: center;">World Rank</th>
                                    </tr>
                                </thead>"""

HTML_NEW = """                        <div class="records-table-wrap" style="margin-top: 0; border: none; background: transparent;">
                            <table class="records-table-enhanced" style="width: 100%; text-align: center; margin: 0;">
                                <thead>
                                    <tr>
                                        <th style="text-align: center; padding: 1rem;">Event</th>
                                        <th style="text-align: center; padding: 1rem;">Single</th>
                                        <th style="text-align: center; padding: 1rem;">Average</th>
                                        <th style="text-align: center; padding: 1rem;">National Rank</th>
                                        <th style="text-align: center; padding: 1rem;">World Rank</th>
                                    </tr>
                                </thead>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Replaced lb-table with records-table-enhanced")
else:
    print("Not found")
