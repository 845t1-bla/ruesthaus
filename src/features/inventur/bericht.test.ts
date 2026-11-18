import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { inventurCsv, inventurPdf } from './bericht';
import type { Inventur } from '../../domain/types';

const inventur: Inventur = {
  id: 'x',
  bezeichnung: 'Inventur 2026 – Test',
  stichtag: new Date(2026, 10, 18).getTime(),
  status: 'abgeschlossen',
  gestartetVon: 'Test Admin',
  gestartetAm: new Date(2026, 10, 18, 9).getTime(),
  abgeschlossenVon: 'Test Admin',
  abgeschlossenAm: new Date(2026, 10, 18, 11).getTime(),
  ergebnis: [
    { varianteId: 'a', artikel: 'Aufnäher Deutschlandflagge', variante: 'Standardgröße', kategorie: 'aufnaeher', soll: 3, ist: 10, differenz: 7, ekPreis: 0.9, gezaehlt: true },
    { varianteId: 'b', artikel: 'Kluft', variante: 'Gr. 152 · benäht', kategorie: 'kluft', soll: 5, ist: 4, differenz: -1, ekPreis: 38, gezaehlt: true },
    { varianteId: 'c', artikel: 'Stammes-Hoodie', variante: 'neue Kollektion · Damen · Gr. M', kategorie: 'stammeskleidung', soll: 2, ist: 0, differenz: -2, ekPreis: 22, gezaehlt: false },
  ],
};

/** Liest den sichtbaren Text aus den (komprimierten) Inhaltsströmen eines PDFs. */
function pdfText(buf: Buffer): string {
  const roh = buf.toString('latin1');
  const teile: string[] = [];
  for (const m of roh.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let inhalt: string;
    try {
      inhalt = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      inhalt = m[1];
    }
    for (const t of inhalt.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) teile.push(t[1].replace(/\\(.)/g, '$1'));
  }
  return teile.join(' | ');
}

describe('Inventurbericht', () => {
  it('erzeugt ein PDF mit Kopf, Kennzahlen, Positionen und Unterschriften', async () => {
    const blob = await inventurPdf(inventur, 'DPSG Stamm Horsadal Roßtal');
    const buf = Buffer.from(await blob.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(buf);
    expect(text).toContain('Inventurbericht');
    expect(text).toContain('DPSG Stamm Horsadal Roßtal - Rüsthaus');
    expect(text).toContain('Inventur 2026 - Test'); // Gedankenstrich ersetzt
    expect(text).toContain('Stichtag 18.11.2026');
    expect(text).toContain('Aufnäher Deutschlandflagge');
    expect(text).toContain('+7');
    expect(text).toContain('nicht gezählt');
    expect(text).toContain('Kassenprüfer/in');
    expect(text).toContain('152,00 EUR'); // Lagerwert Ist: 10×0,90 + 4×38
    expect(text).not.toContain('€');
  });

  it('exportiert die Zeilen als CSV', () => {
    const csv = inventurCsv(inventur);
    expect(csv).toContain('Kategorie;Artikel;Variante;Soll;Ist;Differenz');
    expect(csv).toContain('Kluft;Kluft;Gr. 152 · benäht;5;4;-1;38,00;190,00;152,00;-38,00;ja');
    expect(csv).toContain('nein (= 0)');
  });
});
