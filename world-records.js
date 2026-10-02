/* ============================================================
   CubingHQ — curated world-record metadata
   ------------------------------------------------------------
   Record TIMES come live from the WCA API. Holder names do not —
   that endpoint publishes numbers only — so the names, countries
   and competitions live here and are maintained by hand through
   admin_records.html.

   This file exists because there used to be two copies of this
   table, one in app.js and one inlined in admin_records.html, and
   they had already drifted: the admin page still credited the
   3x3 OH average to a holder the site had long since replaced.
   The page used to FIX the data was editing against a different
   baseline from the one the site rendered.

   Times are seconds (FMC single is a move count, and 3x3 MBLD has
   no average at all). Anything stored here is only shown while it
   still matches the live time — see metaFor in app.js — so a stale
   entry disappears rather than crediting the wrong person.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.WorldRecords = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        '333': {
            single: { time: 2.76, holder: 'Teodor Zajder', country: 'PL', competition: 'GLS Big Cubes Gdańsk 2026' },
            average: { time: 3.51, holder: 'Yiheng Wang (王艺衡)', country: 'CN', competition: 'Hefei Cubing League 3x3 III 2026' }
        },
        '222': {
            single: { time: 0.39, holder: 'Ziyu Ye (叶梓渝)', country: 'CN', competition: 'Hefei Open 2025' },
            average: { time: 0.86, holder: 'Sujan Feist', country: 'US', competition: 'Kids America Christmas Clash OH 2025' }
        },
        '444': {
            single: { time: 15.18, holder: 'Tymon Kolasiński', country: 'PL', competition: 'Spanish Championship 2025' },
            average: { time: 18.56, holder: 'Tymon Kolasiński', country: 'PL', competition: 'Seoul Winter 2026' }
        },
        '555': {
            single: { time: 29.49, holder: 'Tymon Kolasiński', country: 'PL', competition: 'All Rounders Katowice I 2026' },
            average: { time: 33.73, holder: 'Tymon Kolasiński', country: 'PL', competition: 'All Rounders Katowice I 2026' }
        },
        '666': {
            single: { time: 57.69, holder: 'Max Park', country: 'US', competition: 'Burbank Big Cubes 2025' },
            average: { time: 63.63, holder: 'Timofei Tarasenko', country: 'RU', competition: 'Kuala Lumpur Cubing Challenge 2026' }
        },
        '777': {
            single: { time: 90.59, holder: 'Max Park', country: 'US', competition: 'Rubik\'s WCA North American Championship 2026' },
            average: { time: 96.80, holder: 'Timofei Tarasenko', country: 'RU', competition: 'Hanoi Big Cubes 2026' }
        },
        '333oh': {
            single: { time: 5.62, holder: 'Patrick Ponce', country: 'US', competition: 'Mid-Atlantic Speedcubing Championship 2026' },
            average: { time: 6.99, holder: 'Zhen Chen (陈震)', country: 'CN', competition: 'Wuhu Open 2026' }
        },
        '333bf': {
            single: { time: 11.56, holder: 'Tommy Cherry', country: 'US', competition: 'Mid-Atlantic Quiet Championship 2026' },
            average: { time: 13.97, holder: 'Tommy Cherry', country: 'US', competition: 'Hefei August Open 2026' }
        },
        '333fm': {
            single: { time: 16, holder: 'Sebastiano Tronto', country: 'IT', competition: 'FMC 2019', isMoves: true },
            average: { time: 19.00, holder: 'Brian Johnson', country: 'US', competition: 'Evanston FMC Spring 2026', isMoves: true }
        },
        '333mbf': {
            single: { time: '63/65 58:23', holder: 'Graham Siggins', country: 'US', competition: 'Please Be Quiet Reno 2025', isMulti: true },
            average: null
        },
        'pyram': {
            single: { time: 0.73, holder: 'Simon Kellum', country: 'US', competition: 'Middleton Meetup Thursday 2023' },
            average: { time: 1.14, holder: 'Lingkun Jiang (姜凌坤)', country: 'CN', competition: 'Zhengzhou Zest 2025' }
        },
        'skewb': {
            single: { time: 0.73, holder: 'Vojtěch Grohmann', country: 'CZ', competition: 'Głuszyca Open 2026' },
            average: { time: 1.37, holder: 'Ignacy Samselski', country: 'PL', competition: 'Cube Factory League Justynów 2025' }
        },
        'sq1': {
            single: { time: 2.85, holder: 'Brian Johnson', country: 'US', competition: 'Evanston Qualifier 2026' },
            average: { time: 4.63, holder: 'Sameer Aggarwal', country: 'US', competition: 'Cubing in Southern Oregon 2025' }
        },
        'minx': {
            single: { time: 21.04, holder: 'Ziyu Wu (吴子钰)', country: 'CN', competition: 'Quanzhou Summer 2026' },
            average: { time: 23.40, holder: 'Timofei Tarasenko', country: 'RU', competition: 'Kuala Lumpur Cubing Challenge 2026' }
        },
        'clock': {
            single: { time: 1.53, holder: 'Lachlan Gibson', country: 'NZ', competition: 'Hasty Hastings 2025' },
            average: { time: 2.14, holder: 'Lachlan Gibson', country: 'NZ', competition: 'GAN New Zealand Nationals 2026' }
        },
        '444bf': {
            single: { time: 51.96, holder: 'Stanley Chapel', country: 'US', competition: '4BLD in a Madison Hall 2023' },
            average: { time: 59.39, holder: 'Stanley Chapel', country: 'US', competition: 'New York Multimate PBQ II 2025' }
        },
        '555bf': {
            single: { time: 118.59, holder: 'Stanley Chapel', country: 'US', competition: 'Multi Mayhem VA 2026' },
            average: { time: 147.63, holder: 'Stanley Chapel', country: 'US', competition: 'Michigan Cubing Club Epsilon 2019' }
        }
    };
});
