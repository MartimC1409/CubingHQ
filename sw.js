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

const CACHE_VERSION = 'v6';
const CACHE_NAME = `cubinghq-${CACHE_VERSION}`;

// Enough to boot the app offline on a first visit. Runtime caching picks up
// the rest — the scripts and stylesheets are requested with ?v= cache
// busters, so listing them here would go stale the moment one is bumped.
const PRECACHE_URLS = [
    '/index.html',
    '/timer.html',
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
const EXCLUDED = [/\/admin\.html$/, /\/admin_records\.html$/, /^\/_vercel\//];

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

// Serve what we have immediately and refresh it in the background. Falls back
// to an ignoreSearch match so a precached /app.js still answers /app.js?v=10.
async function handleStatic(request) {
    const cache = await caches.open(CACHE_NAME);
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

    event.respondWith(handleStatic(request));
});

// Lets a page ask a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});
