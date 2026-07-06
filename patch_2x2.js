const fs = require('fs');

let content = fs.readFileSync('algorithms.js', 'utf8');
content = content.replace('const ALGORITHMS = ', '');
content = content.replace(/;\s*$/, '');
let ALGORITHMS = JSON.parse(content);

// Group 2x2 into a single subset
if (ALGORITHMS["2x2"]["CLL"]) {
    ALGORITHMS["2x2"]["EG Method"] = {
        "CLL": ALGORITHMS["2x2"]["CLL"],
        "EG1": ALGORITHMS["2x2"]["EG1"],
        "EG2": ALGORITHMS["2x2"]["EG2"]
    };
    delete ALGORITHMS["2x2"]["CLL"];
    delete ALGORITHMS["2x2"]["EG1"];
    delete ALGORITHMS["2x2"]["EG2"];
}

// Convert 2R notation to Rw and 2L to Lw for 4x4 Parity (common fix for twisty-player parsing)
// Actually, 2R means inner slice. Rw means right outer+inner.
// Parity algs in 4x4 like 2R2 U2 2R2 Uw2 2R2 Uw2 might use 2R for inner slice.
// twisty-player supports `2R`, but maybe the user wants it to be standard Rw?
// Wait, OPP parity is often executed as r2 U2 r2 Uw2 r2 Uw2, where r means inner slice (sometimes written as Rw in WCA, but that's thick).
// Let's replace 2R with 2R, wait no, let's replace `2R` with `2R`?
// Let's just fix common syntax issues for twisty-player if any.
// If twisty-player throws error for 2R, we can map it.
// Speedcubedb often uses '2R' which is valid in cubing.js.
// Is there another issue? Let's check the parity names.
// "fix 4x4 parities" - maybe they don't show up correctly?
// I will output the file to see.

fs.writeFileSync('algorithms.js', 'const ALGORITHMS = ' + JSON.stringify(ALGORITHMS, null, 4) + ';\n');
console.log("2x2 grouped!");
