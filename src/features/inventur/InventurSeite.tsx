import { useState } from 'react';
import { Alert, Badge, Button, Group, List, Paper, SegmentedControl, Stack, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import { IconClipboardCheck, IconFileSpreadsheet, IconFileTypePdf, IconPlayerPlay } from '@tabler/icons-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth, useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { col, einstellungenRef, ohneId } from '../../data/refs';
import { dateiDatum } from '../../domain/csv';
import { formatDatum, formatEuro, isoDatum, vonIsoDatum } from '../../domain/format';
import { inventurSummen } from '../../domain/inventur';
import type { Inventur } from '../../domain/types';
import { ladeHerunter, SeitenKopf } from '../../components/Bausteine';
import { Zaehlliste } from './Zaehlliste';
import { InventurAbschluss } from './InventurAbschluss';
import { inventurCsv, inventurPdf } from './bericht';

const dateiname = (inv: Inventur) => `Inventur_${inv.bezeichnung.replace(/[^\wäöüÄÖÜß-]+/g, '_')}_${dateiDatum(inv.stichtag)}`;

export async function exportierePdf(inv: Inventur, stammName: string) {
  try {
    ladeHerunter(await inventurPdf(inv, stammName), `${dateiname(inv)}.pdf`, 'application/pdf');
  } catch (e) {
    notifications.show({ color: 'red', title: 'PDF konnte nicht erstellt werden', message: String(e) });
  }
}

function InventurStarten() {
  const benutzer = useBenutzer();
  const { inventuren, sync } = useDaten();
  const erste = !inventuren.some((i) => i.status === 'abgeschlossen');
  const [bezeichnung, setBezeichnung] = useState(erste ? 'Eröffnungsinventur' : `Inventur ${new Date().getFullYear()}`);
  const [stichtag, setStichtag] = useState(isoDatum(Date.now()));
  const [laeuft, setLaeuft] = useState(false);

  async function starten() {
    setLaeuft(true);
    try {
      const ref = doc(col.inventuren);
      const inv: Inventur = {
        id: ref.id,
        bezeichnung: bezeichnung.trim() || 'Inventur',
        stichtag: vonIsoDatum(stichtag),
        status: 'offen',
        gestartetVon: benutzer.name,
        gestartetAm: Date.now(),
        abgeschlossenVon: null,
        abgeschlossenAm: null,
        ergebnis: null,
      };
      const batch = writeBatch(db);
      batch.set(ref, ohneId(inv));
      batch.update(einstellungenRef, { inventurAktiv: ref.id });
      await batch.commit();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Start fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  const blockiert = !sync.online || sync.ausstehend;
  return (
    <Paper withBorder p="lg">
      <Stack maw={560}>
        <Title order={4}>Neue Inventur starten</Title>
        {erste && (
          <Alert color="dpsgBlau" variant="light" title="Eröffnungsinventur">
            Die erste Inventur erfasst den Startbestand. Tipp: vorher in „Artikel & Varianten“ den geschätzten Ø-EK je Variante eintragen, dann stimmt der Lagerwert.
          </Alert>
        )}
        <TextInput label="Bezeichnung" value={bezeichnung} onChange={(e) => setBezeichnung(e.currentTarget.value)} />
        <TextInput label="Stichtag" type="date" value={stichtag} onChange={(e) => setStichtag(e.currentTarget.value)} w={200} />
        <List size="sm" spacing={4}>
          <List.Item>Ab dem Start sind Verkäufe, Flatrate und Lagerbuchungen gesperrt.</List.Item>
          <List.Item>Vorher sicherstellen, dass alle Handys online waren und synchronisiert haben.</List.Item>
          <List.Item>Alle angemeldeten Personen können parallel zählen.</List.Item>
        </List>
        {blockiert && <Alert color="yellow">Zum Start muss dieses Gerät online und vollständig synchronisiert sein.</Alert>}
        <Group>
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={starten} loading={laeuft} disabled={blockiert}>
            Inventur starten
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function Historie() {
  const { inventuren, einstellungen } = useDaten();
  const fertig = inventuren.filter((i) => i.status === 'abgeschlossen');
  return (
    <Paper withBorder p="md">
      <Title order={5} mb="sm">
        Abgeschlossene Inventuren
      </Title>
      <DataTable
        minHeight={fertig.length ? undefined : 120}
        noRecordsText="Noch keine Inventur abgeschlossen"
        striped
        verticalSpacing={6}
        records={fertig}
        columns={[
          { accessor: 'bezeichnung', title: 'Bezeichnung', render: (i) => <Text size="sm" fw={600}>{i.bezeichnung}</Text> },
          { accessor: 'stichtag', title: 'Stichtag', render: (i) => formatDatum(i.stichtag) },
          { accessor: 'abw', title: 'Abweichungen', textAlign: 'right', render: (i) => inventurSummen(i.ergebnis ?? []).abweichungen, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
          { accessor: 'wert', title: 'Lagerwert', textAlign: 'right', render: (i) => formatEuro(inventurSummen(i.ergebnis ?? []).wertIst), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
          {
            accessor: 'export',
            title: 'Bericht',
            textAlign: 'right',
            render: (i) => (
              <Group gap={4} justify="flex-end" wrap="nowrap">
                <Button size="compact-sm" variant="light" leftSection={<IconFileTypePdf size={14} />} onClick={() => exportierePdf(i, einstellungen.stammName)}>
                  PDF
                </Button>
                <Button size="compact-sm" variant="light" leftSection={<IconFileSpreadsheet size={14} />} onClick={() => ladeHerunter(inventurCsv(i), `${dateiname(i)}.csv`)}>
                  CSV
                </Button>
              </Group>
            ),
          },
        ]}
      />
    </Paper>
  );
}

export function InventurSeite() {
  const { istAdmin } = useAuth();
  const { aktiveInventur, einstellungen } = useDaten();
  const [ansicht, setAnsicht] = useState<'zaehlen' | 'abschluss'>('zaehlen');
  const [gerade, setGerade] = useState<Inventur | null>(null);

  function abbrechen(inv: Inventur) {
    modals.openConfirmModal({
      title: 'Inventur abbrechen?',
      children: <Text size="sm">Die bisherigen Zählungen werden verworfen, der Bestand bleibt unverändert und der Verkauf wird wieder freigegeben.</Text>,
      labels: { confirm: 'Inventur abbrechen', cancel: 'Weiter zählen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const batch = writeBatch(db);
        batch.update(doc(col.inventuren, inv.id), { status: 'abgebrochen' });
        batch.update(einstellungenRef, { inventurAktiv: null });
        await batch.commit();
      },
    });
  }

  return (
    <>
      <SeitenKopf
        titel="Inventur"
        beschreibung={aktiveInventur ? `${aktiveInventur.bezeichnung} · Stichtag ${formatDatum(aktiveInventur.stichtag)}` : 'Jährliche Bestandsaufnahme mit Bericht'}
        aktionen={
          aktiveInventur && istAdmin ? (
            <Button variant="subtle" color="red" onClick={() => abbrechen(aktiveInventur)}>
              Abbrechen
            </Button>
          ) : undefined
        }
      />
      {gerade && (
        <Alert color="ruesthausGruen" icon={<IconClipboardCheck />} title={`${gerade.bezeichnung} abgeschlossen`} mb="md" withCloseButton onClose={() => setGerade(null)}>
          <Group gap="xs" mt={4}>
            <Button size="xs" leftSection={<IconFileTypePdf size={14} />} onClick={() => exportierePdf(gerade, einstellungen.stammName)}>
              Bericht als PDF
            </Button>
            <Button size="xs" variant="light" leftSection={<IconFileSpreadsheet size={14} />} onClick={() => ladeHerunter(inventurCsv(gerade), `${dateiname(gerade)}.csv`)}>
              CSV
            </Button>
          </Group>
        </Alert>
      )}
      {aktiveInventur ? (
        <Stack>
          {istAdmin && (
            <SegmentedControl
              w="fit-content"
              value={ansicht}
              onChange={(v) => setAnsicht(v as 'zaehlen' | 'abschluss')}
              data={[
                { value: 'zaehlen', label: 'Zählliste' },
                { value: 'abschluss', label: 'Prüfen & Abschließen' },
              ]}
            />
          )}
          {ansicht === 'abschluss' && istAdmin ? (
            <InventurAbschluss
              inventur={aktiveInventur}
              onFertig={(inv) => {
                setGerade(inv);
                setAnsicht('zaehlen');
              }}
            />
          ) : (
            <Zaehlliste inventur={aktiveInventur} />
          )}
        </Stack>
      ) : (
        <Stack>
          {istAdmin ? (
            <InventurStarten />
          ) : (
            <Alert color="gray">
              Aktuell läuft keine Inventur. <Badge variant="light">Start durch Admin</Badge>
            </Alert>
          )}
          <Historie />
        </Stack>
      )}
    </>
  );
}
