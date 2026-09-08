/* ============================================================
   CubingHQ — cookie consent banner
   ------------------------------------------------------------
   Loaded after analytics.js, which has already put the Consent
   Mode defaults on the dataLayer (denied in the EEA, the UK and
   Switzerland; granted elsewhere). This file is the thing that
   asks, and turns the answer into a consent update.

   WHY THIS EXISTS ALONGSIDE GOOGLE'S CMP
   --------------------------------------
   Google requires a Google-certified CMP for ad traffic from the
   EEA and the UK. A hand-written banner does not satisfy that
   policy, so AdSense's own GDPR message stays the mechanism for
   ad consent there and this file must not compete with it: two
   banners is worse than one, and the certified one has to win.

   So we look for a certified CMP first — __tcfapi is the TCF v2.2
   entry point every certified CMP must expose, and googlefc is
   Google's own Privacy & messaging. If either turns up we stand
   down entirely and let it do the asking.

   That leaves the case this file is actually for: no certified CMP
   is running (it was never switched on in the AdSense dashboard,
   or it failed to load, or an ad blocker removed it). Without this,
   an EEA visitor would sit on denied defaults forever and never be
   asked — legal, but it means nobody can consent even if they want
   to — and a visitor outside the EEA would have no way to opt out
   at all. This asks, remembers, and can be reopened.

   WHAT IT NEVER DOES
   ------------------
   Reject is exactly as easy as accept, in the same place, at the
   same size. Closing the banner is not consent; there is no X.
   Nothing is granted until a button is pressed. The EDPB has been
   clear that a "dismiss" that means yes is not consent, and dark
   patterns here are the fastest way to turn a cookie banner into
   a complaint.
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'sc-consent';

    // Bump when the categories change, so a stored answer to a
    // different question is not treated as an answer to this one.
    var POLICY_VERSION = 1;

    // How long to wait for a certified CMP to announce itself before
    // deciding there isn't one. Long enough for a slow script on a
    // slow connection, short enough that the banner is not the last
    // thing to appear on the page.
    var CMP_WAIT_MS = 1500;

    var T = function (key, fallback) {
        return (window.AppI18N && window.AppI18N.t) ? window.AppI18N.t(key, fallback) : fallback;
    };

    /* ---- stored answer -------------------------------------- */

    function readChoice() {
        try {
            var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!raw || raw.v !== POLICY_VERSION) return null;
            return { analytics: !!raw.analytics, ads: !!raw.ads, at: raw.at || 0 };
        } catch (e) { return null; }
    }

    function writeChoice(choice) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                v: POLICY_VERSION,
                analytics: !!choice.analytics,
                ads: !!choice.ads,
                at: Date.now(),
            }));
        } catch (e) { /* private mode: the choice holds for this page only */ }
    }

    /* ---- telling Google ------------------------------------- */

    function apply(choice) {
        if (typeof window.gtag !== 'function') return;
        window.gtag('consent', 'update', {
            ad_storage: choice.ads ? 'granted' : 'denied',
            ad_user_data: choice.ads ? 'granted' : 'denied',
            ad_personalization: choice.ads ? 'granted' : 'denied',
            analytics_storage: choice.analytics ? 'granted' : 'denied',
        });
    }

    /* ---- is a certified CMP already handling this? ---------- */

    function certifiedCmpPresent() {
        return typeof window.__tcfapi === 'function' || !!window.googlefc;
    }

    function whenCmpSettled(done) {
        if (certifiedCmpPresent()) return done(true);
        var waited = 0;
        var step = 100;
        var timer = setInterval(function () {
            waited += step;
            if (certifiedCmpPresent()) { clearInterval(timer); done(true); }
            else if (waited >= CMP_WAIT_MS) { clearInterval(timer); done(false); }
        }, step);
    }

    /* ---- the banner ----------------------------------------- */

    var el = null;
    var lastFocused = null;

    function build() {
        if (el) return el;

        el = document.createElement('div');
        el.className = 'cc-banner';
        el.id = 'cookie-consent';
        // A dialog, not an alert: it asks a question and takes focus.
        // The modal flag is deliberately NOT set, and Tab is not trapped —
        // the page behind stays usable, because a cookie question must not
        // hold the site hostage while it is unanswered. Someone who wants
        // to read the cookie policy before answering has to be able to
        // tab to the link to it.
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-labelledby', 'cc-title');
        el.setAttribute('aria-describedby', 'cc-body');

        el.innerHTML =
            '<div class="cc-inner">' +
              '<div class="cc-text">' +
                '<h2 class="cc-title" id="cc-title">' + T('cc.title', 'Cookies on CubingHQ') + '</h2>' +
                '<p class="cc-body" id="cc-body">' +
                  T('cc.body', 'We need cookies for measurement and advertising, which pay for the site. ' +
                    'Nothing is set until you choose. The timer, your sessions and your settings work either way — ' +
                    'they are stored on your device and never needed your permission.') +
                  ' <a href="/cookies.html">' + T('cc.readMore', 'Cookie Policy') + '</a>' +
                '</p>' +
                '<div class="cc-options" id="cc-options" hidden>' +
                  '<label class="cc-option cc-option--locked">' +
                    '<input type="checkbox" checked disabled>' +
                    '<span><strong>' + T('cc.cat.necessary', 'Strictly necessary') + '</strong><br>' +
                    T('cc.cat.necessaryDesc', 'Your theme, language, timer sessions and sign-in. Always on — the site cannot work without them, and they are never used to track you.') +
                    '</span>' +
                  '</label>' +
                  '<label class="cc-option">' +
                    '<input type="checkbox" id="cc-analytics">' +
                    '<span><strong>' + T('cc.cat.analytics', 'Analytics') + '</strong><br>' +
                    T('cc.cat.analyticsDesc', 'Google Analytics, so we can see which pages get used and which are broken.') +
                    '</span>' +
                  '</label>' +
                  '<label class="cc-option">' +
                    '<input type="checkbox" id="cc-ads">' +
                    '<span><strong>' + T('cc.cat.ads', 'Advertising') + '</strong><br>' +
                    T('cc.cat.adsDesc', 'Google AdSense. Turn this off and you still see ads — they are just chosen without your browsing history.') +
                    '</span>' +
                  '</label>' +
                '</div>' +
              '</div>' +
              '<div class="cc-actions">' +
                '<button type="button" class="cc-btn cc-btn--primary" id="cc-accept">' + T('cc.acceptAll', 'Accept all') + '</button>' +
                '<button type="button" class="cc-btn cc-btn--primary" id="cc-reject">' + T('cc.rejectAll', 'Reject all') + '</button>' +
                '<button type="button" class="cc-btn cc-btn--ghost" id="cc-manage">' + T('cc.manage', 'Choose') + '</button>' +
                '<button type="button" class="cc-btn cc-btn--ghost" id="cc-save" hidden>' + T('cc.save', 'Save choices') + '</button>' +
              '</div>' +
            '</div>';

        document.body.appendChild(el);

        var options = el.querySelector('#cc-options');
        var manage = el.querySelector('#cc-manage');
        var save = el.querySelector('#cc-save');

        manage.addEventListener('click', function () {
            options.hidden = false;
            manage.hidden = true;
            save.hidden = false;
            var first = el.querySelector('#cc-analytics');
            if (first) first.focus();
        });

        el.querySelector('#cc-accept').addEventListener('click', function () {
            decide({ analytics: true, ads: true });
        });
        el.querySelector('#cc-reject').addEventListener('click', function () {
            decide({ analytics: false, ads: false });
        });
        save.addEventListener('click', function () {
            decide({
                analytics: el.querySelector('#cc-analytics').checked,
                ads: el.querySelector('#cc-ads').checked,
            });
        });

        // Escape does NOT accept. It is the same as walking away:
        // the banner stays for next time and nothing is granted.
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); hide(); }
        });

        return el;
    }

    function show(existing) {
        build();
        if (existing) {
            var a = el.querySelector('#cc-analytics');
            var b = el.querySelector('#cc-ads');
            if (a) a.checked = existing.analytics;
            if (b) b.checked = existing.ads;
        }
        lastFocused = document.activeElement;
        el.classList.add('cc-open');
        // Focus the heading rather than a button, so a screen reader
        // reads the question before it reads the answers.
        var title = el.querySelector('#cc-title');
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
    }

    function hide() {
        if (!el) return;
        el.classList.remove('cc-open');
        if (lastFocused && document.contains(lastFocused)) {
            lastFocused.focus({ preventScroll: true });
        }
        lastFocused = null;
    }

    function decide(choice) {
        writeChoice(choice);
        apply(choice);
        hide();
    }

    /* ---- boot ----------------------------------------------- */

    function start() {
        var stored = readChoice();

        // A previous answer is re-applied on every page, because
        // Consent Mode defaults reset with each page load.
        if (stored) apply(stored);

        whenCmpSettled(function (certified) {
            // A certified CMP owns the question. Ours would be a
            // second banner asking the same thing with less authority.
            if (certified) return;
            if (!stored) show(null);
        });
    }

    /* ---- the always-available way back ----------------------- */

    window.CubingConsent = {
        /** Reopens the banner. Wired to the "Cookie settings" footer link. */
        reopen: function () {
            if (typeof window.__tcfapi === 'function' && window.googlefc
                && window.googlefc.showRevocationMessage) {
                // Hand back to the certified CMP if it is the one that asked.
                try { window.googlefc.showRevocationMessage(); return; } catch (e) { /* fall through */ }
            }
            show(readChoice());
        },
        /** The stored answer, or null if nobody has been asked yet. */
        get: readChoice,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
