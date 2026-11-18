import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Chip,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconSearch } from '@tabler/icons-react';
import { useDaten } from '../data/DataProvider';
import { formatEuro, normalisiereName } from '../domain/format';
import { KATEGORIE_LABEL, type Artikel, type Kategorie, type Variante } from '../domain/types';
import { variantenLabel } from '../domain/varianten';
import { ArtikelBild } from './Bausteine';

/**
 * Artikel-/Variantenpicker als Modal: erst Artikel suchen, dann Größe/Zustand wählen.
 * Artikel mit nur einer passenden Variante werden direkt übernommen.
 */
export function VariantenAuswahl({
  offen,
  onClose,
  onWaehle,
  filter = () => true,
  titel = 'Artikel hinzufügen',
  preisAnzeigen = true,
}: {
  offen: boolean;
  onClose: () => void;
  onWaehle: (v: Variante) => void;
  filter?: (v: Variante) => boolean;
  titel?: string;
  preisAnzeigen?: boolean;
}) {
  const { artikel, varianten } = useDaten();
  const mobil = useMediaQuery('(max-width: 48em)');
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState<Kategorie | 'alle'>('alle');
  const [gewaehlt, setGewaehlt] = useState<Artikel | null>(null);

  const passend = useMemo(() => varianten.filter((v) => v.aktiv && filter(v)), [varianten, filter]);
  const proArtikel = useMemo(() => {
    const m = new Map<string, Variante[]>();
    for (const v of passend) m.set(v.artikelId, [...(m.get(v.artikelId) ?? []), v]);
    return m;
  }, [passend]);

  const kategorien = useMemo(
    () => [...new Set(artikel.filter((a) => proArtikel.has(a.id)).map((a) => a.kategorie))],
    [artikel, proArtikel],
  );

  const liste = artikel.filter((a) => {
    if (!a.aktiv || !proArtikel.has(a.id)) return false;
    if (kategorie !== 'alle' && a.kategorie !== kategorie) return false;
    return !suche || normalisiereName(a.name).includes(normalisiereName(suche));
  });

  function schliessen() {
    setGewaehlt(null);
    setSuche('');
    onClose();
  }

  function waehleArtikel(a: Artikel) {
    const vs = proArtikel.get(a.id) ?? [];
    if (vs.length === 1) {
      onWaehle(vs[0]);
      schliessen();
    } else setGewaehlt(a);
  }

  return (
    <Modal opened={offen} onClose={schliessen} title={gewaehlt ? gewaehlt.name : titel} size="lg" fullScreen={mobil}>
      {!gewaehlt ? (
        <Stack>
          <TextInput
            placeholder="Artikel suchen …"
            leftSection={<IconSearch size={16} />}
            value={suche}
            onChange={(e) => setSuche(e.currentTarget.value)}
            data-autofocus
          />
          {kategorien.length > 1 && (
            <Chip.Group value={kategorie} onChange={(v) => setKategorie(v as Kategorie | 'alle')}>
              <Group gap={6}>
                <Chip value="alle" size="xs">
                  Alle
                </Chip>
                {kategorien.map((k) => (
                  <Chip key={k} value={k} size="xs">
                    {KATEGORIE_LABEL[k]}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          )}
          <ScrollArea.Autosize mah={mobil ? undefined : 420}>
            <Stack gap={6}>
              {liste.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" py="lg">
                  Keine passenden Artikel.
                </Text>
              )}
              {liste.map((a) => {
                const vs = proArtikel.get(a.id) ?? [];
                const summe = vs.reduce((s, v) => s + v.bestand, 0);
                return (
                  <UnstyledButton
                    key={a.id}
                    onClick={() => waehleArtikel(a)}
                    p="xs"
                    style={{ border: '1px solid var(--rh-border)', borderRadius: 8 }}
                  >
                    <Group wrap="nowrap">
                      <ArtikelBild src={a.thumbnail} kategorie={a.kategorie} groesse={44} />
                      <Stack gap={0} style={{ flex: 1 }}>
                        <Text fw={600} size="sm">
                          {a.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {KATEGORIE_LABEL[a.kategorie]} · {vs.length} {vs.length === 1 ? 'Variante' : 'Varianten'}
                        </Text>
                      </Stack>
                      <Badge variant="light" color={summe > 0 ? 'dpsgBlau' : 'gray'}>
                        {summe} Stk.
                      </Badge>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      ) : (
        <Stack>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => setGewaehlt(null)} w="fit-content" px={4}>
            Anderer Artikel
          </Button>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {(proArtikel.get(gewaehlt.id) ?? []).map((v) => (
              <UnstyledButton
                key={v.id}
                onClick={() => {
                  onWaehle(v);
                  schliessen();
                }}
                p="sm"
                style={{ border: '1px solid var(--rh-border)', borderRadius: 8 }}
              >
                <Stack gap={4}>
                  <Text size="sm" fw={600} lh={1.2}>
                    {variantenLabel(v.attribute)}
                  </Text>
                  <Group gap={6}>
                    <Badge size="sm" variant="light" color={v.bestand > 0 ? 'dpsgBlau' : v.bestand < 0 ? 'red' : 'gray'}>
                      {v.bestand} Stk.
                    </Badge>
                    {preisAnzeigen && (
                      <Text size="xs" c="dimmed">
                        {formatEuro(v.vkPreis)}
                      </Text>
                    )}
                  </Group>
                </Stack>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Modal>
  );
}
