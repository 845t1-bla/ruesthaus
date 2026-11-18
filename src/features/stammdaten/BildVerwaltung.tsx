import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Card, FileButton, Group, Image, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCamera, IconPhotoPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { col } from '../../data/refs';
import { sende } from '../../data/buchen';
import type { Artikel } from '../../domain/types';
import { dataUrlKb, MAX_BILDER, verarbeiteFoto, type ArtikelFoto } from './bilder';

/** Bis zu drei Produktbilder je Artikel; das erste ist das Titelbild (Vorschau in Listen). */
export function BildVerwaltung({ artikel }: { artikel: Artikel }) {
  const [bilder, setBilder] = useState<ArtikelFoto[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(
    () =>
      onSnapshot(doc(col.artikelBilder, artikel.id), (s) => {
        setBilder((s.data()?.bilder as ArtikelFoto[] | undefined) ?? []);
      }),
    [artikel.id],
  );

  async function speichere(neu: ArtikelFoto[]) {
    const batch = writeBatch(db);
    batch.set(doc(col.artikelBilder, artikel.id), { bilder: neu });
    batch.update(doc(col.artikel, artikel.id), { thumbnail: neu[0]?.thumb ?? null });
    await sende(batch);
  }

  async function hinzufuegen(file: File | null) {
    if (!file) return;
    if (bilder.length >= MAX_BILDER) return;
    setLaeuft(true);
    try {
      const foto = await verarbeiteFoto(file);
      await speichere([...bilder, foto]);
      notifications.show({ color: 'ruesthausGruen', title: 'Bild gespeichert', message: `Komprimiert auf ca. ${dataUrlKb(foto.bild)} KB.` });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Bild konnte nicht gespeichert werden', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  const voll = bilder.length >= MAX_BILDER;

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={600}>Produktbilder</Text>
          <Text size="xs" c="dimmed">
            Bis zu {MAX_BILDER} Bilder. Das erste ist das Titelbild in Kasse und Bestand.
          </Text>
        </div>
        <Group gap="xs">
          <FileButton onChange={hinzufuegen} accept="image/*" capture="environment" disabled={voll || laeuft}>
            {(props) => (
              <Button {...props} variant="light" leftSection={<IconCamera size={16} />} loading={laeuft} hiddenFrom="sm">
                Foto aufnehmen
              </Button>
            )}
          </FileButton>
          <FileButton onChange={hinzufuegen} accept="image/*" disabled={voll || laeuft}>
            {(props) => (
              <Button {...props} variant="light" leftSection={<IconPhotoPlus size={16} />} loading={laeuft}>
                Bild hinzufügen
              </Button>
            )}
          </FileButton>
        </Group>
      </Group>
      {bilder.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">
          Noch keine Bilder.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          {bilder.map((b, i) => (
            <Card key={b.id} padding={0} withBorder>
              <Image src={b.bild} h={180} fit="cover" alt="" />
              <Group justify="space-between" p={6}>
                {i === 0 ? (
                  <Badge size="sm" leftSection={<IconStarFilled size={10} />} color="beige.7">
                    Titelbild
                  </Badge>
                ) : (
                  <Tooltip label="Als Titelbild verwenden">
                    <ActionIcon variant="subtle" onClick={() => speichere([b, ...bilder.filter((x) => x.id !== b.id)])}>
                      <IconStar size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Stack gap={0} align="flex-end">
                  <Tooltip label="Bild löschen">
                    <ActionIcon variant="subtle" color="red" onClick={() => speichere(bilder.filter((x) => x.id !== b.id))}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Paper>
  );
}
