// Fachliche Typen der Rüsthaus-App. Alle Geldbeträge in Euro (Zahl mit Nachkommastellen).

export type Rolle = 'admin' | 'verkaeufer';

export interface Benutzer {
  uid: string;
  name: string;
  email: string;
  rolle: Rolle;
  aktiv: boolean;
}

export type Kategorie = 'kluft' | 'kluftbluse' | 'stammeskleidung' | 'halstuch' | 'aufnaeher' | 'sonstiges';
export type Zustand = 'unbenaeht' | 'benaeht' | 'sozial';
export type Kollektion = 'alt' | 'neu';
export type Schnitt = 'herren' | 'damen';
export type Achse = 'groesse' | 'zustand' | 'kollektion' | 'schnitt';

export interface Artikel {
  id: string;
  name: string;
  kategorie: Kategorie;
  achsen: Achse[];
  groessen: string[];
  vkPreisStandard: number;
  beschreibung: string;
  thumbnail: string | null;
  aktiv: boolean;
}

export interface VarianteAttribute {
  groesse?: string;
  zustand?: Zustand;
  kollektion?: Kollektion;
  schnitt?: Schnitt;
}

export interface Variante {
  id: string;
  artikelId: string;
  artikelName: string;
  kategorie: Kategorie;
  attribute: VarianteAttribute;
  /** Sortierschlüssel innerhalb des Artikels (Reihenfolge der Größenliste etc.) */
  sortierung: number;
  vkPreis: number;
  ekDurchschnitt: number;
  bestand: number;
  mindestbestand: number | null;
  aktiv: boolean;
}

export type VorgangTyp =
  | 'VERKAUF'
  | 'FLATRATE'
  | 'FLATRATE_TAUSCH'
  | 'SOZIALKLUFT'
  | 'EINKAUF'
  | 'ZUGANG'
  | 'ABGANG'
  | 'INVENTURKORREKTUR'
  | 'STORNO';

/** Rolle einer Position innerhalb eines Vorgangs (für Anzeige und Auswertung). */
export type PositionRolle = 'ware' | 'aufnaeher' | 'rueckgabe' | 'entsorgung' | 'korrektur';

export interface Position {
  varianteId: string;
  bezeichnung: string;
  /** Bestandsänderung mit Vorzeichen: negativ = Abgang aus dem Lager, positiv = Zugang. */
  menge: number;
  /** Regulärer Preis je Stück (Verkaufspreis bzw. Flatratepreis). */
  listenpreis: number;
  /** Tatsächlicher Preis je Stück (Verkauf) bzw. Einkaufspreis je Stück (Einkauf). */
  preis: number;
  /** Durchschnittlicher Einkaufspreis je Stück zum Buchungszeitpunkt. */
  ekPreis: number;
  rabattGrund: string | null;
  rabattText: string | null;
  rolle: PositionRolle;
}

export interface Vorgang {
  id: string;
  typ: VorgangTyp;
  belegNr: string;
  /** Buchungszeitpunkt in Millisekunden (Client-Zeit, damit Buchungen offline funktionieren). */
  datum: number;
  benutzerUid: string;
  benutzerName: string;
  kaeufer: string | null;
  /** Normalisierter Käufername für Suche (Kleinbuchstaben, Umlaute aufgelöst). */
  kaeuferKey: string | null;
  lieferant: string | null;
  lieferantBelegNr: string | null;
  grund: string | null;
  kommentar: string | null;
  positionen: Position[];
  /** Geldbetrag des Vorgangs: Umsatz bei Verkäufen, Einkaufssumme bei Einkäufen, sonst 0. Storno: negiert. */
  summe: number;
  storniert: boolean;
  stornoDurchId: string | null;
  stornoVonId: string | null;
  inventurId: string | null;
}

export interface Einstellungen {
  stammName: string;
  flatratePreis: number;
  standardAufnaeher: string[];
  rabattGruende: string[];
  zugangsGruende: string[];
  abgangsGruende: string[];
  inventurAktiv: string | null;
  ersteinrichtungDurch?: string;
}

export interface Zaehlung {
  varianteId: string;
  ist: number;
  gezaehltVon: string;
  zeit: number;
}

export interface InventurZeile {
  varianteId: string;
  artikel: string;
  variante: string;
  kategorie: Kategorie;
  soll: number;
  ist: number;
  differenz: number;
  ekPreis: number;
  gezaehlt: boolean;
}

export interface Inventur {
  id: string;
  bezeichnung: string;
  stichtag: number;
  status: 'offen' | 'abgeschlossen' | 'abgebrochen';
  gestartetVon: string;
  gestartetAm: number;
  abgeschlossenVon: string | null;
  abgeschlossenAm: number | null;
  ergebnis: InventurZeile[] | null;
}

export const VERKAUFS_TYPEN: VorgangTyp[] = ['VERKAUF', 'FLATRATE', 'FLATRATE_TAUSCH', 'SOZIALKLUFT'];

export const TYP_LABEL: Record<VorgangTyp, string> = {
  VERKAUF: 'Verkauf',
  FLATRATE: 'Flatrate',
  FLATRATE_TAUSCH: 'Flatrate-Tausch',
  SOZIALKLUFT: 'Sozialkluft',
  EINKAUF: 'Einkauf',
  ZUGANG: 'Zugang',
  ABGANG: 'Abgang',
  INVENTURKORREKTUR: 'Inventurkorrektur',
  STORNO: 'Storno',
};

export const KATEGORIE_LABEL: Record<Kategorie, string> = {
  kluft: 'Kluft',
  kluftbluse: 'Kluftbluse',
  stammeskleidung: 'Stammeskleidung',
  halstuch: 'Halstuch',
  aufnaeher: 'Aufnäher',
  sonstiges: 'Sonstiges',
};

export const ZUSTAND_LABEL: Record<Zustand, string> = {
  unbenaeht: 'unbenäht',
  benaeht: 'benäht',
  sozial: 'Sozialkluft',
};

export const KOLLEKTION_LABEL: Record<Kollektion, string> = {
  alt: 'alte Kollektion',
  neu: 'neue Kollektion',
};

export const SCHNITT_LABEL: Record<Schnitt, string> = {
  herren: 'Herren',
  damen: 'Damen',
};

export const ACHSE_LABEL: Record<Achse, string> = {
  groesse: 'Größe',
  zustand: 'Zustand',
  kollektion: 'Kollektion',
  schnitt: 'Schnitt',
};

/** Standard-Achsen je Kategorie für neue Artikel. */
export const STANDARD_ACHSEN: Record<Kategorie, Achse[]> = {
  kluft: ['groesse', 'zustand'],
  kluftbluse: ['groesse', 'zustand'],
  stammeskleidung: ['kollektion', 'schnitt', 'groesse'],
  halstuch: [],
  aufnaeher: [],
  sonstiges: [],
};

export const SYSTEMGRUND_FLATRATE = 'Flatrate (inklusive)';
export const SYSTEMGRUND_TAUSCH = 'Flatrate-Tausch';
export const SYSTEMGRUND_SOZIAL_AUFNAEHER = 'Sozialkluft (inklusive)';
export const GRUND_SONSTIGES = 'Sonstiges';

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  stammName: 'DPSG Stamm Horsadal Roßtal',
  flatratePreis: 40,
  standardAufnaeher: [],
  rabattGruende: ['Sozialfall', 'Leiterausstattung', 'Mengenrabatt', 'Kulanz', GRUND_SONSTIGES],
  zugangsGruende: ['Spende', 'Rücknahme', 'Fundsache', GRUND_SONSTIGES],
  abgangsGruende: ['Entsorgung', 'Schwund', 'Eigenbedarf Stamm', GRUND_SONSTIGES],
  inventurAktiv: null,
};
