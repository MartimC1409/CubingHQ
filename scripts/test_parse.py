import re

html = open('temp_zbllt.html', encoding='utf-16').read()
# Let's find all case names and their first formatted-alg.
# In speedcubedb, case names are usually inside <div class="category-name">...</div> or similar, or <h2>
# Let's just find everything and dump a snippet to see.
cases = re.findall(r'data-alg="([^"]+)"', html)
print("Algorithms found:", cases[:5])

# Find case names
names = re.findall(r'<div class="case-name.*?>(.*?)</div>', html, re.IGNORECASE)
if not names:
    names = re.findall(r'<h[1-6].*?>(.*?)</h[1-6]>', html, re.IGNORECASE)
print("Names found:", names[:10])
