/* ============================================================
   CubingHQ — Motion layer
   ------------------------------------------------------------
   GSAP-powered entrance and scroll animations (gsap.com), with
   graceful degradation:
     - If GSAP fails to load (offline/CDN down), falls back to a
       lightweight IntersectionObserver reveal.
     - Respects prefers-reduced-motion (no animation at all).
   Also drives the cursor spotlight on the bento cards.
   ============================================================ */
(function () {
    'use strict';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- Bento cursor spotlight (cheap, no library) ----------
    function initSpotlight() {
        const grid = document.querySelector('.bento-grid');
        if (!grid) return;
        grid.addEventListener('pointermove', (e) => {
            for (const card of grid.querySelectorAll('.bento-card')) {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            }
        }, { passive: true });
    }

    // ---------- Reveal targets ----------
    const HERO_SEL = '.home-kicker, .home-headline-line, .home-sub, .home-cta-row, .home-fineprint';
    const SCROLL_SEL = '.bento-card';

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => { s.remove(); reject(new Error(`failed: ${src}`)); };
            document.head.appendChild(s);
        });
    }

    async function initGsap() {
        await loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js');
        window.gsap.registerPlugin(window.ScrollTrigger);
        const gsap = window.gsap;

        // Hero entrance — staggered rise.
        const heroEls = document.querySelectorAll(HERO_SEL);
        if (heroEls.length) {
            gsap.from(heroEls, {
                y: 30,
                opacity: 0,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.09,
                clearProps: 'all',
            });
        }

        // Ticker slides in with the hero.
        const marquee = document.querySelector('.wr-marquee');
        if (marquee) {
            gsap.from(marquee, { opacity: 0, duration: 1.1, delay: 0.5, clearProps: 'opacity' });
        }

        // Bento cards rise as they enter the viewport.
        document.querySelectorAll(SCROLL_SEL).forEach((card, i) => {
            gsap.from(card, {
                y: 34,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
                delay: (i % 3) * 0.07,
                clearProps: 'all',
                scrollTrigger: { trigger: card, start: 'top 88%', once: true },
            });
        });

        // Slow parallax drift on the background glows.
        document.querySelectorAll('.bg-glow').forEach((glow, i) => {
            gsap.to(glow, {
                y: (i + 1) * -40,
                ease: 'none',
                scrollTrigger: { trigger: document.body, start: 'top top', end: 'max', scrub: 1.2 },
            });
        });
    }

    // Fallback: simple IntersectionObserver reveal (no dependency).
    function initFallback() {
        const els = document.querySelectorAll(`${HERO_SEL}, ${SCROLL_SEL}`);
        if (!els.length || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    io.unobserve(entry.target);
                }
            }
        }, { rootMargin: '0px 0px -10% 0px' });
        for (const el of els) {
            el.classList.add('pre-reveal');
            io.observe(el);
        }
        // Failsafe: everything visible after 2s no matter what.
        setTimeout(() => els.forEach(el => el.classList.add('revealed')), 2000);
    }

    function init() {
        initSpotlight();
        if (reduced) return;
        initGsap().catch(() => initFallback());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
