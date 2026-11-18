// Reine Buchungslogik: Jede Funktion erzeugt aus Eingaben einen fertigen Vorgang plus die
// Bestandsänderungen. Firestore wird hier nicht berührt, damit alles testbar bleibt.

import { belegNummer, normalisiereName, runde } from './format';
import { bezeichnungVon } from './varianten';
import {
  GRUND_SONSTIGES,
  SYSTEMGRUND_FLATRATE,
  SYSTEMGRUND_SOZIAL_AUFNAEHER,
  SYSTEMGRUND_TAUSCH,
  VERKAUFS_TYPEN,
  type InventurZeile,
  type Position,
  type PositionRolle,
  type Variante,
  type Vorgang,
  type VorgangTyp,
} from './types';

export class BuchungsFehler extends Error {}

export interface BuchungsKontext {
  /** Vorab erzeugte Dokument-ID des Vorgangs. */
  id: string;
  uid: string;
  benutzerName: string;
  jetzt: number;
}

export interface Buchung {
  vorgang: Vorgang;
  /** Bestandsänderung je Variante (Summe aller Positionen). */
  bestand: Record<string, number>;
  /** Zusätzliche Feldänderungen an Varianten, z. B. neuer Durchschnitts-EK. */
  varianteUpdates: Record<string, Partial<Pick<Variante, 'ekDurchschnitt'>>>;
}

type VarianteRef = Pick<Variante, 'id' | 'artikelName' | 'attribute' | 'vkPreis' | 'ekDurchschnitt' | 'kategorie'>;

const CENT = 0.005;

function position(
  v: VarianteRef,
  menge: number,
  p: { listenpreis: number; preis: number; ekPreis?: number; rolle?: PositionRolle; rabattGrund?: string | null; rabattText?: string | null },
): Position {
  return {
    varianteId: v.id,
    bezeichnung: bezeichnungVon(v),
    menge,
    listenpreis: runde(p.listenpreis),
    preis: runde(p.preis),
    ekPreis: runde(p.ekPreis ?? v.ekDurchschnitt, 4),
    rabattGrund: p.rabattGrund ?? null,
    rabattText: p.rabattText?.trim() ? p.rabattText.trim() : null,
    rolle: p.rolle ?? 'ware',
  };
}

function bestandAus(positionen: Position[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const p of positionen) {
    if (p.menge === 0) continue;
    r[p.varianteId] = (r[p.varianteId] ?? 0) + p.menge;
  }
  return r;
}

function basisVorgang(ctx: BuchungsKontext, typ: VorgangTyp, datum = ctx.jetzt): Omit<Vorgang, 'positionen' | 'summe'> {
  return {
    id: ctx.id,
    typ,
    belegNr: belegNummer(typ, datum, ctx.id),
    datum,
    benutzerUid: ctx.uid,
    benutzerName: ctx.benutzerName,
    kaeufer: null,
    kaeuferKey: null,
    lieferant: null,
    lieferantBelegNr: null,
    grund: null,
    kommentar: null,
    storniert: false,
    stornoDurchId: null,
    stornoVonId: null,
    inventurId: null,
  };
}

function pruefeKaeufer(kaeufer: string): { kaeufer: string; kaeuferKey: string } {
  const k = kaeufer.trim().replace(/\s+/g, ' ');
  if (!k) throw new BuchungsFehler('Bitte den Namen des Käufers eintragen.');
  return { kaeufer: k, kaeuferKey: normalisiereName(k) };
}

function pruefeMenge(menge: number, bezeichnung: string) {
  if (!Number.isInteger(menge) || menge < 1) {
    throw new BuchungsFehler(`Menge für „${bezeichnung}“ muss eine ganze Zahl ab 1 sein.`);
  }
}

/**
 * Prüft, ob für einen reduzierten Preis ein Grund angegeben ist.
 * Liefert eine Fehlermeldung oder null.
 */
export function rabattFehler(z: { listenpreis: number; preis: number; rabattGrund?: string | null; rabattText?: string | null }): string | null {
  if (z.preis < 0) return 'Der Preis darf nicht negativ sein.';
  if (z.preis >= z.listenpreis - CENT) return null;
  if (!z.rabattGrund) return 'Bei Rabatt oder kostenloser Ausgabe ist ein Grund Pflicht.';
  if (z.rabattGrund === GRUND_SONSTIGES && !z.rabattText?.trim()) {
    return 'Bei „Sonstiges“ bitte den Grund als Text beschreiben.';
  }
  return null;
}

export function istRabattiert(p: Pick<Position, 'listenpreis' | 'preis'>): boolean {
  return p.preis < p.listenpreis - CENT;
}

function pruefeKluft(v: VarianteRef, erlaubt: string[], was: string) {
  if (v.kategorie !== 'kluft' && v.kategorie !== 'kluftbluse') {
    throw new BuchungsFehler(`${was}: Bitte eine Kluft oder Kluftbluse wählen.`);
  }
  if (!v.attribute.zustand || !erlaubt.includes(v.attribute.zustand)) {
    throw new BuchungsFehler(`${was}: Dieser Zustand ist hier nicht zulässig.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Verkauf
// ---------------------------------------------------------------------------------------------

export interface VerkaufZeile {
  variante: VarianteRef;
  menge: number;
  preis: number;
  rabattGrund?: string | null;
  rabattText?: string | null;
}

export function bucheVerkauf(ctx: BuchungsKontext, eingabe: { kaeufer: string; zeilen: VerkaufZeile[] }): Buchung {
  const k = pruefeKaeufer(eingabe.kaeufer);
  if (eingabe.zeilen.length === 0) throw new BuchungsFehler('Der Warenkorb ist leer.');
  const positionen = eingabe.zeilen.map((z) => {
    const bez = bezeichnungVon(z.variante);
    pruefeMenge(z.menge, bez);
    if (z.variante.attribute.zustand === 'sozial') {
      throw new BuchungsFehler(`„${bez}“ ist eine Sozialkluft und wird über „Sozialkluft ausgeben“ gebucht.`);
    }
    const fehler = rabattFehler({ listenpreis: z.variante.vkPreis, preis: z.preis, rabattGrund: z.rabattGrund, rabattText: z.rabattText });
    if (fehler) throw new BuchungsFehler(`${bez}: ${fehler}`);
    const rabattiert = z.preis < z.variante.vkPreis - CENT;
    return position(z.variante, -z.menge, {
      listenpreis: z.variante.vkPreis,
      preis: z.preis,
      rabattGrund: rabattiert ? z.rabattGrund : null,
      rabattText: rabattiert ? z.rabattText : null,
    });
  });
  const summe = runde(positionen.reduce((s, p) => s + -p.menge * p.preis, 0));
  return {
    vorgang: { ...basisVorgang(ctx, 'VERKAUF'), ...k, positionen, summe },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

// ---------------------------------------------------------------------------------------------
// Kluft-Flatrate, Tausch, Sozialkluft
// ---------------------------------------------------------------------------------------------

function aufnaeherPositionen(aufnaeher: VarianteRef[], grund: string): Position[] {
  return aufnaeher.map((a) =>
    position(a, -1, { listenpreis: a.vkPreis, preis: 0, rabattGrund: grund, rolle: 'aufnaeher' }),
  );
}

export interface DefekteRueckgabe {
  /** Zurückgegebene Kluft (Größe/Artikel). Bei „sozial“ die Sozialkluft-Variante, die zugebucht wird. */
  variante: VarianteRef;
  art: 'sozial' | 'entsorgung';
}

export function bucheFlatrate(
  ctx: BuchungsKontext,
  eingabe: {
    kaeufer: string;
    kluft: VarianteRef;
    aufnaeher: VarianteRef[];
    flatratePreis: number;
    /** Gesetzt, wenn die Flatrate aus einem Tausch mit beschädigter Kluft entsteht. */
    defekteRueckgabe?: DefekteRueckgabe | null;
  },
): Buchung {
  const k = pruefeKaeufer(eingabe.kaeufer);
  pruefeKluft(eingabe.kluft, ['unbenaeht', 'benaeht'], 'Flatrate');
  const positionen: Position[] = [
    position(eingabe.kluft, -1, { listenpreis: eingabe.flatratePreis, preis: eingabe.flatratePreis }),
    ...aufnaeherPositionen(eingabe.aufnaeher, SYSTEMGRUND_FLATRATE),
  ];
  let kommentar: string | null = null;
  const r = eingabe.defekteRueckgabe;
  if (r) {
    if (r.art === 'sozial') {
      if (r.variante.attribute.zustand !== 'sozial') throw new BuchungsFehler('Rückgabe: Bitte die Sozialkluft-Variante wählen.');
      positionen.push(position(r.variante, 1, { listenpreis: 0, preis: 0, rolle: 'rueckgabe' }));
      kommentar = 'Tausch mit beschädigter Kluft – Rückgabe als Sozialkluft eingebucht, neue Flatrate.';
    } else {
      positionen.push(position(r.variante, 0, { listenpreis: 0, preis: 0, rolle: 'entsorgung' }));
      kommentar = 'Tausch mit beschädigter Kluft – Rückgabe entsorgt, neue Flatrate.';
    }
  }
  return {
    vorgang: { ...basisVorgang(ctx, 'FLATRATE'), ...k, kommentar, positionen, summe: runde(eingabe.flatratePreis) },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

export function bucheFlatrateTausch(
  ctx: BuchungsKontext,
  eingabe: { kaeufer: string; rueckgabe: VarianteRef; neu: VarianteRef; aufnaeher: VarianteRef[]; flatratePreis: number },
): Buchung {
  const k = pruefeKaeufer(eingabe.kaeufer);
  pruefeKluft(eingabe.rueckgabe, ['unbenaeht', 'benaeht'], 'Rückgabe');
  pruefeKluft(eingabe.neu, ['unbenaeht', 'benaeht'], 'Neue Kluft');
  const positionen: Position[] = [
    position(eingabe.rueckgabe, 1, { listenpreis: 0, preis: 0, rolle: 'rueckgabe' }),
    position(eingabe.neu, -1, { listenpreis: eingabe.flatratePreis, preis: 0, rabattGrund: SYSTEMGRUND_TAUSCH }),
    ...aufnaeherPositionen(eingabe.aufnaeher, SYSTEMGRUND_TAUSCH),
  ];
  return {
    vorgang: { ...basisVorgang(ctx, 'FLATRATE_TAUSCH'), ...k, positionen, summe: 0 },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

export function bucheSozialkluft(
  ctx: BuchungsKontext,
  eingabe: {
    kaeufer: string;
    kluft: VarianteRef;
    aufnaeher: VarianteRef[];
    preis: number;
    flatratePreis: number;
    rabattGrund: string | null;
    rabattText?: string | null;
  },
): Buchung {
  const k = pruefeKaeufer(eingabe.kaeufer);
  pruefeKluft(eingabe.kluft, ['sozial'], 'Sozialkluft');
  if (eingabe.preis < 0 || eingabe.preis > eingabe.flatratePreis + CENT) {
    throw new BuchungsFehler(`Der Preis einer Sozialkluft liegt zwischen 0 € und ${eingabe.flatratePreis} €.`);
  }
  const fehler = rabattFehler({
    listenpreis: eingabe.flatratePreis,
    preis: eingabe.preis,
    rabattGrund: eingabe.rabattGrund,
    rabattText: eingabe.rabattText,
  });
  if (fehler) throw new BuchungsFehler(fehler);
  const rabattiert = eingabe.preis < eingabe.flatratePreis - CENT;
  const positionen: Position[] = [
    position(eingabe.kluft, -1, {
      listenpreis: eingabe.flatratePreis,
      preis: eingabe.preis,
      rabattGrund: rabattiert ? eingabe.rabattGrund : null,
      rabattText: rabattiert ? eingabe.rabattText : null,
    }),
    ...aufnaeherPositionen(eingabe.aufnaeher, SYSTEMGRUND_SOZIAL_AUFNAEHER),
  ];
  return {
    vorgang: { ...basisVorgang(ctx, 'SOZIALKLUFT'), ...k, positionen, summe: runde(eingabe.preis) },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

// ---------------------------------------------------------------------------------------------
// Einkauf, Zugang, Abgang
// ---------------------------------------------------------------------------------------------

/** Gleitender Durchschnitts-Einkaufspreis nach einem Zugang. Negative Altbestände zählen als 0. */
export function neuerDurchschnittsEk(altBestand: number, altEk: number, menge: number, ek: number): number {
  const basis = Math.max(altBestand, 0);
  if (basis + menge <= 0) return runde(ek, 4);
  return runde((basis * altEk + menge * ek) / (basis + menge), 4);
}

export interface ZugangZeile {
  variante: VarianteRef & Pick<Variante, 'bestand'>;
  menge: number;
  ekPreis?: number;
}

function ekUpdates(zeilen: { variante: ZugangZeile['variante']; menge: number; ek: number }[]) {
  const stand: Record<string, { bestand: number; ek: number }> = {};
  for (const z of zeilen) {
    const s = stand[z.variante.id] ?? { bestand: z.variante.bestand, ek: z.variante.ekDurchschnitt };
    stand[z.variante.id] = { bestand: s.bestand + z.menge, ek: neuerDurchschnittsEk(s.bestand, s.ek, z.menge, z.ek) };
  }
  return Object.fromEntries(Object.entries(stand).map(([id, s]) => [id, { ekDurchschnitt: s.ek }]));
}

export function bucheEinkauf(
  ctx: BuchungsKontext,
  eingabe: { lieferant: string; lieferantBelegNr?: string; belegDatum?: number; kommentar?: string; zeilen: ZugangZeile[] },
): Buchung {
  const lieferant = eingabe.lieferant.trim();
  if (!lieferant) throw new BuchungsFehler('Bitte den Lieferanten angeben.');
  if (eingabe.zeilen.length === 0) throw new BuchungsFehler('Bitte mindestens eine Position erfassen.');
  const positionen = eingabe.zeilen.map((z) => {
    const bez = bezeichnungVon(z.variante);
    pruefeMenge(z.menge, bez);
    const ek = z.ekPreis ?? 0;
    if (ek < 0) throw new BuchungsFehler(`${bez}: Der Einkaufspreis darf nicht negativ sein.`);
    return position(z.variante, z.menge, { listenpreis: z.variante.vkPreis, preis: ek, ekPreis: ek });
  });
  const summe = runde(positionen.reduce((s, p) => s + p.menge * p.preis, 0));
  return {
    vorgang: {
      ...basisVorgang(ctx, 'EINKAUF', eingabe.belegDatum ?? ctx.jetzt),
      lieferant,
      lieferantBelegNr: eingabe.lieferantBelegNr?.trim() || null,
      kommentar: eingabe.kommentar?.trim() || null,
      positionen,
      summe,
    },
    bestand: bestandAus(positionen),
    varianteUpdates: ekUpdates(eingabe.zeilen.map((z) => ({ variante: z.variante, menge: z.menge, ek: z.ekPreis ?? 0 }))),
  };
}

function pruefeGrund(grund: string, kommentar?: string) {
  if (!grund) throw new BuchungsFehler('Bitte einen Grund auswählen.');
  if (grund === GRUND_SONSTIGES && !kommentar?.trim()) {
    throw new BuchungsFehler('Bei „Sonstiges“ bitte einen Kommentar eintragen.');
  }
}

/** Zugang ohne Einkauf (Spende, Rücknahme …). Wird mit EK-Wert 0 € eingebucht. */
export function bucheZugang(
  ctx: BuchungsKontext,
  eingabe: { grund: string; kommentar?: string; zeilen: ZugangZeile[] },
): Buchung {
  pruefeGrund(eingabe.grund, eingabe.kommentar);
  if (eingabe.zeilen.length === 0) throw new BuchungsFehler('Bitte mindestens eine Position erfassen.');
  const positionen = eingabe.zeilen.map((z) => {
    pruefeMenge(z.menge, bezeichnungVon(z.variante));
    return position(z.variante, z.menge, { listenpreis: z.variante.vkPreis, preis: 0, ekPreis: 0 });
  });
  return {
    vorgang: { ...basisVorgang(ctx, 'ZUGANG'), grund: eingabe.grund, kommentar: eingabe.kommentar?.trim() || null, positionen, summe: 0 },
    bestand: bestandAus(positionen),
    varianteUpdates: ekUpdates(eingabe.zeilen.map((z) => ({ variante: z.variante, menge: z.menge, ek: 0 }))),
  };
}

/** Abgang ohne Verkauf (Entsorgung, Schwund …). */
export function bucheAbgang(
  ctx: BuchungsKontext,
  eingabe: { grund: string; kommentar?: string; zeilen: ZugangZeile[] },
): Buchung {
  pruefeGrund(eingabe.grund, eingabe.kommentar);
  if (eingabe.zeilen.length === 0) throw new BuchungsFehler('Bitte mindestens eine Position erfassen.');
  const positionen = eingabe.zeilen.map((z) => {
    pruefeMenge(z.menge, bezeichnungVon(z.variante));
    return position(z.variante, -z.menge, { listenpreis: z.variante.vkPreis, preis: 0 });
  });
  return {
    vorgang: { ...basisVorgang(ctx, 'ABGANG'), grund: eingabe.grund, kommentar: eingabe.kommentar?.trim() || null, positionen, summe: 0 },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

// ---------------------------------------------------------------------------------------------
// Storno und Inventur
// ---------------------------------------------------------------------------------------------

export function stornierbar(v: Pick<Vorgang, 'typ' | 'storniert'>): boolean {
  return !v.storniert && v.typ !== 'STORNO' && v.typ !== 'INVENTURKORREKTUR';
}

/** Gegenbuchung: alle Positionen mit umgekehrtem Vorzeichen, Summe negiert. */
export function bucheStorno(ctx: BuchungsKontext, original: Vorgang): Buchung {
  if (!stornierbar(original)) throw new BuchungsFehler('Dieser Vorgang kann nicht storniert werden.');
  const positionen = original.positionen.map((p) => ({ ...p, menge: p.menge === 0 ? 0 : -p.menge }));
  return {
    vorgang: {
      ...basisVorgang(ctx, 'STORNO'),
      kaeufer: original.kaeufer,
      kaeuferKey: original.kaeuferKey,
      lieferant: original.lieferant,
      grund: `Storno von ${original.belegNr}`,
      positionen,
      summe: runde(-original.summe),
      stornoVonId: original.id,
    },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

export function bucheInventurKorrektur(
  ctx: BuchungsKontext,
  eingabe: { inventurId: string; bezeichnung: string; zeilen: InventurZeile[] },
): Buchung {
  const positionen: Position[] = eingabe.zeilen
    .filter((z) => z.differenz !== 0)
    .map((z) => ({
      varianteId: z.varianteId,
      bezeichnung: z.variante === 'Standardgröße' ? z.artikel : `${z.artikel} · ${z.variante}`,
      menge: z.differenz,
      listenpreis: 0,
      preis: 0,
      ekPreis: z.ekPreis,
      rabattGrund: null,
      rabattText: null,
      rolle: 'korrektur' as const,
    }));
  return {
    vorgang: {
      ...basisVorgang(ctx, 'INVENTURKORREKTUR'),
      grund: eingabe.bezeichnung,
      inventurId: eingabe.inventurId,
      positionen,
      summe: 0,
    },
    bestand: bestandAus(positionen),
    varianteUpdates: {},
  };
}

/**
 * Umsatz eines Vorgangs für Auswertungen. Stornierte Originale und die Storno-Belege selbst
 * zählen beide nicht – netto ergibt das den korrekten Umsatz.
 */
export function umsatzVon(v: Pick<Vorgang, 'typ' | 'summe' | 'storniert'>): number {
  return !v.storniert && VERKAUFS_TYPEN.includes(v.typ) ? v.summe : 0;
}

/** Wert der gewährten Rabatte/Gratisausgaben einer Position (Listenpreis − Preis) × Stück. */
export function rabattWert(p: Pick<Position, 'listenpreis' | 'preis' | 'menge'>): number {
  return runde(Math.max(p.listenpreis - p.preis, 0) * Math.abs(p.menge));
}
