import {
  KOLLEKTION_LABEL,
  ZUSTAND_LABEL,
  type Artikel,
  type Kollektion,
  type Variante,
  type VarianteAttribute,
  type Zustand,
} from './types';

export const ZUSTAENDE: Zustand[] = ['unbenaeht', 'benaeht', 'sozial'];
export const KOLLEKTIONEN: Kollektion[] = ['neu', 'alt'];

export const GROESSEN_VORLAGEN: { label: string; groessen: string[] }[] = [
  { label: 'Kinder 116–176', groessen: ['116', '128', '140', '152', '164', '176'] },
  { label: 'XS–XXXL', groessen: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { label: 'Konfektion 34–58', groessen: ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58'] },
];

export const SCHNITT_VORLAGEN: { label: string; schnitte: string[] }[] = [
  { label: 'Normal / Schlank', schnitte: ['Normal', 'Schlank'] },
  { label: 'Herren / Damen', schnitte: ['Herren', 'Damen'] },
];

type KombiQuelle = Pick<Artikel, 'achsen' | 'groessen'> & Partial<Pick<Artikel, 'schnitte' | 'ausgeschlossen'>>;

/** Stabiler Schlüssel einer Attributkombination, um bestehende Varianten wiederzuerkennen. */
export function variantenSchluessel(attr: VarianteAttribute): string {
  return [
    `k=${attr.kollektion ?? ''}`,
    `s=${attr.schnitt ?? ''}`,
    `g=${attr.groesse ?? ''}`,
    `z=${attr.zustand ?? ''}`,
  ].join('|');
}

/** Alle theoretisch möglichen Kombinationen (ohne Ausschlüsse) in Anzeige-Reihenfolge. */
export function alleKombinationen(artikel: KombiQuelle): VarianteAttribute[] {
  let kombis: VarianteAttribute[] = [{}];
  const erweitere = <K extends keyof VarianteAttribute>(key: K, werte: NonNullable<VarianteAttribute[K]>[]) => {
    if (werte.length === 0) return;
    kombis = kombis.flatMap((k) => werte.map((w) => ({ ...k, [key]: w })));
  };
  if (artikel.achsen.includes('kollektion')) erweitere('kollektion', KOLLEKTIONEN);
  if (artikel.achsen.includes('schnitt')) erweitere('schnitt', artikel.schnitte ?? []);
  if (artikel.achsen.includes('groesse')) erweitere('groesse', artikel.groessen);
  if (artikel.achsen.includes('zustand')) erweitere('zustand', ZUSTAENDE);
  return kombis;
}

/** Kombinationen, die als Variante existieren sollen (Ausschlüsse herausgefiltert). */
export function variantenKombinationen(artikel: KombiQuelle): { attribute: VarianteAttribute; sortierung: number }[] {
  const aus = new Set(artikel.ausgeschlossen ?? []);
  return alleKombinationen(artikel)
    .filter((a) => !aus.has(variantenSchluessel(a)))
    .map((attribute, sortierung) => ({ attribute, sortierung }));
}

export interface Zuordnung<V> {
  attribute: VarianteAttribute;
  sortierung: number;
  /** Bestehende Variante, die diese Kombination abdeckt (oder null = neu anlegen). */
  variante: V | null;
  /** true, wenn die bestehende Variante neue Attribute bekommt (z. B. Schnitt nachträglich ergänzt). */
  attributeAendern: boolean;
}

/**
 * Ordnet bestehende Varianten den gewünschten Kombinationen zu.
 * Wird der Schnitt nachträglich eingeschaltet, übernehmen die bisherigen Varianten ohne Schnitt
 * den ersten Schnitt (z. B. „Normal“) – Bestand und Buchungen bleiben so erhalten.
 */
export function ordneVariantenZu<V extends Pick<Variante, 'attribute'>>(
  artikel: KombiQuelle,
  vorhanden: V[],
): { zuordnung: Zuordnung<V>[]; ueberzaehlig: V[] } {
  const nachSchluessel = new Map(vorhanden.map((v) => [variantenSchluessel(v.attribute), v]));
  const benutzt = new Set<V>();
  const zuordnung: Zuordnung<V>[] = variantenKombinationen(artikel).map((k) => {
    const v = nachSchluessel.get(variantenSchluessel(k.attribute));
    if (v && !benutzt.has(v)) {
      benutzt.add(v);
      return { ...k, variante: v, attributeAendern: false };
    }
    return { ...k, variante: null, attributeAendern: false };
  });
  const ersterSchnitt = artikel.achsen.includes('schnitt') ? artikel.schnitte?.[0] : undefined;
  if (ersterSchnitt) {
    for (const z of zuordnung) {
      if (z.variante || z.attribute.schnitt !== ersterSchnitt) continue;
      const { schnitt: _s, ...ohneSchnitt } = z.attribute;
      const v = nachSchluessel.get(variantenSchluessel(ohneSchnitt));
      if (v && !benutzt.has(v)) {
        benutzt.add(v);
        z.variante = v;
        z.attributeAendern = true;
      }
    }
  }
  return { zuordnung, ueberzaehlig: vorhanden.filter((v) => !benutzt.has(v)) };
}

/**
 * Matrix-Zellen für die Auswahl im Formular: Zeilen = Größen, Spalten = Kollektion × Schnitt.
 * Jede Zelle umfasst alle Zustände dieser Kombination.
 */
export interface MatrixZelle {
  groesse?: string;
  spalte: { kollektion?: Kollektion; schnitt?: string };
  schluessel: string[];
}

export function matrixSpalten(artikel: KombiQuelle): { kollektion?: Kollektion; schnitt?: string; label: string }[] {
  let spalten: { kollektion?: Kollektion; schnitt?: string }[] = [{}];
  if (artikel.achsen.includes('kollektion')) spalten = spalten.flatMap((s) => KOLLEKTIONEN.map((k) => ({ ...s, kollektion: k })));
  if (artikel.achsen.includes('schnitt') && (artikel.schnitte ?? []).length) {
    spalten = spalten.flatMap((s) => (artikel.schnitte ?? []).map((x) => ({ ...s, schnitt: x })));
  }
  return spalten.map((s) => ({
    ...s,
    label: [s.kollektion ? KOLLEKTION_LABEL[s.kollektion] : null, s.schnitt ?? null].filter(Boolean).join(' · ') || 'alle',
  }));
}

export function matrixZelle(artikel: KombiQuelle, groesse: string | undefined, spalte: { kollektion?: Kollektion; schnitt?: string }): MatrixZelle {
  const zustaende: (Zustand | undefined)[] = artikel.achsen.includes('zustand') ? ZUSTAENDE : [undefined];
  return {
    groesse,
    spalte,
    schluessel: zustaende.map((z) => variantenSchluessel({ ...spalte, groesse, zustand: z })),
  };
}

/** Die Matrix lohnt sich nur, wenn es Größen und mindestens Kollektion oder Schnitt gibt. */
export function hatMatrix(artikel: KombiQuelle): boolean {
  return (
    artikel.achsen.includes('groesse') &&
    (artikel.achsen.includes('kollektion') || (artikel.achsen.includes('schnitt') && (artikel.schnitte ?? []).length > 0))
  );
}

/** Kurzlabel der Attribute, z. B. „neue Kollektion · Damen · M“ oder „Gr. 152 · Schlank · benäht“. */
export function variantenLabel(attr: VarianteAttribute): string {
  const teile: string[] = [];
  if (attr.kollektion) teile.push(KOLLEKTION_LABEL[attr.kollektion]);
  if (attr.groesse) teile.push(`Gr. ${attr.groesse}`);
  if (attr.schnitt) teile.push(attr.schnitt);
  if (attr.zustand) teile.push(ZUSTAND_LABEL[attr.zustand]);
  return teile.length ? teile.join(' · ') : 'Standardgröße';
}

export function variantenBezeichnung(artikelName: string, attr: VarianteAttribute): string {
  const label = variantenLabel(attr);
  return label === 'Standardgröße' ? artikelName : `${artikelName} · ${label}`;
}

export function bezeichnungVon(v: Pick<Variante, 'artikelName' | 'attribute'>): string {
  return variantenBezeichnung(v.artikelName, v.attribute);
}

/** Lagerwert einer Variante: negative Bestände zählen nicht als Wert. */
export function lagerwert(v: Pick<Variante, 'bestand' | 'ekDurchschnitt'>): number {
  return Math.max(v.bestand, 0) * v.ekDurchschnitt;
}

export function unterMindestbestand(v: Pick<Variante, 'bestand' | 'mindestbestand' | 'aktiv'>): boolean {
  return v.aktiv && v.mindestbestand != null && v.bestand < v.mindestbestand;
}

export function sortiereVarianten<T extends Pick<Variante, 'artikelName' | 'sortierung'>>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) => a.artikelName.localeCompare(b.artikelName, 'de') || a.sortierung - b.sortierung,
  );
}
