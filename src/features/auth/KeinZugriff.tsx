import { Button, Text } from '@mantine/core';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../data/AuthProvider';
import { AuthRahmen } from './AuthRahmen';

export function KeinZugriff() {
  const { user, benutzer } = useAuth();
  return (
    <AuthRahmen
      titel="Kein Zugriff"
      untertitel={benutzer ? 'Dein Konto wurde deaktiviert.' : 'Für dieses Konto ist kein Zugang zum Rüsthaus freigeschaltet.'}
    >
      <Text size="sm">
        Angemeldet als <b>{user?.email}</b>. Bitte wende dich an die Rüsthaus-Verantwortlichen.
      </Text>
      <Button variant="light" onClick={() => signOut(auth)}>
        Abmelden
      </Button>
    </AuthRahmen>
  );
}
