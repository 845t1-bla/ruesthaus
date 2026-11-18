import { arrayRemove, arrayUnion, doc, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { col, einstellungenRef } from '../../data/refs';
import type { Artikel, Variante } from '../../domain/types';
import { variantenSchluessel } from '../../domain/varianten';

const BATCH_MAX = 400;

/**
 * IDs aller Varianten, die in irgendeinem Vorgang vorkommen (Verkauf, Einkauf, Inventur, Storno …).
 * Fragt bewusst den Server ab: Gelöscht wird nur, wenn sicher nie gebucht wurde.
 */
export async function gebuchteVariantenIds(): Promise<Set<string>> {
  let snap;
  try {
    snap = await getDocsFromServer(col.vorgaenge);
  } catch {
    throw new Error('Zum Löschen wird eine Internetverbindung benötigt (es wird geprüft, ob schon gebucht wurde).');
  }
  const ids = new Set<string>();
  snap.forEach((d) => {
    for (const p of (d.data().positionen ?? []) as { varianteId?: string }[]) if (p.varianteId) ids.add(p.varianteId);
  });
  return ids;
}

export type LoeschPruefung = { ok: true } | { ok: false; grund: string };

export function pruefeLoeschbar(varianten: Variante[], gebucht: Set<string>): LoeschPruefung {
  if (varianten.some((v) => v.bestand !== 0)) {
    return { ok: false, grund: 'Es ist noch Bestand vorhanden. Bitte zuerst per Abgang oder Inventur auf 0 bringen.' };
  }
  if (varianten.some((v) => gebucht.has(v.id))) {
    return { ok: false, grund: 'Es gibt bereits Buchungen. Gebuchte Varianten können nur deaktiviert werden.' };
  }
  return { ok: true };
}

/** Löscht eine einzelne Variante und merkt sie als ausgeschlossen, damit sie nicht neu erzeugt wird. */
export async function loescheVariante(artikel: Artikel, v: Variante): Promise<LoeschPruefung> {
  const pruefung = pruefeLoeschbar([v], await gebuchteVariantenIds());
  if (!pruefung.ok) return pruefung;
  const batch = writeBatch(db);
  batch.delete(doc(col.varianten, v.id));
  batch.update(doc(col.artikel, artikel.id), { ausgeschlossen: arrayUnion(variantenSchluessel(v.attribute)) });
  batch.update(einstellungenRef, { standardAufnaeher: arrayRemove(v.id) });
  await batch.commit();
  return { ok: true };
}

/** Löscht einen Artikel mit allen Varianten und Bildern – nur wenn nie etwas davon gebucht wurde. */
export async function loescheArtikel(artikel: Artikel, varianten: Variante[]): Promise<LoeschPruefung> {
  const pruefung = pruefeLoeschbar(varianten, await gebuchteVariantenIds());
  if (!pruefung.ok) return pruefung;
  const ids = varianten.map((v) => v.id);
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_MAX)) batch.delete(doc(col.varianten, id));
    await batch.commit();
  }
  const batch = writeBatch(db);
  batch.delete(doc(col.artikelBilder, artikel.id));
  batch.delete(doc(col.artikel, artikel.id));
  if (ids.length) batch.update(einstellungenRef, { standardAufnaeher: arrayRemove(...ids) });
  await batch.commit();
  return { ok: true };
}
