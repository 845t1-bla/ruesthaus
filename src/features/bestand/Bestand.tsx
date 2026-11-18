import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { IconAlertTriangle, IconCoin, IconFileSpreadsheet, IconPackages, IconSearch } from '@tabler/icons-react';
import { useDaten } from '../../data/DataProvider';
import { csvZahl, dateiDatum, toCsv } from '../../domain/csv';
import { formatEuro, formatZahl, normalisiereName } from '../../domain/format';
import {
  KATEGORIE_LABEL,
  KOLLEKTION_LABEL,
  SCHNITT_LABEL,
  ZUSTAND_LABEL,
  type Kategorie,
  type Variante,
  type Zustand,
} from '../../domain/types';
import { lagerwert, unterMindestbestand, variantenLabel } from '../../domain/varianten';
import { ArtikelBild, BestandZahl, Kennzahl, ladeHerunter, SeitenKopf } from '../../components/Bausteine';

export function bestandCsv(varianten: Variante[]): string {
  return toCsv<Variante>(
    [
      { titel: 'Kategorie', wert: (v) => KATEGORIE_LABEL[v.kategorie] },
      { titel: 'Artikel', wert: (v) => v.artikelName },
      { titel: 'Variante', wert: (v) => variantenLabel(v.attribute) },
      { titel: 'Größe', wert: (v) => v.attribute.groesse ?? '' },
      { titel: 'Zustand', wert: (v) => (v.attribute.zustand ? ZUSTAND_LABEL[v.attribute.zustand] : '') },
      { titel: 'Kollektion', wert: (v) => (v.attribute.kollektion ? KOLLEKTION_LABEL[v.attribute.kollektion] : '') },
      { titel: 'Schnitt', wert: (v) => (v.attribute.schnitt ? SCHNITT_LABEL[v.attribute.schnitt] : '') },
      { titel: 'Bestand', wert: (v) => v.bestand },
      { titel: 'Mindestbestand', wert: (v) => v.mindestbestand ?? '' },
      { titel: 'VK-Preis (EUR)', wert: (v) => csvZahl(v.vkPreis, 2) },
      { titel: 'Ø-EK (EUR)', wert: (v) => csvZahl(v.ekDurchschnitt, 2) },
      { titel: 'Lagerwert (EUR)', wert: (v) => csvZahl(lagerwert(v), 2) },
      { titel: 'Aktiv', wert: (v) => (v.aktiv ? 'ja' : 'nein') },
    ],
    varianten,
  );
}

const ZUSTAENDE: Zustand[] = ['unbenaeht', 'benaeht', 'sozial'];

function KluftMatrix() {
  const { artikel, varianten } = useDaten();
  const kluften = artikel.filter((a) => a.aktiv && (a.kategorie === 'kluft' || a.kategorie === 'kluftbluse'));
  if (kluften.length === 0) return <Text c="dimmed">Keine Kluft-Artikel angelegt.</Text>;
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      {kluften.map((a) => {
        const vs = varianten.filter((v) => v.artikelId === a.id);
        const zelle = (g: string, z: Zustand) => vs.find((v) => v.attribute.groesse === g && v.attribute.zustand === z);
        return (
          <Paper withBorder p="md" key={a.id}>
            <Group mb="sm" gap="sm">
              <ArtikelBild src={a.thumbnail} kategorie={a.kategorie} groesse={32} />
              <Title order={5}>{a.name}</Title>
            </Group>
            <Table.ScrollContainer minWidth={380}>
            <Table withColumnBorders verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Größe</Table.Th>
                  {ZUSTAENDE.map((z) => (
                    <Table.Th key={z} className="rh-zahl">
                      {ZUSTAND_LABEL[z]}
                    </Table.Th>
                  ))}
                  <Table.Th className="rh-zahl">Summe</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {a.groessen.map((g) => (
                  <Table.Tr key={g}>
                    <Table.Td fw={600}>{g}</Table.Td>
                    {ZUSTAENDE.map((z) => {
                      const v = zelle(g, z);
                      return (
                        <Table.Td key={z} className="rh-zahl">
                          {v ? <BestandZahl bestand={v.bestand} mindestbestand={v.mindestbestand} /> : '–'}
                        </Table.Td>
                      );
                    })}
                    <Table.Td className="rh-zahl" fw={600}>
                      {ZUSTAENDE.reduce((s, z) => s + (zelle(g, z)?.bestand ?? 0), 0)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            </Table.ScrollContainer>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

export function Bestand() {
  const { varianten, artikelById } = useDaten();
  const [ansicht, setAnsicht] = useState<'liste' | 'kluft'>('liste');
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [nurBedarf, setNurBedarf] = useState(false);
  const [nurBestand, setNurBestand] = useState(false);
  const [sort, setSort] = useState<DataTableSortStatus<Variante>>({ columnAccessor: 'artikelName', direction: 'asc' });

  const relevant = useMemo(() => varianten.filter((v) => v.aktiv || v.bestand !== 0), [varianten]);
  const summe = useMemo(
    () => ({
      stueck: relevant.reduce((s, v) => s + Math.max(v.bestand, 0), 0),
      wert: relevant.reduce((s, v) => s + lagerwert(v), 0),
      bedarf: relevant.filter((v) => unterMindestbestand(v) || v.bestand < 0).length,
    }),
    [relevant],
  );

  const zeilen = useMemo(() => {
    const s = normalisiereName(suche);
    const gefiltert = relevant.filter((v) => {
      if (kategorie && v.kategorie !== kategorie) return false;
      if (nurBedarf && !(unterMindestbestand(v) || v.bestand < 0)) return false;
      if (nurBestand && v.bestand === 0) return false;
      if (s && !normalisiereName(`${v.artikelName} ${variantenLabel(v.attribute)}`).includes(s)) return false;
      return true;
    });
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...gefiltert].sort((a, b) => {
      switch (sort.columnAccessor) {
        case 'bestand':
          return dir * (a.bestand - b.bestand);
        case 'wert':
          return dir * (lagerwert(a) - lagerwert(b));
        default:
          return dir * (a.artikelName.localeCompare(b.artikelName, 'de') || a.sortierung - b.sortierung);
      }
    });
  }, [relevant, suche, kategorie, nurBedarf, nurBestand, sort]);

  return (
    <>
      <SeitenKopf
        titel="Bestand"
        beschreibung="Aktueller Lagerbestand aller Varianten"
        aktionen={
          <Button
            variant="light"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={() => ladeHerunter(bestandCsv(relevant), `Lagerbestand_${dateiDatum()}.csv`)}
          >
            CSV exportieren
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, xs: 3 }} mb="lg">
        <Kennzahl label="Teile im Lager" wert={formatZahl(summe.stueck)} icon={IconPackages} />
        <Kennzahl label="Lagerwert (Ø-EK)" wert={formatEuro(summe.wert)} icon={IconCoin} farbe="ruesthausGruen" />
        <Kennzahl
          label="Handlungsbedarf"
          wert={summe.bedarf}
          zusatz="unter Mindestbestand oder negativ"
          icon={IconAlertTriangle}
          farbe={summe.bedarf ? 'orange' : 'gray'}
          onClick={() => {
            setAnsicht('liste');
            setNurBedarf(true);
          }}
        />
      </SimpleGrid>
      <Stack>
        <SegmentedControl
          w="fit-content"
          value={ansicht}
          onChange={(v) => setAnsicht(v as 'liste' | 'kluft')}
          data={[
            { value: 'liste', label: 'Liste' },
            { value: 'kluft', label: 'Kluft-Matrix' },
          ]}
        />
        {ansicht === 'kluft' ? (
          <KluftMatrix />
        ) : (
          <Paper withBorder p="md">
            <Group mb="md" gap="sm">
              <TextInput placeholder="Suchen …" leftSection={<IconSearch size={16} />} value={suche} onChange={(e) => setSuche(e.currentTarget.value)} w={{ base: '100%', xs: 240 }} />
              <Select
                placeholder="Alle Kategorien"
                data={Object.entries(KATEGORIE_LABEL).map(([value, label]) => ({ value, label }))}
                value={kategorie}
                onChange={setKategorie}
                clearable
                w={{ base: '100%', xs: 200 }}
              />
              <Switch label="Nur Handlungsbedarf" checked={nurBedarf} onChange={(e) => setNurBedarf(e.currentTarget.checked)} />
              <Switch label="Nur mit Bestand" checked={nurBestand} onChange={(e) => setNurBestand(e.currentTarget.checked)} />
            </Group>
            <ScrollArea>
              <DataTable
                minHeight={zeilen.length ? undefined : 160}
                noRecordsText="Keine Varianten gefunden"
                striped
                highlightOnHover
                verticalSpacing={6}
                records={zeilen}
                sortStatus={sort}
                onSortStatusChange={setSort}
                columns={[
                  {
                    accessor: 'artikelName',
                    title: 'Artikel',
                    sortable: true,
                    render: (v) => {
                      const a = artikelById.get(v.artikelId);
                      return (
                        <Group gap="sm" wrap="nowrap">
                          <ArtikelBild src={a?.thumbnail} kategorie={v.kategorie as Kategorie} groesse={32} />
                          <div>
                            <Text size="sm" fw={600}>
                              {v.artikelName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {variantenLabel(v.attribute)}
                            </Text>
                          </div>
                          {!v.aktiv && (
                            <Badge size="xs" color="gray">
                              inaktiv
                            </Badge>
                          )}
                        </Group>
                      );
                    },
                  },
                  { accessor: 'kategorie', title: 'Kategorie', render: (v) => KATEGORIE_LABEL[v.kategorie], visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
                  { accessor: 'bestand', title: 'Bestand', sortable: true, textAlign: 'right', render: (v) => <BestandZahl bestand={v.bestand} mindestbestand={v.mindestbestand} /> },
                  { accessor: 'mindestbestand', title: 'Min.', textAlign: 'right', render: (v) => v.mindestbestand ?? '–', visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
                  { accessor: 'vkPreis', title: 'VK', textAlign: 'right', render: (v) => formatEuro(v.vkPreis), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
                  { accessor: 'ekDurchschnitt', title: 'Ø-EK', textAlign: 'right', render: (v) => formatEuro(v.ekDurchschnitt), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
                  { accessor: 'wert', title: 'Lagerwert', sortable: true, textAlign: 'right', render: (v) => formatEuro(lagerwert(v)), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
                ]}
              />
            </ScrollArea>
          </Paper>
        )}
      </Stack>
    </>
  );
}
