HTML_OLD = """                                                        <th class="rec-th-event">Event</th>
                                                        <th class="rec-th-time">NR</th>
                                                        <th class="rec-th-time">Single</th>
                                                        <th class="rec-th-time">Average</th>
                                                        <th class="rec-th-time">NR</th>"""

HTML_NEW = """                                                        <th class="rec-th-event">Event</th>
                                                        <th class="rec-th-time" style="text-align: center;">NR</th>
                                                        <th class="rec-th-time" style="text-align: center;">Single</th>
                                                        <th class="rec-th-time" style="text-align: center;">Average</th>
                                                        <th class="rec-th-time" style="text-align: center;">NR</th>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Replaced th styles in HTML")
else:
    print("Not found")
