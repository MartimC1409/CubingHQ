/* ============================================================
   /api/auth/:action   — one function, three endpoints

     POST /api/auth/signup
     POST /api/auth/login
     GET  /api/auth/me
     POST /api/auth/link-wca
     POST /api/auth/unlink-wca
     POST /api/auth/avatar
     POST /api/auth/request-reset
     POST /api/auth/reset-password
     GET  /api/auth/health

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
    avatar: require('./_avatar.js'),
    'request-reset': require('./_request-reset.js'),
    'reset-password': require('./_reset-password.js'),
    health: require('./_health.js'),
});
