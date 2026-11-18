import { useEffect, useState } from 'react';
import { Alert, Button, Group, MultiSelect, NumberInput, Paper, Stack, Tabs, TagsInput, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAdjustments, IconBadge, IconDatabaseExport, IconListDetails, IconShieldLock, IconUsers } from '@tabler/icons-react';
import { getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDaten } from '../../data/DataProvider';
import { sende } from '../../data/buchen';
import { alsVorgang, col, einstellungenRef } from '../../data/refs';
import { dateiDatum } from '../../domain/csv';
import { GRUND_SONSTIGES, type Einstellungen as EinstellungenTyp } from '../../domain/types';
import { bezeichnungVon } from '../../domain/varianten';
import { ladeHerunter, SeitenKopf } from '../../components/Bausteine';
import { BenutzerVerwaltung } from './BenutzerVerwaltung';
import { Anonymisieren } from './Anonymisieren';

async function speichereEinstellungen(teil: Partial<EinstellungenTyp>) {
  const batch = writeBatch(db);
  batch.update(einstellungenRef, teil);
  await sende(batch);
  notifications.show({ color: 'ruesthausGruen', title: 'Gespeichert', message: 'Die Einstellungen wurden übernommen.' });
}

function Allgemein() {
  const { einstellungen } = useDaten();
  const [stammName, setStammName] = useState(einstellungen.stammName);
  const [preis, setPreis] = useState<number | string>(einstellungen.flatratePreis);
  return (
    <Stack maw={520}>
      <TextInput label="Name des Stammes" description="Erscheint in Kopfzeile und Berichten" value={stammName} onChange={(e) => setStammName(e.currentTarget.value)} />
      <NumberInput
        label="Preis der Kluft-Flatrate"
        description="Inklusive aller Standardaufnäher; gilt auch als Obergrenze für Sozialkluften"
        value={preis}
        onChange={setPreis}
        min={0}
        decimalScale={2}
        fixedDecimalScale
        suffix=" €"
      />
      <Group>
        <Button onClick={() => speichereEinstellungen({ stammName: stammName.trim(), flatratePreis: Number(preis) || 0 })}>Speichern</Button>
      </Group>
    </Stack>
  );
}

function StandardAufnaeher() {
  const { einstellungen, varianten } = useDaten();
  const [wahl, setWahl] = useState<string[]>(einstellungen.standardAufnaeher);
  useEffect(() => setWahl(einstellungen.standardAufnaeher), [einstellungen.standardAufnaeher]);
  const optionen = varianten.filter((v) => v.kategorie === 'aufnaeher' && v.aktiv).map((v) => ({ value: v.id, label: bezeichnungVon(v) }));
  return (
    <Stack maw={620}>
      <Text size="sm">
        Diese Aufnäher gehören zur Kluft-Flatrate und zur Sozialkluft. Bei der Ausgabe sind alle vorausgewählt und können abgewählt werden, wenn sie schon auf der Kluft sind.
      </Text>
      {optionen.length === 0 && (
        <Alert color="yellow">Lege zuerst unter „Artikel & Varianten“ Artikel der Kategorie „Aufnäher“ an.</Alert>
      )}
      <MultiSelect label="Standardaufnäher-Set" data={optionen} value={wahl} onChange={setWahl} searchable clearable placeholder="Aufnäher wählen" />
      <Group>
        <Button onClick={() => speichereEinstellungen({ standardAufnaeher: wahl })}>Speichern</Button>
      </Group>
    </Stack>
  );
}

const mitSonstiges = (l: string[]) => {
  const ohne = l.map((x) => x.trim()).filter((x) => x && x !== GRUND_SONSTIGES);
  return [...ohne, GRUND_SONSTIGES];
};

function Gruende() {
  const { einstellungen } = useDaten();
  const [rabatt, setRabatt] = useState(einstellungen.rabattGruende);
  const [zugang, setZugang] = useState(einstellungen.zugangsGruende);
  const [abgang, setAbgang] = useState(einstellungen.abgangsGruende);
  return (
    <Stack maw={620}>
      <Text size="sm" c="dimmed">
        „Sonstiges“ ist immer enthalten und verlangt zusätzlich eine Beschreibung.
      </Text>
      <TagsInput label="Gründe für Rabatt / kostenlose Ausgabe" value={rabatt} onChange={setRabatt} />
      <TagsInput label="Gründe für Zugang ohne Einkauf" value={zugang} onChange={setZugang} />
      <TagsInput label="Gründe für Abgang ohne Verkauf" value={abgang} onChange={setAbgang} />
      <Group>
        <Button
          onClick={() =>
            speichereEinstellungen({ rabattGruende: mitSonstiges(rabatt), zugangsGruende: mitSonstiges(zugang), abgangsGruende: mitSonstiges(abgang) })
          }
        >
          Speichern
        </Button>
      </Group>
    </Stack>
  );
}

function Datensicherung() {
  const daten = useDaten();
  const [laeuft, setLaeuft] = useState(false);
  async function exportieren() {
    setLaeuft(true);
    try {
      const alleVorgaenge = (await getDocs(col.vorgaenge)).docs.map(alsVorgang);
      const sicherung = {
        erstellt: new Date().toISOString(),
        einstellungen: daten.einstellungen,
        benutzer: daten.benutzerListe,
        artikel: daten.artikel,
        varianten: daten.varianten,
        vorgaenge: alleVorgaenge,
        inventuren: daten.inventuren,
      };
      ladeHerunter(JSON.stringify(sicherung, null, 2), `Ruesthaus_Sicherung_${dateiDatum()}.json`, 'application/json');
    } catch (e) {
      notifications.show({ color: 'red', title: 'Sicherung fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }
  return (
    <Stack maw={620}>
      <Text size="sm">
        Lädt alle Daten (ohne Produktbilder) als JSON-Datei herunter. Empfehlung: nach jeder Inventur eine Sicherung ablegen, z. B. im Stammes-Cloudordner.
      </Text>
      <Group>
        <Button leftSection={<IconDatabaseExport size={16} />} onClick={exportieren} loading={laeuft}>
          Sicherung herunterladen
        </Button>
      </Group>
    </Stack>
  );
}

export function Einstellungen() {
  return (
    <>
      <SeitenKopf titel="Einstellungen" beschreibung="Flatrate, Aufnäher-Set, Gründe, Benutzer und Datenschutz" />
      <Paper withBorder p="md">
        <Tabs defaultValue="allgemein" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="allgemein" leftSection={<IconAdjustments size={16} />}>
              Allgemein
            </Tabs.Tab>
            <Tabs.Tab value="aufnaeher" leftSection={<IconBadge size={16} />}>
              Standardaufnäher
            </Tabs.Tab>
            <Tabs.Tab value="gruende" leftSection={<IconListDetails size={16} />}>
              Gründe
            </Tabs.Tab>
            <Tabs.Tab value="benutzer" leftSection={<IconUsers size={16} />}>
              Benutzer
            </Tabs.Tab>
            <Tabs.Tab value="datenschutz" leftSection={<IconShieldLock size={16} />}>
              Datenschutz
            </Tabs.Tab>
            <Tabs.Tab value="sicherung" leftSection={<IconDatabaseExport size={16} />}>
              Datensicherung
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="allgemein">
            <Allgemein />
          </Tabs.Panel>
          <Tabs.Panel value="aufnaeher">
            <StandardAufnaeher />
          </Tabs.Panel>
          <Tabs.Panel value="gruende">
            <Gruende />
          </Tabs.Panel>
          <Tabs.Panel value="benutzer">
            <BenutzerVerwaltung />
          </Tabs.Panel>
          <Tabs.Panel value="datenschutz">
            <Anonymisieren />
          </Tabs.Panel>
          <Tabs.Panel value="sicherung">
            <Datensicherung />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </>
  );
}
