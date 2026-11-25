import { deleteDoc, doc, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase';
import { col, zaehlungenCol } from '../../data/refs';
import type { Benutzer, Inventur } from '../../domain/types';

/**
 * Gründe, warum ein Benutzer nicht gelöscht werden darf (leer = noch nichts gemacht).
 * Geprüft wird direkt am Server: Buchungen, Inventur gestartet/abgeschlossen, Inventur-Zählungen.
 * Zählungen und Inventuren speichern nur den Namen – bei Namensgleichheit wird lieber blockiert.
 */
export async function aktivitaetenVon(b: Benutzer, inventuren: Inventur[]): Promise<string[]> {
  const gruende: string[] = [];
  try {
    const buchungen = await getDocsFromServer(query(col.vorgaenge, where('benutzerUid', '==', b.uid), limit(1)));
    if (!buchungen.empty) gruende.push('hat bereits gebucht');
    if (inventuren.some((i) => i.gestartetVon === b.name || i.abgeschlossenVon === b.name)) {
      gruende.push('hat eine Inventur gestartet oder abgeschlossen');
    }
    for (const inv of inventuren) {
      const z = await getDocsFromServer(query(zaehlungenCol(inv.id), where('gezaehltVon', '==', b.name), limit(1)));
      if (!z.empty) {
        gruende.push('hat bei einer Inventur gezählt');
        break;
      }
    }
  } catch {
    throw new Error('Zum Löschen wird eine Internetverbindung benötigt (es wird geprüft, ob die Person schon etwas gebucht hat).');
  }
  return gruende;
}

/** Entfernt das Benutzerprofil: Die Person verliert sofort jeden Zugang zur App. */
export async function loescheBenutzerProfil(b: Benutzer): Promise<void> {
  await deleteDoc(doc(col.benutzer, b.uid));
}

/**
 * Das Login-Konto (E-Mail/Passwort) selbst kann im kostenlosen Firebase-Tarif nur in der
 * Firebase-Konsole gelöscht werden – dorthin führt dieser Link.
 */
export const loginKontenUrl = () => `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`;
