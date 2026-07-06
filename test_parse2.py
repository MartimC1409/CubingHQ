import re

html = open('temp_zbllt.html', encoding='utf-16').read()

# find first singlecase
idx = html.find('singlecase')
if idx != -1:
    print(html[idx-50:idx+500])
