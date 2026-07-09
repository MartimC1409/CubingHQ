# -*- coding: utf-8 -*-
"""Verify WCA WCIF endpoint + scan for 2023CARV02's upcoming registrations."""
import urllib.request
import urllib.error
import json
import sys
from datetime import date, timedelta

# Force UTF-8 stdout for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

UA = {'User-Agent': 'Mozilla/5.0 (SimulateCubing-Debug)'}

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return json.loads(raw.decode('utf-8'))

print('=== STEP 1: Sample upcoming comps ===')
today = date.today().isoformat()
end = (date.today() + timedelta(days=120)).isoformat()
upcoming = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions?start={today}&end={end}&per_page=10')
print(f'  Got {len(upcoming)} upcoming comps in next 120 days')
for c in upcoming[:3]:
    print(f'    - {c["id"]}: {c["name"]} ({c["start_date"]} - {c["end_date"]})')

print()
print('=== STEP 2: WCIF structure for first upcoming comp ===')
sample_id = upcoming[0]['id'] if upcoming else None
if sample_id:
    wcif = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions/{sample_id}/wcif/public')
    print(f'  top-level keys: {list(wcif.keys())}')
    persons = wcif.get('persons', [])
    print(f'  persons: type={type(persons).__name__}, len={len(persons)}')
    if persons:
        p0 = persons[0]
        print(f'  first person keys: {list(p0.keys()) if isinstance(p0, dict) else type(p0)}')
        print(f'  first person: {json.dumps(p0, ensure_ascii=False)[:400]}')
    # Count statuses
    statuses = {}
    for p in persons:
        if isinstance(p, dict):
            s = p.get('status', 'unknown')
            statuses[s] = statuses.get(s, 0) + 1
    print(f'  status distribution: {statuses}')

print()
print('=== STEP 3: Confirm 2023CARV02 has 3 upcoming comps (scan next 90 days) ===')
scan_end = (date.today() + timedelta(days=90)).isoformat()
comps = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions?start={today}&end={scan_end}&per_page=100')
print(f'  Scanning {len(comps)} comps in next 90 days for WCA ID 2023CARV02...')

TARGET = '2023CARV02'
matches = []
checked = 0
errors = 0
for c in comps:
    cid = c.get('id')
    if not cid:
        continue
    try:
        wcif = fetch_json(f'https://www.worldcubeassociation.org/api/v0/competitions/{cid}/wcif/public', timeout=15)
        checked += 1
        for p in wcif.get('persons', []):
            if isinstance(p, dict) and p.get('wcaId') == TARGET:
                matches.append({
                    'comp_id': cid,
                    'name': c.get('name'),
                    'start': c.get('start_date'),
                    'status': p.get('status'),
                    'events': [e.get('eventId') if isinstance(e, dict) else e for e in p.get('eventIds', p.get('assignments', []))],
                })
                break
    except urllib.error.HTTPError as e:
        errors += 1
        if e.code == 404:
            pass  # No WCIF for this comp
        else:
            print(f'  {cid}: HTTP {e.code}')
    except Exception as e:
        errors += 1
        print(f'  {cid}: {type(e).__name__}: {e}')

print(f'\n  RESULT: found 2023CARV02 in {len(matches)} comps (checked {checked}, errors {errors})')
for m in matches:
    print(f'    - {m["comp_id"]}: {m["name"]} ({m["start"]}) status={m["status"]}')
