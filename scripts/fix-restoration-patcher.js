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
\`        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of the pre-Sanctuary collection</b>. Progress: ' + completion.done + '/' + completion.total + '... keep going!</div>';\n\`,
  'boat Kraken progress text'
);`;

if (!src.includes(oldBlock)) {
  if (src.includes("'boat Kraken progress text'")) {
    // A previous hardening pass may already have transformed the block. Ensure
    // its generated message cannot break the single-quoted game.js string.
    src = src.replace(
      "You\\\\'re at ' + completion.done + '/' + completion.total + '... keep going!</div>';\\n`",
      "Progress: ' + completion.done + '/' + completion.total + '... keep going!</div>';\\n`"
    );
    fs.writeFileSync(file, src);
    console.log('Boat progress patch already transformed; normalised generated text.');
    process.exit(0);
  }
  console.log('Boat progress patch not present; nothing to harden.');
  process.exit(0);
}
src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src);
console.log('Hardened boat progress patch matching.');
