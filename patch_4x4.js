const fs = require('fs');

let content = fs.readFileSync('algorithms.js', 'utf8');
content = content.replace('const ALGORITHMS = ', '');
content = content.replace(/;\s*$/, '');
let ALGORITHMS = JSON.parse(content);

ALGORITHMS["4x4"] = {
    "OLL Parity": [
        {
            "name": "Standard OLL Parity",
            "alg": "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"
        },
        {
            "name": "Lucas Parity",
            "alg": "Rw U2 Rw U2 Rw' U2 Rw U2 Lw' U2 Rw U2 Rw' U2 x' Rw' U2 Rw'"
        }
    ],
    "PLL Parity": [
        {
            "name": "Opposite Parity",
            "alg": "2R2 U2 2R2 Uw2 2R2 Uw2"
        },
        {
            "name": "Adjacent Parity",
            "alg": "R' U R U' 2R2 U2 2R2 Uw2 2R2 Uw2 U' R' U' R"
        },
        {
            "name": "O-Perm",
            "alg": "2R2 U2 2R2 Uw2 2R2 Uw2 R U R' F' R U R' U' R' F R2 U' R' U'"
        },
        {
            "name": "W-Perm",
            "alg": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R' 2R2 U2 2R2 Uw2 2R2 Uw2"
        }
    ]
};

fs.writeFileSync('algorithms.js', 'const ALGORITHMS = ' + JSON.stringify(ALGORITHMS, null, 4) + ';\n');
console.log("4x4 fixed!");
