import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Badge, Button, Grid, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconCash,
  IconCoin,
  IconHeartHandshake,
  IconPackages,
  IconReceipt2,
  IconShirt,
  IconShoppingCart,
} from '@tabler/icons-react';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { formatDatumZeit, formatEuro, formatZahl, runde } from '../../domain/format';
import { umsatzVon } from '../../domain/vorgaenge';
import { bezeichnungVon, lagerwert, unterMindestbestand } from '../../domain/varianten';
import { BestandZahl, Kennzahl } from '../../components/Bausteine';
import { TypBadge } from '../vorgaenge/Vorgaenge';

function tagesbeginn() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function Dashboard() {
  const benutzer = useBenutzer();
  const navigate = useNavigate();
  const { varianten, vorgaenge, einstellungen } = useDaten();

  const k = useMemo(() => {
    const heute = tagesbeginn();
    const monat = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const jahr = new Date(new Date().getFullYear(), 0, 1).getTime();
    let umsatzMonat = 0;
    let umsatzJahr = 0;
    let verkaeufeHeute = 0;
    let flatratesJahr = 0;
    let sozialJahr = 0;
    for (const v of vorgaenge) {
      const u = umsatzVon(v);
      if (v.datum >= monat) umsatzMonat += u;
      if (v.datum >= jahr) umsatzJahr += u;
      if (v.storniert) continue;
      if (v.datum >= heute && ['VERKAUF', 'FLATRATE', 'FLATRATE_TAUSCH', 'SOZIALKLUFT'].includes(v.typ)) verkaeufeHeute++;
      if (v.datum >= jahr && v.typ === 'FLATRATE') flatratesJahr++;
      if (v.datum >= jahr && v.typ === 'SOZIALKLUFT') sozialJahr++;
    }
    const aktiv = varianten.filter((v) => v.aktiv || v.bestand !== 0);
    return {
      umsatzMonat: runde(umsatzMonat),
      umsatzJahr: runde(umsatzJahr),
      verkaeufeHeute,
      flatratesJahr,
      sozialJahr,
      lagerwert: aktiv.reduce((s, v) => s + lagerwert(v), 0),
      stueck: aktiv.reduce((s, v) => s + Math.max(v.bestand, 0), 0),
      nachbestellen: aktiv.filter((v) => unterMindestbestand(v) && v.bestand >= 0),
      negativ: aktiv.filter((v) => v.bestand < 0),
    };
  }, [varianten, vorgaenge]);

  const monatName = new Date().toLocaleDateString('de-DE', { month: 'long' });

  return (
    <>
      <Group justify="space-between" align="flex-end" mb="lg">
        <div>
          <Title order={2} fw={650}>
            Hallo {benutzer.name.split(' ')[0]}
          </Title>
          <Text c="dimmed" size="sm">
            Rüsthaus {einstellungen.stammName}
          </Text>
        </div>
        <Group gap="xs">
          <Button leftSection={<IconShoppingCart size={16} />} onClick={() => navigate('/kasse')}>
            Verkauf
          </Button>
          <Button variant="light" color="ruesthausGruen" leftSection={<IconShirt size={16} />} onClick={() => navigate('/flatrate')}>
            Flatrate
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
        <Kennzahl label={`Umsatz ${monatName}`} wert={formatEuro(k.umsatzMonat)} zusatz={`Jahr: ${formatEuro(k.umsatzJahr)}`} icon={IconCash} farbe="ruesthausGruen" onClick={() => navigate('/vorgaenge')} />
        <Kennzahl label="Verkäufe heute" wert={k.verkaeufeHeute} icon={IconReceipt2} onClick={() => navigate('/vorgaenge')} />
        <Kennzahl label="Flatrates im Jahr" wert={k.flatratesJahr} zusatz={`${k.sozialJahr} Sozialkluft(en)`} icon={IconShirt} farbe="dpsgRot" />
        <Kennzahl label="Lagerwert" wert={formatEuro(k.lagerwert)} zusatz={`${formatZahl(k.stueck)} Teile`} icon={IconCoin} farbe="beige" onClick={() => navigate('/bestand')} />
      </SimpleGrid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder p="md" h="100%">
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
                <Title order={5}>Nachbestellen</Title>
                <Badge color="orange" variant="light">
                  {k.nachbestellen.length}
                </Badge>
              </Group>
              <Anchor size="sm" onClick={() => navigate('/bestand')}>
                Bestand
              </Anchor>
            </Group>
            {k.negativ.length > 0 && (
              <Text size="sm" c="red" mb="xs">
                {k.negativ.length} Variante(n) mit negativem Bestand – bitte prüfen.
              </Text>
            )}
            {k.nachbestellen.length === 0 ? (
              <Text size="sm" c="dimmed">
                Alles über Mindestbestand. Mindestbestände pflegst du je Variante unter „Artikel & Varianten“.
              </Text>
            ) : (
              <Stack gap={6}>
                {[...k.negativ, ...k.nachbestellen].slice(0, 8).map((v) => (
                  <Group key={v.id} justify="space-between" wrap="nowrap">
                    <Text size="sm" truncate>
                      {bezeichnungVon(v)}
                    </Text>
                    <Group gap={6} wrap="nowrap">
                      <BestandZahl bestand={v.bestand} mindestbestand={v.mindestbestand} />
                      <Text size="xs" c="dimmed">
                        / {v.mindestbestand ?? 0}
                      </Text>
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder p="md" h="100%">
            <Group justify="space-between" mb="sm">
              <Title order={5}>Letzte Vorgänge</Title>
              <Anchor size="sm" onClick={() => navigate('/vorgaenge')}>
                Alle
              </Anchor>
            </Group>
            {vorgaenge.length === 0 ? (
              <Text size="sm" c="dimmed">
                Noch keine Buchungen.
              </Text>
            ) : (
              <Stack gap={8}>
                {vorgaenge.slice(0, 7).map((v) => (
                  <Group key={v.id} justify="space-between" wrap="nowrap" style={{ opacity: v.storniert ? 0.5 : 1 }}>
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <TypBadge typ={v.typ} />
                      <Stack gap={0} style={{ minWidth: 0 }}>
                        <Text size="sm" truncate>
                          {v.kaeufer ?? v.lieferant ?? v.grund ?? v.belegNr}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDatumZeit(v.datum)} · {v.benutzerName}
                        </Text>
                      </Stack>
                    </Group>
                    <Text size="sm" fw={600} className="rh-zahl">
                      {v.summe ? formatEuro(v.summe) : ''}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mt="lg">
        {[
          { label: 'Kasse', icon: IconShoppingCart, to: '/kasse' },
          { label: 'Umtausch', icon: IconArrowsExchange, to: '/flatrate?tab=tausch' },
          { label: 'Sozialkluft', icon: IconHeartHandshake, to: '/flatrate?tab=sozial' },
          { label: 'Bestand', icon: IconPackages, to: '/bestand' },
        ].map((s) => (
          <Button key={s.label} variant="default" h={56} leftSection={<s.icon size={20} />} onClick={() => navigate(s.to)}>
            {s.label}
          </Button>
        ))}
      </SimpleGrid>
    </>
  );
}
