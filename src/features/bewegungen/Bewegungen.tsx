import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconLock, IconPlus, IconTrash } from '@tabler/icons-react';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { meldeGebucht, neueVorgangsId, speichereBuchung } from '../../data/buchen';
import { formatEuro, isoDatum, runde, vonIsoDatum } from '../../domain/format';
import { GRUND_SONSTIGES, type Variante } from '../../domain/types';
import { BuchungsFehler, bucheAbgang, bucheEinkauf, bucheZugang } from '../../domain/vorgaenge';
import { bezeichnungVon } from '../../domain/varianten';
import { SeitenKopf } from '../../components/Bausteine';
import { VariantenAuswahl } from '../../components/VariantenAuswahl';

type Art = 'einkauf' | 'zugang' | 'abgang';

interface Zeile {
  schluessel: string;
  varianteId: string;
  menge: number;
  ekPreis: number;
}

const BESCHREIBUNG: Record<Art, string> = {
  einkauf: 'Neue Ware vom Lieferanten: erhöht den Bestand und aktualisiert den durchschnittlichen Einkaufspreis.',
  zugang: 'Ware ohne Einkauf, z. B. gespendete Kluften oder Rücknahmen. Wird mit Einkaufswert 0 € eingebucht.',
  abgang: 'Ware, die ohne Verkauf das Lager verlässt: Entsorgung, Schwund, Eigenbedarf des Stammes.',
};

export function Bewegungen() {
  const benutzer = useBenutzer();
  const { variantenById, einstellungen, vorgaenge, aktiveInventur } = useDaten();
  const [art, setArt] = useState<Art>('einkauf');
  const [auswahl, auswahlSteuerung] = useDisclosure();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [lieferant, setLieferant] = useState('');
  const [belegNr, setBelegNr] = useState('');
  const [datum, setDatum] = useState(isoDatum(Date.now()));
  const [grund, setGrund] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const lieferanten = useMemo(() => [...new Set(vorgaenge.map((v) => v.lieferant).filter((l): l is string => Boolean(l)))], [vorgaenge]);
  const gruende = art === 'zugang' ? einstellungen.zugangsGruende : einstellungen.abgangsGruende;
  const summe = runde(zeilen.reduce((s, z) => s + z.menge * z.ekPreis, 0));

  function hinzufuegen(v: Variante) {
    setZeilen((alt) => [...alt, { schluessel: crypto.randomUUID(), varianteId: v.id, menge: 1, ekPreis: v.ekDurchschnitt }]);
  }
  const aendere = (s: string, t: Partial<Zeile>) => setZeilen((alt) => alt.map((z) => (z.schluessel === s ? { ...z, ...t } : z)));

  function zuruecksetzen() {
    setZeilen([]);
    setBelegNr('');
    setKommentar('');
    setGrund(null);
  }

  async function buchen() {
    setLaeuft(true);
    try {
      const heute = isoDatum(Date.now());
      const ctx = { id: neueVorgangsId(), uid: benutzer.uid, benutzerName: benutzer.name, jetzt: Date.now() };
      const z = zeilen.map((x) => ({ variante: variantenById.get(x.varianteId)!, menge: x.menge, ekPreis: x.ekPreis }));
      const b =
        art === 'einkauf'
          ? bucheEinkauf(ctx, {
              lieferant,
              lieferantBelegNr: belegNr,
              belegDatum: datum && datum !== heute ? vonIsoDatum(datum) + 12 * 3600_000 : undefined,
              kommentar,
              zeilen: z,
            })
          : art === 'zugang'
            ? bucheZugang(ctx, { grund: grund ?? '', kommentar, zeilen: z })
            : bucheAbgang(ctx, { grund: grund ?? '', kommentar, zeilen: z });
      meldeGebucht(await speichereBuchung(b), b.vorgang.belegNr);
      zuruecksetzen();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: e instanceof BuchungsFehler ? 'Bitte prüfen' : 'Buchung fehlgeschlagen',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLaeuft(false);
    }
  }

  if (aktiveInventur) {
    return (
      <>
        <SeitenKopf titel="Einkauf & Bewegungen" />
        <Alert color="yellow" icon={<IconLock />} title="Gesperrt">
          Während der Inventur sind keine Lagerbuchungen möglich.
        </Alert>
      </>
    );
  }

  return (
    <>
      <SeitenKopf titel="Einkauf & Bewegungen" beschreibung="Wareneingänge und Lagerabgänge ohne Verkauf erfassen" />
      <Stack>
        <SegmentedControl
          w="fit-content"
          value={art}
          onChange={(v) => {
            setArt(v as Art);
            setGrund(null);
          }}
          data={[
            { value: 'einkauf', label: 'Einkauf' },
            { value: 'zugang', label: 'Zugang (Spende)' },
            { value: 'abgang', label: 'Abgang' },
          ]}
        />
        <Text size="sm" c="dimmed">
          {BESCHREIBUNG[art]}
        </Text>
        <Paper withBorder p="md">
          <Stack>
            {art === 'einkauf' ? (
              <Group grow align="flex-start">
                <Autocomplete label="Lieferant" data={lieferanten} value={lieferant} onChange={setLieferant} withAsterisk placeholder="z. B. Rüsthaus der DPSG" />
                <TextInput label="Belegnummer (Rechnung)" value={belegNr} onChange={(e) => setBelegNr(e.currentTarget.value)} />
                <TextInput label="Belegdatum" type="date" value={datum} onChange={(e) => setDatum(e.currentTarget.value)} />
              </Group>
            ) : (
              <Group grow align="flex-start">
                <Select label="Grund" data={gruende} value={grund} onChange={setGrund} withAsterisk placeholder="Grund wählen" />
                <Textarea
                  label="Kommentar"
                  autosize
                  minRows={1}
                  value={kommentar}
                  onChange={(e) => setKommentar(e.currentTarget.value)}
                  withAsterisk={grund === GRUND_SONSTIGES}
                  placeholder={art === 'zugang' ? 'z. B. Spende von Familie M.' : 'z. B. Mottenschaden'}
                />
              </Group>
            )}

            <Table.ScrollContainer minWidth={560}>
              <Table verticalSpacing={6}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Artikel</Table.Th>
                    <Table.Th>Menge</Table.Th>
                    {art === 'einkauf' && <Table.Th>EK je Stück</Table.Th>}
                    {art === 'einkauf' && <Table.Th className="rh-zahl">Summe</Table.Th>}
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {zeilen.map((z) => {
                    const v = variantenById.get(z.varianteId);
                    if (!v) return null;
                    return (
                      <Table.Tr key={z.schluessel}>
                        <Table.Td>
                          <Text size="sm">{bezeichnungVon(v)}</Text>
                          <Text size="xs" c="dimmed">
                            Bestand {v.bestand} · Ø-EK {formatEuro(v.ekDurchschnitt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput size="xs" w={90} value={z.menge} min={1} allowDecimal={false} onChange={(x) => aendere(z.schluessel, { menge: Math.max(1, Number(x) || 1) })} />
                        </Table.Td>
                        {art === 'einkauf' && (
                          <Table.Td>
                            <NumberInput size="xs" w={110} value={z.ekPreis} min={0} decimalScale={2} fixedDecimalScale suffix=" €" onChange={(x) => aendere(z.schluessel, { ekPreis: Math.max(0, Number(x) || 0) })} />
                          </Table.Td>
                        )}
                        {art === 'einkauf' && <Table.Td className="rh-zahl">{formatEuro(z.menge * z.ekPreis)}</Table.Td>}
                        <Table.Td>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`${bezeichnungVon(v)} aus der Liste entfernen`}
                            onClick={() => setZeilen((alt) => alt.filter((x) => x !== z))}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Group justify="space-between">
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={auswahlSteuerung.open}>
                Position hinzufügen
              </Button>
              {art === 'einkauf' && (
                <Text fw={700}>
                  Einkaufssumme: <span className="rh-zahl">{formatEuro(summe)}</span>
                </Text>
              )}
            </Group>
            <Group justify="flex-end">
              <Button leftSection={<IconCheck size={16} />} disabled={zeilen.length === 0} loading={laeuft} onClick={buchen}>
                {art === 'einkauf' ? 'Einkauf buchen' : art === 'zugang' ? 'Zugang buchen' : 'Abgang buchen'}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
      <VariantenAuswahl offen={auswahl} onClose={auswahlSteuerung.close} onWaehle={hinzufuegen} titel="Position wählen" preisAnzeigen={false} />
    </>
  );
}
