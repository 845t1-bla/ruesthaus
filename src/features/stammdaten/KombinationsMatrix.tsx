import { Button, Checkbox, Group, Stack, Table, Text } from '@mantine/core';
import { hatMatrix, matrixSpalten, matrixZelle } from '../../domain/varianten';
import type { ArtikelDaten } from './artikelSpeichern';

/**
 * Größe × (Kollektion/Schnitt): Häkchen = diese Kombination gibt es.
 * So lässt sich z. B. der schlanke Schnitt nur für einzelne Größen anlegen.
 */
export function KombinationsMatrix({ d, onChange }: { d: ArtikelDaten; onChange: (ausgeschlossen: string[]) => void }) {
  if (!hatMatrix(d)) return null;
  const spalten = matrixSpalten(d);
  const aus = new Set(d.ausgeschlossen);

  const zelle = (g: string, s: (typeof spalten)[number]) => matrixZelle(d, g, { kollektion: s.kollektion, schnitt: s.schnitt });
  const aktiv = (schluessel: string[]) => schluessel.some((k) => !aus.has(k));
  const setze = (schluessel: string[], an: boolean) => {
    const neu = new Set(aus);
    for (const k of schluessel) (an ? neu.delete(k) : neu.add(k));
    onChange([...neu]);
  };
  const alleSchluessel = d.groessen.flatMap((g) => spalten.flatMap((s) => zelle(g, s).schluessel));

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="sm" fw={500}>
            Welche Kombinationen gibt es?
          </Text>
          <Text size="xs" c="dimmed">
            Häkchen entfernen, wo es die Kombination nicht gibt (z. B. schlanker Schnitt nicht in jeder Größe).
            {d.achsen.includes('zustand') && ' Jede Kombination umfasst alle drei Zustände.'}
          </Text>
        </div>
        <Group gap={4}>
          <Button size="compact-xs" variant="subtle" onClick={() => setze(alleSchluessel, true)}>
            alle
          </Button>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setze(alleSchluessel, false)}>
            keine
          </Button>
        </Group>
      </Group>
      <Table.ScrollContainer minWidth={Math.max(240, 90 + spalten.length * 110)}>
        <Table withTableBorder withColumnBorders verticalSpacing={4} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Größe</Table.Th>
              {spalten.map((s) => {
                const spaltenSchluessel = d.groessen.flatMap((g) => zelle(g, s).schluessel);
                return (
                  <Table.Th key={s.label} ta="center">
                    <Checkbox
                      size="xs"
                      label={s.label}
                      checked={spaltenSchluessel.every((k) => !aus.has(k))}
                      indeterminate={aktiv(spaltenSchluessel) && spaltenSchluessel.some((k) => aus.has(k))}
                      onChange={(e) => setze(spaltenSchluessel, e.currentTarget.checked)}
                      styles={{ body: { justifyContent: 'center' } }}
                    />
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {d.groessen.map((g) => (
              <Table.Tr key={g}>
                <Table.Td fw={600}>{g}</Table.Td>
                {spalten.map((s) => {
                  const z = zelle(g, s);
                  return (
                    <Table.Td key={s.label} ta="center">
                      <Checkbox
                        aria-label={`Größe ${g} ${s.label}`}
                        checked={aktiv(z.schluessel)}
                        onChange={(e) => setze(z.schluessel, e.currentTarget.checked)}
                        styles={{ body: { justifyContent: 'center' } }}
                      />
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
