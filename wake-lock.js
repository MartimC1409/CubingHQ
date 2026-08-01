/* ============================================================
   CubingHQ — keep the screen awake
   ------------------------------------------------------------
   Solves run long enough that a phone dims and locks mid-session,
   which hides the running timer. This holds a screen wake lock
   for as long as the site is open.

   Site-wide is deliberate — not just the timer view. Do not
   "optimise" it down to one page without asking; the point is
   that the screen never sleeps while CubingHQ is on screen.

   The part that is easy to get wrong: a wake lock is NOT set and
   forget. The browser releases it automatically every time the
   document stops being visible — switching apps, a notification,
   the screen locking once before the lock took hold. Requesting
   it only at load means it dies the first time you glance away
   and never comes back. So it is re-acquired whenever the page
   becomes visible again, and whenever the sentinel reports it
   was released.

   Requires the Screen Wake Lock API: iOS Safari 16.4+, Chrome,
   Edge. Anywhere else this module does nothing at all — there is
   no standards-based fallback, and the silent-looping-video hack
   drains battery and fights the comp-sim ambient audio.
   ============================================================ */
(function () {
    'use strict';

    if (!('wakeLock' in navigator)) return;

    let sentinel = null;
    let pending = false;
    let retriedOnGesture = false;

    // Locks we let go of on purpose. Releasing fires the same 'release' event
    // the browser uses, so without this the re-acquire below would immediately
    // undo every call to release(). A flag would race — the event is queued,
    // not synchronous — so the sentinel itself is what gets marked.
    const givenUp = new WeakSet();

    function isActive() {
        return !!sentinel && !sentinel.released;
    }

    async function acquire() {
        // One request in flight at a time, and never while hidden — the API
        // rejects for a hidden document anyway.
        if (pending || isActive() || document.visibilityState !== 'visible') return;
        pending = true;
        try {
            const s = await navigator.wakeLock.request('screen');
            sentinel = s;
            // The browser drops the lock on its own; take it straight back if
            // we are still on screen.
            s.addEventListener('release', () => {
                if (sentinel === s) sentinel = null;
                if (givenUp.has(s)) return;
                if (document.visibilityState === 'visible') acquire();
            });
        } catch (err) {
            // NotAllowedError is expected when the document isn't visible or
            // active, and on engines that want a user gesture first. Neither is
            // worth logging — the retries below cover both.
            sentinel = null;
        } finally {
            pending = false;
        }
    }

    async function release() {
        if (!sentinel) return;
        const s = sentinel;
        sentinel = null;
        givenUp.add(s);
        try { await s.release(); } catch (err) { /* already gone */ }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') acquire();
    });

    // iOS leans on the back/forward cache, where the page is restored without
    // a fresh load and the old lock is long gone.
    window.addEventListener('pageshow', acquire);

    // Some engines only grant the lock after a user gesture. Try once more on
    // the first interaction if we don't already hold it.
    function retryOnGesture() {
        if (retriedOnGesture) return;
        retriedOnGesture = true;
        if (!isActive()) acquire();
    }
    window.addEventListener('pointerdown', retryOnGesture, { once: true, passive: true });
    window.addEventListener('keydown', retryOnGesture, { once: true });

    acquire();

    // Not `window.WakeLock` — that name is already taken by the platform's own
    // WakeLock interface, and overwriting a built-in global to hold a plain
    // object is asking for trouble.
    window.AppWakeLock = { isActive, acquire, release };
})();
