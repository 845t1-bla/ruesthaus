import { doc, increment, writeBatch, type FieldValue, type WriteBatch } from 'firebase/firestore';
import { notifications } from '@mantine/notifications';
import { db } from '../firebase';
import type { Buchung } from '../domain/vorgaenge';
import { col, ohneId } from './refs';

export type SendeErgebnis = 'bestaetigt' | 'ausstehend';

function meldeAbgelehnt(err: unknown) {
  notifications.show({
    color: 'red',
    autoClose: false,
    title: 'Änderung vom Server abgelehnt',
    message:
      'Eine offline gespeicherte Änderung wurde beim Synchronisieren abgelehnt (z. B. weil inzwischen eine Inventur läuft). ' +
      `Bitte Bestand prüfen. Details: ${err instanceof Error ? err.message : String(err)}`,
  });
}

/**
 * Schickt einen Batch ab. Offline (oder bei langsamer Verbindung) wird nicht auf die
 * Server-Bestätigung gewartet – Firestore hat die Änderung lokal bereits übernommen und
 * synchronisiert sie später. Lehnt der Server sofort ab, wird der Fehler geworfen.
 */
export async function sende(batch: WriteBatch): Promise<SendeErgebnis> {
  const p = batch.commit();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    p.catch(meldeAbgelehnt);
    return 'ausstehend';
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SendeErgebnis>((r) => {
    timer = setTimeout(() => r('ausstehend'), 6000);
  });
  try {
    const res = await Promise.race([p.then(() => 'bestaetigt' as const), timeout]);
    if (res === 'ausstehend') p.catch(meldeAbgelehnt);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const neueVorgangsId = () => doc(col.vorgaenge).id;

/** Schreibt Vorgang + Bestandsänderungen atomar in einen Batch. */
export function buchungInBatch(batch: WriteBatch, b: Buchung) {
  batch.set(doc(col.vorgaenge, b.vorgang.id), ohneId(b.vorgang));
  const ids = new Set([...Object.keys(b.bestand), ...Object.keys(b.varianteUpdates)]);
  for (const id of ids) {
    const upd: Record<string, number | FieldValue> = { ...(b.varianteUpdates[id] ?? {}) };
    if (b.bestand[id]) upd.bestand = increment(b.bestand[id]);
    if (Object.keys(upd).length) batch.update(doc(col.varianten, id), upd);
  }
}

export async function speichereBuchung(b: Buchung, zusatz?: (batch: WriteBatch) => void): Promise<SendeErgebnis> {
  const batch = writeBatch(db);
  buchungInBatch(batch, b);
  zusatz?.(batch);
  return sende(batch);
}

export function meldeGebucht(ergebnis: SendeErgebnis, belegNr: string, text = 'Gebucht') {
  notifications.show({
    color: ergebnis === 'bestaetigt' ? 'ruesthausGruen' : 'yellow',
    title: `${text}: ${belegNr}`,
    message:
      ergebnis === 'bestaetigt'
        ? 'Die Buchung ist gespeichert.'
        : 'Lokal gespeichert – wird synchronisiert, sobald wieder Internet da ist.',
  });
}
