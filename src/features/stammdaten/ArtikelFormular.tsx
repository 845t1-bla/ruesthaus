import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ACHSE_LABEL,
  KATEGORIE_LABEL,
  STANDARD_ACHSEN,
  type Achse,
  type Artikel,
  type Kategorie,
  type Variante,
} from '../../domain/types';
import { GROESSEN_VORLAGEN, variantenKombinationen } from '../../domain/varianten';
import { speichereArtikel, type ArtikelDaten } from './artikelSpeichern';

const LEER: ArtikelDaten = {
  name: '',
  kategorie: 'kluft',
  achsen: STANDARD_ACHSEN.kluft,
  groessen: [],
  vkPreisStandard: 0,
  beschreibung: '',
  aktiv: true,
};

const ALLE_ACHSEN: Achse[] = ['kollektion', 'schnitt', 'groesse', 'zustand'];

export function ArtikelFormular({
  offen,
  onClose,
  bestehend,
  onGespeichert,
}: {
  offen: boolean;
  onClose: () => void;
  bestehend: { artikel: Artikel; varianten: Variante[] } | null;
  onGespeichert?: (id: string) => void;
}) {
  const [d, setD] = useState<ArtikelDaten>(LEER);
  const [laeuft, setLaeuft] = useState(false);

  // Formular nur beim Öffnen befüllen – sonst würden Live-Updates die Eingaben überschreiben.
  useEffect(() => {
    if (!offen) return;
    if (bestehend) {
      const { id: _i, thumbnail: _t, ...rest } = bestehend.artikel;
      setD(rest);
    } else setD(LEER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const set = <K extends keyof ArtikelDaten>(k: K, v: ArtikelDaten[K]) => setD((alt) => ({ ...alt, [k]: v }));
  const anzahl = variantenKombinationen(d).length;
  const fehlerGroesse = d.achsen.includes('groesse') && d.groessen.length === 0;

  async function speichern() {
    if (!d.name.trim() || fehlerGroesse) return;
    setLaeuft(true);
    try {
      const { id, neu } = await speichereArtikel(d, bestehend);
      notifications.show({
        color: 'ruesthausGruen',
        title: bestehend ? 'Artikel gespeichert' : 'Artikel angelegt',
        message: neu ? `${neu} neue Variante(n) angelegt.` : 'Keine neuen Varianten nötig.',
      });
      onGespeichert?.(id);
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Speichern fehlgeschlagen', message: String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Modal opened={offen} onClose={onClose} title={bestehend ? 'Artikel bearbeiten' : 'Neuer Artikel'} size="lg">
      <Stack>
        <TextInput label="Bezeichnung" value={d.name} onChange={(e) => set('name', e.currentTarget.value)} withAsterisk placeholder="z. B. Kluft, Stammes-Hoodie, Halstuch Roßtal" />
        <Group grow align="flex-start">
          <Select
            label="Kategorie"
            data={Object.entries(KATEGORIE_LABEL).map(([value, label]) => ({ value, label }))}
            value={d.kategorie}
            onChange={(k) => {
              if (!k) return;
              const kat = k as Kategorie;
              setD((alt) => ({ ...alt, kategorie: kat, achsen: bestehend ? alt.achsen : STANDARD_ACHSEN[kat] }));
            }}
            allowDeselect={false}
          />
          <NumberInput
            label="Standard-Verkaufspreis"
            description="Gilt für neue Varianten, später je Variante änderbar"
            value={d.vkPreisStandard}
            onChange={(v) => set('vkPreisStandard', Number(v) || 0)}
            min={0}
            decimalScale={2}
            fixedDecimalScale
            suffix=" €"
          />
        </Group>
        <Checkbox.Group
          label="Varianten-Merkmale"
          description="Halstücher und Aufnäher haben keine Merkmale (Standardgröße)."
          value={d.achsen}
          onChange={(a) => set('achsen', ALLE_ACHSEN.filter((x) => a.includes(x)))}
        >
          <Group mt="xs">
            {ALLE_ACHSEN.map((a) => (
              <Checkbox key={a} value={a} label={ACHSE_LABEL[a]} />
            ))}
          </Group>
        </Checkbox.Group>
        {d.achsen.includes('groesse') && (
          <Stack gap={6}>
            <TagsInput
              label="Größen"
              description="In Anzeige-Reihenfolge eintippen und mit Enter bestätigen"
              value={d.groessen}
              onChange={(g) => set('groessen', g)}
              clearable
              error={fehlerGroesse ? 'Mindestens eine Größe angeben' : null}
            />
            <Group gap={6}>
              <Text size="xs" c="dimmed">
                Vorlagen:
              </Text>
              {GROESSEN_VORLAGEN.map((v) => (
                <Button key={v.label} size="compact-xs" variant="light" onClick={() => set('groessen', v.groessen)}>
                  {v.label}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
        {d.achsen.includes('zustand') && (
          <Text size="xs" c="dimmed">
            Zustände: unbenäht · benäht · Sozialkluft (leicht beschädigt, nur über „Sozialkluft ausgeben“).
          </Text>
        )}
        <Textarea label="Beschreibung (optional)" autosize minRows={2} value={d.beschreibung} onChange={(e) => set('beschreibung', e.currentTarget.value)} />
        {bestehend && <Switch label="Artikel aktiv (inaktive Artikel tauchen nicht in Kasse und Auswahl auf)" checked={d.aktiv} onChange={(e) => set('aktiv', e.currentTarget.checked)} />}
        <Alert color="dpsgBlau" variant="light">
          Ergibt <b>{anzahl}</b> Variante(n).{' '}
          {bestehend ? 'Fehlende Varianten werden ergänzt, bestehende behalten Bestand und Preise.' : 'Bestand startet bei 0 (Erfassung per Inventur oder Einkauf).'}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={speichern} loading={laeuft} disabled={!d.name.trim() || fehlerGroesse}>
            Speichern
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
