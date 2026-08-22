/* ============================================================
   /api/auth/:action   — one function, three endpoints

     POST /api/auth/signup
     POST /api/auth/login
     GET  /api/auth/me

   See _lib/dispatch.js for why this shape exists at all.
   ============================================================ */
'use strict';

const { makeDispatcher } = require('../_lib/dispatch.js');

module.exports = makeDispatcher('action', {
    signup: require('./_signup.js'),
    login: require('./_login.js'),
    me: require('./_me.js'),
});
