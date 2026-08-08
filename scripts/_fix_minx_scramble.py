# -*- coding: utf-8 -*-
"""Fix the megaminx scramble: add a proper WCA-compliant generator.

Previous bug: `MOVES.minx` had only 5 faces and 2 modifiers (++/--), and there was
no dedicated `generateMinxScramble()`. The generic 3x3-style generator produced
garbage like "U-- D++ L-- ..." with no face/opposite constraints, which is an
invalid megaminx scramble.

Fix: add `generateMinxScramble()` that produces a proper 77-move WCA megaminx
scramble using 12 faces and 2 modifiers (++/--), with the standard constraints:
- No two consecutive moves on the same face
- No two consecutive moves on opposite faces
"""
from pathlib import Path

JS = Path(r'D:\AI-TESTE\app.js')
src = JS.read_text(encoding='utf-8')

# 1. Replace the broken MOVES.minx entry with a comment that points to the new generator
OLD_MOVES = """        'minx': { faces: ['U', 'R', 'D', 'L', 'F'], modifiers: ['++', '--'], length: 77 },"""
NEW_MOVES = """        // 'minx' uses a dedicated generator (see generateMinxScramble below) — WCA-compliant 77-move scramble
        'minx': null,"""
if OLD_MOVES not in src:
    raise SystemExit('FATAL: MOVES.minx anchor not found')
src = src.replace(OLD_MOVES, NEW_MOVES, 1)

# 2. Update generateScramble to route minx to the dedicated generator
OLD_GEN = """    function generateScramble(event) {
        if (event === 'sq1') return generateSQ1Scramble();
        if (event === 'clock') return generateClockScramble();

        const config = MOVES[event] || MOVES['333'];"""
NEW_GEN = """    function generateScramble(event) {
        if (event === 'sq1') return generateSQ1Scramble();
        if (event === 'clock') return generateClockScramble();
        if (event === 'minx') return generateMinxScramble();

        const config = MOVES[event] || MOVES['333'];"""
if OLD_GEN not in src:
    raise SystemExit('FATAL: generateScramble anchor not found')
src = src.replace(OLD_GEN, NEW_GEN, 1)

# 3. Insert the dedicated generateMinxScramble() right after generateClockScramble()
# Anchor: the closing brace of generateClockScramble followed by a blank line and the generateCompetitors comment
OLD_ANCHOR = """        return moves.join(' ');
    }

    // ========== COMPETITOR GENERATION =========="""
NEW_ANCHOR = """        return moves.join(' ');
    }

    // WCA-compliant Megaminx scramble: 77 moves, 12 faces, 2 modifiers (++/--).
    // Constraints: no two consecutive moves on the same face, no two consecutive
    // moves on opposite faces. Standard 12-face set: R, D, L, U, F, BL, BR, FL,
    // FR, B, DL, DR. Opposite pairs are the standard WCA pairing.
    function generateMinxScramble() {
        const faces = ['R', 'D', 'L', 'U', 'F', 'BL', 'BR', 'FL', 'FR', 'B', 'DL', 'DR'];
        const opposite = {
            'R': 'L', 'L': 'R',
            'D': 'U', 'U': 'D',
            'F': 'B', 'B': 'F',
            'FL': 'BR', 'BR': 'FL',
            'FR': 'BL', 'BL': 'FR',
            'DL': 'DR', 'DR': 'DL'
        };
        const modifiers = ['++', '--'];
        const moves = [];
        let lastFace = '';
        for (let i = 0; i < 77; i++) {
            let face;
            let attempts = 0;
            do {
                face = faces[Math.floor(Math.random() * faces.length)];
                attempts++;
                // Safety valve: if we somehow can't find a valid face after many tries, just use it
                if (attempts > 50) break;
            } while (face === lastFace || face === opposite[lastFace]);
            const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
            moves.push(face + mod);
            lastFace = face;
        }
        return moves.join(' ');
    }

    // ========== COMPETITOR GENERATION =========="""
if OLD_ANCHOR not in src:
    raise SystemExit('FATAL: anchor for inserting generateMinxScramble not found')
src = src.replace(OLD_ANCHOR, NEW_ANCHOR, 1)

JS.write_text(src, encoding='utf-8', newline='')

# Sanity check
n_open = src.count('{')
n_close = src.count('}')
print(f'  Brace balance: {{ {n_open}   }} {n_close}   delta={n_open - n_close}')
for needle in ['generateMinxScramble', "'minx': null", "if (event === 'minx') return generateMinxScramble()", "const opposite = {", "R: 'L'"]:
    print(f'  {needle!r:55s} : {src.count(needle)} hit(s)')
print(f'  New size: {len(src)} bytes')
print('OK')
