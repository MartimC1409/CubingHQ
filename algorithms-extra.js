/* ============================================================
   CubingHQ — Extended Algorithm Database
   ------------------------------------------------------------
   Sets sourced from SpeedCubeDB (https://speedcubedb.com), using
   the top community-voted algorithm per case. Merged into the
   base ALGORITHMS object from algorithms.js at load time.
   ============================================================ */
(function () {
    'use strict';
    if (typeof ALGORITHMS === 'undefined') {
        console.warn('algorithms-extra.js loaded before algorithms.js');
        return;
    }

    function merge(event, sets) {
        ALGORITHMS[event] = ALGORITHMS[event] || {};
        Object.assign(ALGORITHMS[event], sets);
    }

    // ==================== 2x2 — Ortega ====================
    merge('2x2', {
        'Ortega': {
            'OLL': [
                { name: 'Sune', alg: "R U R' U R U2 R'" },
                { name: 'Anti Sune', alg: "R U2 R' U' R U' R'" },
                { name: 'Pi', alg: "F R U R' U' R U R' U' F'" },
                { name: 'P', alg: "F R U R' U' F'" },
                { name: 'L', alg: "y F' R U R' U' R' F R" },
                { name: 'T', alg: "R U R' U' R' F R F'" },
                { name: 'H', alg: "R2 U2 R' U2 R2" }
            ],
            'PBL': [
                { name: 'Adj', alg: "y R U R' F' R U R' U' R' F R2 U' R'" },
                { name: 'Opp', alg: "R U' R' U' F2 U' R U R' U F2" },
                { name: 'Opp Opp', alg: "R2 F2 R2" },
                { name: 'Adj Adj', alg: "R2 U' B2 U2 R2 U' R2" },
                { name: 'Adj Opp', alg: "R U' R F2 R' U R'" },
                { name: 'Opp Adj', alg: "y R2 U R2 U' R2 U R2 U' R2" }
            ]
        }
    });

    // ==================== Megaminx — EO / CO ====================
    merge('Megaminx', {
        'EO': [
            { name: 'EO 1', alg: "F R U R' U' F'" },
            { name: 'EO 2', alg: "F U R U' R' F'" },
            { name: 'EO 3', alg: "F R U2 R2' F R F' U2' F'" }
        ],
        'CO': [
            { name: 'CO 1', alg: "R U R' U R U R' U2' R U' R'" },
            { name: 'CO 2', alg: "F R U2 R' U' R U' R' F'" },
            { name: 'CO 3', alg: "R U2 R' U R U2 R'" },
            { name: 'CO 4', alg: "R U R' U' R' F R U R U' R' F'" },
            { name: 'CO 5', alg: "R U R' U R U2' R'" },
            { name: 'CO 6', alg: "R' U' R U' R' U2 R" },
            { name: 'CO 7', alg: "R U2 R' U' R U' R'" },
            { name: 'CO 8', alg: "R U R' U2 R U2 R'" },
            { name: 'CO 9', alg: "R U2 R' U' R U R' U' R U' R'" },
            { name: 'CO 10', alg: "R U R' U R U' R' U R U2' R'" },
            { name: 'CO 11', alg: "R U R' U R U R' U' R U2' R'" },
            { name: 'CO 12', alg: "R U2 R' U' R U' R2' U' R U' R' U2 R" },
            { name: 'CO 13', alg: "R U2 R2' U' R2 U' R2' U2 R" },
            { name: 'CO 14', alg: "R' U2' R2 U R2' U R2 U2' R'" },
            { name: 'CO 15', alg: "R U R' U2 R U2' R' U R U2' R'" },
            { name: 'CO 16', alg: "R U2 R' U' R U2 R' U2' R U' R'" }
        ],
        'EP': [
            { name: 'EP 1', alg: "R2 U2' R2' U' R2 U2' R2'" },
            { name: 'EP 2', alg: "R2 U2 R2' U R2 U2 R2'" },
            { name: 'EP 3', alg: "R U R' F' R U R' U' R' F R2 U' R'" },
            { name: 'EP 4', alg: "R U R' U R' U' R2 U' R' U R' U R U2'" },
            { name: 'EP 5', alg: "L R U2 L' U R' L U' R U2 L' U2 R'" }
        ],
        'CP': [
            { name: 'CP 1', alg: "R' BR' R BR R' F' R BR' R' BR F R" },
            { name: 'CP 2', alg: "R' F' BR' R BR R' F R BR' R' BR R" },
            { name: 'CP 3', alg: "BR' R' U L U' R' U L' U' R2 BR" },
            { name: 'CP 4', alg: "BR' R2' U L U' R U L' U' R BR" },
            { name: 'CP 5', alg: "L' R U2 R' U' R U R' U' R U R' U' R U' R' L" },
            { name: 'CP 6', alg: "R U R' U R' U' R F' R U R' U' R' F R2 U' R2' U R U'" },
            { name: 'CP 7', alg: "R2 U R' U' y R U R' U' R U R' U' R U R' y' R U' R2'" },
            { name: 'CP 8', alg: "F R U2 R' U' R U' R' F' R' y' R' U' R U' R' U2 R BR U'" },
            { name: 'CP 9', alg: "R U R' U R' U' R2 U' R' U R' U R U R U R' U R' U' R2 U' R' U R' U R U" },
            { name: 'CP 10', alg: "R2 U2 R2' U' R2 U' R2' y' R2' U' R2 U' R2' U2 R2" },
            { name: 'CP 11', alg: "R2' U2' R2 U R2' U R2 y R2 U R2' U R2 U2' R2'" },
            { name: 'CP 12', alg: "R2 U2' R2' U' R2 U2' R' U R' U' R' F R2 U' R' U' R U R' F'" },
            { name: 'CP 13', alg: "R' U2 R U' R' U2 R U2' R' U' R U2' R' U R U2' R' U R" },
            { name: 'CP 14', alg: "R2 U2' R2' U' R2 U R2' U' R2 U R2' U' R2 U2' R2'" },
            { name: 'CP 15', alg: "R2 U2 R2' U R2 U' R2' U R2 U' R2' U R2 U2 R2'" }
        ]
    });

    // ==================== Square-1 -- EO / CP (source: sarah.cubing.net) ====================
    merge('Square-1', {
        'EO': [
            { name: 'EO 1', alg: '(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-3,0) /' },
            { name: 'EO 2', alg: '(1,0) / (3,0) / (-1,-1) / (-3,0) / (0,1)' },
            { name: 'EO 3', alg: '(0,-1) / (0,-3) / (0,-3) / (1,1) / (-1,2) / (1,4) / (-1,0)' },
            { name: 'EO 4', alg: '(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-4,-1) / (1,0)' },
            { name: 'EO 5', alg: '(1,0) / (-1,-1) / (0,1)' },
            { name: 'EO 6', alg: '(0,-1) / (3,0) / (3,0) / (1,1) / (-3,0) / (-3,0) /' },
            { name: 'EO 7', alg: '(1,0) / (-1,-1) / (3,3) / (1,1) / (-1,0)' }
        ],
        'CP': {
            'Standard': [
                { name: 'CP 1', alg: '/ (3,-3) / (-3,0) / (0,3) / (0,-3) / (0,3) /' },
                { name: 'CP 2', alg: '/ (-3,-3) / (3,0) / (-3,-3) / (3,0) / (-3,-3) /' },
                { name: 'CP 3', alg: '/ (3,-3) / (0,3) / (-3,0) / (3,0) / (-3,0) /' },
                { name: 'CP 4', alg: '/ (3,0) / (-3,-3) / (0,3) /' },
                { name: 'CP 5', alg: '/ (3,0) / (-3,0) / (3,0) / (-3,0) /' },
                { name: 'CP 6', alg: '/ (-3,-3) / (0,-3) / (-3,-3) / (0,-3) / (-3,-3) /' },
                { name: 'CP 7', alg: '/ (0,3) / (0,-3) / (0,3) / (0,-3) /' },
                { name: 'CP 8', alg: '/ (3,-3) / (-3,3) /' }
            ],
            'Parity': [
                { name: 'CP Parity 1', alg: '/ (3,3) / (-1,0) / (2,0) / (-4,0) / (4,0) / (2,0) / (1,0) / (-3,-3) /' },
                { name: 'CP Parity 2', alg: '/ (3,3) / (-1,0) / (-4,2) / (-2,4) / (0,1) / (3,3) /' },
                { name: 'CP Parity 3', alg: '/ (-3,-3) / (0,-5) / (-4,-2) / (-4,0) / (-4,0) / (2,-4) / (5,0) / (-3,-3) /' },
                { name: 'CP Parity 4', alg: '/ (-3,0) / (-3,0) / (-5,0) / (-2,0) / (4,0) / (-4,0) / (-2,0) / (5,0) / (-3,0) /' },
                { name: 'CP Parity 5', alg: '/ (-3,-3) / (0,-5) / (-4,-2) / (-4,0) / (-4,0) / (2,-4) / (-1,0) / (-3,-3) /' },
                { name: 'CP Parity 6', alg: '/ (3,3) / (-1,0) / (-4,2) / (-2,4) / (0,-5) / (3,3) /' },
                { name: 'CP Parity 7', alg: '/ (3,3) / (-1,0) / (2,0) / (-4,0) / (4,0) / (2,0) / (-5,0) / (-3,-3) /' },
                { name: 'CP Parity 8', alg: '/ (3,3) / (1,0) / (4,-2) / (2,-4) / (0,-4) / (3,3) / (3,0) / (3,3) /' }
            ]
        }
    });

    // ==================== Skewb — Sarah's Method, Intermediate Variation (source: sarah.cubing.net) ====================
    // Reduction method for step 2 (solve the opposite side). Cat 2/3 reduce to Cat 1.
    merge('Skewb', {
        "Sarah's Method": {
            'Category 1': [
                { name: 'Pi 2', alg: "F' L F L'" },
                { name: 'Pi 4', alg: "y2 L F' L' F" },
                { name: 'Pi 1', alg: "y2 F' L F L' F' L F L'" }
            ],
            'Category 2': [
                { name: 'L 2', alg: "R' F R F'" },
                { name: 'L 4', alg: "R' F R F'" },
                { name: 'L 3', alg: "L F' L' F" },
                { name: 'L 5', alg: "L F' L' F" }
            ],
            'Category 3': [
                { name: 'Pi 5', alg: "R' F R F'" },
                { name: 'Pi 3', alg: "y2 R' F R F'" },
                { name: 'L 1', alg: "y R' F R F'" }
            ]
        }
    });
})();
