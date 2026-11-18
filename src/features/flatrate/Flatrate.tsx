import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Grid,
  Group,
  List,
  Loader,
  NumberInput,
  Paper,
  Radio,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowsExchange, IconHeartHandshake, IconLock, IconShirt } from '@tabler/icons-react';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { meldeGebucht, neueVorgangsId, speichereBuchung } from '../../data/buchen';
import { formatDatum, formatEuro } from '../../domain/format';
import type { Variante, Vorgang, Zustand } from '../../domain/types';
import {
  BuchungsFehler,
  bucheFlatrate,
  bucheFlatrateTausch,
  bucheSozialkluft,
  rabattFehler,
  type Buchung,
  type BuchungsKontext,
} from '../../domain/vorgaenge';
import { SeitenKopf } from '../../components/Bausteine';
import { AufnaeherCheckliste, KaeuferFeld, RabattGrundFeld } from '../../components/Formularfelder';
import { KluftWahl } from '../../components/KluftWahl';
import { sucheKaeufer } from '../einstellungen/Anonymisieren';

/** Gemeinsame Logik: Kontext bauen, buchen, melden, Formular zurücksetzen. */
function useBuchen(onFertig: () => void) {
  const benutzer = useBenutzer();
  const [laeuft, setLaeuft] = useState(false);
  async function buchen(baue: (ctx: BuchungsKontext) => Buchung, text: string) {
    setLaeuft(true);
    try {
      const b = baue({ id: neueVorgangsId(), uid: benutzer.uid, benutzerName: benutzer.name, jetzt: Date.now() });
      meldeGebucht(await speichereBuchung(b), b.vorgang.belegNr, text);
      onFertig();
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
  return { buchen, laeuft };
}

function useStandardAufnaeher() {
  const { einstellungen, variantenById } = useDaten();
  return einstellungen.standardAufnaeher.filter((id) => variantenById.has(id));
}

function Zusammenfassung({ children, betrag, knopf }: { children?: ReactNode; betrag: number; knopf: ReactNode }) {
  return (
    <Paper withBorder p="md" pos="sticky" top={80}>
      <Stack>
        <Title order={5}>Zusammenfassung</Title>
        {children}
        <Divider />
        <Group justify="space-between">
          <Text fw={700}>Zu zahlen</Text>
          <Text fw={800} fz={26} className="rh-zahl">
            {formatEuro(betrag)}
          </Text>
        </Group>
        {knopf}
      </Stack>
    </Paper>
  );
}

// -------------------------------------------------------------------------------------------
// Ausgabe
// -------------------------------------------------------------------------------------------

function Ausgabe({ onFertig }: { onFertig: () => void }) {
  const { einstellungen, variantenById } = useDaten();
  const standard = useStandardAufnaeher();
  const [kaeufer, setKaeufer] = useState('');
  const [kluft, setKluft] = useState<Variante | null>(null);
  const [aufnaeher, setAufnaeher] = useState<string[]>(standard);
  const [versucht, setVersucht] = useState(false);
  const { buchen, laeuft } = useBuchen(onFertig);

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Paper withBorder p="md">
          <Stack>
            <KaeuferFeld value={kaeufer} onChange={setKaeufer} error={versucht && !kaeufer.trim() ? 'Pflichtfeld' : null} />
            <Divider />
            <KluftWahl label="Kluft aus dem Bestand" zustaende={['unbenaeht', 'benaeht']} onChange={setKluft} />
            <Divider />
            <AufnaeherCheckliste value={aufnaeher} onChange={setAufnaeher} />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Zusammenfassung
          betrag={einstellungen.flatratePreis}
          knopf={
            <Button
              size="md"
              leftSection={<IconShirt size={20} />}
              disabled={!kluft}
              loading={laeuft}
              onClick={() => {
                setVersucht(true);
                buchen(
                  (ctx) =>
                    bucheFlatrate(ctx, {
                      kaeufer,
                      kluft: kluft!,
                      aufnaeher: aufnaeher.map((id) => variantenById.get(id)!),
                      flatratePreis: einstellungen.flatratePreis,
                    }),
                  'Flatrate gebucht',
                );
              }}
            >
              Flatrate buchen
            </Button>
          }
        >
          <List size="sm" spacing={4}>
            <List.Item>1 Kluft {kluft ? `(${kluft.artikelName}, Gr. ${kluft.attribute.groesse ?? '–'})` : ''}</List.Item>
            <List.Item>{aufnaeher.length} Standardaufnäher inklusive</List.Item>
            <List.Item>Umtausch bei Herauswachsen kostenlos, solange die Kluft wiederverwendbar ist</List.Item>
          </List>
        </Zusammenfassung>
      </Grid.Col>
    </Grid>
  );
}

// -------------------------------------------------------------------------------------------
// Tausch
// -------------------------------------------------------------------------------------------

type RueckgabeArt = 'unbenaeht' | 'benaeht' | 'sozial' | 'entsorgen';

/**
 * Prüfhilfe für den Umtausch: sucht frühere Flatrate-Buchungen zum Namen (über alle Jahre).
 * Meldet per onAnspruch, ob der Anspruch belegt oder manuell bestätigt ist.
 */
function Pruefhilfe({
  kaeufer,
  onAnspruch,
  onNameUebernehmen,
}: {
  kaeufer: string;
  onAnspruch: (ok: boolean) => void;
  onNameUebernehmen: (name: string) => void;
}) {
  const [name] = useDebouncedValue(kaeufer.trim(), 400);
  const [treffer, setTreffer] = useState<Vorgang[] | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);

  const flatrate = treffer?.some((v) => v.typ === 'FLATRATE' || v.typ === 'FLATRATE_TAUSCH') ?? false;
  const ok = name.length >= 3 && treffer !== null && (flatrate || bestaetigt);
  useEffect(() => onAnspruch(ok), [ok, onAnspruch]);

  useEffect(() => {
    setBestaetigt(false);
    if (name.length < 3) {
      setTreffer(null);
      return;
    }
    let abbruch = false;
    setLaedt(true);
    sucheKaeufer(name)
      .then((vs) => {
        if (abbruch) return;
        setTreffer(
          vs
            .filter((v) => !v.storniert && ['FLATRATE', 'FLATRATE_TAUSCH', 'SOZIALKLUFT'].includes(v.typ))
            .sort((a, b) => b.datum - a.datum),
        );
      })
      .catch(() => !abbruch && setTreffer([]))
      .finally(() => !abbruch && setLaedt(false));
    return () => {
      abbruch = true;
    };
  }, [name]);

  if (name.length < 3) {
    return (
      <Text size="xs" c="dimmed">
        Ab 3 Zeichen sucht die App frühere Flatrate-Buchungen zu diesem Namen.
      </Text>
    );
  }
  if (laedt || !treffer) return <Loader size="sm" />;

  const nurSozial = !flatrate && treffer.some((v) => v.typ === 'SOZIALKLUFT');
  return (
    <Stack gap="xs">
      {flatrate ? (
        <Alert color="ruesthausGruen" title="Flatrate gefunden">
          Zu diesem Namen gibt es eine Flatrate-Buchung.
        </Alert>
      ) : nurSozial ? (
        <Alert color="red" title="Nur Sozialkluft gefunden">
          Sozialkluften haben kein Umtauschrecht. Neue Kluft bitte als Flatrate oder Sozialkluft ausgeben.
        </Alert>
      ) : (
        <Alert color="yellow" title="Keine Flatrate gefunden">
          Evtl. anders geschrieben oder vor Einführung der App gebucht. Bitte Anspruch selbst prüfen.
        </Alert>
      )}
      {treffer.slice(0, 6).map((v) => (
        <Group key={v.id} gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light" color={v.typ === 'SOZIALKLUFT' ? 'grape' : v.typ === 'FLATRATE' ? 'ruesthausGruen' : 'teal'}>
            {v.typ === 'FLATRATE' ? 'Flatrate' : v.typ === 'SOZIALKLUFT' ? 'Sozialkluft' : 'Tausch'}
          </Badge>
          <Text size="xs" style={{ flex: 1 }}>
            {formatDatum(v.datum)} · {v.kaeufer} · {v.positionen.find((p) => p.rolle === 'ware')?.bezeichnung ?? ''}
          </Text>
          {v.kaeufer && v.kaeufer !== kaeufer.trim() && (
            <Button size="compact-xs" variant="subtle" onClick={() => onNameUebernehmen(v.kaeufer!)}>
              Name übernehmen
            </Button>
          )}
        </Group>
      ))}
      {!flatrate && (
        <Checkbox
          label="Ich habe den Flatrate-Anspruch anders geprüft und bestätige ihn"
          checked={bestaetigt}
          onChange={(e) => setBestaetigt(e.currentTarget.checked)}
        />
      )}
    </Stack>
  );
}

function Tausch({ onFertig }: { onFertig: () => void }) {
  const { einstellungen, variantenById } = useDaten();
  const standard = useStandardAufnaeher();
  const [kaeufer, setKaeufer] = useState('');
  const [art, setArt] = useState<RueckgabeArt>('benaeht');
  const [rueckgabe, setRueckgabe] = useState<Variante | null>(null);
  const [neu, setNeu] = useState<Variante | null>(null);
  const [aufnaeher, setAufnaeher] = useState<string[]>(standard);
  const [anspruchOk, setAnspruchOk] = useState(false);
  const { buchen, laeuft } = useBuchen(onFertig);

  const wiederverwendbar = art === 'unbenaeht' || art === 'benaeht';
  const rueckZustaende: Zustand[] = art === 'sozial' ? ['sozial'] : art === 'entsorgen' ? ['benaeht'] : [art];
  const betrag = wiederverwendbar ? 0 : einstellungen.flatratePreis;

  function absenden() {
    const auf = aufnaeher.map((id) => variantenById.get(id)!);
    if (wiederverwendbar) {
      buchen(
        (ctx) => bucheFlatrateTausch(ctx, { kaeufer, rueckgabe: rueckgabe!, neu: neu!, aufnaeher: auf, flatratePreis: einstellungen.flatratePreis }),
        'Tausch gebucht',
      );
    } else {
      buchen(
        (ctx) =>
          bucheFlatrate(ctx, {
            kaeufer,
            kluft: neu!,
            aufnaeher: auf,
            flatratePreis: einstellungen.flatratePreis,
            defekteRueckgabe: { variante: rueckgabe!, art: art === 'sozial' ? 'sozial' : 'entsorgung' },
          }),
        'Neue Flatrate gebucht',
      );
    }
  }

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Paper withBorder p="md">
          <Stack>
            <KaeuferFeld value={kaeufer} onChange={setKaeufer} />
            <Pruefhilfe kaeufer={kaeufer} onAnspruch={setAnspruchOk} onNameUebernehmen={setKaeufer} />
            <Divider />
            <Radio.Group label="Zustand der zurückgegebenen Kluft" value={art} onChange={(v) => setArt(v as RueckgabeArt)}>
              <Stack gap={6} mt="xs">
                <Radio value="benaeht" label="Wiederverwendbar, benäht → zurück ins Lager" />
                <Radio value="unbenaeht" label="Wiederverwendbar, unbenäht → zurück ins Lager" />
                <Radio value="sozial" label="Beschädigt → als Sozialkluft einbuchen (neue Flatrate fällig)" />
                <Radio value="entsorgen" label="Zu stark beschädigt → entsorgen (neue Flatrate fällig)" />
              </Stack>
            </Radio.Group>
            <KluftWahl key={art} label="Zurückgegebene Kluft (Größe)" zustaende={rueckZustaende} onChange={setRueckgabe} bestandPruefen={false} />
            <Divider />
            <KluftWahl label="Neue Kluft" zustaende={['unbenaeht', 'benaeht']} onChange={setNeu} />
            <Divider />
            <AufnaeherCheckliste value={aufnaeher} onChange={setAufnaeher} />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Zusammenfassung
          betrag={betrag}
          knopf={
            <Button
              size="md"
              leftSection={<IconArrowsExchange size={20} />}
              disabled={!rueckgabe || !neu || !kaeufer.trim() || !anspruchOk}
              loading={laeuft}
              onClick={absenden}
            >
              {wiederverwendbar ? 'Tausch buchen' : 'Neue Flatrate buchen'}
            </Button>
          }
        >
          {wiederverwendbar ? (
            <Text size="sm">Kostenloser Tausch: Die alte Kluft geht zurück ins Lager, die neue wird mit {aufnaeher.length} Aufnäher(n) ausgegeben.</Text>
          ) : (
            <Alert color="orange" p="xs">
              Die alte Kluft ist beschädigt. Laut Flatrate-Regel zahlt die Person erneut den vollen Preis von {formatEuro(einstellungen.flatratePreis)}.
            </Alert>
          )}
          {!anspruchOk && kaeufer.trim().length >= 3 && (
            <Text size="xs" c="dimmed">
              Buchen erst möglich, wenn der Flatrate-Anspruch gefunden oder bestätigt ist.
            </Text>
          )}
        </Zusammenfassung>
      </Grid.Col>
    </Grid>
  );
}

// -------------------------------------------------------------------------------------------
// Sozialkluft
// -------------------------------------------------------------------------------------------

function Sozialkluft({ onFertig }: { onFertig: () => void }) {
  const { einstellungen, variantenById } = useDaten();
  const standard = useStandardAufnaeher();
  const [kaeufer, setKaeufer] = useState('');
  const [kluft, setKluft] = useState<Variante | null>(null);
  const [preis, setPreis] = useState(0);
  const [grund, setGrund] = useState<string | null>(einstellungen.rabattGruende.includes('Sozialfall') ? 'Sozialfall' : null);
  const [text, setText] = useState('');
  const [aufnaeher, setAufnaeher] = useState<string[]>(standard);
  const { buchen, laeuft } = useBuchen(onFertig);
  const rabatt = preis < einstellungen.flatratePreis - 0.005;
  const fehler = rabattFehler({ listenpreis: einstellungen.flatratePreis, preis, rabattGrund: grund, rabattText: text });

  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Paper withBorder p="md">
          <Stack>
            <KaeuferFeld value={kaeufer} onChange={setKaeufer} />
            <Divider />
            <KluftWahl label="Sozialkluft (leicht beschädigt)" zustaende={['sozial']} onChange={setKluft} />
            <NumberInput
              label="Preis"
              description={`0 € bis ${formatEuro(einstellungen.flatratePreis)}`}
              value={preis}
              onChange={(v) => setPreis(Math.min(einstellungen.flatratePreis, Math.max(0, Number(v) || 0)))}
              min={0}
              max={einstellungen.flatratePreis}
              decimalScale={2}
              fixedDecimalScale
              suffix=" €"
              w={180}
            />
            <RabattGrundFeld pflicht={rabatt} grund={grund} text={text} onChange={(g, t) => { setGrund(g); setText(t); }} />
            <Divider />
            <AufnaeherCheckliste value={aufnaeher} onChange={setAufnaeher} />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Zusammenfassung
          betrag={preis}
          knopf={
            <Button
              size="md"
              color="grape"
              leftSection={<IconHeartHandshake size={20} />}
              disabled={!kluft || !kaeufer.trim() || Boolean(fehler)}
              loading={laeuft}
              onClick={() =>
                buchen(
                  (ctx) =>
                    bucheSozialkluft(ctx, {
                      kaeufer,
                      kluft: kluft!,
                      aufnaeher: aufnaeher.map((id) => variantenById.get(id)!),
                      preis,
                      flatratePreis: einstellungen.flatratePreis,
                      rabattGrund: grund,
                      rabattText: text,
                    }),
                  'Sozialkluft ausgegeben',
                )
              }
            >
              Sozialkluft ausgeben
            </Button>
          }
        >
          <Text size="sm">Mit {aufnaeher.length} Standardaufnäher(n).</Text>
          <Alert color="grape" variant="light" p="xs">
            Sozialkluften haben kein Umtauschrecht beim Herauswachsen.
          </Alert>
        </Zusammenfassung>
      </Grid.Col>
    </Grid>
  );
}

export function Flatrate() {
  const { aktiveInventur, einstellungen } = useDaten();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<string | null>(params.get('tab') ?? 'ausgabe');
  useEffect(() => {
    const t = params.get('tab');
    if (t) setTab(t);
  }, [params]);
  const [runde, setRunde] = useState(0);
  const fertig = () => setRunde((r) => r + 1);

  return (
    <>
      <SeitenKopf
        titel="Kluft-Flatrate"
        beschreibung={`Kluft für ${formatEuro(einstellungen.flatratePreis)} inklusive Standardaufnäher, Umtausch beim Herauswachsen`}
      />
      {aktiveInventur ? (
        <Alert color="yellow" icon={<IconLock />} title="Gesperrt">
          Während der Inventur „{aktiveInventur.bezeichnung}“ sind keine Ausgaben möglich.
        </Alert>
      ) : (
        <Tabs value={tab} onChange={setTab} keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="ausgabe" leftSection={<IconShirt size={16} />}>
              Flatrate ausgeben
            </Tabs.Tab>
            <Tabs.Tab value="tausch" leftSection={<IconArrowsExchange size={16} />}>
              Umtausch
            </Tabs.Tab>
            <Tabs.Tab value="sozial" leftSection={<IconHeartHandshake size={16} />}>
              Sozialkluft
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="ausgabe">
            <Ausgabe key={runde} onFertig={fertig} />
          </Tabs.Panel>
          <Tabs.Panel value="tausch">
            <Tausch key={runde} onFertig={fertig} />
          </Tabs.Panel>
          <Tabs.Panel value="sozial">
            <Sozialkluft key={runde} onFertig={fertig} />
          </Tabs.Panel>
        </Tabs>
      )}
    </>
  );
}
