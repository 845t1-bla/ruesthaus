import { describe, expect, it } from 'vitest';
import {
  BuchungsFehler,
  bucheAbgang,
  bucheEinkauf,
  bucheFlatrate,
  bucheFlatrateTausch,
  bucheInventurKorrektur,
  bucheSozialkluft,
  bucheStorno,
  bucheVerkauf,
  bucheZugang,
  neuerDurchschnittsEk,
  rabattFehler,
  umsatzVon,
  type BuchungsKontext,
} from './vorgaenge';
import type { Variante } from './types';

const ctx: BuchungsKontext = { id: 'abcd1234', uid: 'u1', benutzerName: 'Anna', jetzt: new Date(2026, 10, 18, 10, 0).getTime() };

function v(id: string, teil: Partial<Variante> = {}): Variante {
  return {
    id,
    artikelId: 'a-' + id,
    artikelName: 'Artikel ' + id,
    kategorie: 'sonstiges',
    attribute: {},
    sortierung: 0,
    vkPreis: 10,
    ekDurchschnitt: 4,
    bestand: 5,
    mindestbestand: null,
    aktiv: true,
    ...teil,
  };
}

const kluft = (id: string, zustand: 'unbenaeht' | 'benaeht' | 'sozial', groesse = '152') =>
  v(id, { artikelName: 'Kluft', kategorie: 'kluft', attribute: { groesse, zustand }, vkPreis: 55, ekDurchschnitt: 35 });
const lilie = v('lilie', { artikelName: 'Aufnäher Lilie', kategorie: 'aufnaeher', vkPreis: 3, ekDurchschnitt: 1.2 });
const stamm = v('stamm', { artikelName: 'Aufnäher Stamm', kategorie: 'aufnaeher', vkPreis: 4, ekDurchschnitt: 1.5 });

describe('Verkauf', () => {
  it('bucht Bestand ab und berechnet die Summe', () => {
    const b = bucheVerkauf(ctx, { kaeufer: '  Max  Müller ', zeilen: [{ variante: v('x'), menge: 2, preis: 10 }] });
    expect(b.vorgang.typ).toBe('VERKAUF');
    expect(b.vorgang.kaeufer).toBe('Max Müller');
    expect(b.vorgang.kaeuferKey).toBe('max mueller');
    expect(b.vorgang.summe).toBe(20);
    expect(b.bestand).toEqual({ x: -2 });
    expect(b.vorgang.belegNr).toBe('V-261118-ABCD');
  });

  it('verlangt einen Käufer', () => {
    expect(() => bucheVerkauf(ctx, { kaeufer: ' ', zeilen: [{ variante: v('x'), menge: 1, preis: 10 }] })).toThrow(BuchungsFehler);
  });

  it('verlangt bei Rabatt einen Grund, bei „Sonstiges“ zusätzlich Text', () => {
    expect(() => bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: v('x'), menge: 1, preis: 5 }] })).toThrow(/Grund/);
    expect(() =>
      bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: v('x'), menge: 1, preis: 0, rabattGrund: 'Sonstiges' }] }),
    ).toThrow(/Text/);
    const b = bucheVerkauf(ctx, {
      kaeufer: 'A',
      zeilen: [{ variante: v('x'), menge: 1, preis: 0, rabattGrund: 'Sonstiges', rabattText: 'Geburtstag' }],
    });
    expect(b.vorgang.positionen[0]).toMatchObject({ rabattGrund: 'Sonstiges', rabattText: 'Geburtstag', preis: 0, listenpreis: 10 });
  });

  it('entfernt den Grund, wenn gar kein Rabatt vorliegt', () => {
    const b = bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: v('x'), menge: 1, preis: 10, rabattGrund: 'Kulanz' }] });
    expect(b.vorgang.positionen[0].rabattGrund).toBeNull();
  });

  it('lässt Sozialkluften nicht über die Kasse laufen', () => {
    expect(() => bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: kluft('s', 'sozial'), menge: 1, preis: 0, rabattGrund: 'Sozialfall' }] })).toThrow(
      /Sozialkluft/,
    );
  });

  it('lehnt ungültige Mengen ab', () => {
    expect(() => bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: v('x'), menge: 0, preis: 10 }] })).toThrow(/Menge/);
    expect(() => bucheVerkauf(ctx, { kaeufer: 'A', zeilen: [{ variante: v('x'), menge: 1.5, preis: 10 }] })).toThrow(/Menge/);
  });
});

describe('rabattFehler', () => {
  it('erkennt Cent-Rundung nicht als Rabatt', () => {
    expect(rabattFehler({ listenpreis: 10, preis: 9.999 })).toBeNull();
    expect(rabattFehler({ listenpreis: 10, preis: -1 })).toMatch(/negativ/);
  });
});

describe('Flatrate', () => {
  it('bucht Kluft für 40 € und nur die angehakten Aufnäher zu 0 €', () => {
    const b = bucheFlatrate(ctx, { kaeufer: 'Lena', kluft: kluft('k', 'unbenaeht'), aufnaeher: [lilie], flatratePreis: 40 });
    expect(b.vorgang.typ).toBe('FLATRATE');
    expect(b.vorgang.summe).toBe(40);
    expect(b.bestand).toEqual({ k: -1, lilie: -1 });
    const [k, a] = b.vorgang.positionen;
    expect(k).toMatchObject({ preis: 40, listenpreis: 40, rolle: 'ware' });
    expect(a).toMatchObject({ preis: 0, listenpreis: 3, rolle: 'aufnaeher', rabattGrund: 'Flatrate (inklusive)' });
    expect(b.vorgang.positionen).toHaveLength(2);
  });

  it('akzeptiert keine Sozialkluft als Flatrate', () => {
    expect(() => bucheFlatrate(ctx, { kaeufer: 'L', kluft: kluft('k', 'sozial'), aufnaeher: [], flatratePreis: 40 })).toThrow(BuchungsFehler);
  });

  it('bucht bei defekter Rückgabe die Sozialkluft ein', () => {
    const b = bucheFlatrate(ctx, {
      kaeufer: 'L',
      kluft: kluft('neu', 'unbenaeht', '164'),
      aufnaeher: [lilie, stamm],
      flatratePreis: 40,
      defekteRueckgabe: { variante: kluft('alt-s', 'sozial'), art: 'sozial' },
    });
    expect(b.bestand).toEqual({ neu: -1, lilie: -1, stamm: -1, 'alt-s': 1 });
    expect(b.vorgang.summe).toBe(40);
  });

  it('dokumentiert entsorgte Rückgaben ohne Bestandsänderung', () => {
    const b = bucheFlatrate(ctx, {
      kaeufer: 'L',
      kluft: kluft('neu', 'benaeht'),
      aufnaeher: [],
      flatratePreis: 40,
      defekteRueckgabe: { variante: kluft('alt', 'benaeht'), art: 'entsorgung' },
    });
    expect(b.bestand).toEqual({ neu: -1 });
    expect(b.vorgang.positionen.find((p) => p.rolle === 'entsorgung')?.menge).toBe(0);
  });

  it('Tausch: Rückgabe +1, neue Kluft gratis mit Systemgrund', () => {
    const b = bucheFlatrateTausch(ctx, {
      kaeufer: 'Lena',
      rueckgabe: kluft('alt', 'benaeht', '140'),
      neu: kluft('neu', 'unbenaeht', '152'),
      aufnaeher: [lilie],
      flatratePreis: 40,
    });
    expect(b.vorgang.typ).toBe('FLATRATE_TAUSCH');
    expect(b.vorgang.summe).toBe(0);
    expect(b.bestand).toEqual({ alt: 1, neu: -1, lilie: -1 });
    expect(b.vorgang.positionen[1]).toMatchObject({ preis: 0, listenpreis: 40, rabattGrund: 'Flatrate-Tausch' });
  });

  it('Sozialkluft: Preis 0–40 €, Grund Pflicht unter 40 €', () => {
    expect(() =>
      bucheSozialkluft(ctx, { kaeufer: 'K', kluft: kluft('s', 'sozial'), aufnaeher: [], preis: 0, flatratePreis: 40, rabattGrund: null }),
    ).toThrow(/Grund/);
    expect(() =>
      bucheSozialkluft(ctx, { kaeufer: 'K', kluft: kluft('s', 'sozial'), aufnaeher: [], preis: 50, flatratePreis: 40, rabattGrund: 'Sozialfall' }),
    ).toThrow(/zwischen/);
    expect(() =>
      bucheSozialkluft(ctx, { kaeufer: 'K', kluft: kluft('k', 'benaeht'), aufnaeher: [], preis: 0, flatratePreis: 40, rabattGrund: 'Sozialfall' }),
    ).toThrow(BuchungsFehler);
    const b = bucheSozialkluft(ctx, {
      kaeufer: 'K',
      kluft: kluft('s', 'sozial'),
      aufnaeher: [lilie],
      preis: 10,
      flatratePreis: 40,
      rabattGrund: 'Sozialfall',
    });
    expect(b.vorgang.summe).toBe(10);
    expect(b.bestand).toEqual({ s: -1, lilie: -1 });
  });
});

describe('Einkauf, Zugang, Abgang', () => {
  it('berechnet den gleitenden Durchschnitts-EK', () => {
    expect(neuerDurchschnittsEk(10, 4, 10, 6)).toBe(5);
    expect(neuerDurchschnittsEk(-3, 4, 10, 6)).toBe(6);
    expect(neuerDurchschnittsEk(0, 0, 5, 2.5)).toBe(2.5);
  });

  it('Einkauf erhöht Bestand und aktualisiert den EK, auch bei doppelten Zeilen', () => {
    const x = v('x', { bestand: 10, ekDurchschnitt: 4 });
    const b = bucheEinkauf(ctx, {
      lieferant: 'Rüsthaus Shop',
      zeilen: [
        { variante: x, menge: 10, ekPreis: 6 },
        { variante: x, menge: 20, ekPreis: 2 },
      ],
    });
    expect(b.bestand).toEqual({ x: 30 });
    expect(b.vorgang.summe).toBe(100);
    // (10*4 + 10*6) / 20 = 5; dann (20*5 + 20*2) / 40 = 3.5
    expect(b.varianteUpdates.x.ekDurchschnitt).toBe(3.5);
  });

  it('Zugang wird mit EK 0 € eingebucht und braucht einen Grund', () => {
    expect(() => bucheZugang(ctx, { grund: '', zeilen: [{ variante: v('x'), menge: 1 }] })).toThrow(/Grund/);
    const b = bucheZugang(ctx, { grund: 'Spende', zeilen: [{ variante: v('x', { bestand: 1, ekDurchschnitt: 4 }), menge: 1 }] });
    expect(b.bestand).toEqual({ x: 1 });
    expect(b.varianteUpdates.x.ekDurchschnitt).toBe(2);
  });

  it('Abgang mit „Sonstiges“ braucht einen Kommentar', () => {
    expect(() => bucheAbgang(ctx, { grund: 'Sonstiges', zeilen: [{ variante: v('x'), menge: 1 }] })).toThrow(/Kommentar/);
    const b = bucheAbgang(ctx, { grund: 'Schwund', zeilen: [{ variante: v('x'), menge: 2 }] });
    expect(b.bestand).toEqual({ x: -2 });
  });
});

describe('Storno und Inventur', () => {
  it('Storno kehrt alle Positionen um und negiert die Summe', () => {
    const original = bucheFlatrate(ctx, { kaeufer: 'L', kluft: kluft('k', 'unbenaeht'), aufnaeher: [lilie], flatratePreis: 40 }).vorgang;
    const s = bucheStorno({ ...ctx, id: 'zzzz9999' }, original);
    expect(s.vorgang.typ).toBe('STORNO');
    expect(s.vorgang.stornoVonId).toBe(original.id);
    expect(s.vorgang.summe).toBe(-40);
    expect(s.bestand).toEqual({ k: 1, lilie: 1 });
    expect(() => bucheStorno(ctx, { ...original, storniert: true })).toThrow(BuchungsFehler);
    expect(() => bucheStorno(ctx, s.vorgang)).toThrow(BuchungsFehler);
  });

  it('Umsatz zählt stornierte Vorgänge und Storno-Belege nicht', () => {
    expect(umsatzVon({ typ: 'VERKAUF', summe: 20, storniert: false })).toBe(20);
    expect(umsatzVon({ typ: 'VERKAUF', summe: 20, storniert: true })).toBe(0);
    expect(umsatzVon({ typ: 'STORNO', summe: -20, storniert: false })).toBe(0);
    expect(umsatzVon({ typ: 'EINKAUF', summe: 99, storniert: false })).toBe(0);
  });

  it('Inventurkorrektur bucht nur Differenzen', () => {
    const b = bucheInventurKorrektur(ctx, {
      inventurId: 'inv1',
      bezeichnung: 'Inventur 2026',
      zeilen: [
        { varianteId: 'a', artikel: 'A', variante: 'Standardgröße', kategorie: 'halstuch', soll: 5, ist: 3, differenz: -2, ekPreis: 2, gezaehlt: true },
        { varianteId: 'b', artikel: 'B', variante: 'Gr. 152', kategorie: 'kluft', soll: 1, ist: 1, differenz: 0, ekPreis: 30, gezaehlt: true },
      ],
    });
    expect(b.bestand).toEqual({ a: -2 });
    expect(b.vorgang.positionen).toHaveLength(1);
    expect(b.vorgang.inventurId).toBe('inv1');
  });
});
