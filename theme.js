/* ============================================================
   CubingHQ — theme
   ------------------------------------------------------------
   Two independent axes on <html>:

     data-theme   dark | light      (appearance)
     data-accent  orange | green | blue | red

   Keeping them separate means four accents work in both light and
   dark rather than being four more one-off palettes.

   The saved choice is applied by a tiny inline snippet in each
   page <head> so there is no flash of the wrong colours; this
   module owns the picker and the persistence.
   ============================================================ */
(function () {
    'use strict';

    const MODE_KEY = 'sc-theme';
    const ACCENT_KEY = 'sc-accent';

    const MODES = ['dark', 'light'];
    const ACCENTS = ['orange', 'green', 'blue', 'red'];
    const DEFAULT_MODE = 'dark';
    const DEFAULT_ACCENT = 'orange';

    // Swatches for the picker, matching the resolved --clr-primary of
    // each accent so the dot shows the colour you actually get.
    const SWATCH = {
        orange: '#D04600',
        green: '#008231',
        blue: '#006CD8',
        red: '#CC3336',
    };

    const T = (key, fallback) =>
        (window.AppI18N ? window.AppI18N.t(key, fallback) : fallback);

    const read = (key, allowed, fallback) => {
        let v = null;
        try { v = localStorage.getItem(key); } catch (e) { /* private mode */ }
        return allowed.indexOf(v) !== -1 ? v : fallback;
    };

    const write = (key, value) => {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    };

    function getMode() { return read(MODE_KEY, MODES, DEFAULT_MODE); }
    function getAccent() { return read(ACCENT_KEY, ACCENTS, DEFAULT_ACCENT); }

    function apply(mode, accent) {
        const root = document.documentElement;
        root.setAttribute('data-theme', mode);
        root.setAttribute('data-accent', accent);
        // Keep the installed-app status bar and browser chrome in step.
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', mode === 'light' ? '#f7f7f7' : '#09090b');
        }
        document.dispatchEvent(new CustomEvent('app-theme-changed', {
            detail: { mode, accent },
        }));
    }

    function setMode(mode) {
        if (MODES.indexOf(mode) === -1) return;
        write(MODE_KEY, mode);
        apply(mode, getAccent());
        render();
    }

    function setAccent(accent) {
        if (ACCENTS.indexOf(accent) === -1) return;
        write(ACCENT_KEY, accent);
        apply(getMode(), accent);
        render();
    }

    function toggleMode() {
        setMode(getMode() === 'dark' ? 'light' : 'dark');
    }

    // ---------- picker ----------

    let popover = null;
    let backdrop = null;
    let trigger = null;
    let lastFocused = null;

    function build() {
        if (popover) return;

        backdrop = document.createElement('div');
        backdrop.className = 'theme-pop-backdrop';
        backdrop.hidden = true;
        backdrop.addEventListener('click', close);

        popover = document.createElement('div');
        popover.className = 'theme-pop';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-modal', 'true');
        popover.setAttribute('aria-labelledby', 'theme-pop-title');
        popover.hidden = true;

        document.body.appendChild(backdrop);
        document.body.appendChild(popover);
    }

    function render() {
        if (!popover) return;
        const mode = getMode();
        const accent = getAccent();

        popover.innerHTML = `
            <h2 class="theme-pop-title" id="theme-pop-title" data-i18n="theme.title">${T('theme.title', 'Theme')}</h2>

            <span class="theme-pop-label" data-i18n="theme.appearance">${T('theme.appearance', 'Appearance')}</span>
            <div class="theme-mode-group" role="group" aria-label="${T('theme.appearance', 'Appearance')}">
                ${MODES.map(m => `
                    <button type="button" class="theme-mode-btn${m === mode ? ' active' : ''}"
                            data-mode="${m}" aria-pressed="${m === mode}">
                        ${m === 'dark' ? MOON : SUN}
                        <span data-i18n="theme.${m}">${T('theme.' + m, m === 'dark' ? 'Dark' : 'Light')}</span>
                    </button>`).join('')}
            </div>

            <span class="theme-pop-label" data-i18n="theme.accent">${T('theme.accent', 'Accent')}</span>
            <div class="theme-accent-group" role="group" aria-label="${T('theme.accent', 'Accent')}">
                ${ACCENTS.map(a => `
                    <button type="button" class="theme-accent-btn${a === accent ? ' active' : ''}"
                            data-accent-choice="${a}" aria-pressed="${a === accent}"
                            title="${T('theme.' + a, a)}">
                        <span class="theme-swatch" style="background:${SWATCH[a]}"></span>
                        <span class="theme-accent-name" data-i18n="theme.${a}">${T('theme.' + a, a)}</span>
                    </button>`).join('')}
            </div>
        `;

        popover.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });
        popover.querySelectorAll('[data-accent-choice]').forEach(btn => {
            btn.addEventListener('click', () => setAccent(btn.dataset.accentChoice));
        });
    }

    const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    function isOpen() { return popover && !popover.hidden; }

    function open(fromEl) {
        build();
        render();
        if (isOpen()) return;
        lastFocused = fromEl || document.activeElement;
        trigger = fromEl || null;
        backdrop.hidden = false;
        popover.hidden = false;
        position();
        void popover.offsetHeight;
        backdrop.classList.add('open');
        popover.classList.add('open');
        const first = popover.querySelector('button');
        (first || popover).focus({ preventScroll: true });
        document.addEventListener('keydown', onKeydown, true);
        window.addEventListener('resize', position);
    }

    function close() {
        if (!isOpen()) return;
        backdrop.classList.remove('open');
        popover.classList.remove('open');
        document.removeEventListener('keydown', onKeydown, true);
        window.removeEventListener('resize', position);
        setTimeout(() => { popover.hidden = true; backdrop.hidden = true; }, 200);
        if (lastFocused && document.contains(lastFocused)) {
            lastFocused.focus({ preventScroll: true });
        }
        lastFocused = null;
    }

    // Anchored under the trigger on desktop; the stylesheet turns it into a
    // bottom sheet on small screens, where these offsets are ignored.
    function position() {
        if (!popover || !trigger) return;
        const r = trigger.getBoundingClientRect();
        const width = popover.offsetWidth || 240;
        const left = Math.min(
            Math.max(8, r.left + r.width / 2 - width / 2),
            window.innerWidth - width - 8
        );
        popover.style.top = Math.round(r.bottom + 10) + 'px';
        popover.style.left = Math.round(left) + 'px';
    }

    function onKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        const items = popover.querySelectorAll('button');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    // ---------- wiring ----------

    function init() {
        // The head snippet already applied the attributes; re-assert in case
        // a page lacks it, then hook the existing toggle up to the picker.
        apply(getMode(), getAccent());

        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.setAttribute('aria-haspopup', 'dialog');
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isOpen() ? close() : open(toggle);
            });
            toggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    isOpen() ? close() : open(toggle);
                }
            });
        }

        document.addEventListener('app-language-changed', render);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.AppTheme = {
        getMode, getAccent, setMode, setAccent, toggleMode,
        open, close, MODES, ACCENTS,
    };
})();
