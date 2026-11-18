import { useState } from 'react';
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { signOut } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useAuth } from '../../data/AuthProvider';
import { col, einstellungenRef } from '../../data/refs';
import { STANDARD_EINSTELLUNGEN } from '../../domain/types';
import { AuthRahmen } from './AuthRahmen';

/** Erster Start: legt die Einstellungen an und macht das angemeldete Konto zum Admin. */
export function Ersteinrichtung() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [stammName, setStammName] = useState(STANDARD_EINSTELLUNGEN.stammName);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function einrichten() {
    if (!user || !name.trim()) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const batch = writeBatch(db);
      batch.set(einstellungenRef, { ...STANDARD_EINSTELLUNGEN, stammName: stammName.trim(), ersteinrichtungDurch: user.uid });
      batch.set(doc(col.benutzer, user.uid), { name: name.trim(), email: user.email ?? '', rolle: 'admin', aktiv: true });
      await batch.commit();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
      setLaeuft(false);
    }
  }

  return (
    <AuthRahmen titel="Rüsthaus einrichten" untertitel="Die App ist noch leer. Du wirst als erster Benutzer Administrator.">
      <Stack>
        <Text size="sm">
          Angemeldet als <b>{user?.email}</b>
        </Text>
        <TextInput label="Dein Name" description="Erscheint bei allen deinen Buchungen" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <TextInput label="Name des Stammes" value={stammName} onChange={(e) => setStammName(e.currentTarget.value)} />
        {fehler && <Alert color="red">{fehler}</Alert>}
        <Button onClick={einrichten} loading={laeuft} disabled={!name.trim()}>
          Einrichtung abschließen
        </Button>
        <Button variant="subtle" color="gray" onClick={() => signOut(auth)}>
          Abmelden
        </Button>
      </Stack>
    </AuthRahmen>
  );
}
