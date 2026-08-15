/* ============================================================
   CubingHQ — service worker
   ------------------------------------------------------------
   Makes the site installable and usable offline once it has been
   visited. Deliberately conservative, because a service worker
   persists on the live site and a bad strategy strands people on
   stale code:

     - navigations      -> network-first (deploys take effect at once)
     - same-origin GET  -> stale-while-revalidate
     - cross-origin     -> untouched, straight to the network

   Bump CACHE_VERSION to retire every previous cache.
   ============================================================ */

const CACHE_VERSION = 'v19';
const CACHE_NAME = `cubinghq-${CACHE_VERSION}`;

// Enough to boot the app offline on a first visit. Runtime caching picks up
// the rest — the scripts and stylesheets are requested with ?v= cache
// busters, so listing them here would go stale the moment one is bumped.
const PRECACHE_URLS = [
    '/index.html',
    '/timer.html',
    '/coach.html',
    // The static content pages. Small, rarely change, and the footer links to
    // them from every page — so a visitor offline on the timer can still open
    // the privacy policy.
    '/about.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/guides/index.html',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon-180.png',
];

// Paths this worker must not touch. The admin pages are not part of the app
// shell; /_vercel/ is Vercel's own analytics endpoint, which is same-origin and
// would otherwise be cached stale-while-revalidate — an analytics script served
// from cache is pointless at best and misleading at worst.
//
// /api/ is the same: the Coach's endpoints are same-origin, so without this
// they would be served stale-while-revalidate and a user could be shown a
// previous assessment as if it were the answer to their latest question.
const EXCLUDED = [/\/admin\.html$/, /\/admin_records\.html$/, /^\/_vercel\//, /^\/api\//];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // addAll is atomic: one 404 would reject the whole install, so
            // add individually and let a missing file be non-fatal.
            .then((cache) => Promise.all(
                PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name.startsWith('cubinghq-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

function isCacheableResponse(res) {
    // 'basic' means same-origin: never store opaque cross-origin responses.
    return res && res.ok && res.type === 'basic';
}

// Network first, falling back to whatever we last stored, then to the shell.
async function handleNavigation(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const fresh = await fetch(request);
        if (isCacheableResponse(fresh)) cache.put(request, fresh.clone());
        return fresh;
    } catch (err) {
        return (await cache.match(request))
            || (await cache.match(request, { ignoreSearch: true }))
            || (await cache.match('/index.html'))
            || Response.error();
    }
}

// A URL carrying an explicit ?v= is versioned by hand: the version is
// bumped precisely because the bytes changed. Serving such a request
// from cache buys nothing — the whole point of the new URL is that it is
// new — and it cost real time here. Every asset on this site is
// versioned that way, so a change reached users a full page-load late:
// stale-while-revalidate answered from the old copy first and only then
// refreshed. Debugging by screenshot against code one revision behind is
// a very expensive way to find nothing.
function isVersioned(url) {
    return url.searchParams.has('v');
}

/**
 * Static assets.
 *
 * Versioned URLs go to the network first and fall back to cache only
 * when offline. Everything else keeps stale-while-revalidate, which is
 * the right trade for a URL that never changes its name.
 */
async function handleStatic(request, url) {
    const cache = await caches.open(CACHE_NAME);

    if (isVersioned(url)) {
        try {
            const fresh = await fetch(request);
            if (isCacheableResponse(fresh)) cache.put(request, fresh.clone());
            return fresh;
        } catch (err) {
            // Offline. An exact match only: an ignoreSearch match here
            // would hand back a DIFFERENT version of the file, which is
            // the bug this function exists to avoid.
            return (await cache.match(request)) || Response.error();
        }
    }

    // Unversioned: serve what we have and refresh behind it. The
    // ignoreSearch fallback stays for this path only — it is what lets a
    // precached bare /app.js answer a request that picked up a query.
    const cached = (await cache.match(request))
        || (await cache.match(request, { ignoreSearch: true }));

    const network = fetch(request)
        .then((res) => {
            if (isCacheableResponse(res)) cache.put(request, res.clone());
            return res;
        })
        .catch(() => null);

    if (cached) return cached;
    return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Cross-origin (WCA API, Firebase, cubing.js CDN, fonts, Chart.js): leave
    // it alone entirely so nothing is ever served stale or opaque.
    if (url.origin !== self.location.origin) return;

    if (EXCLUDED.some((re) => re.test(url.pathname))) return;

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request));
        return;
    }

    event.respondWith(handleStatic(request, url));
});

// Lets a page ask a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});
