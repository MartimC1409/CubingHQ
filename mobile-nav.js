/* ============================================================
   CubingHQ — mobile tab bar
   ------------------------------------------------------------
   On phones the nav is a fixed bottom bar. Nine items in that bar
   meant a sideways scroll, so below 850px we keep four primary
   tabs plus a "More" tab that opens a bottom sheet holding the
   rest.

   The secondary buttons are MOVED, never cloned: app.js and
   timer.html have already attached click handlers to those exact
   nodes, and moving a node keeps its listeners. Cloning would
   silently drop them.

   Above the breakpoint everything is put back where it was, so the
   desktop nav is untouched.
   ============================================================ */
(function () {
    'use strict';

    const BREAKPOINT = 850;

    // The tabs that stay in the bar, in display order. Four plus "More"
    // is all that fits without the row scrolling sideways.
    //
    // Coach leads: it is the product, not one tool among nine. Records
    // moved to the sheet to make room — it is a reference lookup, not
    // something reached for mid-session.
    const PRIMARY_IDS = [
        'nav-coach-btn',
        'nav-home-btn',
        'nav-timer-btn',
        'nav-simulation-btn',
    ];

    const MORE_ID = 'nav-more-btn';

    // Short tile labels for icon-only controls, whose accessible names are
    // written for screen readers ("Toggle light/dark theme") and read as
    // clutter under an icon.
    const SHORT_LABELS = {
        'theme-toggle': ['nav.theme', 'Theme'],
    };

    const MORE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

    let navLinks = null;
    let sheet = null;
    let sheetItems = null;
    let backdrop = null;
    let moreBtn = null;
    let originalOrder = [];
    let originalParent = null;
    let originalNextSibling = null;
    let applied = false;
    let lastFocused = null;
    let observer = null;

    const T = (key, fallback) =>
        (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);

    const isPrimary = (el) =>
        PRIMARY_IDS.indexOf(el.id) !== -1 || el.id === MORE_ID;

    // ---------- sheet ----------

    function buildSheet() {
        if (sheet) return;

        backdrop = document.createElement('div');
        backdrop.className = 'mnav-backdrop';
        backdrop.hidden = true;

        sheet = document.createElement('div');
        sheet.className = 'mnav-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-labelledby', 'mnav-sheet-title');
        sheet.hidden = true;

        const grip = document.createElement('div');
        grip.className = 'mnav-sheet-grip';
        grip.setAttribute('aria-hidden', 'true');

        const title = document.createElement('h2');
        title.id = 'mnav-sheet-title';
        title.className = 'mnav-sheet-title';
        title.setAttribute('data-i18n', 'nav.more');
        title.textContent = T('nav.more', 'More');

        sheetItems = document.createElement('div');
        sheetItems.className = 'mnav-sheet-items';

        sheet.appendChild(grip);
        sheet.appendChild(title);
        sheet.appendChild(sheetItems);

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);

        backdrop.addEventListener('click', closeSheet);
        // Any choice inside the sheet dismisses it.
        sheetItems.addEventListener('click', (e) => {
            if (e.target.closest('button, a')) closeSheet();
        });
    }

    function isSheetOpen() {
        return sheet && !sheet.hidden;
    }

    function openSheet() {
        if (!sheet || isSheetOpen()) return;
        lastFocused = document.activeElement;
        backdrop.hidden = false;
        sheet.hidden = false;
        // Reflow so the transition runs from the closed state.
        void sheet.offsetHeight;
        backdrop.classList.add('open');
        sheet.classList.add('open');
        document.body.style.overflow = 'hidden';
        moreBtn && moreBtn.setAttribute('aria-expanded', 'true');

        const first = sheetItems.querySelector('button, a');
        (first || sheet).focus({ preventScroll: true });

        document.addEventListener('keydown', onKeydown, true);
    }

    function closeSheet() {
        if (!isSheetOpen()) return;
        backdrop.classList.remove('open');
        sheet.classList.remove('open');
        document.body.style.overflow = '';
        moreBtn && moreBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onKeydown, true);

        const done = () => { sheet.hidden = true; backdrop.hidden = true; };
        // Match the CSS transition, but never leave it open if that never fires.
        setTimeout(done, 260);

        if (lastFocused && document.contains(lastFocused)) {
            lastFocused.focus({ preventScroll: true });
        }
        lastFocused = null;
    }

    function onKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSheet();
            return;
        }
        if (e.key !== 'Tab') return;

        const focusables = sheet.querySelectorAll(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // ---------- layout ----------

    function ensureMoreButton() {
        if (moreBtn && document.contains(moreBtn)) return;
        moreBtn = document.createElement('button');
        moreBtn.id = MORE_ID;
        moreBtn.className = 'nav-btn mnav-more-btn';
        moreBtn.type = 'button';
        moreBtn.setAttribute('aria-haspopup', 'dialog');
        moreBtn.setAttribute('aria-expanded', 'false');
        // i18n.js translates this the same way as the markup nav buttons.
        moreBtn.setAttribute('data-i18n', 'nav.more');
        moreBtn.addEventListener('click', () => {
            isSheetOpen() ? closeSheet() : openSheet();
        });
        renderMoreLabel();
    }

    function renderMoreLabel() {
        if (!moreBtn) return;
        const label = T('nav.more', 'More');
        moreBtn.title = label;
        // A bare text node, not a <span>: style.css hides `.nav-btn span` on
        // very small screens, and i18n's setText() writes into the last text
        // node — which is how the markup nav buttons work.
        moreBtn.innerHTML = MORE_ICON;
        moreBtn.appendChild(document.createTextNode(label));
    }

    // The bar is `position: fixed; bottom: 0`, which only means "the bottom of
    // the screen" while no ancestor is a containing block for fixed children.
    // On timer.html the nav sits inside .cs-fixed-navbar, and that element has
    // a backdrop-filter — which makes it exactly such a containing block, so
    // the bar was anchoring to the navbar at the top of the page and the Home
    // tab ended up off-screen. Hoisting the bar to <body> on mobile makes both
    // pages behave identically, and stays correct if a transform, filter or
    // will-change is ever added to an ancestor.
    function hoistBar() {
        if (!navLinks || navLinks.parentElement === document.body) return;
        originalParent = navLinks.parentElement;
        originalNextSibling = navLinks.nextSibling;
        document.body.appendChild(navLinks);
    }

    function restoreBar() {
        if (!navLinks || !originalParent) return;
        if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
            originalParent.insertBefore(navLinks, originalNextSibling);
        } else {
            originalParent.appendChild(navLinks);
        }
        originalParent = null;
        originalNextSibling = null;
    }

    function apply() {
        if (applied || !navLinks) return;
        buildSheet();
        ensureMoreButton();
        hoistBar();

        Array.prototype.slice.call(navLinks.children).forEach((el) => {
            if (!isPrimary(el)) {
                sheetItems.appendChild(el);
                labelSheetItem(el);
            }
        });
        navLinks.appendChild(moreBtn);

        document.body.classList.add('has-mobile-tabs');
        applied = true;
        syncMoreActive();
    }

    // The theme toggle is an icon with no text of its own, so in a grid of
    // labelled tiles it would read as broken. Give any icon-only item a label
    // from the accessible name the markup already carries.
    function labelSheetItem(el) {
        if (el.dataset.mnavLabelled === '1') return;
        // textContent, not innerText: the language toggle's own label sits in a
        // span that small-screen CSS hides, and it must not be double-labelled.
        if (el.textContent && el.textContent.trim()) return;

        const short = SHORT_LABELS[el.id];
        const text = short
            ? T(short[0], short[1])
            : (el.getAttribute('aria-label') || el.title || '');
        if (!text) return;

        const span = document.createElement('span');
        span.className = 'mnav-item-label';
        if (short) span.setAttribute('data-i18n', short[0]);
        span.textContent = text;
        el.appendChild(span);
        el.dataset.mnavLabelled = '1';
    }

    function unapply() {
        if (!applied || !navLinks) return;
        closeSheet();
        if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn);

        // Put every item back in its original document order, dropping the
        // labels we added for the sheet so the desktop icons stay icons.
        originalOrder.forEach((el) => {
            if (!document.contains(el)) return;
            if (el.dataset.mnavLabelled === '1') {
                const label = el.querySelector('.mnav-item-label');
                if (label) label.remove();
                delete el.dataset.mnavLabelled;
            }
            navLinks.appendChild(el);
        });

        restoreBar();
        document.body.classList.remove('has-mobile-tabs');
        applied = false;
    }

    // app.js marks the real button active; when that button lives in the
    // sheet, light up More so the bar never looks unselected.
    function syncMoreActive() {
        if (!applied || !moreBtn || !sheetItems) return;
        const active = sheetItems.querySelector('.nav-btn.active');
        moreBtn.classList.toggle('active', !!active);
    }

    function evaluate() {
        const shouldApply = window.innerWidth <= BREAKPOINT;
        if (shouldApply) apply();
        else unapply();
    }

    // ---------- init ----------

    function init() {
        navLinks = document.getElementById('nav-links');
        if (!navLinks) return;

        originalOrder = Array.prototype.slice.call(navLinks.children);

        evaluate();

        window.addEventListener('resize', evaluate);

        // The language toggle is injected by i18n.js and may land after this
        // runs; relocate anything that shows up in the bar later.
        observer = new MutationObserver((records) => {
            if (!applied) { originalOrder = mergeOrder(); return; }
            let moved = false;
            records.forEach((rec) => {
                Array.prototype.slice.call(rec.addedNodes).forEach((node) => {
                    if (node.nodeType !== 1 || isPrimary(node)) return;
                    if (node.parentNode === navLinks) {
                        sheetItems.appendChild(node);
                        moved = true;
                    }
                });
            });
            if (moved) originalOrder = mergeOrder();
        });
        observer.observe(navLinks, { childList: true });

        // Active state is toggled by app.js on navigation.
        const activeWatcher = new MutationObserver(syncMoreActive);
        activeWatcher.observe(navLinks, {
            attributes: true, attributeFilter: ['class'], subtree: true,
        });
        if (sheetItems) {
            activeWatcher.observe(sheetItems, {
                attributes: true, attributeFilter: ['class'], subtree: true,
            });
        }
        window.addEventListener('hashchange', syncMoreActive);

        document.addEventListener('app-language-changed', () => {
            renderMoreLabel();
            const title = document.getElementById('mnav-sheet-title');
            if (title) title.textContent = T('nav.more', 'More');
        });
    }

    // Keep a stable restore order that includes anything added later.
    function mergeOrder() {
        const seen = new Set(originalOrder);
        const extra = [];
        if (sheetItems) {
            Array.prototype.slice.call(sheetItems.children).forEach((el) => {
                if (!seen.has(el)) extra.push(el);
            });
        }
        return originalOrder.concat(extra);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MobileNav = { open: openSheet, close: closeSheet, refresh: evaluate };
})();
