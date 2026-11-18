import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Group, Paper, SegmentedControl, Text, TextInput } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useDaten } from '../../data/DataProvider';
import { formatEuro, normalisiereName } from '../../domain/format';
import { KATEGORIE_LABEL } from '../../domain/types';
import { lagerwert } from '../../domain/varianten';
import { ArtikelBild, SeitenKopf } from '../../components/Bausteine';
import { ArtikelFormular } from './ArtikelFormular';

export function ArtikelListe() {
  const { artikel, varianten } = useDaten();
  const navigate = useNavigate();
  const [neu, setNeu] = useState(false);
  const [suche, setSuche] = useState('');
  const [status, setStatus] = useState<'aktiv' | 'alle'>('aktiv');

  const zeilen = useMemo(() => {
    return artikel
      .filter((a) => (status === 'alle' || a.aktiv) && (!suche || normalisiereName(a.name).includes(normalisiereName(suche))))
      .map((a) => {
        const vs = varianten.filter((v) => v.artikelId === a.id);
        return {
          ...a,
          anzahl: vs.filter((v) => v.aktiv).length,
          bestand: vs.reduce((s, v) => s + v.bestand, 0),
          wert: vs.reduce((s, v) => s + lagerwert(v), 0),
        };
      });
  }, [artikel, varianten, suche, status]);

  return (
    <>
      <SeitenKopf
        titel="Artikel & Varianten"
        beschreibung="Stammdaten: Artikel anlegen, Größen und Zustände als Varianten erzeugen, Preise und Bilder pflegen."
        aktionen={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setNeu(true)}>
            Neuer Artikel
          </Button>
        }
      />
      <Paper withBorder p="md">
        <Group mb="md" justify="space-between">
          <TextInput placeholder="Suchen …" leftSection={<IconSearch size={16} />} value={suche} onChange={(e) => setSuche(e.currentTarget.value)} w={260} />
          <SegmentedControl
            size="xs"
            value={status}
            onChange={(v) => setStatus(v as 'aktiv' | 'alle')}
            data={[
              { value: 'aktiv', label: 'Aktive' },
              { value: 'alle', label: 'Alle' },
            ]}
          />
        </Group>
        <DataTable
          minHeight={zeilen.length ? undefined : 160}
          noRecordsText="Noch keine Artikel – lege mit „Neuer Artikel“ den ersten an."
          highlightOnHover
          striped
          verticalSpacing="xs"
          records={zeilen}
          onRowClick={({ record }) => navigate(`/stammdaten/${record.id}`)}
          columns={[
            {
              accessor: 'name',
              title: 'Artikel',
              render: (a) => (
                <Group gap="sm" wrap="nowrap">
                  <ArtikelBild src={a.thumbnail} kategorie={a.kategorie} groesse={36} />
                  <div>
                    <Text size="sm" fw={600}>
                      {a.name}
                    </Text>
                    {!a.aktiv && (
                      <Badge size="xs" color="gray">
                        inaktiv
                      </Badge>
                    )}
                  </div>
                </Group>
              ),
            },
            { accessor: 'kategorie', title: 'Kategorie', render: (a) => KATEGORIE_LABEL[a.kategorie], visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
            { accessor: 'anzahl', title: 'Varianten', textAlign: 'right', visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
            { accessor: 'bestand', title: 'Bestand', textAlign: 'right' },
            { accessor: 'wert', title: 'Lagerwert', textAlign: 'right', render: (a) => formatEuro(a.wert), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
          ]}
        />
      </Paper>
      <ArtikelFormular offen={neu} onClose={() => setNeu(false)} bestehend={null} onGespeichert={(id) => navigate(`/stammdaten/${id}`)} />
    </>
  );
}
