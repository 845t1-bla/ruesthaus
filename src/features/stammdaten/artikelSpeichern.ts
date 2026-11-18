import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { col } from '../../data/refs';
import { sende } from '../../data/buchen';
import type { Artikel, Variante } from '../../domain/types';
import { variantenKombinationen, variantenSchluessel } from '../../domain/varianten';

export type ArtikelDaten = Omit<Artikel, 'id' | 'thumbnail'>;

/**
 * Speichert einen Artikel und legt fehlende Varianten an. Bestehende Varianten behalten
 * Bestand und Preise; Name, Kategorie und Sortierung werden nachgezogen.
 * Gibt die Artikel-ID und die Zahl neu angelegter Varianten zurück.
 */
export async function speichereArtikel(
  daten: ArtikelDaten,
  bestehend: { artikel: Artikel; varianten: Variante[] } | null,
): Promise<{ id: string; neu: number }> {
  const batch = writeBatch(db);
  const ref = bestehend ? doc(col.artikel, bestehend.artikel.id) : doc(col.artikel);
  const sauber: ArtikelDaten = {
    ...daten,
    name: daten.name.trim(),
    beschreibung: daten.beschreibung.trim(),
    groessen: daten.achsen.includes('groesse') ? daten.groessen.map((g) => g.trim()).filter(Boolean) : [],
  };
  if (bestehend) batch.update(ref, { ...sauber });
  else batch.set(ref, { ...sauber, thumbnail: null });

  const vorhanden = new Map((bestehend?.varianten ?? []).map((v) => [variantenSchluessel(v.attribute), v]));
  let neu = 0;
  for (const { attribute, sortierung } of variantenKombinationen(sauber)) {
    const alt = vorhanden.get(variantenSchluessel(attribute));
    if (alt) {
      if (alt.artikelName !== sauber.name || alt.kategorie !== sauber.kategorie || alt.sortierung !== sortierung) {
        batch.update(doc(col.varianten, alt.id), { artikelName: sauber.name, kategorie: sauber.kategorie, sortierung });
      }
      vorhanden.delete(variantenSchluessel(attribute));
    } else {
      neu++;
      batch.set(doc(col.varianten), {
        artikelId: ref.id,
        artikelName: sauber.name,
        kategorie: sauber.kategorie,
        attribute,
        sortierung,
        // Sozialkluften werden nicht regulär verkauft (Preis über Flatratepreis/Sozialkluft-Ausgabe)
        vkPreis: attribute.zustand === 'sozial' ? 0 : sauber.vkPreisStandard,
        ekDurchschnitt: 0,
        bestand: 0,
        mindestbestand: null,
        aktiv: true,
      } satisfies Omit<Variante, 'id'>);
    }
  }
  // Varianten, die es laut Achsen nicht mehr gibt: Namen nachziehen, Rest entscheidet der Admin.
  for (const alt of vorhanden.values()) {
    if (alt.artikelName !== sauber.name || alt.kategorie !== sauber.kategorie) {
      batch.update(doc(col.varianten, alt.id), { artikelName: sauber.name, kategorie: sauber.kategorie, sortierung: 9999 });
    }
  }
  await sende(batch);
  return { id: ref.id, neu };
}
