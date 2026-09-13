const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');

const replacements = [
  ['function renderProviderSearchfunction renderProviderSearch', 'function renderProviderSearch'],
  ['async function readResponseasync function readResponse', 'async function readResponse'],
  ['function requiresModelfunction requiresModel', 'function requiresModel'],
  ['async function testKeyAtasync function testKeyAt', 'async function testKeyAt'],
  ['async function testAllKeysasync function testAllKeys', 'async function testAllKeys'],
  ['function clearAllfunction clearAll', 'function clearAll']
];

for (const [bad, good] of replacements) {
  if (html.includes(bad)) html = html.replaceAll(bad, good);
}

fs.writeFileSync(file, html);
