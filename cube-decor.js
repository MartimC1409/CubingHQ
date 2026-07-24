/* ============================================================
   CubingHQ — 3D cube decorations
   ------------------------------------------------------------
   Builds lightweight CSS-3D Rubik's cubes (transform-style:
   preserve-3d — no WebGL context, no CDN dependency) into any
   element marked with `.cube-decor`, and parallaxes them
   gently with the scroll position.

   Markup contract:
     <div class="cube-decor cube-decor--a" aria-hidden="true"></div>
   Optional attributes:
     data-cube-scrambled="false"  -> solved colours instead of a
                                     scrambled-looking sticker mix
   ============================================================ */
(function () {
    'use strict';

    // Standard speedcube palette (WCA colour scheme).
    const FACE_COLORS = {
        u: '#f8f8f8', // white
        d: '#ffd500', // yellow
        f: '#00b04f', // green
        b: '#0046ad', // blue
        r: '#c41e3a', // red
        l: '#ff8c00', // orange
    };
    const FACES = ['u', 'd', 'f', 'b', 'r', 'l'];
    const PALETTE = Object.values(FACE_COLORS);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function buildFace(face, scrambled) {
        const el = document.createElement('div');
        el.className = `cube3d-face cube3d-face--${face}`;
        for (let i = 0; i < 9; i++) {
            const sticker = document.createElement('div');
            sticker.className = 'cube3d-sticker';
            // Centre sticker always keeps the face colour (as on a real
            // cube, centres never move) — the rest can be mixed.
            const color = (!scrambled || i === 4)
                ? FACE_COLORS[face]
                : PALETTE[Math.floor(Math.random() * PALETTE.length)];
            sticker.style.setProperty('--c', color);
            el.appendChild(sticker);
        }
        return el;
    }

    function buildCube(scrambled) {
        const cube = document.createElement('div');
        cube.className = 'cube3d';
        for (const face of FACES) cube.appendChild(buildFace(face, scrambled));
        return cube;
    }

    function init() {
        const slots = document.querySelectorAll('.cube-decor');
        if (!slots.length) return;

        slots.forEach(slot => {
            if (slot.dataset.cubeBuilt) return;
            slot.dataset.cubeBuilt = '1';
            slot.setAttribute('aria-hidden', 'true');
            slot.appendChild(buildCube(slot.dataset.cubeScrambled !== 'false'));
        });

        if (reduced) return;

        // Subtle scroll parallax — each cube drifts at its own rate.
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const y = window.scrollY || 0;
                slots.forEach((slot, i) => {
                    const rate = 0.04 + (i % 3) * 0.025;
                    slot.style.setProperty('--cube-parallax', `${(-y * rate).toFixed(1)}px`);
                    slot.style.translate = `0 ${(-y * rate).toFixed(1)}px`;
                });
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.CubeDecor = { init, buildCube };
})();
