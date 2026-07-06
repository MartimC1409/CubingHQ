import urllib.request
import re
import json

URLS = {
    "2x2": {
        "CLL": ["https://speedcubedb.com/a/2x2/CLL"],
        "EG1": ["https://speedcubedb.com/a/2x2/EG1"],
        "EG2": ["https://speedcubedb.com/a/2x2/EG2"]
    },
    "3x3": {
        "OLL": ["https://speedcubedb.com/a/3x3/OLL"],
        "PLL": ["https://speedcubedb.com/a/3x3/PLL"],
        "ZBLS": ["https://speedcubedb.com/a/3x3/ZBLS"],
        "ZBLL": [
            "https://speedcubedb.com/a/3x3/ZBLLPi",
            "https://speedcubedb.com/a/3x3/ZBLLU",
            "https://speedcubedb.com/a/3x3/ZBLLT",
            "https://speedcubedb.com/a/3x3/ZBLLL",
            "https://speedcubedb.com/a/3x3/ZBLLH",
            "https://speedcubedb.com/a/3x3/ZBLLS",
            "https://speedcubedb.com/a/3x3/ZBLLAS"
        ]
    },
    "4x4": {
        "OLL Parity": ["https://speedcubedb.com/a/4x4/OLLParity"],
        "PLL Parity": ["https://speedcubedb.com/a/4x4/PLLParity"]
    },
    "5x5": {
        "L2E": ["https://speedcubedb.com/a/5x5/L2E"]
    },
    "Pyraminx": {
        "L4E": ["https://speedcubedb.com/a/Pyraminx/L4E"]
    },
    "Megaminx": {
        "PLL": ["https://speedcubedb.com/a/Megaminx/MegaminxPLL"]
    }
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
    except Exception as e:
        print(f"Failed {url}: {e}")
        return []
        
    results = []
    blocks = html.split("<ul class='list-group'")[1:]
    for b in blocks:
        # extract name
        name_match = re.search(r'data-t="([^"]+)"', b)
        if not name_match: continue
        name = name_match.group(1).split(',')[0].strip()
        
        # extract alg
        alg_match = re.search(r'<div class="formatted-alg">(.*?)</div>', b, re.DOTALL | re.IGNORECASE)
        if not alg_match: continue
        alg = alg_match.group(1).strip()
        
        # remove HTML tags from alg if any
        alg = re.sub(r'<[^>]+>', '', alg).strip()
        
        # remove multiple spaces
        alg = re.sub(r'\s+', ' ', alg)
        
        results.append({"name": name, "alg": alg})
        
    return results

ALGORITHMS = {}

for event, categories in URLS.items():
    ALGORITHMS[event] = {}
    for cat, urls in categories.items():
        print(f"Fetching {event} - {cat}...")
        ALGORITHMS[event][cat] = []
        for url in urls:
            algs = fetch(url)
            ALGORITHMS[event][cat].extend(algs)
            print(f"  Found {len(algs)} algs from {url}")

with open("algorithms.js", "w", encoding="utf-8") as f:
    f.write("const ALGORITHMS = ")
    json.dump(ALGORITHMS, f, indent=4)
    f.write(";\n")

print("Done. algorithms.js written.")
