# -*- coding: utf-8 -*-
"""Verify WCIF scan for 2023CARV02's upcoming registrations WITH rate limiting."""
import urllib.request
import urllib.error
import json
import sys
import time
from datetime import date, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

UA = {'User-Agent': 'Mozilla/5.0 (SimulateCubing-Debug)'}

def fetch_json(url, timeout=20, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                wait = (attempt + 1) * 2
                print(f'  429 - waiting {wait}s (attempt {attempt+1}/{retries})')
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            raise

TARGET = '2023CARV02'
today = date.today().isoformat()
end = (date.today() + timedelta(days=90)).isoformat()

print('=== STEP 1: Fetch upcoming competitions (next 90 days) ===')
comps = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions?start={today}&end={end}&per_page=200')
print(f'  Total upcoming comps: {len(comps)}')
print(f'  Date range: {comps[0]["start_date"]} -> {comps[-1]["start_date"]}')

print()
print(f'=== STEP 2: Scan WCIFs in batches of 4 with 200ms delay ===')
print(f'  Target WCA ID: {TARGET}')

matches = []
checked = 0
errors = []
BATCH = 4
DELAY = 0.2

for i in range(0, len(comps), BATCH):
    batch = comps[i:i + BATCH]
    if i % 40 == 0:
        print(f'  Progress: {i}/{len(comps)}...')

    for comp in batch:
        cid = comp.get('id')
        try:
            wcif = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions/{cid}/wcif/public', retries=2)
            checked += 1
            persons = wcif.get('persons', [])
            for p in persons:
                if isinstance(p, dict) and p.get('wcaId') == TARGET:
                    reg = p.get('registration', {}) or {}
                    matches.append({
                        'comp_id': cid,
                        'name': comp.get('name'),
                        'start': comp.get('start_date'),
                        'end_date': comp.get('end_date'),
                        'city': comp.get('city'),
                        'country': comp.get('country_iso2'),
                        'status': reg.get('status', 'unknown'),
                        'events': reg.get('eventIds', []),
                        'guests': reg.get('guests', 0),
                    })
                    break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                pass  # No WCIF (registration not open)
            else:
                errors.append((cid, e.code))
        except Exception as e:
            errors.append((cid, type(e).__name__))

    if i + BATCH < len(comps):
        time.sleep(DELAY)

print()
print(f'=== RESULT ===')
print(f'  Checked: {checked} comps (errors: {len(errors)})')
print(f'  Found {TARGET} in {len(matches)} comps:')
for m in matches:
    print(f'    - {m["comp_id"]}: {m["name"]}')
    print(f'        {m["start"]} -> {m["end_date"]} | {m["city"]}, {m["country"]} | status={m["status"]} | events={len(m["events"])}')
