/* ============================================================
   /api/auth/:action   — one function, three endpoints

     POST /api/auth/signup
     POST /api/auth/login
     GET  /api/auth/me
     POST /api/auth/link-wca
     POST /api/auth/unlink-wca

   See _lib/dispatch.js for why this shape exists at all.
   ============================================================ */
'use strict';

const { makeDispatcher } = require('../_lib/dispatch.js');

module.exports = makeDispatcher('action', {
    signup: require('./_signup.js'),
    login: require('./_login.js'),
    me: require('./_me.js'),
    'link-wca': require('./_link-wca.js'),
    'unlink-wca': require('./_unlink-wca.js'),
});
