import { useEffect, useMemo, useState } from 'react';
import { Badge, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { useDaten } from '../data/DataProvider';
import { ZUSTAND_LABEL, type Variante, type Zustand } from '../domain/types';

/**
 * Auswahl einer Kluft/Kluftbluse über Artikel → Größe → (Schnitt) → Zustand.
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
  const [schnitt, setSchnitt] = useState<string | null>(null);
  const [zustand, setZustand] = useState<Zustand>(zustaende[0]);

  const art = kluftArtikel.find((a) => a.id === artikelId) ?? null;
  // Bei Rücknahmen auch deaktivierte Varianten zulassen (Kluft kann aus alter Zeit stammen)
  const artVarianten = varianten.filter((v) => v.artikelId === artikelId && (v.aktiv || !bestandPruefen));
  const hatGroesse = art?.achsen.includes('groesse') ?? false;
  const hatSchnitt = art?.achsen.includes('schnitt') ?? false;

  // Schnitte, die es in der gewählten Größe tatsächlich gibt
  const schnittOptionen = useMemo(() => {
    if (!hatSchnitt || !art) return [];
    const vorhanden = new Set(
      artVarianten.filter((v) => !hatGroesse || v.attribute.groesse === groesse).map((v) => v.attribute.schnitt),
    );
    return art.schnitte.filter((s) => vorhanden.has(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art?.id, art?.schnitte, hatSchnitt, hatGroesse, groesse, varianten]);

  useEffect(() => {
    if (!hatSchnitt) setSchnitt(null);
    else if (!schnitt || !schnittOptionen.includes(schnitt)) setSchnitt(schnittOptionen[0] ?? null);
  }, [hatSchnitt, schnittOptionen, schnitt]);

  const variante =
    artVarianten.find(
      (v) =>
        (!hatGroesse || v.attribute.groesse === groesse) &&
        (!hatSchnitt || v.attribute.schnitt === schnitt) &&
        (v.attribute.zustand ?? zustand) === zustand,
    ) ?? null;

  const vollstaendig = Boolean(art) && (!hatGroesse || Boolean(groesse)) && (!hatSchnitt || Boolean(schnitt));

  useEffect(() => {
    onChange(vollstaendig ? variante : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante?.id, vollstaendig]);

  const bestandFuer = (g: string) =>
    artVarianten.filter((v) => v.attribute.groesse === g && v.attribute.zustand === zustand).reduce((s, v) => s + v.bestand, 0);

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
        {hatSchnitt && (
          <Select
            label="Schnitt"
            placeholder={schnittOptionen.length ? 'Schnitt wählen' : 'nicht vorhanden'}
            data={schnittOptionen}
            value={schnitt}
            onChange={setSchnitt}
            allowDeselect={false}
            disabled={schnittOptionen.length === 0}
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
      {variante && vollstaendig && bestandPruefen && (
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
      {art && vollstaendig && !variante && (
        <Text size="xs" c="red">
          Diese Variante gibt es nicht – bitte unter „Artikel & Varianten“ prüfen.
        </Text>
      )}
      {art && hatSchnitt && groesse && schnittOptionen.length === 0 && (
        <Text size="xs" c="red">
          Für diese Größe ist kein Schnitt angelegt.
        </Text>
      )}
    </Stack>
  );
}
