import { useState } from 'react';
import { Alert, Anchor, Button, Group, PasswordInput, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { AuthRahmen } from './AuthRahmen';

export function authFehlertext(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'E-Mail oder Passwort ist falsch.';
  }
  if (code.includes('too-many-requests')) return 'Zu viele Versuche. Bitte kurz warten.';
  if (code.includes('network')) return 'Keine Verbindung zum Server. Für die erste Anmeldung wird Internet benötigt.';
  if (code.includes('email-already-in-use')) return 'Diese E-Mail-Adresse ist bereits registriert.';
  if (code.includes('weak-password')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
  if (code.includes('invalid-email')) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (code.includes('requires-recent-login')) return 'Bitte einmal ab- und wieder anmelden und es dann erneut versuchen.';
  return e instanceof Error ? e.message : 'Unbekannter Fehler';
}

export function Login() {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [modus, setModus] = useState<'login' | 'einrichtung'>('login');

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      if (modus === 'login') await signInWithEmailAndPassword(auth, email.trim(), passwort);
      else await createUserWithEmailAndPassword(auth, email.trim(), passwort);
    } catch (err) {
      setFehler(authFehlertext(err));
    } finally {
      setLaeuft(false);
    }
  }

  async function passwortVergessen() {
    if (!email.trim()) {
      setFehler('Bitte zuerst die E-Mail-Adresse eintragen.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      notifications.show({ title: 'E-Mail verschickt', message: 'Falls das Konto existiert, kommt gleich ein Link zum Zurücksetzen.' });
    } catch (err) {
      setFehler(authFehlertext(err));
    }
  }

  return (
    <AuthRahmen
      titel={modus === 'login' ? 'Anmelden' : 'Ersteinrichtung: Admin-Konto anlegen'}
      untertitel={
        modus === 'login'
          ? 'Mit dem Konto, das dir der Rüsthaus-Admin angelegt hat.'
          : 'Nur beim allerersten Start der App. Das erste Konto wird Administrator.'
      }
    >
      <form onSubmit={absenden}>
        <Stack>
          <TextInput label="E-Mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
          <PasswordInput
            label="Passwort"
            autoComplete={modus === 'login' ? 'current-password' : 'new-password'}
            value={passwort}
            onChange={(e) => setPasswort(e.currentTarget.value)}
            required
          />
          {fehler && <Alert color="red">{fehler}</Alert>}
          <Button type="submit" loading={laeuft} fullWidth>
            {modus === 'login' ? 'Anmelden' : 'Konto anlegen'}
          </Button>
          <Group justify="space-between">
            {modus === 'login' ? (
              <>
                <Anchor component="button" type="button" size="xs" onClick={passwortVergessen}>
                  Passwort vergessen?
                </Anchor>
                <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => setModus('einrichtung')}>
                  Ersteinrichtung
                </Anchor>
              </>
            ) : (
              <Anchor component="button" type="button" size="xs" onClick={() => setModus('login')}>
                Zurück zur Anmeldung
              </Anchor>
            )}
          </Group>
        </Stack>
      </form>
    </AuthRahmen>
  );
}
