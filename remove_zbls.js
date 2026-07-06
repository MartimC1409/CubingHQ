const fs = require('fs');

let content = fs.readFileSync('algorithms.js', 'utf8');
content = content.replace('const ALGORITHMS = ', '');
content = content.replace(/;\s*$/, '');
let ALGORITHMS = JSON.parse(content);

if (ALGORITHMS["3x3"] && ALGORITHMS["3x3"]["ZBLS"]) {
    delete ALGORITHMS["3x3"]["ZBLS"];
    fs.writeFileSync('algorithms.js', 'const ALGORITHMS = ' + JSON.stringify(ALGORITHMS, null, 4) + ';\n');
    console.log("Removed ZBLS!");
}
