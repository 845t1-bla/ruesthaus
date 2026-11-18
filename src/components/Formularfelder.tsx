import { useMemo } from 'react';
import { Alert, Autocomplete, Badge, Button, Checkbox, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { useDaten } from '../data/DataProvider';
import { GRUND_SONSTIGES } from '../domain/types';
import { bezeichnungVon } from '../domain/varianten';

/** Käufername (Pflicht) mit Vorschlägen aus bisherigen Buchungen – hilft gegen Schreibvarianten. */
export function KaeuferFeld({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  const { vorgaenge } = useDaten();
  const namen = useMemo(() => {
    const gesehen = new Map<string, string>();
    for (const v of vorgaenge) {
      if (v.kaeufer && v.kaeufer !== 'anonymisiert' && !gesehen.has(v.kaeuferKey ?? v.kaeufer)) {
        gesehen.set(v.kaeuferKey ?? v.kaeufer, v.kaeufer);
      }
    }
    return [...gesehen.values()];
  }, [vorgaenge]);
  return (
    <Autocomplete
      label="Käufer/in"
      description="Vor- und Nachname, ggf. Stufe – Pflichtfeld"
      placeholder="z. B. Max Müller (Jupfis)"
      leftSection={<IconUser size={16} />}
      data={namen}
      limit={8}
      value={value}
      onChange={onChange}
      error={error}
      withAsterisk
    />
  );
}

/** Grund für Rabatt/Gratisausgabe: Auswahl + Freitext bei „Sonstiges“. */
export function RabattGrundFeld({
  grund,
  text,
  onChange,
  pflicht,
}: {
  grund: string | null;
  text: string;
  onChange: (grund: string | null, text: string) => void;
  pflicht: boolean;
}) {
  const { einstellungen } = useDaten();
  if (!pflicht) return null;
  return (
    <Group grow align="flex-start" gap="xs">
      <Select
        size="xs"
        label="Grund für Rabatt"
        placeholder="Grund wählen"
        data={einstellungen.rabattGruende}
        value={grund}
        onChange={(g) => onChange(g, text)}
        error={!grund ? 'Pflichtfeld' : null}
        withAsterisk
        comboboxProps={{ withinPortal: true }}
      />
      {grund === GRUND_SONSTIGES && (
        <Textarea
          size="xs"
          label="Beschreibung"
          autosize
          minRows={1}
          value={text}
          onChange={(e) => onChange(grund, e.currentTarget.value)}
          error={!text.trim() ? 'Pflichtfeld' : null}
          withAsterisk
        />
      )}
    </Group>
  );
}

/** Standardaufnäher-Set mit Häkchen: alle vorausgewählt, abwählen was schon aufgenäht ist. */
export function AufnaeherCheckliste({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { einstellungen, variantenById } = useDaten();
  const set = einstellungen.standardAufnaeher.map((id) => variantenById.get(id)).filter((v) => v != null);
  if (set.length === 0) {
    return (
      <Alert color="yellow" title="Kein Standardaufnäher-Set hinterlegt">
        Der Admin kann das Set unter Einstellungen → Standardaufnäher festlegen.
      </Alert>
    );
  }
  const umschalten = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Standardaufnäher ({value.length}/{set.length})
        </Text>
        <Group gap={4}>
          <Button size="compact-xs" variant="subtle" onClick={() => onChange(set.map((v) => v.id))}>
            alle
          </Button>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => onChange([])}>
            keine
          </Button>
        </Group>
      </Group>
      <Text size="xs" c="dimmed">
        Abhaken, was auf der Kluft schon aufgenäht ist – nur die angehakten Aufnäher werden ausgebucht.
      </Text>
      {set.map((v) => (
        <Checkbox
          key={v.id}
          checked={value.includes(v.id)}
          onChange={() => umschalten(v.id)}
          label={
            <Group gap="xs">
              <Text size="sm">{bezeichnungVon(v)}</Text>
              <Badge size="xs" variant="light" color={v.bestand > 0 ? 'gray' : 'red'}>
                Bestand {v.bestand}
              </Badge>
            </Group>
          }
        />
      ))}
    </Stack>
  );
}
