import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import { IconArrowBackUp, IconCash, IconDiscount2, IconFileSpreadsheet, IconReceipt2, IconSearch } from '@tabler/icons-react';
import { doc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useAuth, useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { meldeGebucht, neueVorgangsId, speichereBuchung } from '../../data/buchen';
import { alsVorgang, col } from '../../data/refs';
import { csvZahl, dateiDatum, toCsv } from '../../domain/csv';
import { formatDatumZeit, formatEuro, isoDatum, normalisiereName, runde, vonIsoDatum } from '../../domain/format';
import { TYP_LABEL, VERKAUFS_TYPEN, type Position, type Vorgang, type VorgangTyp } from '../../domain/types';
import { bucheStorno, istRabattiert, rabattWert, stornierbar, umsatzVon } from '../../domain/vorgaenge';
import { Kennzahl, ladeHerunter, SeitenKopf } from '../../components/Bausteine';

export const TYP_FARBE: Record<VorgangTyp, string> = {
  VERKAUF: 'dpsgBlau',
  FLATRATE: 'ruesthausGruen',
  FLATRATE_TAUSCH: 'teal',
  SOZIALKLUFT: 'grape',
  EINKAUF: 'indigo',
  ZUGANG: 'cyan',
  ABGANG: 'orange',
  INVENTURKORREKTUR: 'yellow',
  STORNO: 'red',
};

export function TypBadge({ typ }: { typ: VorgangTyp }) {
  return (
    <Badge color={TYP_FARBE[typ]} variant="light" size="sm">
      {TYP_LABEL[typ]}
    </Badge>
  );
}

const ROLLE_TEXT: Record<Position['rolle'], string> = {
  ware: '',
  aufnaeher: 'Aufnäher',
  rueckgabe: 'Rückgabe',
  entsorgung: 'entsorgt',
  korrektur: 'Korrektur',
};

function partner(v: Vorgang): string {
  return v.kaeufer ?? v.lieferant ?? v.grund ?? '–';
}

function Positionen({ v }: { v: Vorgang }) {
  return (
    <Box p="sm" style={{ background: 'var(--rh-gruppe)' }}>
      <Table verticalSpacing={4} fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Position</Table.Th>
            <Table.Th className="rh-zahl">Menge</Table.Th>
            <Table.Th className="rh-zahl">Listenpreis</Table.Th>
            <Table.Th className="rh-zahl">{v.typ === 'EINKAUF' ? 'EK-Preis' : 'Preis'}</Table.Th>
            <Table.Th>Grund</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {v.positionen.map((p, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                {p.bezeichnung}{' '}
                {ROLLE_TEXT[p.rolle] && (
                  <Badge size="xs" variant="outline" color="gray">
                    {ROLLE_TEXT[p.rolle]}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td className="rh-zahl">{p.menge > 0 ? `+${p.menge}` : p.menge}</Table.Td>
              <Table.Td className="rh-zahl">{formatEuro(p.listenpreis)}</Table.Td>
              <Table.Td className="rh-zahl">{formatEuro(p.preis)}</Table.Td>
              <Table.Td>{[p.rabattGrund, p.rabattText].filter(Boolean).join(': ')}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {v.kommentar && (
        <Text size="xs" c="dimmed" mt="xs">
          Kommentar: {v.kommentar}
        </Text>
      )}
      {v.lieferantBelegNr && (
        <Text size="xs" c="dimmed">
          Lieferanten-Beleg: {v.lieferantBelegNr}
        </Text>
      )}
    </Box>
  );
}

export function vorgaengeCsv(liste: Vorgang[]): string {
  const zeilen = liste.flatMap((v) => v.positionen.map((p) => ({ v, p })));
  return toCsv<{ v: Vorgang; p: Position }>(
    [
      { titel: 'Datum', wert: ({ v }) => formatDatumZeit(v.datum) },
      { titel: 'Beleg', wert: ({ v }) => v.belegNr },
      { titel: 'Art', wert: ({ v }) => TYP_LABEL[v.typ] },
      { titel: 'Käufer', wert: ({ v }) => v.kaeufer ?? '' },
      { titel: 'Lieferant', wert: ({ v }) => v.lieferant ?? '' },
      { titel: 'Gebucht von', wert: ({ v }) => v.benutzerName },
      { titel: 'Position', wert: ({ p }) => p.bezeichnung },
      { titel: 'Rolle', wert: ({ p }) => ROLLE_TEXT[p.rolle] },
      { titel: 'Menge (Lager)', wert: ({ p }) => p.menge },
      { titel: 'Listenpreis (EUR)', wert: ({ p }) => csvZahl(p.listenpreis, 2) },
      { titel: 'Preis (EUR)', wert: ({ p }) => csvZahl(p.preis, 2) },
      { titel: 'Betrag (EUR)', wert: ({ v, p }) => csvZahl(v.typ === 'EINKAUF' ? p.menge * p.preis : -p.menge * p.preis, 2) },
      { titel: 'Rabatt (EUR)', wert: ({ p }) => csvZahl(istRabattiert(p) ? rabattWert(p) : 0, 2) },
      { titel: 'Grund', wert: ({ v, p }) => [p.rabattGrund, p.rabattText].filter(Boolean).join(': ') || v.grund || '' },
      { titel: 'Storniert', wert: ({ v }) => (v.storniert ? 'ja' : '') },
    ],
    zeilen,
  );
}

export function Vorgaenge() {
  const benutzer = useBenutzer();
  const { istAdmin } = useAuth();
  const { vorgaenge, vorgaengeAb, benutzerListe, aktiveInventur } = useDaten();
  const jahresbeginn = new Date(new Date().getFullYear(), 0, 1).getTime();
  const [von, setVon] = useState(isoDatum(jahresbeginn));
  const [bis, setBis] = useState(isoDatum(Date.now()));
  const [ansicht, setAnsicht] = useState<'verkauf' | 'alle'>('verkauf');
  const [typen, setTypen] = useState<string[]>([]);
  const [verkaeufer, setVerkaeufer] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [nurRabatt, setNurRabatt] = useState(false);
  const [ohneStorno, setOhneStorno] = useState(false);
  const [aelter, setAelter] = useState<Vorgang[] | null>(null);

  const vonMs = von ? vonIsoDatum(von) : jahresbeginn;
  const bisMs = bis ? vonIsoDatum(bis, true) : Date.now();

  // Zeiträume vor dem live geladenen Fenster werden einmalig nachgeladen.
  useEffect(() => {
    if (vonMs >= vorgaengeAb) {
      setAelter(null);
      return;
    }
    let abbruch = false;
    getDocs(query(col.vorgaenge, where('datum', '>=', vonMs), where('datum', '<', vorgaengeAb), orderBy('datum', 'desc')))
      .then((s) => !abbruch && setAelter(s.docs.map(alsVorgang)))
      .catch((e) => notifications.show({ color: 'red', title: 'Ältere Vorgänge nicht ladbar', message: String(e) }));
    return () => {
      abbruch = true;
    };
  }, [vonMs, vorgaengeAb]);

  const liste = useMemo(() => {
    const s = normalisiereName(suche);
    return [...vorgaenge, ...(aelter ?? [])].filter((v) => {
      if (v.datum < vonMs || v.datum > bisMs) return false;
      if (ansicht === 'verkauf' && !VERKAUFS_TYPEN.includes(v.typ) && !(v.typ === 'STORNO')) return false;
      if (typen.length && !typen.includes(v.typ)) return false;
      if (verkaeufer && v.benutzerUid !== verkaeufer) return false;
      if (ohneStorno && (v.storniert || v.typ === 'STORNO')) return false;
      if (nurRabatt && !v.positionen.some((p) => p.rolle === 'ware' && istRabattiert(p))) return false;
      if (s && !normalisiereName(`${v.kaeufer ?? ''} ${v.lieferant ?? ''} ${v.belegNr} ${v.grund ?? ''}`).includes(s)) return false;
      return true;
    });
  }, [vorgaenge, aelter, vonMs, bisMs, ansicht, typen, verkaeufer, suche, nurRabatt, ohneStorno]);

  const kennzahlen = useMemo(() => {
    let umsatz = 0;
    let rabatte = 0;
    let anzahl = 0;
    for (const v of liste) {
      umsatz += umsatzVon(v);
      if (!v.storniert && VERKAUFS_TYPEN.includes(v.typ)) {
        anzahl++;
        rabatte += v.positionen.filter((p) => p.rolle === 'ware' && istRabattiert(p)).reduce((s, p) => s + rabattWert(p), 0);
      }
    }
    return { umsatz: runde(umsatz), rabatte: runde(rabatte), anzahl };
  }, [liste]);

  function stornieren(v: Vorgang) {
    modals.openConfirmModal({
      title: `Beleg ${v.belegNr} stornieren?`,
      children: (
        <Text size="sm">
          Es wird eine Gegenbuchung angelegt; der Bestand wird zurückgebucht. Der ursprüngliche Beleg bleibt als „storniert“ sichtbar.
        </Text>
      ),
      labels: { confirm: 'Stornieren', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const id = neueVorgangsId();
          const b = bucheStorno({ id, uid: benutzer.uid, benutzerName: benutzer.name, jetzt: Date.now() }, v);
          const ergebnis = await speichereBuchung(b, (batch) =>
            batch.update(doc(col.vorgaenge, v.id), { storniert: true, stornoDurchId: id }),
          );
          meldeGebucht(ergebnis, b.vorgang.belegNr, 'Storniert');
        } catch (e) {
          notifications.show({ color: 'red', title: 'Storno fehlgeschlagen', message: e instanceof Error ? e.message : String(e) });
        }
      },
    });
  }

  const darfStornieren = (v: Vorgang) => !aktiveInventur && stornierbar(v) && (istAdmin || v.benutzerUid === benutzer.uid);

  return (
    <>
      <SeitenKopf
        titel="Vorgänge & Verkäufe"
        beschreibung="Alle Buchungen mit Verkäufer, Käufer und Rabattgründen"
        aktionen={
          <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} onClick={() => ladeHerunter(vorgaengeCsv(liste), `Vorgaenge_${von}_bis_${bis}.csv`)}>
            CSV exportieren
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, xs: 3 }} mb="lg">
        <Kennzahl label="Umsatz im Zeitraum" wert={formatEuro(kennzahlen.umsatz)} icon={IconCash} farbe="ruesthausGruen" />
        <Kennzahl label="Verkaufsvorgänge" wert={kennzahlen.anzahl} icon={IconReceipt2} />
        <Kennzahl label="Rabatte & Gratisausgaben" wert={formatEuro(kennzahlen.rabatte)} zusatz="ohne inklusive Flatrate-Aufnäher" icon={IconDiscount2} farbe="dpsgRot" />
      </SimpleGrid>
      <Paper withBorder p="md">
        <Stack gap="sm" mb="md">
          <Group gap="sm" align="flex-end">
            <SegmentedControl
              value={ansicht}
              onChange={(v) => setAnsicht(v as 'verkauf' | 'alle')}
              data={[
                { value: 'verkauf', label: 'Verkäufe' },
                { value: 'alle', label: 'Alle Vorgänge' },
              ]}
            />
            <TextInput type="date" label="Von" value={von} onChange={(e) => setVon(e.currentTarget.value)} w={150} />
            <TextInput type="date" label="Bis" value={bis} onChange={(e) => setBis(e.currentTarget.value)} w={150} />
            <TextInput label="Suche" placeholder="Käufer, Beleg, Lieferant" leftSection={<IconSearch size={16} />} value={suche} onChange={(e) => setSuche(e.currentTarget.value)} w={{ base: '100%', xs: 220 }} />
          </Group>
          <Group gap="sm" align="flex-end">
            <MultiSelect
              label="Art"
              placeholder="alle"
              data={Object.entries(TYP_LABEL).map(([value, label]) => ({ value, label }))}
              value={typen}
              onChange={setTypen}
              clearable
              w={{ base: '100%', xs: 280 }}
            />
            <Select label="Gebucht von" placeholder="alle" data={benutzerListe.map((b) => ({ value: b.uid, label: b.name }))} value={verkaeufer} onChange={setVerkaeufer} clearable w={{ base: '100%', xs: 180 }} />
            <Switch label="Nur mit Rabatt" checked={nurRabatt} onChange={(e) => setNurRabatt(e.currentTarget.checked)} mb={8} />
            <Switch label="Stornos ausblenden" checked={ohneStorno} onChange={(e) => setOhneStorno(e.currentTarget.checked)} mb={8} />
          </Group>
        </Stack>
        <DataTable
          minHeight={liste.length ? undefined : 160}
          noRecordsText="Keine Vorgänge im gewählten Zeitraum"
          striped
          highlightOnHover
          verticalSpacing={6}
          records={liste}
          idAccessor="id"
          rowExpansion={{
            allowMultiple: true,
            content: ({ record }) => <Positionen v={record} />,
          }}
          rowStyle={(v) => (v.storniert ? { opacity: 0.55, textDecoration: 'line-through' } : undefined)}
          columns={[
            { accessor: 'datum', title: 'Datum', render: (v) => formatDatumZeit(v.datum), noWrap: true },
            {
              accessor: 'belegNr',
              title: 'Beleg',
              render: (v) => (
                <Stack gap={2}>
                  <Text size="xs" ff="monospace" style={{ whiteSpace: 'nowrap' }}>
                    {v.belegNr}
                  </Text>
                  <TypBadge typ={v.typ} />
                </Stack>
              ),
            },
            { accessor: 'partner', title: 'Käufer / Lieferant / Grund', render: (v) => partner(v) },
            { accessor: 'benutzerName', title: 'Gebucht von', visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
            {
              accessor: 'positionen',
              title: 'Pos.',
              textAlign: 'right',
              render: (v) => v.positionen.length,
              visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`,
            },
            { accessor: 'summe', title: 'Betrag', textAlign: 'right', render: (v) => (v.summe ? formatEuro(v.summe) : '–') },
            {
              accessor: 'aktion',
              title: '',
              textAlign: 'right',
              render: (v) =>
                v.storniert ? (
                  <Text size="xs" c="red" fw={600} style={{ whiteSpace: 'nowrap', display: 'inline-block', textDecoration: 'none' }}>
                    storniert
                  </Text>
                ) : darfStornieren(v) ? (
                  <Tooltip label="Stornieren">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Beleg ${v.belegNr} stornieren`}
                      onClick={(e) => {
                        e.stopPropagation();
                        stornieren(v);
                      }}
                    >
                      <IconArrowBackUp size={18} />
                    </ActionIcon>
                  </Tooltip>
                ) : null,
            },
          ]}
        />
        <Text size="xs" c="dimmed" mt="sm">
          Zeile antippen für Positionen und Rabattgründe. Export: {dateiDatum()}.
        </Text>
      </Paper>
    </>
  );
}
