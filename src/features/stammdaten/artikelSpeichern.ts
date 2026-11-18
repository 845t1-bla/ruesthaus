import { arrayRemove, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { col, einstellungenRef } from '../../data/refs';
import { sende } from '../../data/buchen';
import type { Artikel, Variante } from '../../domain/types';
import { ordneVariantenZu } from '../../domain/varianten';
import { gebuchteVariantenIds } from './loeschen';

export type ArtikelDaten = Omit<Artikel, 'id' | 'thumbnail'>;

export interface SpeicherErgebnis {
  id: string;
  neu: number;
  geloescht: number;
  deaktiviert: number;
}

/** Markierung für Varianten, die nicht mehr zu den Merkmalen passen (stehen am Ende der Liste). */
export const SORTIERUNG_AUSSERHALB = 9999;

/**
 * Speichert einen Artikel und gleicht die Varianten ab:
 * - fehlende Kombinationen werden angelegt,
 * - bestehende behalten Bestand und Preise (Name, Kategorie, Reihenfolge werden nachgezogen),
 * - Varianten, die nicht mehr vorgesehen sind (Merkmal geändert oder in der Matrix abgewählt),
 *   werden gelöscht, wenn sie nie gebucht wurden und keinen Bestand haben – sonst deaktiviert.
 */
export async function speichereArtikel(
  daten: ArtikelDaten,
  bestehend: { artikel: Artikel; varianten: Variante[] } | null,
): Promise<SpeicherErgebnis> {
  const ref = bestehend ? doc(col.artikel, bestehend.artikel.id) : doc(col.artikel);
  const sauber: ArtikelDaten = {
    ...daten,
    name: daten.name.trim(),
    beschreibung: daten.beschreibung.trim(),
    groessen: daten.achsen.includes('groesse') ? daten.groessen.map((g) => g.trim()).filter(Boolean) : [],
    schnitte: daten.achsen.includes('schnitt') ? daten.schnitte.map((s) => s.trim()).filter(Boolean) : [],
  };

  const { zuordnung, ueberzaehlig } = ordneVariantenZu(sauber, bestehend?.varianten ?? []);

  // Nur wenn etwas wegfällt, muss geprüft werden, ob schon gebucht wurde.
  let gebucht: Set<string> | null = null;
  if (ueberzaehlig.length) {
    try {
      gebucht = await gebuchteVariantenIds();
    } catch {
      gebucht = null; // offline: nichts löschen, nur deaktivieren
    }
  }

  const batch = writeBatch(db);
  if (bestehend) batch.update(ref, { ...sauber });
  else batch.set(ref, { ...sauber, thumbnail: null });

  const ergebnis: SpeicherErgebnis = { id: ref.id, neu: 0, geloescht: 0, deaktiviert: 0 };
  for (const { attribute, sortierung, variante: alt, attributeAendern } of zuordnung) {
    if (alt) {
      const upd: Partial<Variante> = {};
      if (attributeAendern) upd.attribute = attribute;
      if (alt.artikelName !== sauber.name) upd.artikelName = sauber.name;
      if (alt.kategorie !== sauber.kategorie) upd.kategorie = sauber.kategorie;
      if (alt.sortierung !== sortierung) upd.sortierung = sortierung;
      // Automatisch deaktivierte Variante ist wieder vorgesehen → reaktivieren
      if (alt.sortierung === SORTIERUNG_AUSSERHALB && !alt.aktiv) upd.aktiv = true;
      if (Object.keys(upd).length) batch.update(doc(col.varianten, alt.id), upd);
    } else {
      ergebnis.neu++;
      batch.set(doc(col.varianten), {
        artikelId: ref.id,
        artikelName: sauber.name,
        kategorie: sauber.kategorie,
        attribute,
        sortierung,
        // Sozialkluften werden nicht regulär verkauft (Preis über Sozialkluft-Ausgabe)
        vkPreis: attribute.zustand === 'sozial' ? 0 : sauber.vkPreisStandard,
        ekDurchschnitt: 0,
        bestand: 0,
        mindestbestand: null,
        aktiv: true,
      } satisfies Omit<Variante, 'id'>);
    }
  }

  const geloeschteIds: string[] = [];
  for (const v of ueberzaehlig) {
    if (gebucht && v.bestand === 0 && !gebucht.has(v.id)) {
      batch.delete(doc(col.varianten, v.id));
      geloeschteIds.push(v.id);
      ergebnis.geloescht++;
    } else {
      batch.update(doc(col.varianten, v.id), {
        artikelName: sauber.name,
        kategorie: sauber.kategorie,
        sortierung: SORTIERUNG_AUSSERHALB,
        aktiv: false,
      });
      ergebnis.deaktiviert++;
    }
  }
  if (geloeschteIds.length) batch.update(einstellungenRef, { standardAufnaeher: arrayRemove(...geloeschteIds) });

  await sende(batch);
  return ergebnis;
}
