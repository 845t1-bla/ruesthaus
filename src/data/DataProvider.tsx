import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { STANDARD_EINSTELLUNGEN, type Artikel, type Benutzer, type Einstellungen, type Inventur, type Variante, type Vorgang } from '../domain/types';
import { sortiereVarianten } from '../domain/varianten';
import { alsArtikel, alsBenutzer, alsEinstellungen, alsInventur, alsVariante, alsVorgang, col, einstellungenRef } from './refs';

export interface SyncStatus {
  online: boolean;
  ausstehend: boolean;
  ausCache: boolean;
}

interface DatenWert {
  geladen: boolean;
  artikel: Artikel[];
  artikelById: Map<string, Artikel>;
  varianten: Variante[];
  variantenById: Map<string, Variante>;
  einstellungen: Einstellungen;
  benutzerListe: Benutzer[];
  /** Vorgänge ab Beginn des Vorjahres (ältere werden bei Bedarf nachgeladen). */
  vorgaenge: Vorgang[];
  vorgaengeAb: number;
  inventuren: Inventur[];
  aktiveInventur: Inventur | null;
  sync: SyncStatus;
}

const DatenContext = createContext<DatenWert | null>(null);

/** Beginn des Vorjahres: so viel Historie wird live mitgeführt. */
export const vorgaengeFensterAb = () => new Date(new Date().getFullYear() - 1, 0, 1).getTime();

export function DataProvider({ children }: { children: ReactNode }) {
  const [artikel, setArtikel] = useState<Artikel[] | null>(null);
  const [varianten, setVarianten] = useState<Variante[] | null>(null);
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null);
  const [benutzerListe, setBenutzerListe] = useState<Benutzer[]>([]);
  const [vorgaenge, setVorgaenge] = useState<Vorgang[] | null>(null);
  const [inventuren, setInventuren] = useState<Inventur[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [ausstehendV, setAusstehendV] = useState(false);
  const [ausstehendB, setAusstehendB] = useState(false);
  const [ausCache, setAusCache] = useState(false);
  const [vorgaengeAb] = useState(vorgaengeFensterAb);

  useEffect(() => {
    const an = () => setOnline(true);
    const aus = () => setOnline(false);
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    const fehler = (e: Error) => console.error('Firestore-Abo fehlgeschlagen', e);
    const abos = [
      onSnapshot(col.artikel, (s) => setArtikel(s.docs.map(alsArtikel)), fehler),
      onSnapshot(
        col.varianten,
        { includeMetadataChanges: true },
        (s) => {
          setVarianten(sortiereVarianten(s.docs.map(alsVariante)));
          setAusstehendB(s.metadata.hasPendingWrites);
        },
        fehler,
      ),
      onSnapshot(einstellungenRef, (s) => setEinstellungen(alsEinstellungen(s)), fehler),
      onSnapshot(col.benutzer, (s) => setBenutzerListe(s.docs.map(alsBenutzer)), fehler),
      onSnapshot(
        query(col.vorgaenge, where('datum', '>=', vorgaengeAb), orderBy('datum', 'desc')),
        { includeMetadataChanges: true },
        (s) => {
          setVorgaenge(s.docs.map(alsVorgang));
          setAusstehendV(s.metadata.hasPendingWrites);
          setAusCache(s.metadata.fromCache);
        },
        fehler,
      ),
      onSnapshot(query(col.inventuren, orderBy('gestartetAm', 'desc')), (s) => setInventuren(s.docs.map(alsInventur)), fehler),
    ];
    return () => {
      window.removeEventListener('online', an);
      window.removeEventListener('offline', aus);
      abos.forEach((u) => u());
    };
  }, [vorgaengeAb]);

  const wert = useMemo<DatenWert>(() => {
    const e = einstellungen ?? STANDARD_EINSTELLUNGEN;
    const inv = inventuren.find((i) => i.id === e.inventurAktiv) ?? null;
    return {
      geladen: artikel !== null && varianten !== null && einstellungen !== null && vorgaenge !== null,
      artikel: [...(artikel ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      artikelById: new Map((artikel ?? []).map((a) => [a.id, a])),
      varianten: varianten ?? [],
      variantenById: new Map((varianten ?? []).map((v) => [v.id, v])),
      einstellungen: e,
      benutzerListe,
      vorgaenge: vorgaenge ?? [],
      vorgaengeAb,
      inventuren,
      aktiveInventur: inv,
      sync: { online, ausstehend: ausstehendV || ausstehendB, ausCache },
    };
  }, [artikel, varianten, einstellungen, benutzerListe, vorgaenge, vorgaengeAb, inventuren, online, ausstehendV, ausstehendB, ausCache]);

  return <DatenContext.Provider value={wert}>{children}</DatenContext.Provider>;
}

export function useDaten(): DatenWert {
  const d = useContext(DatenContext);
  if (!d) throw new Error('useDaten außerhalb des DataProvider');
  return d;
}
