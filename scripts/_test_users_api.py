# -*- coding: utf-8 -*-
"""Test the /users/{wcaId}?upcoming_competitions=true endpoint with proper UTF-8."""
import urllib.request
import urllib.error
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

UA = {'User-Agent': 'Mozilla/5.0 (SimulateCubing-Debug)'}

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return json.loads(raw.decode('utf-8'))

def show(name, d, max_list_items=2, max_str_len=200):
    print(f'=== {name} ===')
    print(f'  Type: {type(d).__name__}')
    if isinstance(d, dict):
        print(f'  Top keys: {list(d.keys())}')
        for k, v in d.items():
            if isinstance(v, list):
                print(f'    {k}: list[{len(v)}]')
                if v and isinstance(v[0], dict):
                    print(f'      first item keys: {list(v[0].keys())}')
                    s = json.dumps(v[0], ensure_ascii=False)
                    print(f'      first item (truncated): {s[:max_str_len]}')
            elif isinstance(v, dict):
                print(f'    {k}: dict({list(v.keys())[:10]})')
                if k in ('user', 'upcoming_competitions', 'ongoing_competitions'):
                    s = json.dumps(v, ensure_ascii=False)
                    print(f'      content (truncated): {s[:max_str_len]}')
            else:
                s = repr(v)
                print(f'    {k}: {s[:max_str_len]}')
    print()

print('=== TEST 1: 2023CARV02 with full filters ===')
try:
    d = fetch_json('https://www.worldcubeassociation.org/api/v0/users/2023CARV02?upcoming_competitions=true&ongoing_competitions=true')
    show('2023CARV02 (full)', d)
except Exception as e:
    print(f'  ERROR: {e}\n')

print('=== TEST 2: 2010ZEMD01 (Feliks) with full filters ===')
try:
    d = fetch_json('https://www.worldcubeassociation.org/api/v0/users/2010ZEMD01?upcoming_competitions=true&ongoing_competitions=true')
    show('2010ZEMD01 (full)', d)
except Exception as e:
    print(f'  ERROR: {e}\n')

print('=== TEST 3: 2023CARV02 with NO filters (baseline) ===')
try:
    d = fetch_json('https://www.worldcubeassociation.org/api/v0/users/2023CARV02')
    show('2023CARV02 (no filters)', d)
except Exception as e:
    print(f'  ERROR: {e}\n')

print('=== TEST 4: 2023CARV02 with ONLY upcoming_competitions ===')
try:
    d = fetch_json('https://www.worldcubeassociation.org/api/v0/users/2023CARV02?upcoming_competitions=true')
    show('2023CARV02 (upcoming only)', d)
except Exception as e:
    print(f'  ERROR: {e}\n')

print('=== TEST 5: 2009PARK01 (Max Park) with full filters ===')
try:
    d = fetch_json('https://www.worldcubeassociation.org/api/v0/users/2009PARK01?upcoming_competitions=true&ongoing_competitions=true')
    show('2009PARK01 (full)', d)
except Exception as e:
    print(f'  ERROR: {e}\n')
