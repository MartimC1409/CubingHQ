#!/usr/bin/env python3
"""Remove the no-op stopBattleChat() call from the init/reset path in app.js.

The actual format (verified) is just:
        // Stop chat polling
        stopBattleChat();

Two sites exist:
  - L3522-3523 in initBattle() (reset path) — REMOVE
  - L4087-4088 in actual room-leave handler — KEEP
"""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('app.js').read_text(encoding='utf-8')
lines = src.split('\n')

# Find both sites by looking for the comment + call pattern
sites = []
for i, l in enumerate(lines):
    if 'Stop chat polling' in l:
        # Check the next line is the call
        if i+1 < len(lines) and 'stopBattleChat()' in lines[i+1]:
            sites.append(i)

print(f'Found {len(sites)} "Stop chat polling" sites at lines: {[s+1 for s in sites]}')

if len(sites) != 2:
    print(f'ERROR: expected 2 sites, got {len(sites)}')
    sys.exit(1)

# Remove the first site only (init path)
first_idx = sites[0]
print(f'Removing lines {first_idx+1}-{first_idx+2} (init path)')
del lines[first_idx:first_idx+2]

# Write back
Path('app.js').write_text('\n'.join(lines), encoding='utf-8')

# Verify
verify = Path('app.js').read_text(encoding='utf-8')
remaining = verify.count('stopBattleChat()')
print(f'Remaining stopBattleChat() refs: {remaining} (expected 2: 1 def + 1 call)')
