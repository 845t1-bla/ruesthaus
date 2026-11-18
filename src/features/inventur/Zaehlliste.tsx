import { useEffect, useMemo, useState } from 'react';
import { Badge, Group, NumberInput, Paper, Progress, Select, Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useBenutzer } from '../../data/AuthProvider';
import { useDaten } from '../../data/DataProvider';
import { sende } from '../../data/buchen';
import { zaehlungenCol } from '../../data/refs';
import { normalisiereName } from '../../domain/format';
import { zaehlVarianten } from '../../domain/inventur';
import { KATEGORIE_LABEL, type Inventur, type Variante, type Zaehlung } from '../../domain/types';
import { variantenLabel } from '../../domain/varianten';
import { ArtikelBild } from '../../components/Bausteine';

export function useZaehlungen(inventurId: string | null) {
  const [z, setZ] = useState<Map<string, Zaehlung>>(new Map());
  useEffect(() => {
    if (!inventurId) return;
    return onSnapshot(zaehlungenCol(inventurId), (s) => setZ(new Map(s.docs.map((d) => [d.id, d.data() as Zaehlung]))));
  }, [inventurId]);
  return z;
}

function ZaehlFeld({ v, zaehlung, inventurId }: { v: Variante; zaehlung: Zaehlung | undefined; inventurId: string }) {
  const benutzer = useBenutzer();
  const [wert, setWert] = useState<number | string>(zaehlung?.ist ?? '');
  useEffect(() => setWert(zaehlung?.ist ?? ''), [zaehlung?.ist]);

  function speichern() {
    if (wert === '' || Number(wert) === zaehlung?.ist) return;
    const ist = Math.max(0, Math.round(Number(wert)));
    const batch = writeBatch(db);
    batch.set(doc(zaehlungenCol(inventurId), v.id), { varianteId: v.id, ist, gezaehltVon: benutzer.name, zeit: Date.now() } satisfies Zaehlung);
    void sende(batch);
  }

  return (
    <Group justify="space-between" wrap="nowrap" py={6} style={{ borderBottom: '1px solid var(--rh-border)' }}>
      <Text size="sm">{variantenLabel(v.attribute)}</Text>
      <Group gap="xs" wrap="nowrap">
        {zaehlung ? (
          <Tooltip label={`gezählt von ${zaehlung.gezaehltVon}`}>
            <ThemeIcon variant="light" color="ruesthausGruen" size="sm" radius="xl">
              <IconCircleCheck size={14} />
            </ThemeIcon>
          </Tooltip>
        ) : (
          <Badge size="xs" color="gray" variant="outline">
            offen
          </Badge>
        )}
        <NumberInput
          w={110}
          size="sm"
          min={0}
          allowDecimal={false}
          placeholder="Ist"
          value={wert}
          onChange={setWert}
          onBlur={speichern}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          inputMode="numeric"
          aria-label={`Ist-Menge ${v.artikelName} ${variantenLabel(v.attribute)}`}
        />
      </Group>
    </Group>
  );
}

/** Blindzählung: Soll-Mengen werden nicht angezeigt. Mehrere Geräte können parallel zählen. */
export function Zaehlliste({ inventur }: { inventur: Inventur }) {
  const { varianten, artikelById } = useDaten();
  const zaehlungen = useZaehlungen(inventur.id);
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [nurOffen, setNurOffen] = useState(false);

  const liste = useMemo(() => zaehlVarianten(varianten), [varianten]);
  const gezaehlt = liste.filter((v) => zaehlungen.has(v.id)).length;

  const gruppen = useMemo(() => {
    const s = normalisiereName(suche);
    const m = new Map<string, Variante[]>();
    for (const v of liste) {
      if (kategorie && v.kategorie !== kategorie) continue;
      if (nurOffen && zaehlungen.has(v.id)) continue;
      if (s && !normalisiereName(`${v.artikelName} ${variantenLabel(v.attribute)}`).includes(s)) continue;
      m.set(v.artikelId, [...(m.get(v.artikelId) ?? []), v]);
    }
    return [...m.entries()];
  }, [liste, suche, kategorie, nurOffen, zaehlungen]);

  return (
    <Stack>
      <Paper withBorder p="md">
        <Group justify="space-between" mb={6}>
          <Text fw={600}>Fortschritt</Text>
          <Text size="sm">
            {gezaehlt} von {liste.length} Positionen gezählt
          </Text>
        </Group>
        <Progress value={liste.length ? (gezaehlt / liste.length) * 100 : 0} color="ruesthausGruen" size="lg" radius="xl" />
        <Group mt="md" gap="sm">
          <TextInput placeholder="Suchen …" leftSection={<IconSearch size={16} />} value={suche} onChange={(e) => setSuche(e.currentTarget.value)} w={{ base: '100%', xs: 220 }} />
          <Select
            placeholder="Alle Kategorien"
            data={Object.entries(KATEGORIE_LABEL).map(([value, label]) => ({ value, label }))}
            value={kategorie}
            onChange={setKategorie}
            clearable
            w={{ base: '100%', xs: 200 }}
          />
          <Switch label="Nur ungezählte" checked={nurOffen} onChange={(e) => setNurOffen(e.currentTarget.checked)} />
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          Blindzählung: Die Soll-Menge wird bewusst nicht angezeigt. Wert eintippen und Feld verlassen – wird sofort gespeichert, auch offline.
        </Text>
      </Paper>
      {gruppen.map(([artikelId, vs]) => {
        const a = artikelById.get(artikelId);
        return (
          <Paper withBorder p="md" key={artikelId}>
            <Group gap="sm" mb="xs">
              <ArtikelBild src={a?.thumbnail} kategorie={vs[0].kategorie} groesse={34} />
              <div>
                <Title order={5}>{vs[0].artikelName}</Title>
                <Text size="xs" c="dimmed">
                  {KATEGORIE_LABEL[vs[0].kategorie]}
                </Text>
              </div>
            </Group>
            {vs.map((v) => (
              <ZaehlFeld key={v.id} v={v} zaehlung={zaehlungen.get(v.id)} inventurId={inventur.id} />
            ))}
          </Paper>
        );
      })}
      {gruppen.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          Keine Positionen für diesen Filter.
        </Text>
      )}
    </Stack>
  );
}
