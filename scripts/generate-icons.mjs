// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten: DPSG-blaue Fläche, beiges Lagerhaus,
// grüner Rüsthaus-Strich. Aufruf: npm run icons
// Wer ein eigenes Logo nutzen will, ersetzt einfach die Dateien in public/.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLAU = [0, 48, 86];
const BEIGE = [236, 223, 203];
const GRUEN = [70, 187, 0];

const crcTabelle = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(breite, hoehe, rgba) {
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0;
    rgba.copy(roh, y * (breite * 4 + 1) + 1, y * breite * 4, (y + 1) * breite * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function imPolygon(x, y, pts) {
  let drin = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}
function imRundRechteck(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Farbe an Position (0..1) oder null für transparent. */
function farbe(x, y, maskable) {
  if (!maskable && !imRundRechteck(x, y, 0.2)) return null;
  // Inhalt bei maskable auf die sichere Zone (80 %) verkleinern
  const s = maskable ? 0.78 : 1;
  const u = (x - 0.5) / s + 0.5;
  const v = (y - 0.5) / s + 0.5;
  const haus = [
    [0.22, 0.47],
    [0.5, 0.22],
    [0.78, 0.47],
    [0.78, 0.74],
    [0.22, 0.74],
  ];
  const tor = u > 0.39 && u < 0.61 && v > 0.53 && v < 0.74;
  const torStreifen = tor && Math.floor((v - 0.53) / 0.042) % 2 === 1;
  if (u > 0.18 && u < 0.82 && v > 0.79 && v < 0.835) return GRUEN;
  if (imPolygon(u, v, haus)) {
    if (tor) return torStreifen ? [5, 70, 121] : BLAU;
    return BEIGE;
  }
  return BLAU;
}

function icon(groesse, maskable) {
  const rgba = Buffer.alloc(groesse * groesse * 4);
  const ss = 4;
  for (let py = 0; py < groesse; py++) {
    for (let px = 0; px < groesse; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const f = farbe((px + (sx + 0.5) / ss) / groesse, (py + (sy + 0.5) / ss) / groesse, maskable);
          if (f) {
            r += f[0];
            g += f[1];
            b += f[2];
            a++;
          }
        }
      }
      const i = (py * groesse + px) * 4;
      const n = ss * ss;
      if (a) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return png(groesse, groesse, rgba);
}

writeFileSync('public/icon-192.png', icon(192, false));
writeFileSync('public/icon-512.png', icon(512, false));
writeFileSync('public/icon-512-maskable.png', icon(512, true));
writeFileSync('public/apple-touch-icon.png', icon(180, true));
console.log('Icons erzeugt: public/icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png');
