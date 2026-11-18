import type { VorgangTyp } from './types';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const datum = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const datumZeit = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatEuro = (n: number) => euro.format(runde(n));
export const formatZahl = (n: number) => zahl.format(n);
export const formatDatum = (ms: number) => datum.format(new Date(ms));
export const formatDatumZeit = (ms: number) => datumZeit.format(new Date(ms));

/** Kaufmännisch auf Cent runden (vermeidet 0,1 + 0,2 = 0,30000000000000004). */
export function runde(n: number, stellen = 2): number {
  const f = 10 ** stellen;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Normalisiert einen Namen für die Suche: Kleinbuchstaben, Umlaute aufgelöst (ä→ae, ß→ss),
 * Akzente entfernt, Leerzeichen zusammengefasst. So finden „Müller“ und „Mueller“ zueinander.
 */
export function normalisiereName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

const BELEG_PREFIX: Record<VorgangTyp, string> = {
  VERKAUF: 'V',
  FLATRATE: 'F',
  FLATRATE_TAUSCH: 'T',
  SOZIALKLUFT: 'S',
  EINKAUF: 'E',
  ZUGANG: 'Z',
  ABGANG: 'A',
  INVENTURKORREKTUR: 'I',
  STORNO: 'X',
};

/** Lesbare Belegnummer, z. B. „V-261118-K3F9“. Eindeutig über die Dokument-ID, ohne Online-Zähler. */
export function belegNummer(typ: VorgangTyp, ms: number, id: string): string {
  const d = new Date(ms);
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const kurz = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return `${BELEG_PREFIX[typ]}-${yy}${mm}${dd}-${kurz}`;
}

/** Datum als yyyy-mm-dd für <input type="date">. */
export function isoDatum(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function vonIsoDatum(iso: string, endeDesTages = false): number {
  const [y, m, d] = iso.split('-').map(Number);
  return endeDesTages ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}
