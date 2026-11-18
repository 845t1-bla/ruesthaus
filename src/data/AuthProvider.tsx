import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth } from '../firebase';
import type { Benutzer } from '../domain/types';
import { alsBenutzer, col, einstellungenRef } from './refs';

export type AuthStatus = 'laden' | 'abgemeldet' | 'ersteinrichtung' | 'keinZugriff' | 'bereit';

interface AuthWert {
  status: AuthStatus;
  user: User | null;
  benutzer: Benutzer | null;
  istAdmin: boolean;
}

const AuthContext = createContext<AuthWert>({ status: 'laden', user: null, benutzer: null, istAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [benutzer, setBenutzer] = useState<Benutzer | null | undefined>(undefined);
  const [ohneEinrichtung, setOhneEinrichtung] = useState<boolean | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    setBenutzer(undefined);
    setOhneEinrichtung(undefined);
    if (!user) return;
    return onSnapshot(
      doc(col.benutzer, user.uid),
      (s) => {
        if (s.exists()) {
          setBenutzer(alsBenutzer(s));
        } else {
          setBenutzer(null);
          // Noch kein Benutzerprofil: Ist die App überhaupt schon eingerichtet?
          getDoc(einstellungenRef)
            .then((e) => setOhneEinrichtung(!e.exists()))
            .catch(() => setOhneEinrichtung(false));
        }
      },
      () => setBenutzer(null),
    );
  }, [user]);

  let status: AuthStatus = 'laden';
  if (user === null) status = 'abgemeldet';
  else if (user && benutzer) status = benutzer.aktiv ? 'bereit' : 'keinZugriff';
  else if (user && benutzer === null && ohneEinrichtung !== undefined) status = ohneEinrichtung ? 'ersteinrichtung' : 'keinZugriff';

  const wert: AuthWert = {
    status,
    user: user ?? null,
    benutzer: benutzer ?? null,
    istAdmin: status === 'bereit' && benutzer?.rolle === 'admin',
  };
  return <AuthContext.Provider value={wert}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Für Buchungen: angemeldeter, aktiver Benutzer (nur innerhalb geschützter Seiten verwenden). */
export function useBenutzer(): Benutzer {
  const { benutzer } = useAuth();
  if (!benutzer) throw new Error('Kein angemeldeter Benutzer');
  return benutzer;
}
