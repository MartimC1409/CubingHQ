HTML_OLD = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="setting-sound" checked>
                                        <span class="slider"></span>
                                    </label>
                                    <span>Sound Effects</span>"""

HTML_NEW = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="setting-sound" checked>
                                        <span class="slider"></span>
                                    </label>
                                    <span>Competition Noise</span>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Replaced sound toggle label")
else:
    print("Not found")
