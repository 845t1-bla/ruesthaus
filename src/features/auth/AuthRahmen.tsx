import type { ReactNode } from 'react';
import { Box, Center, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBuildingWarehouse } from '@tabler/icons-react';

/** Gemeinsamer Rahmen für Anmelde- und Hinweisseiten. */
export function AuthRahmen({ titel, untertitel, children }: { titel: string; untertitel?: string; children: ReactNode }) {
  return (
    <Box mih="100vh" style={{ background: 'linear-gradient(160deg, #003056 0%, #054679 55%, #810a1a 160%)' }}>
      <Center mih="100vh" p="md">
        <Paper w="100%" maw={420} p="xl" shadow="xl" radius="md" style={{ borderTop: '4px solid #810a1a' }}>
          <Stack gap="lg">
            <Group gap="sm">
              <IconBuildingWarehouse size={34} color="var(--mantine-color-dpsgBlau-filled)" stroke={1.6} />
              <Box>
                <Title order={3} lh={1.1}>
                  Rüsthaus
                </Title>
                <Text size="xs" c="dimmed">
                  DPSG Stamm Horsadal Roßtal
                </Text>
              </Box>
            </Group>
            <Box>
              <Title order={4}>{titel}</Title>
              {untertitel && (
                <Text size="sm" c="dimmed" mt={4}>
                  {untertitel}
                </Text>
              )}
            </Box>
            {children}
          </Stack>
        </Paper>
      </Center>
    </Box>
  );
}
