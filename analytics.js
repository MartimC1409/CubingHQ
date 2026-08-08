/* ============================================================
   CubingHQ — consent signalling + Google Analytics bootstrap
   ------------------------------------------------------------
   Loaded synchronously from <head> on every page, BEFORE the gtag
   and AdSense tags. Order is the whole point: Consent Mode only
   works if the defaults are on the dataLayer before Google's tags
   read them, which is why this file is not async/defer.

   What it does NOT do: show a consent banner. Google requires a
   certified CMP for EEA/UK ad traffic, so the banner itself is
   Google's own GDPR message, enabled in AdSense under
   Privacy & messaging. That message calls gtag('consent','update',…)
   for us; this file only establishes what holds until it does.

   Defaults are denied in the EEA, the UK and Switzerland and
   granted elsewhere. Setting a blanket global denial would silently
   break analytics for the rest of the world, which is not what the
   policy asks for.
   ============================================================ */
(function () {
    'use strict';

    var GA_MEASUREMENT_ID = 'G-YQSNC2LYVS';

    // EEA + UK + Switzerland, as ISO 3166-1 alpha-2. Google matches the
    // visitor's region against this list and applies the first entry that
    // covers them, falling through to the unscoped default below.
    var CONSENT_REQUIRED_REGIONS = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
        'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL',
        'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH'
    ];

    window.dataLayer = window.dataLayer || [];
    // Must be a real function declaration assigned to the global, not an
    // arrow: Google's own snippets and the CMP both call a global gtag(),
    // and it relies on `arguments`.
    window.gtag = function gtag() { window.dataLayer.push(arguments); };

    // Denied where consent is legally required...
    window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        region: CONSENT_REQUIRED_REGIONS,
        // Give the CMP half a second to answer before any tag decides it is
        // running without consent; without this the first pageview races it.
        wait_for_update: 500
    });

    // ...and granted everywhere else.
    window.gtag('consent', 'default', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
    });

    // Now pull in gtag.js itself. Injected rather than hard-coded into each
    // page so the measurement ID lives in exactly one place.
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
})();
