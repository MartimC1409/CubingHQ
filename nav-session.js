/* ============================================================
   CubingHQ — signed-in state on the standalone pages
   ------------------------------------------------------------
   timer.html and coach.html are pages of their own, not views of
   index.html, so app.js — which restores the session and swaps the
   navbar's Login button for the account picture — never runs on
   them. Their navbar always said "Login", and someone who opened
   the timer while signed in read that as having been signed out.
   They had not: the session was still stored, and going back to
   any other page showed them signed in again.

   This shows the same account button app.js shows, from what the
   browser already holds:
     - our own session token (chq_auth_token), whose payload is
       readable JSON with the name and the expiry — no request
       needed, and an expired one is left as "Login";
     - a WCA sign-in (wca_access_token);
     - the name and picture app.js last showed (chq_nav_profile),
       saved by updateUIAfterLogin purely for this.

   It never removes or changes a credential. Deciding a session is
   invalid is app.js's job, against the server; this only displays.
   ============================================================ */
(function () {
    'use strict';

    const SESSION_KEY = 'chq_auth_token';
    const WCA_KEY = 'wca_access_token';
    const PROFILE_KEY = 'chq_nav_profile';
    // app.js opens the account panel on arrival when this is set, since
    // that is where an email account's picture and sign-out live.
    const OPEN_ACCOUNT_KEY = 'chq_open_account';

    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    /** The claims of one of our session tokens, or null if expired or unreadable. */
    function sessionClaims(token) {
        const parts = String(token || '').split('.');
        if (parts.length !== 3 || parts[0] !== 'v1') return null;
        try {
            const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
            const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
            const claims = JSON.parse(new TextDecoder().decode(bytes));
            if (!claims || typeof claims.exp !== 'number' || claims.exp <= Date.now()) return null;
            return claims;
        } catch (e) {
            return null;
        }
    }

    function cachedProfile() {
        try {
            const p = JSON.parse(read(PROFILE_KEY) || 'null');
            return p && typeof p === 'object' ? p : null;
        } catch (e) { return null; }
    }

    /** Who this browser is signed in as, or null. */
    function signedIn() {
        const cached = cachedProfile();
        const claims = sessionClaims(read(SESSION_KEY));
        if (claims) {
            return {
                name: (cached && cached.name) || claims.name || '',
                picture: cached && cached.picture,
                source: 'email',
                wcaId: claims.wcaId || (cached && cached.wcaId) || null,
            };
        }
        if (read(WCA_KEY)) {
            return {
                name: (cached && cached.name) || '',
                picture: cached && cached.picture,
                source: 'wca',
                wcaId: cached && cached.wcaId,
            };
        }
        return null;
    }

    function initialsOf(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        const first = parts[0][0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase();
    }

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function render() {
        const me = signedIn();
        const login = document.getElementById('nav-login-btn');
        if (!me || !login) return;
        const btn = login.cloneNode(false);   // drops any listener on the Login button
        btn.id = 'nav-profile-btn';
        btn.removeAttribute('data-i18n');
        btn.removeAttribute('data-i18n-title');
        btn.title = me.name || 'Profile';
        btn.setAttribute('aria-label', me.name ? `${me.name} — account` : 'Account');
        btn.innerHTML = me.picture
            ? `<img src="${esc(me.picture)}" alt="" class="nav-avatar">`
            : `<span class="nav-avatar nav-avatar--initials" aria-hidden="true">${esc(initialsOf(me.name))}</span>`;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Same destination the button has on index.html: the account
            // panel for an email account, the statistics view for WCA.
            if (me.source === 'email') {
                try { sessionStorage.setItem(OPEN_ACCOUNT_KEY, '1'); } catch (err) { /* private mode */ }
                window.location.href = 'index.html#home';
            } else {
                window.location.href = 'index.html#stats';
            }
        });
        login.parentNode.replaceChild(btn, login);
    }

    // Placed right after the navbar markup, before the page wires its
    // buttons and before mobile-nav.js moves them, so it runs now.
    render();

    window.NavSession = { signedIn, sessionClaims, PROFILE_KEY, OPEN_ACCOUNT_KEY };
})();
