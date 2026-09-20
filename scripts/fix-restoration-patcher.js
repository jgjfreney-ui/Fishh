#!/usr/bin/env node
'use strict';

const fs = require('fs');
const file = 'scripts/apply-restoration-fixes.js';
let src = fs.readFileSync(file, 'utf8');

const oldBlock = `exact(
\`        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of everything</b> caught. You\\'re at ' + Object.keys(state.discovered).length + '... keep going!</div>';\n\`,
\`        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of the pre-Sanctuary collection</b>. You\\'re at ' + completion.done + '/' + completion.total + '... keep going!</div>';\n\`,
  'boat Kraken progress text'
);`;

const newBlock = `regex(
/        html \\+= '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of everything<\\/b> caught\\. You(?:\\\\)?'re at ' \\+ Object\\.keys\\(state\\.discovered\\)\\.length \\+ '\\.\\.\\. keep going!<\\/div>';\\n/,
\`        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of the pre-Sanctuary collection</b>. You\\'re at ' + completion.done + '/' + completion.total + '... keep going!</div>';\n\`,
  'boat Kraken progress text'
);`;

if (!src.includes(oldBlock)) {
  if (src.includes("'boat Kraken progress text'")) throw new Error('Boat progress patch exists but its expected block changed');
  console.log('Boat progress patch already transformed.');
  process.exit(0);
}
src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src);
console.log('Hardened boat progress patch matching.');
