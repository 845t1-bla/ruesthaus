import { useState } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { authFehlertext } from './Login';

export function PasswortAendern({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [neu2, setNeu2] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  function schliessen() {
    setAlt('');
    setNeu('');
    setNeu2('');
    setFehler(null);
    onClose();
  }

  async function speichern() {
    const user = auth.currentUser;
    if (!user?.email) return;
    if (neu.length < 8) return setFehler('Das neue Passwort braucht mindestens 8 Zeichen.');
    if (neu !== neu2) return setFehler('Die beiden neuen Passwörter stimmen nicht überein.');
    setLaeuft(true);
    setFehler(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, alt));
      await updatePassword(user, neu);
      notifications.show({ color: 'ruesthausGruen', title: 'Passwort geändert', message: 'Ab sofort gilt das neue Passwort.' });
      schliessen();
    } catch (e) {
      setFehler(authFehlertext(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Modal opened={offen} onClose={schliessen} title="Passwort ändern">
      <Stack>
        <PasswordInput label="Aktuelles Passwort" value={alt} onChange={(e) => setAlt(e.currentTarget.value)} autoComplete="current-password" />
        <PasswordInput label="Neues Passwort" value={neu} onChange={(e) => setNeu(e.currentTarget.value)} autoComplete="new-password" />
        <PasswordInput label="Neues Passwort wiederholen" value={neu2} onChange={(e) => setNeu2(e.currentTarget.value)} autoComplete="new-password" />
        {fehler && <Alert color="red">{fehler}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button onClick={speichern} loading={laeuft}>
            Speichern
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
