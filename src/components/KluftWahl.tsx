import { useEffect, useMemo, useState } from 'react';
import { Badge, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { useDaten } from '../data/DataProvider';
import { ZUSTAND_LABEL, type Variante, type Zustand } from '../domain/types';

/**
 * Auswahl einer Kluft/Kluftbluse über Artikel → Größe → Zustand.
 * Liefert die passende Variante (oder null) per onChange.
 */
export function KluftWahl({
  label,
  zustaende,
  onChange,
  bestandPruefen = true,
}: {
  label: string;
  zustaende: Zustand[];
  onChange: (v: Variante | null) => void;
  /** Bei Rücknahmen ist der Bestand egal. */
  bestandPruefen?: boolean;
}) {
  const { artikel, varianten } = useDaten();
  const kluftArtikel = useMemo(
    () => artikel.filter((a) => a.aktiv && (a.kategorie === 'kluft' || a.kategorie === 'kluftbluse')),
    [artikel],
  );
  const [artikelId, setArtikelId] = useState<string | null>(kluftArtikel[0]?.id ?? null);
  const [groesse, setGroesse] = useState<string | null>(null);
  const [zustand, setZustand] = useState<Zustand>(zustaende[0]);

  const art = kluftArtikel.find((a) => a.id === artikelId) ?? null;
  const artVarianten = varianten.filter((v) => v.artikelId === artikelId && v.aktiv);
  const hatGroesse = art?.achsen.includes('groesse') ?? false;

  const variante =
    artVarianten.find(
      (v) => (!hatGroesse || v.attribute.groesse === groesse) && (v.attribute.zustand ?? zustand) === zustand,
    ) ?? null;

  useEffect(() => {
    onChange(art && (!hatGroesse || groesse) ? variante : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante?.id, art?.id, groesse, zustand]);

  const bestandFuer = (g: string) =>
    artVarianten.find((v) => v.attribute.groesse === g && v.attribute.zustand === zustand)?.bestand ?? 0;

  if (kluftArtikel.length === 0) {
    return (
      <Text size="sm" c="red">
        Es sind noch keine Artikel der Kategorie Kluft/Kluftbluse angelegt.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {label}
      </Text>
      <Group grow align="flex-start" gap="xs">
        <Select
          label="Artikel"
          data={kluftArtikel.map((a) => ({ value: a.id, label: a.name }))}
          value={artikelId}
          onChange={(v) => {
            setArtikelId(v);
            setGroesse(null);
          }}
          allowDeselect={false}
        />
        {hatGroesse && (
          <Select
            label="Größe"
            placeholder="Größe wählen"
            data={(art?.groessen ?? []).map((g) => ({
              value: g,
              label: bestandPruefen ? `${g}  (${bestandFuer(g)} Stk.)` : g,
            }))}
            value={groesse}
            onChange={setGroesse}
            searchable
          />
        )}
      </Group>
      {zustaende.length > 1 && (
        <SegmentedControl
          value={zustand}
          onChange={(z) => setZustand(z as Zustand)}
          data={zustaende.map((z) => ({ value: z, label: ZUSTAND_LABEL[z] }))}
        />
      )}
      {variante && bestandPruefen && (
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Bestand dieser Variante:
          </Text>
          <Badge size="sm" color={variante.bestand > 0 ? 'ruesthausGruen' : 'red'} variant="light">
            {variante.bestand} Stk.
          </Badge>
          {variante.bestand <= 0 && (
            <Text size="xs" c="red">
              Buchung möglich, Bestand wird negativ.
            </Text>
          )}
        </Group>
      )}
      {art && (!hatGroesse || groesse) && !variante && (
        <Text size="xs" c="red">
          Diese Variante existiert noch nicht – bitte unter „Artikel & Varianten“ generieren.
        </Text>
      )}
    </Stack>
  );
}
