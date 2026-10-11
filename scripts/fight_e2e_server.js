/* A local stand-in for the deployed site, for playing online Cube Fights
   between two browsers without Vercel or Firebase.

   Serves the repository as static files and mounts the REAL
   /api/fight handler, backed by the in-memory store from
   api/_lib/fights.js instead of Firebase. /api/auth/me answers for the
   session tokens this file mints, so two browsers can be two signed-in
   accounts. /rtdb/fights/<id>.json streams the fight the way Firebase's
   REST streaming does, so the page's live-update path is exercised too
   (point the page at it with window.CHQ_RTDB_URL).

   Used by scripts/fight_e2e.js; also handy by hand:
     AUTH_SIGNING_SECRET=dev node scripts/fight_e2e_server.js 8790
   prints two sign-in tokens to paste into localStorage.chq_auth_token. */
'use strict';

process.env.AUTH_SIGNING_SECRET = process.env.AUTH_SIGNING_SECRET || 'fight-e2e-secret';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const session = require('../api/_lib/session.js');
const fights = require('../api/_lib/fights.js');
const handler = require('../api/fight/[action].js');

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

function start(port, opts = {}) {
    const store = fights.createMemoryStore();
    const service = fights.createFightService({ store, scrambleGenerator: opts.scrambleGenerator || null });
    handler._setService(service);
    handler._resetLimits();

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:${port}`);
        try {
            if (url.pathname.startsWith('/api/fight/')) {
                req.query = { action: url.pathname.split('/').pop() };
                return await handler(req, res);
            }
            if (url.pathname === '/api/auth/me') {
                const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
                const claims = m && session.verify(m[1]);
                res.setHeader('Content-Type', 'application/json');
                if (!claims) { res.statusCode = 401; return res.end('{"error":{"code":"sign_in_required"}}'); }
                return res.end(JSON.stringify({ user: { uid: claims.uid, name: claims.name, email: claims.email, wcaId: claims.wcaId } }));
            }
            if (url.pathname.startsWith('/api/')) {
                res.statusCode = 404; res.setHeader('Content-Type', 'application/json');
                return res.end('{"error":{"code":"not_found"}}');
            }
            const m = /^\/rtdb\/fights\/([A-Za-z0-9]+)\.json$/.exec(url.pathname);
            if (m) return stream(req, res, store, m[1]);

            let file = path.join(ROOT, decodeURIComponent(url.pathname));
            if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
            if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
            if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
            res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
            fs.createReadStream(file).pipe(res);
        } catch (e) {
            console.error(e);
            res.statusCode = 500; res.end();
        }
    });

    return new Promise(resolve => server.listen(port, () => resolve({ server, store, service })));
}

/** Firebase-style REST streaming: an initial put, then a put per change. */
function stream(req, res, store, id) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
    });
    let last = null;
    const send = async () => {
        const { value } = await store.get(`fights/${id}`);
        const text = JSON.stringify(value);
        if (text === last) return;
        last = text;
        res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: value })}\n\n`);
    };
    send();
    const timer = setInterval(send, 100);
    const keepAlive = setInterval(() => res.write('event: keep-alive\ndata: null\n\n'), 15000);
    req.on('close', () => { clearInterval(timer); clearInterval(keepAlive); });
}

function tokenFor(uid, name) {
    return session.issue({ uid, name, email: `${uid}@example.test` });
}

module.exports = { start, tokenFor };

if (require.main === module) {
    const port = Number(process.argv[2]) || 8790;
    start(port).then(() => {
        console.log(`Cube Fights test server on http://localhost:${port}/index.html#fights`);
        console.log('Ana:', tokenFor('acc_ana', 'Ana'));
        console.log('Bea:', tokenFor('acc_bea', 'Bea'));
    });
}
