import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconEdit, IconInfoCircle, IconTrash } from '@tabler/icons-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { col } from '../../data/refs';
import { sende } from '../../data/buchen';
import { useDaten } from '../../data/DataProvider';
import { formatEuro } from '../../domain/format';
import { KATEGORIE_LABEL, ZUSTAND_LABEL, type Variante, type Zustand } from '../../domain/types';
import { lagerwert, variantenKombinationen, variantenLabel } from '../../domain/varianten';
import { ArtikelBild, BestandZahl, SeitenKopf } from '../../components/Bausteine';
import { ArtikelFormular } from './ArtikelFormular';
import { BildVerwaltung } from './BildVerwaltung';
import { SORTIERUNG_AUSSERHALB } from './artikelSpeichern';
import { loescheArtikel, loescheVariante } from './loeschen';

type Aenderung = Partial<Pick<Variante, 'vkPreis' | 'ekDurchschnitt' | 'mindestbestand' | 'aktiv'>>;

export function ArtikelDetail() {
  const { artikelId } = useParams();
  const navigate = useNavigate();
  const { artikelById, varianten, aktiveInventur } = useDaten();
  const artikel = artikelById.get(artikelId ?? '');
  const vs = useMemo(() => varianten.filter((v) => v.artikelId === artikelId), [varianten, artikelId]);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [aend, setAend] = useState<Record<string, Aenderung>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [massZustand, setMassZustand] = useState<string>('alle');
  const [massPreis, setMassPreis] = useState<number | string>('');

  if (!artikel) {
    return (
      <Alert color="red" title="Artikel nicht gefunden">
        <Button variant="subtle" onClick={() => navigate('/stammdaten')}>
          Zur Artikelliste
        </Button>
      </Alert>
    );
  }

  const wert = <K extends keyof Aenderung>(v: Variante, k: K): Variante[K] => (aend[v.id]?.[k] ?? v[k]) as Variante[K];
  const setze = (id: string, a: Aenderung) => setAend((alt) => ({ ...alt, [id]: { ...alt[id], ...a } }));
  const anzahlAend = Object.keys(aend).length;
  const fehlend = variantenKombinationen(artikel).length - vs.filter((v) => v.sortierung !== SORTIERUNG_AUSSERHALB).length;
  const art = artikel;

  function varianteLoeschen(v: Variante) {
    modals.openConfirmModal({
      title: 'Variante löschen?',
      children: (
        <Text size="sm">
          „{variantenLabel(v.attribute)}“ wird gelöscht und auch beim erneuten Speichern des Artikels nicht wieder angelegt. Das geht nur, wenn die Variante nie gebucht wurde.
        </Text>
      ),
      labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const r = await loescheVariante(art, v);
          if (r.ok) notifications.show({ color: 'ruesthausGruen', title: 'Variante gelöscht', message: variantenLabel(v.attribute) });
          else notifications.show({ color: 'orange', title: 'Löschen nicht möglich', message: r.grund, autoClose: 8000 });
        } catch (e) {
          notifications.show({ color: 'red', title: 'Löschen fehlgeschlagen', message: e instanceof Error ? e.message : String(e) });
        }
      },
    });
  }

  function artikelLoeschen() {
    modals.openConfirmModal({
      title: `„${art.name}“ löschen?`,
      children: (
        <Text size="sm">
          Der Artikel wird mit allen {vs.length} Varianten und Bildern endgültig gelöscht. Das geht nur, wenn nie etwas davon gebucht wurde und kein Bestand vorhanden ist. Sonst bitte stattdessen deaktivieren.
        </Text>
      ),
      labels: { confirm: 'Endgültig löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const r = await loescheArtikel(art, vs);
          if (r.ok) {
            notifications.show({ color: 'ruesthausGruen', title: 'Artikel gelöscht', message: art.name });
            navigate('/stammdaten');
          } else notifications.show({ color: 'orange', title: 'Löschen nicht möglich', message: r.grund, autoClose: 8000 });
        } catch (e) {
          notifications.show({ color: 'red', title: 'Löschen fehlgeschlagen', message: e instanceof Error ? e.message : String(e) });
        }
      },
    });
  }

  function massenpreis() {
    const p = Number(massPreis);
    if (massPreis === '' || Number.isNaN(p)) return;
    for (const v of vs) {
      if (massZustand === 'alle' || v.attribute.zustand === massZustand) setze(v.id, { vkPreis: p });
    }
  }

  async function speichern() {
    setLaeuft(true);
    try {
      const batch = writeBatch(db);
      for (const [id, a] of Object.entries(aend)) batch.update(doc(col.varianten, id), a);
      await sende(batch);
      setAend({});
      notifications.show({ color: 'ruesthausGruen', title: 'Varianten gespeichert', message: `${anzahlAend} Variante(n) aktualisiert.` });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Speichern fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <>
      <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/stammdaten')} mb="xs" px={4}>
        Alle Artikel
      </Button>
      <SeitenKopf
        titel={artikel.name}
        beschreibung={
          <Group gap="xs" component="span">
            <Badge variant="light">{KATEGORIE_LABEL[artikel.kategorie]}</Badge>
            {!artikel.aktiv && <Badge color="gray">inaktiv</Badge>}
            <span>
              {vs.length} Varianten · Lagerwert {formatEuro(vs.reduce((s, v) => s + lagerwert(v), 0))}
            </span>
          </Group>
        }
        aktionen={
          <>
            <Tooltip label={aktiveInventur ? 'Während der Inventur nicht möglich' : 'Nur möglich, wenn nie gebucht wurde'}>
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={artikelLoeschen} disabled={Boolean(aktiveInventur)}>
                Löschen
              </Button>
            </Tooltip>
            <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setBearbeiten(true)}>
              Bearbeiten
            </Button>
          </>
        }
      />
      <Stack>
        {artikel.beschreibung && (
          <Text size="sm" c="dimmed">
            {artikel.beschreibung}
          </Text>
        )}
        {fehlend > 0 && (
          <Alert color="yellow" icon={<IconInfoCircle />}>
            Laut Merkmalen fehlen {fehlend} Variante(n). Über „Bearbeiten → Speichern“ werden sie ergänzt.
          </Alert>
        )}
        <BildVerwaltung artikel={artikel} />

        <Paper withBorder p="md">
          <Group justify="space-between" mb="sm" align="flex-end">
            <div>
              <Text fw={600}>Varianten</Text>
              <Text size="xs" c="dimmed">
                Bestand ändert sich nur über Buchungen. Ø-EK nur für Schätzwerte (z. B. Eröffnungsinventur) direkt ändern.
              </Text>
            </div>
            <Group gap="xs" align="flex-end">
              {artikel.achsen.includes('zustand') && (
                <Select
                  size="xs"
                  w={140}
                  label="VK für"
                  data={[{ value: 'alle', label: 'alle Varianten' }, ...(['unbenaeht', 'benaeht'] as Zustand[]).map((z) => ({ value: z, label: ZUSTAND_LABEL[z] }))]}
                  value={massZustand}
                  onChange={(v) => setMassZustand(v ?? 'alle')}
                  allowDeselect={false}
                />
              )}
              <NumberInput size="xs" w={110} label={artikel.achsen.includes('zustand') ? 'Preis' : 'VK für alle'} value={massPreis} onChange={setMassPreis} min={0} decimalScale={2} suffix=" €" />
              <Button size="xs" variant="light" onClick={massenpreis}>
                setzen
              </Button>
            </Group>
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover miw={760} verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Variante</Table.Th>
                  <Table.Th className="rh-zahl">Bestand</Table.Th>
                  <Table.Th>VK-Preis</Table.Th>
                  <Table.Th>Ø-EK</Table.Th>
                  <Table.Th>Mindestbestand</Table.Th>
                  <Table.Th>Aktiv</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vs.map((v) => (
                  <Table.Tr key={v.id} style={aend[v.id] ? { background: 'var(--mantine-color-yellow-light)' } : undefined}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <ArtikelBild src={artikel.thumbnail} kategorie={artikel.kategorie} groesse={26} />
                        <Text size="sm">{variantenLabel(v.attribute)}</Text>
                        {v.sortierung === SORTIERUNG_AUSSERHALB && (
                          <Badge size="xs" color="gray">
                            nicht mehr in Merkmalen
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td className="rh-zahl">
                      <BestandZahl bestand={v.bestand} mindestbestand={v.mindestbestand} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" w={100} value={wert(v, 'vkPreis')} onChange={(x) => setze(v.id, { vkPreis: Number(x) || 0 })} min={0} decimalScale={2} fixedDecimalScale suffix=" €" hideControls />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" w={100} value={wert(v, 'ekDurchschnitt')} onChange={(x) => setze(v.id, { ekDurchschnitt: Number(x) || 0 })} min={0} decimalScale={2} fixedDecimalScale suffix=" €" hideControls />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        w={90}
                        placeholder="–"
                        value={wert(v, 'mindestbestand') ?? ''}
                        onChange={(x) => setze(v.id, { mindestbestand: x === '' ? null : Math.max(0, Math.round(Number(x))) })}
                        min={0}
                        allowDecimal={false}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Switch size="sm" checked={wert(v, 'aktiv')} onChange={(e) => setze(v.id, { aktiv: e.currentTarget.checked })} />
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={
                          aktiveInventur
                            ? 'Während der Inventur nicht möglich'
                            : v.bestand !== 0
                              ? 'Nur Varianten ohne Bestand können gelöscht werden'
                              : 'Variante löschen (nur wenn nie gebucht)'
                        }
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Variante ${variantenLabel(v.attribute)} löschen`}
                          disabled={v.bestand !== 0 || Boolean(aktiveInventur)}
                          onClick={() => varianteLoeschen(v)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Group justify="flex-end" mt="md">
            {anzahlAend > 0 && (
              <Button variant="default" onClick={() => setAend({})}>
                Verwerfen
              </Button>
            )}
            <Button leftSection={<IconDeviceFloppy size={16} />} disabled={anzahlAend === 0} loading={laeuft} onClick={speichern}>
              {anzahlAend ? `${anzahlAend} Änderung(en) speichern` : 'Keine Änderungen'}
            </Button>
          </Group>
        </Paper>
      </Stack>
      <ArtikelFormular offen={bearbeiten} onClose={() => setBearbeiten(false)} bestehend={{ artikel, varianten: vs }} />
    </>
  );
}
