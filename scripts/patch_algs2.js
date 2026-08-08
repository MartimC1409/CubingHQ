const fs = require('fs');

let content = fs.readFileSync('algorithms.js', 'utf8');
content = content.replace('const ALGORITHMS = ', '');
content = content.replace(/;\s*$/, '');
let ALGORITHMS = JSON.parse(content);

// 1. Convert ZBLL flat subsets to a nested object
if (ALGORITHMS["3x3"]["ZBLL Pi"]) {
    ALGORITHMS["3x3"]["ZBLL"] = {
        "Pi": ALGORITHMS["3x3"]["ZBLL Pi"],
        "U": ALGORITHMS["3x3"]["ZBLL U"],
        "T": ALGORITHMS["3x3"]["ZBLL T"],
        "L": ALGORITHMS["3x3"]["ZBLL L"],
        "H": ALGORITHMS["3x3"]["ZBLL H"],
        "S": ALGORITHMS["3x3"]["ZBLL S"],
        "AS": ALGORITHMS["3x3"]["ZBLL AS"]
    };
    delete ALGORITHMS["3x3"]["ZBLL Pi"];
    delete ALGORITHMS["3x3"]["ZBLL U"];
    delete ALGORITHMS["3x3"]["ZBLL T"];
    delete ALGORITHMS["3x3"]["ZBLL L"];
    delete ALGORITHMS["3x3"]["ZBLL H"];
    delete ALGORITHMS["3x3"]["ZBLL S"];
    delete ALGORITHMS["3x3"]["ZBLL AS"];
}

fs.writeFileSync('algorithms.js', 'const ALGORITHMS = ' + JSON.stringify(ALGORITHMS, null, 4) + ';\n');
console.log("Algorithms nested!");
