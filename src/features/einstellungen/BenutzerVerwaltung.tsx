import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, PasswordInput, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUserPlus } from '@tabler/icons-react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { zweitAuth } from '../../firebase';
import { useAuth } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { col } from '../../data/refs';
import type { Rolle } from '../../domain/types';
import { authFehlertext } from '../auth/Login';

const ROLLEN = [
  { value: 'verkaeufer', label: 'Verkäufer' },
  { value: 'admin', label: 'Admin' },
];

function zufallsPasswort() {
  const zeichen = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(r, (n) => zeichen[n % zeichen.length]).join('');
}

function NeuerBenutzer({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState(zufallsPasswort);
  const [rolle, setRolle] = useState<Rolle>('verkaeufer');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function anlegen() {
    if (!name.trim() || !email.trim()) return setFehler('Name und E-Mail sind Pflicht.');
    if (passwort.length < 8) return setFehler('Das Startpasswort braucht mindestens 8 Zeichen.');
    setLaeuft(true);
    setFehler(null);
    const a = zweitAuth();
    try {
      const cred = await createUserWithEmailAndPassword(a, email.trim(), passwort);
      await setDoc(doc(col.benutzer, cred.user.uid), { name: name.trim(), email: email.trim(), rolle, aktiv: true });
      await signOut(a);
      notifications.show({
        color: 'ruesthausGruen',
        autoClose: false,
        title: `${name.trim()} angelegt`,
        message: 'Gib das Startpasswort persönlich weiter. Es lässt sich nach der ersten Anmeldung im Benutzermenü ändern.',
      });
      setName('');
      setEmail('');
      setPasswort(zufallsPasswort());
      onClose();
    } catch (e) {
      setFehler(authFehlertext(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Modal opened={offen} onClose={onClose} title="Benutzer anlegen">
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} withAsterisk />
        <TextInput label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} withAsterisk />
        <PasswordInput label="Startpasswort" description="Zufällig erzeugt – bitte notieren und persönlich weitergeben" value={passwort} onChange={(e) => setPasswort(e.currentTarget.value)} visible />
        <Select label="Rolle" data={ROLLEN} value={rolle} onChange={(r) => setRolle((r as Rolle) ?? 'verkaeufer')} allowDeselect={false} />
        {fehler && <Alert color="red">{fehler}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={anlegen} loading={laeuft}>
            Anlegen
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function BenutzerVerwaltung() {
  const { benutzerListe } = useDaten();
  const { user } = useAuth();
  const [neu, setNeu] = useState(false);

  async function aendere(uid: string, teil: { rolle?: Rolle; aktiv?: boolean }) {
    try {
      await updateDoc(doc(col.benutzer, uid), teil);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Änderung fehlgeschlagen', message: String(e) });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Verkäufer dürfen verkaufen, Flatrates buchen, Bestand ansehen und zählen. Admins zusätzlich alles andere.
        </Text>
        <Button leftSection={<IconUserPlus size={16} />} onClick={() => setNeu(true)}>
          Benutzer anlegen
        </Button>
      </Group>
      <Table.ScrollContainer minWidth={560}>
        <Table striped verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>E-Mail</Table.Th>
              <Table.Th>Rolle</Table.Th>
              <Table.Th>Aktiv</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {benutzerListe.map((b) => {
              const ich = b.uid === user?.uid;
              return (
                <Table.Tr key={b.uid}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {b.name}
                      </Text>
                      {ich && <Badge size="xs">du</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{b.email}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Select size="xs" w={140} data={ROLLEN} value={b.rolle} disabled={ich} onChange={(r) => r && aendere(b.uid, { rolle: r as Rolle })} allowDeselect={false} />
                  </Table.Td>
                  <Table.Td>
                    <Switch checked={b.aktiv} disabled={ich} onChange={(e) => aendere(b.uid, { aktiv: e.currentTarget.checked })} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text size="xs" c="dimmed">
        Konten werden nicht gelöscht, sondern deaktiviert – ihre Buchungen bleiben nachvollziehbar.
      </Text>
      <NeuerBenutzer offen={neu} onClose={() => setNeu(false)} />
    </Stack>
  );
}
