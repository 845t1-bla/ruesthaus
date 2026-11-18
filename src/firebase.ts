import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

export const nutztEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseKonfiguriert = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  // Offline-Cache: Buchungen funktionieren ohne Netz und werden später synchronisiert.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

if (nutztEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/**
 * Zweite Firebase-Instanz nur für das Anlegen neuer Benutzer: createUserWithEmailAndPassword
 * meldet sonst den angemeldeten Admin ab.
 */
export function zweitAuth() {
  const name = 'benutzerverwaltung';
  const zweit = getApps().find((a) => a.name === name) ?? initializeApp(firebaseConfig, name);
  const a = getAuth(zweit);
  if (nutztEmulator && !a.emulatorConfig) connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
  return a;
}
