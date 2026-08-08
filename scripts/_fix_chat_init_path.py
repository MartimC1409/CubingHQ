#!/usr/bin/env python3
"""Remove the no-op stopBattleChat() call from init/reset path; keep it only at actual room-leave."""
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')

src = Path('app.js').read_text(encoding='utf-8')
original = src

# Both call sites have the form:
#         // Stop chat polling
#         if (typeof stopBattleChat === 'function') stopBattleChat();
# We need to remove ONLY the one inside initBattle() (the first occurrence).
# The second occurrence is the actual room-leave cleanup.

# Strategy: split the file at the first "// Stop chat polling" line.
# The init one is preceded by '// Show lobby (hide room view)' and the actual leave
# one is preceded by code that resets battleState fields.

# Simpler: find the first occurrence and remove ONLY the two lines (comment + call).
import re
matches = list(re.finditer(r'\n[ \t]*// Stop chat polling\n[ \t]*if \(typeof stopBattleChat === \'function\'\) stopBattleChat\(\);', src))
print(f'Found {len(matches)} stopBattleChat call sites.')

if len(matches) < 2:
    print('ERROR: expected 2 sites, found', len(matches))
    sys.exit(1)

# Remove only the first site (init/reset). Keep the second (actual room leave).
first = matches[0]
# The pattern matched the leading \n; we want to keep the line before that \n intact
# but remove from the \n through the end of the second matched line.
removed = src[first.start():first.end()]
print('--- Removing from init path ---')
print(repr(removed))
src = src[:first.start()] + src[first.end():]

# Also remove any trailing blank line that was left over (if present)
# The original had "if (typeof stopBattleChat === 'function') stopBattleChat();\n" followed by
# an empty line before the next non-empty line. We want to leave the structure clean.
# Check what comes right after the removed section:
nxt = src[first.start():first.start()+200]
print('--- After removal (next 200 chars) ---')
print(repr(nxt))

if src != original:
    Path('app.js').write_text(src, encoding='utf-8')
    print('app.js updated.')

# Verify
verify = Path('app.js').read_text(encoding='utf-8')
remaining = re.findall(r'stopBattleChat\(\)', verify)
print(f'Remaining stopBattleChat() references: {len(remaining)} (expected 2: 1 def + 1 call)')
