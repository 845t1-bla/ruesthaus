import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Paper, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import { IconAlertTriangle, IconCoin, IconListCheck, IconSum } from '@tabler/icons-react';
import { doc, increment, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { neueVorgangsId } from '../../data/buchen';
import { col, einstellungenRef, ohneId } from '../../data/refs';
import { formatEuro } from '../../domain/format';
import { inventurSummen, inventurZeilen } from '../../domain/inventur';
import type { Inventur, InventurZeile } from '../../domain/types';
import { bucheInventurKorrektur } from '../../domain/vorgaenge';
import { Kennzahl } from '../../components/Bausteine';
import { useZaehlungen } from './Zaehlliste';

const BATCH_MAX = 450;

export function InventurAbschluss({ inventur, onFertig }: { inventur: Inventur; onFertig: (inv: Inventur) => void }) {
  const benutzer = useBenutzer();
  const { varianten, sync } = useDaten();
  const zaehlungen = useZaehlungen(inventur.id);
  const [nurAbweichungen, setNurAbweichungen] = useState(true);
  const [nullOk, setNullOk] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  const zeilen = useMemo(() => inventurZeilen(varianten, zaehlungen), [varianten, zaehlungen]);
  const s = inventurSummen(zeilen);
  const anzeigen = nurAbweichungen ? zeilen.filter((z) => z.differenz !== 0 || !z.gezaehlt) : zeilen;
  const bereit = s.nichtGezaehlt === 0 || nullOk;

  async function abschliessen() {
    if (!navigator.onLine) {
      notifications.show({ color: 'red', title: 'Offline', message: 'Zum Abschluss der Inventur wird eine Internetverbindung benötigt.' });
      return;
    }
    setLaeuft(true);
    try {
      const jetzt = Date.now();
      const b = bucheInventurKorrektur(
        { id: neueVorgangsId(), uid: benutzer.uid, benutzerName: benutzer.name, jetzt },
        { inventurId: inventur.id, bezeichnung: inventur.bezeichnung, zeilen },
      );
      const ergebnis: InventurZeile[] = zeilen;
      const updates = Object.entries(b.bestand);
      // Erster Batch: Korrekturbeleg, Inventur abschließen, Sperre aufheben + erste Bestandsänderungen.
      const erster = writeBatch(db);
      if (b.vorgang.positionen.length) erster.set(doc(col.vorgaenge, b.vorgang.id), ohneId(b.vorgang));
      erster.update(doc(col.inventuren, inventur.id), {
        status: 'abgeschlossen',
        abgeschlossenVon: benutzer.name,
        abgeschlossenAm: jetzt,
        ergebnis,
      });
      erster.update(einstellungenRef, { inventurAktiv: null });
      for (const [id, d] of updates.slice(0, BATCH_MAX)) erster.update(doc(col.varianten, id), { bestand: increment(d) });
      await erster.commit();
      for (let i = BATCH_MAX; i < updates.length; i += BATCH_MAX) {
        const weitere = writeBatch(db);
        for (const [id, d] of updates.slice(i, i + BATCH_MAX)) weitere.update(doc(col.varianten, id), { bestand: increment(d) });
        await weitere.commit();
      }
      notifications.show({ color: 'ruesthausGruen', title: 'Inventur abgeschlossen', message: `${s.abweichungen} Abweichung(en) wurden als Korrektur gebucht.` });
      onFertig({ ...inventur, status: 'abgeschlossen', abgeschlossenVon: benutzer.name, abgeschlossenAm: jetzt, ergebnis });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Abschluss fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  function bestaetigen() {
    modals.openConfirmModal({
      title: 'Inventur abschließen?',
      children: (
        <Text size="sm">
          Die gezählten Mengen werden der neue Bestand. {s.abweichungen} Abweichung(en) mit einem Wert von {formatEuro(s.wertDifferenz)} werden als Inventurkorrektur gebucht. Danach ist der Verkauf wieder freigegeben.
        </Text>
      ),
      labels: { confirm: 'Abschließen', cancel: 'Abbrechen' },
      onConfirm: abschliessen,
    });
  }

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Kennzahl label="Gezählt" wert={`${s.gezaehlt}/${s.positionen}`} icon={IconListCheck} />
        <Kennzahl label="Abweichungen" wert={s.abweichungen} icon={IconAlertTriangle} farbe={s.abweichungen ? 'orange' : 'gray'} />
        <Kennzahl label="Lagerwert Ist" wert={formatEuro(s.wertIst)} zusatz={`Soll ${formatEuro(s.wertSoll)}`} icon={IconCoin} farbe="ruesthausGruen" />
        <Kennzahl label="Wertdifferenz" wert={formatEuro(s.wertDifferenz)} icon={IconSum} farbe={s.wertDifferenz < 0 ? 'dpsgRot' : 'gray'} />
      </SimpleGrid>
      {sync.ausstehend && (
        <Alert color="blue">Es werden noch Zählungen synchronisiert. Bitte warten, bis oben „Synchron“ angezeigt wird.</Alert>
      )}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Soll/Ist-Vergleich</Text>
          <Switch label="Nur Abweichungen und Ungezähltes" checked={nurAbweichungen} onChange={(e) => setNurAbweichungen(e.currentTarget.checked)} />
        </Group>
        <DataTable
          minHeight={anzeigen.length ? undefined : 120}
          noRecordsText="Keine Abweichungen – alles stimmt."
          striped
          verticalSpacing={6}
          records={anzeigen}
          idAccessor="varianteId"
          columns={[
            { accessor: 'artikel', title: 'Artikel', render: (z) => <Text size="sm" fw={600}>{z.artikel}</Text> },
            { accessor: 'variante', title: 'Variante' },
            { accessor: 'soll', title: 'Soll', textAlign: 'right' },
            {
              accessor: 'ist',
              title: 'Ist',
              textAlign: 'right',
              render: (z) => (z.gezaehlt ? z.ist : <Text size="sm" c="orange">nicht gezählt</Text>),
            },
            {
              accessor: 'differenz',
              title: 'Diff.',
              textAlign: 'right',
              render: (z) => (
                <Text size="sm" fw={700} c={z.differenz < 0 ? 'dpsgRot.7' : z.differenz > 0 ? 'ruesthausGruen.8' : undefined}>
                  {z.differenz > 0 ? `+${z.differenz}` : z.differenz}
                </Text>
              ),
            },
            { accessor: 'wert', title: 'Wertdiff.', textAlign: 'right', render: (z) => formatEuro(z.differenz * z.ekPreis), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
          ]}
        />
      </Paper>
      {s.nichtGezaehlt > 0 && (
        <Checkbox
          checked={nullOk}
          onChange={(e) => setNullOk(e.currentTarget.checked)}
          label={`${s.nichtGezaehlt} Position(en) wurden nicht gezählt. Ich bestätige, dass davon nichts mehr da ist (Ist = 0).`}
        />
      )}
      <Group justify="flex-end">
        <Button size="md" disabled={!bereit || sync.ausstehend} loading={laeuft} onClick={bestaetigen}>
          Inventur abschließen und buchen
        </Button>
      </Group>
    </Stack>
  );
}
