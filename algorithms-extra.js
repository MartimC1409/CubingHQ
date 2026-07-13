/* ============================================================
   SimulateCubing — Extended Algorithm Database
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

    // ==================== Square-1 ====================
    merge('Square-1', {
        'Cube Shape': {
            '1-2 Slices': [
                { name: 'Kite / Kite', alg: '/', setup: '/' },
                { name: 'Left fist / Right fist', alg: '/ (3,0) / (-1,1)', setup: '(1,-1) / (-3,0) /' },
                { name: 'Right fist / Left fist', alg: '/ (3,0) /', setup: '/ (-3,0) /' },
                { name: 'Barrel / Barrel', alg: '/ (3,3) /', setup: '/ (-3,-3) /' }
            ],
            '3 Slices': [
                { name: 'Muffin / Square', alg: '/ (2,0) / (3,0) /', setup: '/ (-3,0) / (-2,0) /' },
                { name: 'Square / Muffin', alg: '/ (0,-2) / (0,-3) /', setup: '/ (0,3) / (0,2) /' },
                { name: 'Shield / Square', alg: '/ (-1,0) / (-3,0) /', setup: '/ (3,0) / (1,0) /' },
                { name: 'Square / Shield', alg: '/ (0,1) / (0,3) /', setup: '/ (0,-3) / (0,-1) /' },
                { name: 'Right paw / Left paw', alg: '/ (-4,1) / (3,0) /', setup: '/ (3,0) / (-5,2) /' },
                { name: 'Left paw / Right paw', alg: '/ (-1,4) / (-3,0) /', setup: '/ (3,0) / (1,-4) /' },
                { name: 'Muffin / Muffin', alg: '/ (-2,0) / (3,3) /', setup: '/ (-3,-3) / (2,0) /' },
                { name: 'Shield / Shield', alg: '/ (1,0) / (-3,-3) /', setup: '/ (3,3) / (-1,0) /' },
                { name: 'Scallop / Scallop', alg: '/ (1,2) / (-3,-3) /', setup: '/ (-3,-3) / (2,1) /' },
                { name: 'Barrel / Kite', alg: '/ (-3,0) / (-3,0) /', setup: '/ (3,0) / (3,0) /' },
                { name: 'Kite / Barrel', alg: '/ (0,3) / (0,3) /', setup: '/ (0,-3) / (0,-3) /' },
                { name: 'Scallop / Kite', alg: '/ (-1,-2) / (-3,0) /', setup: '/ (3,0) / (1,2) /' },
                { name: 'Kite / Scallop', alg: '/ (2,1) / (0,3) /', setup: '/ (0,-3) / (-2,-1) /' }
            ],
            '4 Slices': [
                { name: 'Star / 6-2', alg: '/ (2,4) / (-4,1) / (0,3) /', setup: '/ (0,-3) / (4,-1) / (-2,-4) /' },
                { name: '6-2 / Star', alg: '/ (-4,-2) / (-1,4) / (-3,0) /', setup: '/ (3,0) / (1,-4) / (4,2) /' },
                { name: 'Star / 8', alg: '/ (-4,-2) / (1,2) / (-3,-3) /', setup: '/ (3,3) / (-1,-2) / (4,2) /' },
                { name: '8 / Star', alg: '/ (2,4) / (-2,-1) / (3,3) /', setup: '/ (-3,-3) / (2,1) / (-2,-4) /' },
                { name: 'Star / 4-4', alg: '/ (-2,-2) / (1,0) / (-3,-3) /', setup: '/ (3,3) / (-1,0) / (2,2) /' },
                { name: '4-4 / Star', alg: '/ (2,2) / (0,-1) / (3,3) /', setup: '/ (-3,-3) / (0,1) / (-2,-2) /' },
                { name: 'Left 4-2 / Parallel Edges', alg: '/ (2,3) / (-2,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (2,1) / (-2,-3) /' },
                { name: 'Parallel Edges / Left 4-2', alg: '/ (3,2) / (-1,-2) / (0,-3) /', setup: '/ (0,3) / (1,2) / (-3,-2) /' },
                { name: 'Right 4-2 / Parallel Edges', alg: '/ (-2,-3) / (-1,-2) / (-3,0) /', setup: '/ (3,0) / (1,2) / (2,3) /' },
                { name: 'Parallel Edges / Right 4-2', alg: '/ (4,0) / (2,-3) / (-1,-2) / (-3,0) /', setup: '/ (3,0) / (1,2) / (-2,3) / (-4,0) /' },
                { name: 'Right 5-1 / Perpendicular Edges', alg: '/ (0,-4) / (2,1) / (0,3) /', setup: '/ (0,-3) / (-2,-1) / (0,4) /' },
                { name: 'Perpendicular Edges / Right 5-1', alg: '/ (-4,0) / (-2,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (2,1) / (4,0) /' },
                { name: 'Left 5-1 / Perpendicular Edges', alg: '/ (0,4) / (1,2) / (0,3) / (-1,1)', setup: '(1,-1) / (0,-3) / (-1,-2) / (0,-4) /' },
                { name: 'Perpendicular Edges / Left 5-1', alg: '/ (4,0) / (-1,-2) / (-3,0) /', setup: '/ (3,0) / (1,2) / (-4,0) /' },
                { name: '4-1-1 / Perpendicular Edges', alg: '/ (2,0) / (-1,-2) / (-3,0) /', setup: '/ (3,0) / (1,2) / (-2,0) /' },
                { name: 'Perpendicular Edges / 4-1-1', alg: '/ (0,-2) / (2,1) / (0,3) /', setup: '/ (0,-3) / (-2,-1) / (0,2) /' },
                { name: '3-2-1 / Perpendicular Edges', alg: '/ (0,-2) / (0,1) / (0,3) /', setup: '/ (0,-3) / (0,-1) / (0,2) /' },
                { name: 'Perpendicular Edges / 3-2-1', alg: '/ (2,1) / (-1,0) / (-3,0) /', setup: '/ (3,0) / (1,0) / (-2,-1) /' },
                { name: '3-1-2 / Perpendicular Edges', alg: '/ (-1,-2) / (0,1) / (0,3) /', setup: '/ (0,-3) / (0,-1) / (1,2) /' },
                { name: 'Perpendicular Edges / 3-1-2', alg: '/ (2,0) / (-1,0) / (-3,0) /', setup: '/ (3,0) / (1,0) / (-2,0) /' },
                { name: '3-3 / Perpendicular Edges', alg: '/ (0,-2) / (-1,4) / (-3,0) /', setup: '/ (3,0) / (1,-4) / (0,2) /' },
                { name: 'Perpendicular Edges / 3-3', alg: '/ (-2,0) / (-5,2) / (0,3) / (-1,1)', setup: '(1,-1) / (0,-3) / (5,-2) / (2,0) /' },
                { name: 'Right 5-1 / Pair', alg: '/ (3,-2) / (-1,-2) / (0,-3) /', setup: '/ (0,3) / (1,2) / (-3,2) /' },
                { name: 'Pair / Right 5-1', alg: '/ (-2,3) / (-2,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (2,1) / (2,-3) /' },
                { name: 'Left 5-1 / Pair', alg: '/ (-3,2) / (-2,-1) / (0,-3) / (-1,1)', setup: '(1,-1) / (0,3) / (2,1) / (3,-2) /' },
                { name: 'Pair / Left 5-1', alg: '/ (-2,3) / (-2,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (2,1) / (2,-3) /' },
                { name: '4-1-1 / Pair', alg: '/ (0,4) / (4,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (-4,1) / (0,-4) /' },
                { name: 'Pair / 4-1-1', alg: '/ (-4,0) / (4,-1) / (-3,0) / (-1,1)', setup: '(1,-1) / (3,0) / (-4,1) / (4,0) /' },
                { name: '2-2-2 / Pair', alg: '/ (-2,0) / (0,1) / (3,3) /', setup: '/ (-3,-3) / (0,-1) / (2,0) /' },
                { name: 'Pair / 2-2-2', alg: '/ (0,2) / (-1,0) / (-3,-3) /', setup: '/ (3,3) / (1,0) / (0,-2) /' },
                { name: 'Left 4-2 / Pair', alg: '/ (2,0) / (-2,-1) / (3,3) /', setup: '/ (-3,-3) / (2,1) / (-2,0) /' },
                { name: 'Pair / Left 4-2', alg: '/ (0,2) / (2,1) / (3,3) /', setup: '/ (-3,-3) / (-2,-1) / (0,-2) /' },
                { name: 'Right 4-2 / Pair', alg: '/ (0,4) / (1,0) / (-3,-3) /', setup: '/ (3,3) / (-1,0) / (0,-4) /' },
                { name: 'Pair / Right 4-2', alg: '/ (-2,0) / (1,2) / (-3,-3) /', setup: '/ (3,3) / (-1,-2) / (2,0) /' },
                { name: '6 / Pair', alg: '/ (0,4) / (1,2) / (-3,-3) /', setup: '/ (3,3) / (-1,-2) / (0,-4) /' },
                { name: 'Pair / 6', alg: '/ (-4,0) / (-2,-1) / (3,3) /', setup: '/ (-3,-3) / (2,1) / (4,0) /' },
                { name: 'Right fist / Left paw', alg: '/ (0,-4) / (0,1) / (0,3) /', setup: '/ (0,-3) / (0,-1) / (0,4) /' },
                { name: 'Left paw / Right fist', alg: '/ (4,0) / (-1,0) / (-3,0) /', setup: '/ (3,0) / (1,0) / (-4,0) /' },
                { name: 'Left fist / Right paw', alg: '/ (-1,0) / (0,1) / (0,3) /', setup: '/ (0,-3) / (0,-1) / (1,0) /' },
                { name: 'Right paw / Left fist', alg: '/ (0,1) / (-1,0) / (-3,0) /', setup: '/ (3,0) / (1,0) / (0,-1) /' },
                { name: 'Right paw / Right paw', alg: '/ (-1,2) / (2,2) / (0,-1) / (3,3) /', setup: '/ (-3,-3) / (0,1) / (-2,-2) / (1,-2) /' },
                { name: 'Muffin / Shield', alg: '/ (3,0) / (-1,-2) / (0,-3) /', setup: '/ (0,3) / (1,2) / (-3,0) /' },
                { name: 'Shield / Muffin', alg: '/ (0,-3) / (2,1) / (3,0) /', setup: '/ (-3,0) / (-2,-1) / (0,3) /' },
                { name: 'Scallop / Barrel', alg: '/ (4,0) / (-1,0) / (-3,-3) /', setup: '/ (3,3) / (1,0) / (-4,0) /' },
                { name: 'Barrel / Scallop', alg: '/ (0,-4) / (0,1) / (3,3) /', setup: '/ (-3,-3) / (0,-1) / (0,4) /' }
            ]
        },
        'CO': [
            { name: '2-2', alg: '(1,0) / (-1,0)', setup: '(1,0) / (-1,0)' },
            { name: '3-1', alg: '(1,0) / (3,0) / (-1,0)', setup: '(1,0) / (-3,0) / (-1,0)' },
            { name: 'Opp / Opp', alg: '(1,0) / (3,3) / (-1,0)', setup: '(1,0) / (-3,-3) / (-1,0)' },
            { name: 'Adj / Opp', alg: '(1,0) / (0,3) / (0,3) / (-1,0)', setup: '(1,0) / (0,-3) / (0,-3) / (-1,0)' },
            { name: 'Opp / Adj', alg: '(1,0) / (-3,0) / (-3,0) / (-1,0)', setup: '(1,0) / (-3,0) / (-3,0) / (-1,0)' },
            { name: '1-3', alg: '(1,0) / (3,6) / (-1,0)', setup: '(1,0) / (-3,-6) / (-1,0)' },
            { name: '0-4', alg: '/ (6,6) / (-1,1)', setup: '(1,-1) / (-6,-6) /' }
        ],
        'EO': [
            { name: '1-1', alg: '(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-3,0) / (-1,0)', setup: '(1,0) / (3,0) / (2,-1) / (1,1) / (-3,0) / (-3,0) / (-1,0)' },
            { name: 'I-I', alg: '(1,0) / (-1,-1) / (0,1)', setup: '(0,-1) / (1,1) / (-1,0)' },
            { name: 'L-L', alg: '(1,0) / (-4,-1) / (1,1) / (3,0) / (-1,0)', setup: '(1,0) / (-4,-1) / (1,1) / (3,0) / (-1,0)' },
            { name: 'L-I', alg: '(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-4,-1) / (0,1)', setup: '(0,-1) / (4,1) / (2,-1) / (1,1) / (-3,0) / (-3,0) / (-1,0)' },
            { name: '3-3', alg: '(1,0) / (3,0) / (3,0) / (-1,-1) / (-3,0) / (-3,0) / (0,1)', setup: '(0,-1) / (3,0) / (3,0) / (1,1) / (-3,0) / (-3,0) / (-1,0)' },
            { name: '4-4', alg: '(1,0) / (-1,-1) / (-2,4) / (-1,-1) / (1,0)', setup: '(1,0) / (-1,-1) / (-3,-3) / (1,1) / (-1,0)' },
            { name: 'I-L', alg: '(1,0) / (-3,0) / (3,0) / (-1,-1) / (-3,0) / (3,0) / (0,1)', setup: '(0,-1) / (-3,0) / (3,0) / (1,1) / (-3,0) / (3,0) / (-1,0)' }
        ],
        'CP': [
            { name: 'Adj / Solved', alg: '/ (-3,3) / (3,0) / (0,-3) / (0,3) / (0,-3) /', setup: '/ (0,-3) / (0,3) / (0,-3) / (3,0) / (-3,3) /' },
            { name: 'Opp / Solved', alg: '/ (3,3) / (-3,0) / (3,3) / (-3,0) / (3,3) /', setup: '/ (3,3) / (-3,0) / (3,3) / (-3,0) / (3,3) /' },
            { name: 'Solved / Adj', alg: '/ (-3,3) / (0,-3) / (3,0) / (-3,0) / (3,0) /', setup: '/ (3,0) / (-3,0) / (3,0) / (0,-3) / (-3,3) /' },
            { name: 'Solved / Opp', alg: '/ (3,3) / (0,3) / (3,3) / (0,3) / (3,3) /', setup: '/ (3,3) / (0,3) / (3,3) / (0,3) / (3,3) /' },
            { name: 'Adj / Adj', alg: '/ (-3,0) / (3,3) / (0,-3) /', setup: '/ (0,-3) / (3,3) / (-3,0) /' },
            { name: 'Opp / Adj', alg: '/ (3,0) / (-3,0) / (3,0) / (-3,0) /', setup: '/ (3,0) / (-3,0) / (3,0) / (-3,0) /' },
            { name: 'Adj / Opp', alg: '/ (0,-3) / (0,3) / (0,-3) / (0,3) /', setup: '/ (0,3) / (0,-3) / (0,3) / (0,-3) /' },
            { name: 'Opp / Opp', alg: '/ (-3,3) / (3,-3) /', setup: '/ (3,-3) / (-3,3) /' }
        ],
        'Parity': [
            { name: 'Adj Parity', alg: '/ (-3,0) / (0,3) / (0,-3) / (0,3) / (2,0) / (0,2) / (-2,0) / (4,0) / (0,-2) / (0,2) / (-1,4) / (0,-3) / (0,3)', setup: '(0,-3) / (0,3) / (1,-4) / (0,-2) / (0,2) / (-4,0) / (2,0) / (0,-2) / (-2,0) / (0,-3) / (0,3) / (0,-3) / (3,0) /' },
            { name: 'Opp Parity', alg: '/ (3,3) / (-1,0) / (2,-4) / (4,-2) / (0,-2) / (-4,2) / (1,-5) / (3,0) / (3,3) / (3,0)', setup: '(-3,0) / (-3,-3) / (-3,0) / (-1,5) / (4,-2) / (0,2) / (-4,2) / (-2,4) / (1,0) / (-3,-3) /' },
            { name: 'O+ Parity', alg: '(0,-1) / (-2,-2) / (2,0) / (-3,-3) / (0,1) / (-2,-2) / (0,-2) / (2,2) / (0,-1) / (3,3) / (3,3)', setup: '(-3,-3) / (-3,-3) / (0,1) / (-2,-2) / (0,2) / (2,2) / (0,-1) / (3,3) / (-2,0) / (2,2) / (0,1)' },
            { name: 'O- Parity', alg: '/ (-3,-3) / (0,1) / (-2,-2) / (0,2) / (2,2) / (0,-1) / (3,3) / (-2,0) / (2,2) / (-3,-2)', setup: '(3,2) / (-2,-2) / (2,0) / (-3,-3) / (0,1) / (-2,-2) / (0,-2) / (2,2) / (0,-1) / (3,3) /' },
            { name: 'W Parity', alg: '(0,-1) / (1,-2) / (-4,0) / (0,3) / (1,0) / (3,-2) / (-4,0) / (-4,0) / (-2,2) / (-1,0) / (0,-3) / (-3,0)', setup: '(3,0) / (0,3) / (1,0) / (2,-2) / (4,0) / (4,0) / (-3,2) / (-1,0) / (0,-3) / (4,0) / (-1,2) / (0,1)' }
        ],
        'EP': [
            { name: 'Adj / Adj', alg: '(-2,0) / (0,3) / (-1,-1) / (1,-2) / (2,0)' },
            { name: 'Adj / O+', alg: '(0,-1) / (3,0) / (-3,0) / (1,-2) / (-4,-1) / (1,-2) / (-1,2) / (3,3) / (0,1)' },
            { name: 'Adj / O-', alg: '(1,0) / (-3,0) / (3,0) / (-1,2) / (4,1) / (-1,2) / (1,-2) / (-3,-3) / (-1,0)' },
            { name: 'Adj / Opp', alg: '(1,0) / (-1,0) / (-3,0) / (0,-1) / (6,0) / (1,0) / (3,0) / (0,1) / (5,0)' },
            { name: 'Adj / W', alg: '(1,0) / (0,3) / (-1,-1) / (0,3) / (0,-3) / (1,1) / (0,-3) / (-1,0)' },
            { name: 'H / H', alg: '(1,0) / (5,-1) / (-2,-2) / (-1,-1) / (-2,4) / (-1,0)' },
            { name: 'H / Solved', alg: '/ (3,-3) / (3,-3) / (0,1) / (-3,3) / (-3,3) / (-1,0)' },
            { name: 'H / Ua', alg: '(0,-1) / (0,-3) / (4,1) / (-1,-4) / (-5,1) / (-1,-4) / (4,1) / (0,-3) / (-1,0)' },
            { name: 'H / Ub', alg: '(1,0) / (0,3) / (-4,-1) / (1,4) / (5,-1) / (1,4) / (-4,-1) / (0,3) / (0,1)' },
            { name: 'H / Z', alg: '(1,0) / (-1,-1) / (0,3) / (1,1) / (0,3) / (3,-3) / (-1,-1) / (-3,3) / (0,1)' },
            { name: 'O+ / Adj', alg: '(0,-1) / (-3,0) / (1,1) / (2,-1) / (1,4) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'O+ / O+', alg: '(1,0) / (5,-1) / (-3,0) / (1,1) / (-4,2) / (1,1) / (0,-3) / (-1,0)' },
            { name: 'O+ / O-', alg: '(1,0) / (-1,-1) / (-3,0) / (1,1) / (-3,-3) / (-1,-1) / (1,4) / (-1,-1) / (0,1)' },
            { name: 'O+ / Opp', alg: '(1,0) / (-1,-1) / (-3,0) / (1,1) / (-3,0) / (-1,-1) / (0,1)' },
            { name: 'O+ / W', alg: '(1,0) / (2,-4) / (0,3) / (1,4) / (0,3) / (3,-3) / (-4,-1) / (-2,1) / (-1,0)' },
            { name: 'O- / Adj', alg: '(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,3) / (2,-1) / (1,1) / (2,-1) / (-5,1) / (-1,0)' },
            { name: 'O- / O+', alg: '(1,0) / (-1,-1) / (3,0) / (1,1) / (3,3) / (-1,-1) / (1,-2) / (-1,-1) / (0,1)' },
            { name: 'O- / O-', alg: '(1,0) / (0,3) / (-1,-1) / (4,-2) / (-1,-1) / (3,0) / (-5,1) / (-1,0)' },
            { name: 'O- / Opp', alg: '(1,0) / (-1,-1) / (3,0) / (1,1) / (3,0) / (-1,-1) / (0,1)' },
            { name: 'O- / W', alg: '(1,-3) / (0,3) / (-1,-1) / (1,-2) / (3,0) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'Opp / Adj', alg: '(0,-1) / (0,-3) / (0,3) / (1,-2) / (-1,-1) / (0,3) / (0,-3) / (0,3) / (0,1)' },
            { name: 'Opp / O+', alg: '(1,0) / (-1,-1) / (1,-2) / (-1,-1) / (1,-2) / (-1,-1) / (0,1)' },
            { name: 'Opp / O-', alg: '(1,0) / (-1,-1) / (1,4) / (-1,-1) / (1,4) / (-1,-1) / (0,1)' },
            { name: 'Opp / Opp', alg: '(1,0) / (-1,-1) / (-5,1) / (-1,-1) / (0,1)' },
            { name: 'Opp / W', alg: '(1,0) / (-1,2) / (-5,1) / (3,0) / (0,-3) / (-4,-1) / (0,3) / (-5,1) / (-1,0)' },
            { name: 'Solved / H', alg: '/ (3,-3) / (3,-3) / (-1,0) / (-3,3) / (-3,3) / (0,1)' },
            { name: 'Solved / Ua', alg: '(0,-1) / (3,0) / (0,1) / (0,-3) / (0,-1) / (-3,0) / (0,1) / (0,3) /' },
            { name: 'Solved / Ub', alg: '/ (0,-3) / (0,-1) / (3,0) / (0,1) / (0,3) / (0,-1) / (-3,0) / (0,1)' },
            { name: 'Solved / Z', alg: '(0,-1) / (1,1) / (0,3) / (-1,-1) / (0,-3) / (1,1) / (-1,0)' },
            { name: 'Ua / H', alg: '(1,0) / (0,3) / (-1,-4) / (1,4) / (5,-1) / (4,1) / (-1,-4) / (3,0) / (0,1)' },
            { name: 'Ua / Solved', alg: '(1,0) / (-3,0) / (-1,0) / (0,3) / (1,0) / (3,0) / (-1,0) / (0,-3) /' },
            { name: 'Ua / Ua', alg: '(1,0) / (3,0) / (-1,-1) / (3,0) / (-5,1) / (-1,0)' },
            { name: 'Ua / Ub', alg: '(1,0) / (5,-1) / (-5,1) / (3,0) / (0,3) / (-1,-1) / (1,-2) / (-1,0)' },
            { name: 'Ua / Z', alg: '(1,0) / (0,3) / (-1,-1) / (1,-2) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'Ub / H', alg: '(0,-1) / (-3,0) / (1,4) / (-4,-1) / (-5,1) / (-1,-4) / (1,4) / (0,-3) / (-1,0)' },
            { name: 'Ub / Solved', alg: '/ (0,3) / (1,0) / (-3,0) / (-1,0) / (0,-3) / (1,0) / (3,0) / (-1,0)' },
            { name: 'Ub / Ua', alg: '(-2,0) / (3,0) / (-1,-1) / (3,0) / (-2,1) / (-1,-1) / (3,0) / (-5,1) / (-1,0)' },
            { name: 'Ub / Ub', alg: '(1,0) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'Ub / Z', alg: '(1,0) / (0,3) / (-1,-1) / (1,-2) / (-3,0) / (3,0) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'W / Adj', alg: '(1,0) / (2,-1) / (1,1) / (2,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'W / O+', alg: '(1,0) / (2,-4) / (0,3) / (4,1) / (0,3) / (3,-3) / (-1,-4) / (1,-2) / (-1,0)' },
            { name: 'W / O-', alg: '(0,-1) / (-2,4) / (0,-3) / (-4,-1) / (0,-3) / (-3,3) / (1,4) / (-1,2) / (0,1)' },
            { name: 'W / Opp', alg: '(1,0) / (5,-1) / (-3,0) / (4,1) / (3,0) / (-3,0) / (5,-1) / (-2,1) / (-1,0)' },
            { name: 'W / W', alg: '(1,0) / (5,-1) / (-3,0) / (1,1) / (0,-3) / (-1,-1) / (-2,4) / (-1,0)' },
            { name: 'Z / H', alg: '(1,0) / (3,3) / (2,-1) / (-3,3) / (4,-2) / (3,0) / (-3,-3) / (-1,0)' },
            { name: 'Z / Solved', alg: '(1,0) / (-1,-1) / (-3,0) / (1,1) / (3,0) / (-1,-1) / (0,1)' },
            { name: 'Z / Ua', alg: '(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,3) / (3,0) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'Z / Ub', alg: '(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,-3) / (3,0) / (-1,-1) / (-2,1) / (-1,0)' },
            { name: 'Z / Z', alg: '(1,0) / (-1,-1) / (-3,0) / (1,1) / (3,3) / (-1,-1) / (0,-3) / (1,1) / (-1,0)' }
        ]
    });

    // ==================== 3x3 — F2L (cases 1–24, top-layer pairs) ====================
    merge('3x3', {
        'F2L': [
            { name: 'F2L 1', alg: "U R U' R'", setup: "F R' F' R" },
            { name: 'F2L 2', alg: "F R' F' R", setup: "R' F R F'" },
            { name: 'F2L 3', alg: "F' U' F", setup: "F' U F" },
            { name: 'F2L 4', alg: "R U R'", setup: "R U' R'" },
            { name: 'F2L 5', alg: "U' R U R' U2 R U' R'", setup: "R U R' U2' R U' R' U" },
            { name: 'F2L 6', alg: "U' r U' R' U R U r'", setup: "F' U' F U2' F' U F U'" },
            { name: 'F2L 7', alg: "U' R U2 R' U' R U2 R'", setup: "R U R' U2' R U2' R' U" },
            { name: 'F2L 8', alg: "d R' U2 R U R' U2 R", setup: "r' U' R2 U' R2' U2' r" },
            { name: 'F2L 9', alg: "U' R U' R' U F' U' F", setup: "F' U F U' R U R' U" },
            { name: 'F2L 10', alg: "U' R U R' U R U R'", setup: "R U' R' U' R U' R' U" },
            { name: 'F2L 11', alg: "U' R U2 R' U F' U' F", setup: "F' U F U' R U2' R' U" },
            { name: 'F2L 12', alg: "R U' R' U R U' R' U2 R U' R'", setup: "R U R' U2' R U R' U' R U R'" },
            { name: 'F2L 13', alg: "y' U R' U R U' R' U' R", setup: "r U2' R' U R U' R' U M" },
            { name: 'F2L 14', alg: "U' R U' R' U R U R'", setup: "R U' R' U' R U R' U" },
            { name: 'F2L 15', alg: "R' D' R U' R' D R U R U' R'", setup: "R U R' U' R U R' U2' R U' R'" },
            { name: 'F2L 16', alg: "R U' R' U2 F' U' F", setup: "F' U F U2' R U R'" },
            { name: 'F2L 17', alg: "R U2 R' U' R U R'", setup: "R U' R' U R U2' R'" },
            { name: 'F2L 18', alg: "y' R' U2 R U R' U' R", setup: "R U R' U' R U R' F R' F' R" },
            { name: 'F2L 19', alg: "U R U2 R' U R U' R'", setup: "R U R' U' R U2' R' U'" },
            { name: 'F2L 20', alg: "y' U' R' U2 R U' R' U R", setup: "R U R' F R' F' R2' U R' U" },
            { name: 'F2L 21', alg: "U2 R U R' U R U' R'", setup: "R U' R' U2' R U R'" },
            { name: 'F2L 22', alg: "r U' r' U2 r U r'", setup: "F' L' U2' L F" },
            { name: 'F2L 23', alg: "U R U' R' U' R U' R' U R U' R'", setup: "R U' R' U R U' R' U2' R U' R'" },
            { name: 'F2L 24', alg: "F U R U' R' F' R U' R'", setup: "R U R' F R U R' U' F'" }
        ]
    });

    // ==================== Skewb — Sarah's Advanced ====================
    // Notation: S = sledge (R' L R L'), H = hedge (L R' L' R).
    merge('Skewb', {
        "Sarah's Advanced": [
            { name: '1a (Pi + Swirl)', alg: "y x R b' r' R' r z B' r B" },
            { name: '1b (Pi + Swirl)', alg: "y2 x r' B R r R' B r' B'" },
            { name: '1c (Pi + Swirl)', alg: "S z H z' S z H" },
            { name: '1d (Pi + Swirl)', alg: "z' H z' S z H z' H" },
            { name: '2a (Pi + Swirl)', alg: "z2 H z' S z S z' S" },
            { name: '2b (Pi + Swirl)', alg: "z S z' H z H z' H" },
            { name: '2c (Pi + Swirl)', alg: "z2 S z' H z H z' H" },
            { name: '2d (Pi + Swirl)', alg: "z S z S z' H z S" },
            { name: '3a (Pi + Wat)', alg: "z' S z2 H z' S z' S" },
            { name: '3b (Pi + Wat)', alg: "y x B R' B' R B R B' R' r' R' r R" },
            { name: '3c (Pi + Wat)', alg: "z S z S z H z2 S" },
            { name: '3d (Pi + Wat)', alg: "H z' H z' S z2 H" },
            { name: '4a (Pi + Wat)', alg: "x r' R' r B R' B' R' r' R r R'" },
            { name: '4b (Pi + Wat)', alg: "y x r' R r R B' r' R' r B R'" },
            { name: '4c (Pi + Wat)', alg: "y' x R r' R r z R r' R' r R r R'" },
            { name: '4d (Pi + Wat)', alg: "y x R r' R' r' z' r' R r R z R r R' r'" },
            { name: '5a (Pi + X)', alg: "x' S z2 S y2 x' H" },
            { name: '5b (Pi + X)', alg: "y2 x R r' B R' B' R' r' R r'" },
            { name: '5c (Pi + X)', alg: "x' S z2 S y2 x' S" },
            { name: '5d (Pi + X)', alg: "y z' S z2 S z2 x' H" },
            { name: '6a (Pi + X)', alg: "y x R r' R r z2 R r' R' r b" },
            { name: '6b (Pi + X)', alg: "y' x R' r R' r' z' r' R' r z R' r" },
            { name: '6c (Pi + X)', alg: "y' x B' r' R r R' z2 r' R r' R'" },
            { name: '6d (Pi + X)', alg: "y x r B R' B' R r z' r' R r" },
            { name: '7a (Pi + Horizontal U)', alg: "y' x B r' R r' R' r B r'" },
            { name: '7b (Pi + Horizontal U)', alg: "y2 x r' z R r' R r z r' B' r" },
            { name: '7c (Pi + Horizontal U)', alg: "y' x r B' r' R r R' r B'" },
            { name: '7d (Pi + Horizontal U)', alg: "y2 x B' r z R r' R' r z' B' r" },
            { name: '8a (Pi + Horizontal U)', alg: "x R' r R' B b r' R r'" },
            { name: '8b (Pi + Horizontal U)', alg: "x R' r B R' B' r2' R' r" },
            { name: '8c (Pi + Horizontal U)', alg: "H z H z H" },
            { name: '8d (Pi + Horizontal U)', alg: "H z S z H" },
            { name: '9a (Pi + Vertical U)', alg: "y' x B' r' R r R B' R' r' R' r B'" },
            { name: '9b (Pi + Vertical U)', alg: "S z2 S z' S S" },
            { name: '10a (Pi + Vertical U)', alg: "x z r B r B' r' B'" },
            { name: '10b (Pi + Vertical U)', alg: "x B' r' B' r B r" },
            { name: '11a (Pi + O)', alg: "y' x R r' R' r' R r R' z' r' R r" },
            { name: '11b (Pi + O)', alg: "x r' R r R r' R' r z R r' R'" },
            { name: '11c (Pi + O)', alg: "y x r R' r B r' R B" },
            { name: '11d (Pi + O)', alg: "z H z H z2 H" },
            { name: '12a (Pi + O)', alg: "z S z' x' S z2 S" },
            { name: '12b (Pi + O)', alg: "z2 H z x S z2 S" },
            { name: '12c (Pi + O)', alg: "z H y' z' S z2 S" },
            { name: '12d (Pi + O)', alg: "z2 S x y' S z2 S" },
            { name: '13a (Pi + Z Conjugate)', alg: "y x r' R' r' R' z' r' R r R B'" },
            { name: '13b (Pi + Z Conjugate)', alg: "y' x B R B' r B R' B' r'" },
            { name: '13c (Pi + Z Conjugate)', alg: "x r B R B' r' B R' B'" },
            { name: '13d (Pi + Z Conjugate)', alg: "x B' r' R' r B r' R r" },
            { name: '14a (Pi + Z Conjugate)', alg: "z' H z' S z S" },
            { name: '14b (Pi + Z Conjugate)', alg: "z H z' H z S" },
            { name: '14c (Pi + Z Conjugate)', alg: "z' S z H z' H" },
            { name: '14d (Pi + Z Conjugate)', alg: "z S z S z' H" },
            { name: '15a (Pi + Triple Sledge)', alg: "S S y S S S" },
            { name: '15b (Pi + Triple Sledge)', alg: "y' S S y' S S S" },
            { name: '16 (Pi + H/Z)', alg: "z' S z2 S z2 S" },
            { name: '17a (Pi + H/Z)', alg: "z S z' H z H z' S z H" },
            { name: '17b (Pi + H/Z)', alg: "z S z H z' H z S z' H" },
            { name: '18a (Peanut + Swirl)', alg: "H z H z' H z H" },
            { name: '18b (Peanut + Swirl)', alg: "z' S z' S z S z' S" },
            { name: '18c (Peanut + Swirl)', alg: "z2 S z' H z S z' H" },
            { name: '18d (Peanut + Swirl)', alg: "z H z S z' H z S" },
            { name: '18e (Peanut + Swirl)', alg: "y' x B r' R r R' z R r' R r" },
            { name: '18f (Peanut + Swirl)', alg: "z' H z' H z H z' H" },
            { name: '18g (Peanut + Swirl)', alg: "z2 H z' S z H z' S" },
            { name: '18h (Peanut + Swirl)', alg: "z S z H z' S z H" },
            { name: '19a (Peanut + Wat)', alg: "z' H z S y' S z2 S" },
            { name: '19b (Peanut + Wat)', alg: "S z' H y S z2 S" },
            { name: '19c (Peanut + Wat)', alg: "z S z' S y S z2 S" },
            { name: '19d (Peanut + Wat)', alg: "z2 H z' H y' S z2 S" },
            { name: '19e (Peanut + Wat)', alg: "z2 S z2 S z' S z' S" },
            { name: '19f (Peanut + Wat)', alg: "z S z2 S z H z H" },
            { name: '19g (Peanut + Wat)', alg: "z2 S z2 S z H z S" },
            { name: '19h (Peanut + Wat)', alg: "z S z2 S z' S z' H" }
        ]
    });

    // ==================== Pyraminx — Last Layer (L3E) ====================
    merge('Pyraminx', {
        'Last Layer': [
            { name: 'Sune', alg: "R U R' U R U R'", setup: "L' U' L U' L' U' L" },
            { name: 'Anti Sune', alg: "R' U' R U' R' U' R", setup: "R U R' U R U R'" },
            { name: 'Lefty Bars', alg: "R' U' L' U L R", setup: "R' L' U' L U R" },
            { name: 'Righty Bars', alg: "U' R' L' U' L U R", setup: "L R U R' U' L'" },
            { name: '2 Flip', alg: "L R' L' R U' R U R'", setup: "U' R' U L' U L U' R" }
        ]
    });
})();
