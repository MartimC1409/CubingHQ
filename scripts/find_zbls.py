import urllib.request
import re

html = urllib.request.urlopen('https://speedcubedb.com/').read().decode('utf-8')
links = set(re.findall(r'href=["\'](/a/3x3/[^"\']*)["\']', html))
print(links)
