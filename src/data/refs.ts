import { collection, doc, type DocumentData, type DocumentSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  normalisiereSchnitt,
  STANDARD_EINSTELLUNGEN,
  type Artikel,
  type Benutzer,
  type Einstellungen,
  type Inventur,
  type Variante,
  type VarianteAttribute,
  type Vorgang,
} from '../domain/types';

export const col = {
  artikel: collection(db, 'artikel'),
  artikelBilder: collection(db, 'artikelBilder'),
  varianten: collection(db, 'varianten'),
  vorgaenge: collection(db, 'vorgaenge'),
  benutzer: collection(db, 'benutzer'),
  inventuren: collection(db, 'inventuren'),
};

export const einstellungenRef = doc(db, 'einstellungen', 'app');
export const zaehlungenCol = (inventurId: string) => collection(db, 'inventuren', inventurId, 'zaehlungen');

type Snap = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

export const alsArtikel = (s: Snap): Artikel => {
  const d = s.data() ?? {};
  const achsen = d.achsen ?? [];
  return {
    id: s.id,
    name: d.name ?? '',
    kategorie: d.kategorie ?? 'sonstiges',
    achsen,
    groessen: d.groessen ?? [],
    // Ältere Artikel hatten fest „Herren/Damen“ ohne eigenes Feld.
    schnitte: d.schnitte ?? (achsen.includes('schnitt') ? ['Herren', 'Damen'] : []),
    ausgeschlossen: d.ausgeschlossen ?? [],
    vkPreisStandard: d.vkPreisStandard ?? 0,
    beschreibung: d.beschreibung ?? '',
    thumbnail: d.thumbnail ?? null,
    aktiv: d.aktiv ?? true,
  };
};

function alsAttribute(a: VarianteAttribute | undefined): VarianteAttribute {
  if (!a) return {};
  const schnitt = normalisiereSchnitt(a.schnitt);
  const { schnitt: _alt, ...rest } = a;
  return schnitt ? { ...rest, schnitt } : rest;
}

export const alsVariante = (s: Snap): Variante => {
  const d = s.data() ?? {};
  return {
    id: s.id,
    artikelId: d.artikelId,
    artikelName: d.artikelName ?? '',
    kategorie: d.kategorie ?? 'sonstiges',
    attribute: alsAttribute(d.attribute),
    sortierung: d.sortierung ?? 0,
    vkPreis: d.vkPreis ?? 0,
    ekDurchschnitt: d.ekDurchschnitt ?? 0,
    bestand: d.bestand ?? 0,
    mindestbestand: d.mindestbestand ?? null,
    aktiv: d.aktiv ?? true,
  };
};

export const alsVorgang = (s: Snap): Vorgang => ({ ...(s.data() as Omit<Vorgang, 'id'>), id: s.id });

export const alsBenutzer = (s: Snap): Benutzer => {
  const d = s.data() ?? {};
  return { uid: s.id, name: d.name ?? '', email: d.email ?? '', rolle: d.rolle ?? 'verkaeufer', aktiv: d.aktiv ?? false };
};

export const alsInventur = (s: Snap): Inventur => ({ ...(s.data() as Omit<Inventur, 'id'>), id: s.id });

export const alsEinstellungen = (s: Snap): Einstellungen => ({ ...STANDARD_EINSTELLUNGEN, ...(s.data() ?? {}) });

/** Entfernt das id-Feld, bevor ein Objekt gespeichert wird (die ID ist der Dokumentname). */
export function ohneId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = o;
  return rest;
}
