import {
  KOLLEKTION_LABEL,
  SCHNITT_LABEL,
  ZUSTAND_LABEL,
  type Artikel,
  type Kollektion,
  type Schnitt,
  type Variante,
  type VarianteAttribute,
  type Zustand,
} from './types';

export const ZUSTAENDE: Zustand[] = ['unbenaeht', 'benaeht', 'sozial'];
export const KOLLEKTIONEN: Kollektion[] = ['neu', 'alt'];
export const SCHNITTE: Schnitt[] = ['herren', 'damen'];

export const GROESSEN_VORLAGEN: { label: string; groessen: string[] }[] = [
  { label: 'Kinder 116–176', groessen: ['116', '128', '140', '152', '164', '176'] },
  { label: 'XS–XXXL', groessen: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { label: 'Konfektion 34–58', groessen: ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58'] },
];

/** Alle Attributkombinationen eines Artikels in Anzeige-Reihenfolge. */
export function variantenKombinationen(
  artikel: Pick<Artikel, 'achsen' | 'groessen'>,
): { attribute: VarianteAttribute; sortierung: number }[] {
  let kombis: VarianteAttribute[] = [{}];
  const erweitere = <K extends keyof VarianteAttribute>(key: K, werte: NonNullable<VarianteAttribute[K]>[]) => {
    if (werte.length === 0) return;
    kombis = kombis.flatMap((k) => werte.map((w) => ({ ...k, [key]: w })));
  };
  if (artikel.achsen.includes('kollektion')) erweitere('kollektion', KOLLEKTIONEN);
  if (artikel.achsen.includes('schnitt')) erweitere('schnitt', SCHNITTE);
  if (artikel.achsen.includes('groesse')) erweitere('groesse', artikel.groessen);
  if (artikel.achsen.includes('zustand')) erweitere('zustand', ZUSTAENDE);
  return kombis.map((attribute, sortierung) => ({ attribute, sortierung }));
}

/** Stabiler Schlüssel einer Attributkombination, um bestehende Varianten wiederzuerkennen. */
export function variantenSchluessel(attr: VarianteAttribute): string {
  return [
    `k=${attr.kollektion ?? ''}`,
    `s=${attr.schnitt ?? ''}`,
    `g=${attr.groesse ?? ''}`,
    `z=${attr.zustand ?? ''}`,
  ].join('|');
}

/** Kurzlabel der Attribute, z. B. „neue Kollektion · Damen · M“ oder „Gr. 152 · benäht“. */
export function variantenLabel(attr: VarianteAttribute): string {
  const teile: string[] = [];
  if (attr.kollektion) teile.push(KOLLEKTION_LABEL[attr.kollektion]);
  if (attr.schnitt) teile.push(SCHNITT_LABEL[attr.schnitt]);
  if (attr.groesse) teile.push(`Gr. ${attr.groesse}`);
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
