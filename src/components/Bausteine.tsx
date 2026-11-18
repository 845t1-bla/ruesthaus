import type { ReactNode } from 'react';
import { Badge, Box, Group, Paper, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import {
  IconBadge,
  IconBox,
  IconHanger,
  IconShirt,
  IconShirtSport,
  IconTriangleInverted,
  type Icon,
} from '@tabler/icons-react';
import type { Kategorie } from '../domain/types';
import { formatZahl } from '../domain/format';

export function SeitenKopf({ titel, beschreibung, aktionen }: { titel: string; beschreibung?: ReactNode; aktionen?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" gap="sm">
      <Box>
        <Title order={2} fw={650}>
          {titel}
        </Title>
        {beschreibung && (
          <Text c="dimmed" size="sm" mt={2}>
            {beschreibung}
          </Text>
        )}
      </Box>
      {aktionen && <Group gap="xs">{aktionen}</Group>}
    </Group>
  );
}

export const KATEGORIE_ICON: Record<Kategorie, Icon> = {
  kluft: IconShirt,
  kluftbluse: IconHanger,
  stammeskleidung: IconShirtSport,
  halstuch: IconTriangleInverted,
  aufnaeher: IconBadge,
  sonstiges: IconBox,
};

export function ArtikelBild({ src, kategorie, groesse = 40 }: { src: string | null | undefined; kategorie: Kategorie; groesse?: number }) {
  if (src) return <img src={src} alt="" className="rh-thumb" style={{ width: groesse, height: groesse }} />;
  const I = KATEGORIE_ICON[kategorie];
  return (
    <ThemeIcon variant="light" color="beige.7" size={groesse} radius="md" style={{ flexShrink: 0 }}>
      <I size={groesse * 0.55} stroke={1.5} />
    </ThemeIcon>
  );
}

export function Kennzahl({
  label,
  wert,
  zusatz,
  icon: I,
  farbe = 'dpsgBlau',
  onClick,
}: {
  label: string;
  wert: ReactNode;
  zusatz?: ReactNode;
  icon: Icon;
  farbe?: string;
  onClick?: () => void;
}) {
  return (
    <Paper
      withBorder
      p="md"
      className="rh-kachel"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, borderTop: `3px solid var(--mantine-color-${farbe}-6)` }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text fw={700} fz={{ base: 20, sm: 24 }} lh={1.15} style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
            {wert}
          </Text>
          {zusatz && (
            <Text size="xs" c="dimmed">
              {zusatz}
            </Text>
          )}
        </Stack>
        <ThemeIcon variant="light" color={farbe} size={36} radius="md" style={{ flexShrink: 0 }} visibleFrom="xs">
          <I size={20} stroke={1.6} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

/** Bestandszahl mit Ampel: rot bei Minus, orange unter Mindestbestand. */
export function BestandZahl({ bestand, mindestbestand }: { bestand: number; mindestbestand?: number | null }) {
  if (bestand < 0) {
    return (
      <Tooltip label="Negativer Bestand – vermutlich offline doppelt verkauft oder Zählfehler">
        <Badge color="red" variant="filled">
          {formatZahl(bestand)}
        </Badge>
      </Tooltip>
    );
  }
  if (mindestbestand != null && bestand < mindestbestand) {
    return (
      <Tooltip label={`Unter Mindestbestand (${mindestbestand})`}>
        <Badge color="orange" variant="light">
          {formatZahl(bestand)}
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Badge color={bestand === 0 ? 'gray' : 'dpsgBlau'} variant="light">
      {formatZahl(bestand)}
    </Badge>
  );
}

export function ladeHerunter(inhalt: Blob | string, dateiname: string, mime = 'text/csv;charset=utf-8') {
  const blob = typeof inhalt === 'string' ? new Blob([inhalt], { type: mime }) : inhalt;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
