'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Deliberate allowlist: no backups, source configuration, or secrets reach hosting.
const output = path.join(__dirname, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'script.js', 'quran-data.js', 'quran.js']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
}
console.log('Built static interface in dist/');
