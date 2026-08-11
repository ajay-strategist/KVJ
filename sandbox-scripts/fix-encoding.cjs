const fs = require('fs');
const path = require('path');

function collectFiles(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules','.git','dist','build'].includes(e.name)) collectFiles(full, exts, out);
    else if (e.isFile() && exts.includes(path.extname(e.name))) out.push(full);
  }
  return out;
}

// Mojibake map: Windows-1252 byte sequences that represent garbled UTF-8 chars
// These appear when UTF-8 bytes are read as Windows-1252 then re-saved as UTF-8
const fixes = [
  ['\u00e2\u0082\u00b9', '₹'],   // ₹ Rupee
  ['\u00e2\u0094\u0080', '─'],   // ─ box drawing
  ['\u00e2\u0095\u0090', '═'],   // ═ box drawing double
  ['\u00e2\u0095\u0091', '║'],   // ║
  ['\u00e2\u0095\u00a0', '╠'],
  ['\u00e2\u0080\u0094', '—'],   // — em dash
  ['\u00e2\u0080\u0093', '–'],   // – en dash
  ['\u00e2\u0080\u0098', '\u2018'], // '
  ['\u00e2\u0080\u0099', '\u2019'], // '
  ['\u00e2\u0080\u009c', '\u201c'], // "
  ['\u00e2\u0080\u009d', '\u201d'], // "
  ['\u00c2\u00b7', '·'],         // · middle dot
  ['\u00c2\u00a0', ' '],         // NBSP → space
  ['\u00e2\u0086\u0092', '→'],
  ['\u00e2\u009c\u0093', '✓'],
  ['\u00e2\u0097\u008f', '●'],
];

const root = __dirname;
const files = [
  ...collectFiles(path.join(root,'src'),['.js','.jsx']),
  ...collectFiles(path.join(root,'server'),['.js']),
];

let fixed = 0;
files.forEach(fp => {
  // Step 1: read raw bytes
  const raw = fs.readFileSync(fp);
  
  // Step 2: Check if file was double-encoded by detecting surrogate-free overgrowth.
  // Strategy: decode as UTF-8, check if ALL non-ASCII chars are in U+0080-U+00FF.
  // If so, the file was damaged (every original byte 0x80-0xFF became 2 UTF-8 bytes).
  let str = raw.toString('utf8');
  const nonAscii = [...str].filter(c => c.charCodeAt(0) > 0x7F);
  const allLow = nonAscii.every(c => c.charCodeAt(0) <= 0xFF);
  
  if (allLow && nonAscii.length > 0) {
    // Reverse the damage: each char code → raw byte → correct UTF-8 string
    const revBytes = Buffer.from([...str].map(c => c.charCodeAt(0) & 0xFF));
    // Now revBytes contains the original file bytes (either correct UTF-8 or mojibake)
    // Try decoding as UTF-8 first
    let recovered = revBytes.toString('latin1'); // read as latin1 to do mojibake fixes
    let changed = false;
    fixes.forEach(([bad, good]) => {
      if (recovered.includes(bad)) { recovered = recovered.split(bad).join(good); changed = true; }
    });
    fs.writeFileSync(fp, recovered, 'utf8');
    console.log(`Repaired${changed?' + fixed':''}: ${path.relative(root,fp)}`);
    fixed++;
  } else {
    // File is already proper UTF-8 — just apply mojibake fixes to any remaining issues
    let changed = false;
    // Read as latin1 for mojibake pattern matching
    let content = raw.toString('latin1');
    fixes.forEach(([bad, good]) => {
      if (content.includes(bad)) { content = content.split(bad).join(good); changed = true; }
    });
    if (changed) {
      fs.writeFileSync(fp, content, 'utf8');
      console.log(`Fixed: ${path.relative(root,fp)}`);
      fixed++;
    }
  }
});

console.log(`\nDone. Processed ${fixed} file(s).`);
