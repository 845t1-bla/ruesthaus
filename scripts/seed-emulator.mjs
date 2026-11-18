// Befüllt die lokale Firebase Emulator Suite mit Testdaten.
// Voraussetzung: `npm run emulators` läuft. Aufruf: npm run seed
// NUR für den Emulator gedacht – die Zugangsdaten unten sind reine Testwerte.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getFirestore, writeBatch } from 'firebase/firestore';

import { TEST_ADMIN, TEST_VERKAEUFER } from './seed-emulator-konten.mjs';

const cfg = { apiKey: 'demo-api-key', authDomain: 'demo-ruesthaus.firebaseapp.com', projectId: 'demo-ruesthaus', appId: 'demo-app' };

function verbinde(name) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return { app, auth };
}

async function konto(auth, { email, passwort }) {
  try {
    return (await createUserWithEmailAndPassword(auth, email, passwort)).user;
  } catch {
    return (await signInWithEmailAndPassword(auth, email, passwort)).user;
  }
}

const admin = verbinde('admin');
const db = getFirestore(admin.app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
const adminUser = await konto(admin.auth, TEST_ADMIN);

// Ersteinrichtung wie in der App
const e = writeBatch(db);
e.set(doc(db, 'einstellungen', 'app'), {
  stammName: 'DPSG Stamm Horsadal Roßtal',
  flatratePreis: 40,
  standardAufnaeher: [],
  rabattGruende: ['Sozialfall', 'Leiterausstattung', 'Mengenrabatt', 'Kulanz', 'Sonstiges'],
  zugangsGruende: ['Spende', 'Rücknahme', 'Fundsache', 'Sonstiges'],
  abgangsGruende: ['Entsorgung', 'Schwund', 'Eigenbedarf Stamm', 'Sonstiges'],
  inventurAktiv: null,
  ersteinrichtungDurch: adminUser.uid,
});
e.set(doc(db, 'benutzer', adminUser.uid), { name: TEST_ADMIN.name, email: TEST_ADMIN.email, rolle: 'admin', aktiv: true });
await e.commit();

const verk = verbinde('verkaeufer');
const verkUser = await konto(verk.auth, TEST_VERKAEUFER);

const b = writeBatch(db);
b.set(doc(db, 'benutzer', verkUser.uid), { name: TEST_VERKAEUFER.name, email: TEST_VERKAEUFER.email, rolle: 'verkaeufer', aktiv: true });

const ZUSTAENDE = ['unbenaeht', 'benaeht', 'sozial'];
const aufnaeherIds = [];
let zaehler = 0;

function artikel({ name, kategorie, achsen, groessen = [], vk, ek }) {
  const ref = doc(collection(db, 'artikel'));
  b.set(ref, { name, kategorie, achsen, groessen, vkPreisStandard: vk, beschreibung: '', thumbnail: null, aktiv: true });
  let kombis = [{}];
  const erweitere = (key, werte) => (kombis = kombis.flatMap((k) => werte.map((w) => ({ ...k, [key]: w }))));
  if (achsen.includes('kollektion')) erweitere('kollektion', ['neu', 'alt']);
  if (achsen.includes('schnitt')) erweitere('schnitt', ['herren', 'damen']);
  if (achsen.includes('groesse')) erweitere('groesse', groessen);
  if (achsen.includes('zustand')) erweitere('zustand', ZUSTAENDE);
  kombis.forEach((attribute, sortierung) => {
    const vref = doc(collection(db, 'varianten'));
    zaehler++;
    b.set(vref, {
      artikelId: ref.id,
      artikelName: name,
      kategorie,
      attribute,
      sortierung,
      vkPreis: attribute.zustand === 'sozial' ? 0 : attribute.zustand === 'benaeht' ? vk + 5 : vk,
      ekDurchschnitt: ek,
      bestand: (zaehler * 7) % 6,
      mindestbestand: kategorie === 'aufnaeher' ? 10 : attribute.zustand === 'unbenaeht' ? 2 : null,
      aktiv: true,
    });
    if (kategorie === 'aufnaeher') aufnaeherIds.push(vref.id);
  });
}

artikel({ name: 'Kluft', kategorie: 'kluft', achsen: ['groesse', 'zustand'], groessen: ['140', '152', '164', '176', 'S', 'M', 'L'], vk: 55, ek: 38 });
artikel({ name: 'Kluftbluse', kategorie: 'kluftbluse', achsen: ['groesse', 'zustand'], groessen: ['140', '152', '164', '36', '38', '40'], vk: 55, ek: 38 });
artikel({ name: 'Stammes-Hoodie', kategorie: 'stammeskleidung', achsen: ['kollektion', 'schnitt', 'groesse'], groessen: ['S', 'M', 'L', 'XL'], vk: 35, ek: 22 });
artikel({ name: 'Stammes-T-Shirt', kategorie: 'stammeskleidung', achsen: ['kollektion', 'schnitt', 'groesse'], groessen: ['S', 'M', 'L', 'XL'], vk: 15, ek: 8.5 });
artikel({ name: 'Halstuch Roßtal', kategorie: 'halstuch', achsen: [], vk: 12, ek: 6 });
for (const [name, vk, ek] of [
  ['Aufnäher DPSG-Lilie', 3, 1.2],
  ['Stammesaufnäher', 4, 1.6],
  ['Bezirksaufnäher', 3, 1.2],
  ['Diözesanaufnäher', 3, 1.2],
  ['Aufnäher Deutschlandflagge', 2.5, 0.9],
]) {
  artikel({ name, kategorie: 'aufnaeher', achsen: [], vk, ek });
}
b.update(doc(db, 'einstellungen', 'app'), { standardAufnaeher: aufnaeherIds });
await b.commit();

console.log(`Testdaten angelegt: ${zaehler} Varianten.`);
console.log(`Admin:      ${TEST_ADMIN.email}`);
console.log(`Verkäufer:  ${TEST_VERKAEUFER.email}`);
console.log('Passwörter stehen in scripts/seed-emulator-konten.mjs.');
process.exit(0);
