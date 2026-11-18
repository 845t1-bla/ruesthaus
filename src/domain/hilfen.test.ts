import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { belegNummer, normalisiereName } from './format';
import { inventurSummen, inventurZeilen } from './inventur';
import { variantenKombinationen, variantenLabel } from './varianten';
import type { Variante, Zaehlung } from './types';

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
    const s = variantenKombinationen({ achsen: ['kollektion', 'schnitt', 'groesse'], groessen: ['S', 'M'] });
    expect(s).toHaveLength(8);
    expect(variantenKombinationen({ achsen: [], groessen: [] })).toEqual([{ attribute: {}, sortierung: 0 }]);
  });
  it('beschriftet Varianten verständlich', () => {
    expect(variantenLabel({ kollektion: 'neu', schnitt: 'damen', groesse: 'M' })).toBe('neue Kollektion · Damen · Gr. M');
    expect(variantenLabel({})).toBe('Standardgröße');
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
