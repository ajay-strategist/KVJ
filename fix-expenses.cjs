// Deep-repair: read file as UTF-8, extract raw byte values from each char code,
// rebuild as proper UTF-8 with correct Unicode chars.
const fs = require('fs');

const file = 'src/pages/Expenses.jsx';
const raw = fs.readFileSync(file); // raw Buffer (bytes)

// Strategy: the damage is that bytes >= 0x80 were re-encoded as UTF-8.
// We need to UNDO that. Walk the buffer, detect 2-byte UTF-8 sequences
// where the decoded code point is in U+0080-U+00FF (i.e., it's a doubled byte),
// and collapse them back to 1 byte. Then decode as UTF-8 and fix mojibake.
function undoDoubleEncode(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b >= 0xC2 && b <= 0xC3 && i + 1 < buf.length && (buf[i+1] & 0xC0) === 0x80) {
      // 2-byte UTF-8 sequence → code point in U+0080-U+00FF
      const cp = ((b & 0x1F) << 6) | (buf[i+1] & 0x3F);
      if (cp >= 0x80 && cp <= 0xFF) {
        // This looks like a re-encoded latin1 byte — collapse to 1 byte
        out.push(cp);
        i += 2;
        continue;
      }
    }
    if (b >= 0xF0 && b <= 0xF4 && i + 3 < buf.length) {
      // 4-byte UTF-8: proper emoji/etc — keep as-is
      out.push(b, buf[i+1], buf[i+2], buf[i+3]);
      i += 4;
      continue;
    }
    if (b >= 0xE0 && b <= 0xEF && i + 2 < buf.length) {
      // 3-byte UTF-8 — keep as-is (could be ₹, ─ etc already correct)
      out.push(b, buf[i+1], buf[i+2]);
      i += 3;
      continue;
    }
    out.push(b);
    i++;
  }
  return Buffer.from(out);
}

const repaired = undoDoubleEncode(raw);

// Now repaired should be original bytes — apply mojibake fixes
const mojibake = [
  [Buffer.from([0xE2,0x82,0xB9]), '₹'],  // ₹ rupee
  [Buffer.from([0xE2,0x94,0x80]), '─'],  // ─ box
  [Buffer.from([0xE2,0x95,0x90]), '═'],  // ═ double box
  [Buffer.from([0xE2,0x80,0x94]), '—'],  // — em dash
  [Buffer.from([0xE2,0x80,0x93]), '–'],  // – en dash
  [Buffer.from([0xC2,0xB7]),      '·'],  // · middle dot
  [Buffer.from([0xC2,0xA0]),      ' '],  // NBSP
];

let text = repaired.toString('latin1');
mojibake.forEach(([bytes, good]) => {
  // Represent the bytes as latin1 string to match
  const bad = bytes.toString('latin1');
  text = text.split(bad).join(good);
});

// Also replace any stray garbled comment divider sequences with plain dashes
// (these come from many box-drawing chars that couldn't be undone perfectly)
text = text.replace(/[^\x00-\x7F\u20B9\u2014\u2013\u2018\u2019\u201C\u201D\u00B7\u2500\u2550\u2502\u2551\u2192\u2190\u2713\u25CF\u2714\u20AC\u00A9\u00AE\u2026\u00B0\u00BD\u2F00-\u9FFF\uF900-\uFAFF\u{1F000}-\u{1FFFF}]/gu, '?');

fs.writeFileSync(file, text, 'utf8');
console.log('Repaired Expenses.jsx. Size:', Buffer.byteLength(text, 'utf8'), 'bytes');
