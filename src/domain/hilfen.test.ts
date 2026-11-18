import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { belegNummer, normalisiereName } from './format';
import { inventurSummen, inventurZeilen } from './inventur';
import {
  hatMatrix,
  matrixSpalten,
  matrixZelle,
  ordneVariantenZu,
  variantenKombinationen,
  variantenLabel,
  variantenSchluessel,
} from './varianten';
import { normalisiereSchnitt, type Achse, type Variante, type Zaehlung } from './types';

describe('CSV', () => {
  it('nutzt BOM, Semikolon, Dezimalkomma und maskiert Sonderzeichen', () => {
    const csv = toCsv(
      [
        { titel: 'Artikel', wert: (r: { a: string; n: number; p: number }) => r.a },
        { titel: 'Menge', wert: (r) => r.n },
        { titel: 'Preis', wert: (r) => r.p, stellen: 2 },
      ],
      [
        { a: 'Kluft; Gr. "152"', n: 3, p: 40 },
        { a: 'Halstuch', n: 1, p: 12.5 },
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿Artikel;Menge;Preis\r\n"Kluft; Gr. ""152""";3;40,00\r\nHalstuch;1;12,50\r\n');
  });
});

describe('Namen und Belege', () => {
  it('normalisiert Umlaute und Leerzeichen', () => {
    expect(normalisiereName('  Jörg   MÜLLER ')).toBe('joerg mueller');
    expect(normalisiereName('Strauß')).toBe('strauss');
    expect(normalisiereName('Renée')).toBe('renee');
  });
  it('erzeugt lesbare Belegnummern', () => {
    expect(belegNummer('FLATRATE', new Date(2027, 0, 5).getTime(), 'k3f9xyz')).toBe('F-270105-K3F9');
  });
});

describe('Varianten', () => {
  it('erzeugt das Kreuzprodukt in Anzeige-Reihenfolge', () => {
    const k = variantenKombinationen({ achsen: ['groesse', 'zustand'], groessen: ['140', '152'] });
    expect(k).toHaveLength(6);
    expect(k[0].attribute).toEqual({ groesse: '140', zustand: 'unbenaeht' });
    expect(k[5].attribute).toEqual({ groesse: '152', zustand: 'sozial' });
    const s = variantenKombinationen({ achsen: ['kollektion', 'schnitt', 'groesse'], groessen: ['S', 'M'], schnitte: ['Herren', 'Damen'] });
    expect(s).toHaveLength(8);
    expect(variantenKombinationen({ achsen: [], groessen: [] })).toEqual([{ attribute: {}, sortierung: 0 }]);
  });

  it('nutzt frei definierte Schnitte und lässt ausgeschlossene Kombinationen weg', () => {
    const kluft = { achsen: ['schnitt', 'groesse', 'zustand'] as Achse[], groessen: ['140', '152'], schnitte: ['Normal', 'Schlank'] };
    expect(variantenKombinationen(kluft)).toHaveLength(12);
    // Schlanker Schnitt gibt es nicht in Größe 140 → ganze Matrix-Zelle (alle 3 Zustände) ausschließen
    const zelle = matrixZelle(kluft, '140', { schnitt: 'Schlank' });
    expect(zelle.schluessel).toHaveLength(3);
    const ohne = variantenKombinationen({ ...kluft, ausgeschlossen: zelle.schluessel });
    expect(ohne).toHaveLength(9);
    expect(ohne.some((k) => k.attribute.groesse === '140' && k.attribute.schnitt === 'Schlank')).toBe(false);
    expect(ohne.map((k) => k.sortierung)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(variantenSchluessel({ schnitt: 'Schlank', groesse: '140', zustand: 'benaeht' })).toBe(zelle.schluessel[1]);
  });

  it('übernimmt beim nachträglichen Schnitt die alten Varianten als ersten Schnitt', () => {
    const alt = [
      { id: 'a', attribute: { groesse: '140', zustand: 'benaeht' as const } },
      { id: 'b', attribute: { groesse: '152', zustand: 'benaeht' as const } },
      { id: 'c', attribute: { groesse: '176', zustand: 'benaeht' as const } }, // Größe gestrichen
    ];
    const { zuordnung, ueberzaehlig } = ordneVariantenZu(
      { achsen: ['schnitt', 'groesse', 'zustand'], groessen: ['140', '152'], schnitte: ['Normal', 'Schlank'] },
      alt,
    );
    const normal140 = zuordnung.find((z) => z.attribute.groesse === '140' && z.attribute.schnitt === 'Normal' && z.attribute.zustand === 'benaeht');
    expect(normal140?.variante?.id).toBe('a');
    expect(normal140?.attributeAendern).toBe(true);
    expect(zuordnung.find((z) => z.attribute.schnitt === 'Schlank' && z.variante)).toBeUndefined();
    expect(ueberzaehlig.map((v) => v.id)).toEqual(['c']);
  });

  it('baut die Matrix nur bei Größe plus Kollektion oder Schnitt', () => {
    expect(hatMatrix({ achsen: ['groesse', 'zustand'], groessen: ['140'] })).toBe(false);
    expect(hatMatrix({ achsen: ['groesse', 'schnitt'], groessen: ['140'], schnitte: ['Normal', 'Schlank'] })).toBe(true);
    expect(matrixSpalten({ achsen: ['kollektion', 'schnitt', 'groesse'], groessen: ['M'], schnitte: ['Herren', 'Damen'] }).map((s) => s.label)).toEqual([
      'neue Kollektion · Herren',
      'neue Kollektion · Damen',
      'alte Kollektion · Herren',
      'alte Kollektion · Damen',
    ]);
  });

  it('beschriftet Varianten verständlich', () => {
    expect(variantenLabel({ kollektion: 'neu', schnitt: 'Damen', groesse: 'M' })).toBe('neue Kollektion · Gr. M · Damen');
    expect(variantenLabel({ groesse: '152', schnitt: 'Schlank', zustand: 'benaeht' })).toBe('Gr. 152 · Schlank · benäht');
    expect(variantenLabel({})).toBe('Standardgröße');
  });

  it('übersetzt alte Schnitt-Werte', () => {
    expect(normalisiereSchnitt('herren')).toBe('Herren');
    expect(normalisiereSchnitt('damen')).toBe('Damen');
    expect(normalisiereSchnitt('Schlank')).toBe('Schlank');
    expect(normalisiereSchnitt(undefined)).toBeUndefined();
  });
});

describe('Inventur', () => {
  const basis = (id: string, bestand: number, ek: number, aktiv = true): Variante => ({
    id,
    artikelId: 'a',
    artikelName: 'Halstuch',
    kategorie: 'halstuch',
    attribute: {},
    sortierung: 0,
    vkPreis: 10,
    ekDurchschnitt: ek,
    bestand,
    mindestbestand: null,
    aktiv,
  });
  it('setzt Ungezähltes auf 0 und summiert Werte', () => {
    const varianten = [basis('a', 5, 2), basis('b', 2, 10), basis('alt', 0, 1, false)];
    const z = new Map<string, Zaehlung>([['a', { varianteId: 'a', ist: 4, gezaehltVon: 'X', zeit: 0 }]]);
    const zeilen = inventurZeilen(varianten, z);
    expect(zeilen).toHaveLength(2); // inaktiv ohne Bestand fällt raus
    const s = inventurSummen(zeilen);
    expect(s).toMatchObject({ gezaehlt: 1, nichtGezaehlt: 1, abweichungen: 2, wertSoll: 30, wertIst: 8, wertDifferenz: -22 });
  });
});
