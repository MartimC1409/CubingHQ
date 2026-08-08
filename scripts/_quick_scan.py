# -*- coding: utf-8 -*-
"""Quick targeted scan of 8 upcoming comps for 2023CARV02."""
import urllib.request
import urllib.error
import json
import sys
import time
from datetime import date, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

UA = {'User-Agent': 'Mozilla/5.0 (SimulateCubing-Debug)'}
TARGET = '2023CARV02'

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))

today = date.today().isoformat()
end = (date.today() + timedelta(days=30)).isoformat()

print('=== STEP 1: First 8 upcoming comps in next 30 days ===')
comps = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions?start={today}&end={end}&per_page=8')
print(f'  Got {len(comps)} comps (today={today}, end={end})')
for c in comps:
    print(f'    - {c["id"]}: {c["name"]} ({c["start_date"]}) {c["city"]}, {c["country_iso2"]}')

print()
print(f'=== STEP 2: Check each WCIF for {TARGET} ===')
for c in comps:
    cid = c['id']
    try:
        wcif = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions/{cid}/wcif/public', timeout=15)
        persons = wcif.get('persons', [])
        match = None
        for p in persons:
            if isinstance(p, dict) and p.get('wcaId') == TARGET:
                match = p
                break
        if match:
            reg = match.get('registration', {}) or {}
            print(f'  *** {cid}: FOUND! status={reg.get("status")} events={len(reg.get("eventIds", []))} ***')
        else:
            print(f'  {cid}: {len(persons)} persons, {TARGET} NOT in list')
        time.sleep(0.3)  # small delay
    except urllib.error.HTTPError as e:
        print(f'  {cid}: HTTP {e.code}')
    except Exception as e:
        print(f'  {cid}: {type(e).__name__}: {e}')

print()
print('=== STEP 3: Sample person object structure (first 3 persons from first comp) ===')
if comps:
    try:
        wcif = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions/{comps[0]["id"]}/wcif/public', timeout=15)
        persons = wcif.get('persons', [])
        for p in persons[:3]:
            if isinstance(p, dict):
                keys = list(p.keys())
                print(f'  person keys: {keys}')
                if 'registration' in p:
                    print(f'    registration keys: {list(p["registration"].keys())}')
                    print(f'    registration.status: {p["registration"].get("status")}')
                    print(f'    registration.eventIds: {p["registration"].get("eventIds")}')
                break
    except Exception as e:
        print(f'  Error: {e}')
