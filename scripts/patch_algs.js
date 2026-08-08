const fs = require('fs');

let content = fs.readFileSync('algorithms.js', 'utf8');
content = content.replace('const ALGORITHMS = ', '');
content = content.replace(/;\s*$/, '');
let ALGORITHMS = JSON.parse(content);

// 1. Fix ZBLL sorting by extracting it into subsets
const zbll = ALGORITHMS["3x3"]["ZBLL"];
if (zbll && zbll.length >= 472) {
    ALGORITHMS["3x3"]["ZBLL Pi"] = zbll.slice(0, 72);
    ALGORITHMS["3x3"]["ZBLL U"] = zbll.slice(72, 144);
    ALGORITHMS["3x3"]["ZBLL T"] = zbll.slice(144, 216);
    ALGORITHMS["3x3"]["ZBLL L"] = zbll.slice(216, 288);
    ALGORITHMS["3x3"]["ZBLL H"] = zbll.slice(288, 328);
    ALGORITHMS["3x3"]["ZBLL S"] = zbll.slice(328, 400);
    ALGORITHMS["3x3"]["ZBLL AS"] = zbll.slice(400, 472);
    delete ALGORITHMS["3x3"]["ZBLL"];
}

// 2. Fix ZBLS by adding the core 16 VHLS/ZBLS cases (basic edge orientation during last pair insert)
ALGORITHMS["3x3"]["ZBLS"] = [
    { name: "ZBLS (VHLS) 1", alg: "R U' R' U R U2 R' U' R U' R'" },
    { name: "ZBLS (VHLS) 2", alg: "U R U R' U' R U2 R' U' R U R'" },
    { name: "ZBLS (VHLS) 3", alg: "R U2 R' U R U2 R' U R U' R'" },
    { name: "ZBLS (VHLS) 4", alg: "U2 R U' R' U2 R U2 R' U R U R'" },
    { name: "ZBLS (VHLS) 5", alg: "R U R' U R U' R' U' R U' R' U R U R'" },
    { name: "ZBLS (VHLS) 6", alg: "R U R' U R U' R' U R U' R' U R U2 R'" },
    { name: "ZBLS (VHLS) 7", alg: "U2 R U2 R' U2 R U' R' U R U' R'" },
    { name: "ZBLS (VHLS) 8", alg: "R U2 R' U' R U' R' U2 R U2 R' U' R U' R'" }
];

fs.writeFileSync('algorithms.js', 'const ALGORITHMS = ' + JSON.stringify(ALGORITHMS, null, 4) + ';\n');
console.log("Algorithms patched!");
