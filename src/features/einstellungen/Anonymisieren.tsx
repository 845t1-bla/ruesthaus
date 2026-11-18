import { useState } from 'react';
import { Alert, Button, Group, Radio, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconUserOff } from '@tabler/icons-react';
import { doc, getDocs, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { alsVorgang, col } from '../../data/refs';
import { normalisiereName } from '../../domain/format';
import type { Vorgang } from '../../domain/types';

export const ANONYM = 'anonymisiert';

/** Sucht Vorgänge, deren Käufername mit dem Suchbegriff beginnt (über alle Jahre, direkt am Server/Cache). */
export async function sucheKaeufer(name: string): Promise<Vorgang[]> {
  const key = normalisiereName(name);
  if (!key) return [];
  const s = await getDocs(query(col.vorgaenge, where('kaeuferKey', '>=', key), where('kaeuferKey', '<=', key + ''), orderBy('kaeuferKey')));
  return s.docs.map(alsVorgang);
}

export function Anonymisieren() {
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Map<string, { name: string; anzahl: number; ids: string[] }> | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function suchen() {
    setLaeuft(true);
    try {
      const vs = await sucheKaeufer(suche);
      const m = new Map<string, { name: string; anzahl: number; ids: string[] }>();
      for (const v of vs) {
        if (!v.kaeuferKey) continue;
        const e = m.get(v.kaeuferKey) ?? { name: v.kaeufer ?? '', anzahl: 0, ids: [] };
        e.anzahl++;
        e.ids.push(v.id);
        m.set(v.kaeuferKey, e);
      }
      setTreffer(m);
      setWahl(null);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Suche fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  function anonymisieren() {
    const e = wahl ? treffer?.get(wahl) : null;
    if (!e) return;
    modals.openConfirmModal({
      title: 'Person anonymisieren',
      children: (
        <Text size="sm">
          Der Name <b>{e.name}</b> wird in {e.anzahl} Buchung(en) durch „{ANONYM}“ ersetzt. Beträge und Mengen bleiben erhalten. Das lässt sich nicht rückgängig machen.
        </Text>
      ),
      labels: { confirm: 'Anonymisieren', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          for (let i = 0; i < e.ids.length; i += 400) {
            const batch = writeBatch(db);
            for (const id of e.ids.slice(i, i + 400)) batch.update(doc(col.vorgaenge, id), { kaeufer: ANONYM, kaeuferKey: ANONYM });
            await batch.commit();
          }
          notifications.show({ color: 'ruesthausGruen', title: 'Anonymisiert', message: `${e.anzahl} Buchung(en) angepasst.` });
          setTreffer(null);
          setSuche('');
        } catch (err) {
          notifications.show({ color: 'red', title: 'Anonymisieren fehlgeschlagen', message: String(err) });
        }
      },
    });
  }

  return (
    <Stack maw={620}>
      <Text size="sm">
        Auf Löschwunsch (DSGVO) wird der Käufername in allen Buchungen ersetzt. Achtung: Danach lässt sich für diese Person kein Flatrate-Anspruch mehr nachweisen.
      </Text>
      <Group align="flex-end">
        <TextInput label="Name suchen" value={suche} onChange={(e) => setSuche(e.currentTarget.value)} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && suchen()} />
        <Button leftSection={<IconSearch size={16} />} onClick={suchen} loading={laeuft} disabled={!suche.trim()}>
          Suchen
        </Button>
      </Group>
      {treffer && treffer.size === 0 && <Alert color="gray">Keine Buchungen mit diesem Namen gefunden.</Alert>}
      {treffer && treffer.size > 0 && (
        <Radio.Group value={wahl} onChange={setWahl} label="Gefundene Namen">
          <Stack gap={6} mt="xs">
            {[...treffer.entries()].map(([key, e]) => (
              <Radio key={key} value={key} label={`${e.name} – ${e.anzahl} Buchung(en)`} />
            ))}
          </Stack>
        </Radio.Group>
      )}
      <Group>
        <Button color="red" leftSection={<IconUserOff size={16} />} disabled={!wahl} onClick={anonymisieren}>
          Anonymisieren
        </Button>
      </Group>
    </Stack>
  );
}
