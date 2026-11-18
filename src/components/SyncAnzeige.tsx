import { Badge, Tooltip } from '@mantine/core';
import { IconCloudCheck, IconCloudOff, IconCloudUpload } from '@tabler/icons-react';
import { useDaten } from '../data/DataProvider';

export function SyncAnzeige() {
  const { sync } = useDaten();
  if (!sync.online) {
    return (
      <Tooltip label="Kein Internet. Buchungen werden lokal gespeichert und später synchronisiert.">
        <Badge color="yellow" variant="filled" leftSection={<IconCloudOff size={14} />} size="lg">
          Offline
        </Badge>
      </Tooltip>
    );
  }
  if (sync.ausstehend) {
    return (
      <Tooltip label="Lokale Änderungen werden gerade an den Server übertragen.">
        <Badge color="blue" variant="filled" leftSection={<IconCloudUpload size={14} />} size="lg">
          Synchronisiere
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Tooltip label="Alle Änderungen sind auf dem Server gespeichert.">
      <Badge
        color="ruesthausGruen"
        variant="light"
        leftSection={<IconCloudCheck size={14} />}
        size="lg"
        visibleFrom="xs"
        styles={{ root: { background: 'rgba(70,187,0,0.18)', color: '#b8eb96' } }}
      >
        Synchron
      </Badge>
    </Tooltip>
  );
}
