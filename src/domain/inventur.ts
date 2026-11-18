import { runde } from './format';
import { variantenLabel, sortiereVarianten } from './varianten';
import type { InventurZeile, Variante, Zaehlung } from './types';

/** Welche Varianten gehören in die Zählliste: aktive und alle mit Restbestand. */
export function zaehlVarianten(varianten: Variante[]): Variante[] {
  return sortiereVarianten(varianten.filter((v) => v.aktiv || v.bestand !== 0));
}

/**
 * Baut die Inventurzeilen. Ungezählte Varianten werden mit Ist = 0 angesetzt und als
 * „nicht gezählt“ markiert; der Admin muss das vor dem Abschluss bestätigen.
 */
export function inventurZeilen(varianten: Variante[], zaehlungen: Map<string, Zaehlung>): InventurZeile[] {
  return zaehlVarianten(varianten).map((v) => {
    const z = zaehlungen.get(v.id);
    const ist = z ? z.ist : 0;
    return {
      varianteId: v.id,
      artikel: v.artikelName,
      variante: variantenLabel(v.attribute),
      kategorie: v.kategorie,
      soll: v.bestand,
      ist,
      differenz: ist - v.bestand,
      ekPreis: v.ekDurchschnitt,
      gezaehlt: Boolean(z),
    };
  });
}

export interface InventurSummen {
  positionen: number;
  gezaehlt: number;
  nichtGezaehlt: number;
  abweichungen: number;
  stueckSoll: number;
  stueckIst: number;
  wertSoll: number;
  wertIst: number;
  wertDifferenz: number;
}

export function inventurSummen(zeilen: InventurZeile[]): InventurSummen {
  const s: InventurSummen = {
    positionen: zeilen.length,
    gezaehlt: 0,
    nichtGezaehlt: 0,
    abweichungen: 0,
    stueckSoll: 0,
    stueckIst: 0,
    wertSoll: 0,
    wertIst: 0,
    wertDifferenz: 0,
  };
  for (const z of zeilen) {
    if (z.gezaehlt) s.gezaehlt++;
    else s.nichtGezaehlt++;
    if (z.differenz !== 0) s.abweichungen++;
    s.stueckSoll += z.soll;
    s.stueckIst += z.ist;
    s.wertSoll += Math.max(z.soll, 0) * z.ekPreis;
    s.wertIst += Math.max(z.ist, 0) * z.ekPreis;
  }
  s.wertSoll = runde(s.wertSoll);
  s.wertIst = runde(s.wertIst);
  s.wertDifferenz = runde(s.wertIst - s.wertSoll);
  return s;
}
