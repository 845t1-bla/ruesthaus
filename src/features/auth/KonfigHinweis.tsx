import { Code, List, Text } from '@mantine/core';
import { AuthRahmen } from './AuthRahmen';

export function KonfigHinweis() {
  return (
    <AuthRahmen titel="Firebase ist noch nicht verbunden" untertitel="Die App braucht die Zugangsdaten eines Firebase-Projekts.">
      <Text size="sm">So geht's (Details in der README):</Text>
      <List size="sm" spacing={4}>
        <List.Item>Firebase-Projekt anlegen, Authentication (E-Mail/Passwort) und Firestore aktivieren.</List.Item>
        <List.Item>
          Web-App registrieren und die Werte in <Code>.env.local</Code> eintragen (Vorlage: <Code>.env.example</Code>).
        </List.Item>
        <List.Item>
          Für das Hosting auf GitHub Pages dieselben Werte als Repository-Variablen hinterlegen.
        </List.Item>
      </List>
    </AuthRahmen>
  );
}
