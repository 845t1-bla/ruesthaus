// Prüft die Firestore-Sicherheitsregeln gegen den laufenden Emulator (nach `npm run seed`).
// Aufruf: npm run test:rules
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { TEST_ADMIN, TEST_VERKAEUFER } from './seed-emulator-konten.mjs';

const cfg = { apiKey: 'demo-api-key', authDomain: 'demo-ruesthaus.firebaseapp.com', projectId: 'demo-ruesthaus', appId: 'demo-app' };

async function sitzung(name, konto, neu = false) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const user = neu
    ? (await createUserWithEmailAndPassword(auth, konto.email, konto.passwort)).user
    : (await signInWithEmailAndPassword(auth, konto.email, konto.passwort)).user;
  return { db, uid: user.uid };
}

let ok = 0;
let fehler = 0;
async function erwarte(text, erlaubt, fn) {
  let erfolg;
  try {
    await fn();
    erfolg = true;
  } catch (e) {
    erfolg = false;
    if (!String(e?.code ?? e).includes('permission-denied')) console.log('   (Fehler:', e?.code ?? e, ')');
  }
  const passt = erfolg === erlaubt;
  passt ? ok++ : fehler++;
  console.log(`${passt ? '✔' : '✘'} ${text} → ${erfolg ? 'erlaubt' : 'verweigert'}`);
}

const admin = await sitzung('admin', TEST_ADMIN);
const verk = await sitzung('verk', TEST_VERKAEUFER);
const fremd = await sitzung('fremd', { email: `fremd${Date.now()}@ruesthaus.test`, passwort: 'Fremd-Test-1' }, true);

const v = (await getDocs(query(collection(admin.db, 'varianten'), limit(1)))).docs[0];
const vorgang = (uid, typ = 'VERKAUF') => ({
  typ,
  belegNr: 'T-1',
  datum: Date.now(),
  benutzerUid: uid,
  benutzerName: 'Test',
  kaeufer: 'Regeltest',
  kaeuferKey: 'regeltest',
  positionen: [{ varianteId: v.id, menge: -1 }],
  summe: 1,
  storniert: false,
});

console.log('\n— Fremdes Konto ohne Freischaltung —');
await erwarte('liest Artikel', false, () => getDocs(collection(fremd.db, 'artikel')));
await erwarte('macht sich selbst zum Admin', false, () => setDoc(doc(fremd.db, 'benutzer', fremd.uid), { name: 'X', email: 'x', rolle: 'admin', aktiv: true }));
await erwarte('überschreibt Einstellungen', false, () => setDoc(doc(fremd.db, 'einstellungen', 'app'), { ersteinrichtungDurch: fremd.uid }));

console.log('\n— Verkäufer —');
await erwarte('liest Bestand', true, () => getDocs(collection(verk.db, 'varianten')));
await erwarte('legt Artikel an', false, () => setDoc(doc(collection(verk.db, 'artikel')), { name: 'X' }));
await erwarte('ändert Verkaufspreis', false, () => updateDoc(doc(verk.db, 'varianten', v.id), { vkPreis: 0 }));
await erwarte('bucht Einkauf', false, () => setDoc(doc(collection(verk.db, 'vorgaenge')), vorgang(verk.uid, 'EINKAUF')));
await erwarte('bucht Verkauf unter fremdem Namen', false, () => setDoc(doc(collection(verk.db, 'vorgaenge')), vorgang(admin.uid)));
const eigenerRef = doc(collection(verk.db, 'vorgaenge'));
await erwarte('bucht Verkauf + Bestand', true, async () => {
  const b = writeBatch(verk.db);
  b.set(eigenerRef, vorgang(verk.uid));
  b.update(doc(verk.db, 'varianten', v.id), { bestand: increment(-1) });
  await b.commit();
});
await erwarte('ändert Betrag eines Belegs', false, () => updateDoc(eigenerRef, { summe: 0 }));
await erwarte('löscht Beleg', false, () => deleteDoc(eigenerRef));
await erwarte('storniert eigenen Beleg', true, () => updateDoc(eigenerRef, { storniert: true, stornoDurchId: 'x' }));
await erwarte('storniert ein zweites Mal', false, () => updateDoc(eigenerRef, { storniert: true, stornoDurchId: 'y' }));
const adminRef = doc(collection(admin.db, 'vorgaenge'));
await setDoc(adminRef, vorgang(admin.uid));
await erwarte('storniert Beleg des Admins', false, () => updateDoc(doc(verk.db, 'vorgaenge', adminRef.id), { storniert: true, stornoDurchId: 'x' }));
await erwarte('anonymisiert Käufer', false, () => updateDoc(doc(verk.db, 'vorgaenge', adminRef.id), { kaeufer: 'anonymisiert', kaeuferKey: 'anonymisiert' }));
await erwarte('ändert eigene Rolle', false, () => updateDoc(doc(verk.db, 'benutzer', verk.uid), { rolle: 'admin' }));

console.log('\n— Admin —');
await erwarte('anonymisiert Käufer', true, () => updateDoc(adminRef, { kaeufer: 'anonymisiert', kaeuferKey: 'anonymisiert' }));
await erwarte('storniert fremden Beleg', true, async () => {
  const r = doc(collection(admin.db, 'vorgaenge'));
  await setDoc(r, vorgang(admin.uid));
  await updateDoc(doc(admin.db, 'vorgaenge', r.id), { storniert: true, stornoDurchId: 'z' });
});
await erwarte('entzieht sich selbst die Admin-Rolle', false, () => updateDoc(doc(admin.db, 'benutzer', admin.uid), { rolle: 'verkaeufer' }));

console.log('\n— Inventursperre —');
const invRef = doc(collection(admin.db, 'inventuren'));
await setDoc(invRef, { bezeichnung: 'Regeltest', stichtag: Date.now(), status: 'offen', gestartetVon: 'Test', gestartetAm: Date.now(), abgeschlossenVon: null, abgeschlossenAm: null, ergebnis: null });
await updateDoc(doc(admin.db, 'einstellungen', 'app'), { inventurAktiv: invRef.id });
await erwarte('Verkäufer bucht Verkauf', false, () => setDoc(doc(collection(verk.db, 'vorgaenge')), vorgang(verk.uid)));
await erwarte('Verkäufer ändert Bestand', false, () => updateDoc(doc(verk.db, 'varianten', v.id), { bestand: increment(1) }));
await erwarte('Verkäufer zählt', true, () => setDoc(doc(verk.db, 'inventuren', invRef.id, 'zaehlungen', v.id), { varianteId: v.id, ist: 3, gezaehltVon: 'Test', zeit: Date.now() }));
await erwarte('Admin bucht Verkauf', false, () => setDoc(doc(collection(admin.db, 'vorgaenge')), vorgang(admin.uid)));
await erwarte('Admin bucht Inventurkorrektur', true, () => setDoc(doc(collection(admin.db, 'vorgaenge')), vorgang(admin.uid, 'INVENTURKORREKTUR')));
const inventurKorrektur = (await getDocs(query(collection(admin.db, 'vorgaenge'), where('typ', '==', 'INVENTURKORREKTUR'), limit(1)))).docs[0];
await erwarte('Admin storniert Inventurkorrektur', false, () => updateDoc(inventurKorrektur.ref, { storniert: true, stornoDurchId: 'x' }));
await updateDoc(doc(admin.db, 'einstellungen', 'app'), { inventurAktiv: null });
await updateDoc(invRef, { status: 'abgebrochen' });
await erwarte('Verkäufer zählt in beendeter Inventur', false, () => setDoc(doc(verk.db, 'inventuren', invRef.id, 'zaehlungen', v.id), { varianteId: v.id, ist: 1, gezaehltVon: 'Test', zeit: Date.now() }));

// Aufräumen: Regeltest-Belege bleiben (unlöschbar) – im Emulator egal.
const e = await getDoc(doc(admin.db, 'einstellungen', 'app'));
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen. Inventursperre aktuell: ${e.data().inventurAktiv ?? 'keine'}`);
process.exit(fehler ? 1 : 0);
