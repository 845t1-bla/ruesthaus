import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconLock, IconPlus, IconShoppingCartCheck, IconTrash } from '@tabler/icons-react';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { meldeGebucht, neueVorgangsId, speichereBuchung } from '../../data/buchen';
import { formatEuro, runde } from '../../domain/format';
import type { Variante } from '../../domain/types';
import { BuchungsFehler, bucheVerkauf, rabattFehler } from '../../domain/vorgaenge';
import { variantenLabel } from '../../domain/varianten';
import { ArtikelBild, SeitenKopf } from '../../components/Bausteine';
import { KaeuferFeld, RabattGrundFeld } from '../../components/Formularfelder';
import { VariantenAuswahl } from '../../components/VariantenAuswahl';

interface Zeile {
  schluessel: string;
  varianteId: string;
  menge: number;
  preis: number;
  rabattGrund: string | null;
  rabattText: string;
}

const kasseFilter = (v: Variante) => v.attribute.zustand !== 'sozial';

export function Kasse() {
  const benutzer = useBenutzer();
  const { variantenById, artikelById, aktiveInventur } = useDaten();
  const [auswahl, auswahlSteuerung] = useDisclosure();
  const [kaeufer, setKaeufer] = useState('');
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [versucht, setVersucht] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  function hinzufuegen(v: Variante) {
    setZeilen((alt) => {
      const vorhanden = alt.find((z) => z.varianteId === v.id && z.preis === v.vkPreis && !z.rabattGrund);
      if (vorhanden) return alt.map((z) => (z === vorhanden ? { ...z, menge: z.menge + 1 } : z));
      return [...alt, { schluessel: crypto.randomUUID(), varianteId: v.id, menge: 1, preis: v.vkPreis, rabattGrund: null, rabattText: '' }];
    });
  }

  const aendere = (s: string, teil: Partial<Zeile>) => setZeilen((alt) => alt.map((z) => (z.schluessel === s ? { ...z, ...teil } : z)));
  const summe = runde(zeilen.reduce((s, z) => s + z.menge * z.preis, 0));
  const listensumme = runde(
    zeilen.reduce((s, z) => s + z.menge * (variantenById.get(z.varianteId)?.vkPreis ?? 0), 0),
  );

  async function buchen() {
    setVersucht(true);
    setLaeuft(true);
    try {
      const b = bucheVerkauf(
        { id: neueVorgangsId(), uid: benutzer.uid, benutzerName: benutzer.name, jetzt: Date.now() },
        {
          kaeufer,
          zeilen: zeilen.map((z) => ({
            variante: variantenById.get(z.varianteId)!,
            menge: z.menge,
            preis: z.preis,
            rabattGrund: z.rabattGrund,
            rabattText: z.rabattText,
          })),
        },
      );
      const ergebnis = await speichereBuchung(b);
      meldeGebucht(ergebnis, b.vorgang.belegNr, `Verkauf ${formatEuro(b.vorgang.summe)}`);
      setZeilen([]);
      setKaeufer('');
      setVersucht(false);
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
        <SeitenKopf titel="Kasse" />
        <Alert color="yellow" icon={<IconLock />} title="Kasse gesperrt">
          Während der Inventur „{aktiveInventur.bezeichnung}“ können keine Verkäufe gebucht werden.
        </Alert>
      </>
    );
  }

  return (
    <>
      <SeitenKopf titel="Kasse" beschreibung="Verkauf von Stammeskleidung, Halstüchern, Aufnähern und Kluften (ohne Flatrate)" />
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="sm">
              <Title order={5}>Warenkorb</Title>
              <Button leftSection={<IconPlus size={16} />} onClick={auswahlSteuerung.open}>
                Artikel hinzufügen
              </Button>
            </Group>
            {zeilen.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl" size="sm">
                Noch leer. Über „Artikel hinzufügen“ Ware auswählen.
              </Text>
            ) : (
              <Stack gap={0}>
                {zeilen.map((z, i) => {
                  const v = variantenById.get(z.varianteId);
                  if (!v) return null;
                  const a = artikelById.get(v.artikelId);
                  const rabatt = z.preis < v.vkPreis - 0.005;
                  const fehler = versucht ? rabattFehler({ listenpreis: v.vkPreis, preis: z.preis, rabattGrund: z.rabattGrund, rabattText: z.rabattText }) : null;
                  const rest = v.bestand - zeilen.filter((x) => x.varianteId === v.id).reduce((s, x) => s + x.menge, 0);
                  return (
                    <Stack key={z.schluessel} gap={6} py="sm">
                      {i > 0 && <Divider mb="xs" />}
                      <Group wrap="nowrap" align="flex-start" gap="sm">
                        <ArtikelBild src={a?.thumbnail} kategorie={v.kategorie} groesse={44} />
                        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                          <Text fw={600} size="sm" truncate>
                            {v.artikelName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {variantenLabel(v.attribute)} · Listenpreis {formatEuro(v.vkPreis)}
                          </Text>
                          {rest < 0 && (
                            <Badge size="xs" color="orange" variant="light" w="fit-content">
                              Bestand reicht nicht ({v.bestand} Stk.) – wird negativ
                            </Badge>
                          )}
                        </Stack>
                        <ActionIcon variant="subtle" color="red" onClick={() => setZeilen((alt) => alt.filter((x) => x !== z))} aria-label="Entfernen">
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                      <Group gap="xs" align="flex-end" wrap="wrap">
                        <NumberInput size="xs" w={90} label="Menge" value={z.menge} min={1} allowDecimal={false} onChange={(x) => aendere(z.schluessel, { menge: Math.max(1, Number(x) || 1) })} />
                        <NumberInput
                          size="xs"
                          w={120}
                          label="Preis je Stück"
                          value={z.preis}
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          suffix=" €"
                          onChange={(x) => aendere(z.schluessel, { preis: Math.max(0, Number(x) || 0) })}
                        />
                        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => aendere(z.schluessel, { preis: 0 })} mb={4}>
                          kostenlos
                        </Button>
                        {rabatt && (
                          <Button size="compact-xs" variant="subtle" onClick={() => aendere(z.schluessel, { preis: v.vkPreis, rabattGrund: null, rabattText: '' })} mb={4}>
                            Listenpreis
                          </Button>
                        )}
                        <Text ml="auto" fw={700} className="rh-zahl">
                          {formatEuro(z.menge * z.preis)}
                        </Text>
                      </Group>
                      <RabattGrundFeld
                        pflicht={rabatt}
                        grund={z.rabattGrund}
                        text={z.rabattText}
                        onChange={(g, t) => aendere(z.schluessel, { rabattGrund: g, rabattText: t })}
                      />
                      {fehler && (
                        <Text size="xs" c="red">
                          {fehler}
                        </Text>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" pos="sticky" top={80}>
            <Stack>
              <Title order={5}>Abschluss</Title>
              <KaeuferFeld value={kaeufer} onChange={setKaeufer} error={versucht && !kaeufer.trim() ? 'Pflichtfeld' : null} />
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Positionen
                </Text>
                <Text size="sm">{zeilen.reduce((s, z) => s + z.menge, 0)} Stk.</Text>
              </Group>
              {listensumme > summe && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Rabatt
                  </Text>
                  <Text size="sm" c="dpsgRot.7">
                    − {formatEuro(listensumme - summe)}
                  </Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text fw={700}>Summe</Text>
                <Text fw={800} fz={26} className="rh-zahl">
                  {formatEuro(summe)}
                </Text>
              </Group>
              <Button size="md" leftSection={<IconShoppingCartCheck size={20} />} disabled={zeilen.length === 0} loading={laeuft} onClick={buchen}>
                Verkauf buchen
              </Button>
              <Text size="xs" c="dimmed">
                Gebucht von {benutzer.name}. Zahlungsart wird nicht erfasst.
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
      <VariantenAuswahl offen={auswahl} onClose={auswahlSteuerung.close} onWaehle={hinzufuegen} filter={kasseFilter} />
    </>
  );
}
