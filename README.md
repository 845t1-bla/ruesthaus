# Rüsthaus – DPSG Stamm Horsadal Roßtal

**Live:** <https://845t1-bla.github.io/ruesthaus/> · Firebase-Projekt: `ruesthaus-rosstal` (Firestore in `europe-west3`)

Web-App (PWA) zur Verwaltung des Rüsthauses: Bestand, Einkauf, Verkauf, Kluft-Flatrate mit Umtausch,
Sozialkluften, jährliche Inventur mit Bericht und CSV-Exporte. Läuft im Browser auf Laptop, Android und iPhone
und lässt sich wie eine App auf dem Homescreen installieren. Daten liegen in Firebase (Firestore), gehostet wird
kostenlos über GitHub Pages.

## Funktionen

| Bereich | Was geht |
|---|---|
| **Kasse** | Warenkorb, Käufername (Pflicht, mit Vorschlägen), Preis je Position änderbar; unter Listenpreis ist ein Grund Pflicht (bei „Sonstiges“ zusätzlich Text) |
| **Kluft-Flatrate** | Ausgabe für 40 € inkl. Standardaufnäher (bereits aufgenähte abwählen) · Umtausch: wiederverwendbare Kluft zurück ins Lager und neue gratis, beschädigte als Sozialkluft oder entsorgt plus neue Flatrate · Prüfhilfe sucht frühere Flatrates zum Namen |
| **Sozialkluft** | 0–40 € mit Pflicht-Grund, mit Aufnähern, ohne Umtauschrecht |
| **Bestand** | Liste mit Ampel (Mindestbestand/negativ), Kluft-Matrix (Größe × Zustand), Lagerwert, CSV-Export |
| **Vorgänge** | Alle Buchungen mit Verkäufer, Käufer, Rabattgrund; Filter, Umsatz, CSV-Export; Storno als Gegenbuchung |
| **Einkauf & Bewegungen** (Admin) | Einkauf mit EK-Preis (gleitender Durchschnitt), Zugang ohne Einkauf (Spende), Abgang (Entsorgung/Schwund) |
| **Inventur** | Admin startet → Buchungen gesperrt → Blindzählung auf mehreren Handys → Soll/Ist-Abgleich → Abschluss bucht Differenzen → Bericht als PDF (mit Unterschriftszeilen) und CSV |
| **Artikel & Varianten** (Admin) | Artikel mit Merkmalen (Größe, Zustand, Kollektion alt/neu, Herren/Damen), Variantengenerator, Preise, Ø-EK, Mindestbestand, bis zu 3 Produktfotos |
| **Einstellungen** (Admin) | Flatratepreis, Standardaufnäher-Set, Gründe-Listen, Benutzer & Rollen, Person anonymisieren (DSGVO), Datensicherung als JSON |
| **Offline** | Buchungen funktionieren ohne Netz und werden später synchronisiert (Anzeige oben rechts) |

Rollen: **Admin** darf alles. **Verkäufer** dürfen Kasse, Flatrate, Bestand ansehen, Vorgänge ansehen,
eigene Buchungen stornieren und bei der Inventur zählen.

---

## Einrichtung (einmalig, ca. 30 Minuten)

### 1. Firebase-Projekt anlegen

1. <https://console.firebase.google.com> → **Projekt hinzufügen** (z. B. `ruesthaus-rosstal`). Google Analytics wird nicht gebraucht.
2. **Build → Authentication → Jetzt starten → Anbieter „E-Mail/Passwort“** aktivieren.
3. **Build → Firestore Database → Datenbank erstellen**, Standort **`europe-west3` (Frankfurt)**, im **Produktionsmodus**.
4. **Firestore → Regeln**: Inhalt von [`firestore.rules`](firestore.rules) hineinkopieren und **Veröffentlichen**.
   (Alternativ mit der Firebase CLI: `npx firebase-tools deploy --only firestore:rules`.)
5. **Projekteinstellungen (Zahnrad) → Allgemein → Meine Apps → Web-App (`</>`)** registrieren (Firebase Hosting *nicht* anhaken).
   Die angezeigten Werte (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`) brauchst du gleich.

Der kostenlose **Spark-Tarif** reicht. Produktfotos werden komprimiert in Firestore gespeichert, Firebase Storage
(das eine Kreditkarte bräuchte) wird nicht verwendet.

### 2. Lokal starten (optional, zum Ausprobieren)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Werte aus Schritt 1.5 in `.env.local` eintragen, dann:

```bash
npm run dev
```

### 3. Auf GitHub Pages veröffentlichen

1. Neues Repository **`ruesthaus`** auf GitHub anlegen und diesen Ordner hochladen (`main`-Branch).
2. **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
3. **Settings → Secrets and variables → Actions → Variables** (nicht Secrets) anlegen:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
4. Workflow unter **Actions → „Auf GitHub Pages veröffentlichen“ → Run workflow** starten (läuft auch bei jedem Push).
   Die App ist dann unter `https://<dein-github-name>.github.io/ruesthaus/` erreichbar.
5. In Firebase: **Authentication → Einstellungen → Autorisierte Domains** → `<dein-github-name>.github.io` hinzufügen.
6. Empfohlen: In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) den Browser-API-Key auf
   HTTP-Referrer `https://<dein-github-name>.github.io/*` (und `http://localhost:5173/*` für die Entwicklung) beschränken.

> Die Firebase-Werte sind keine Geheimnisse – sie stehen in jeder Web-App im Klartext. Geschützt werden die Daten
> durch den Login und die Firestore-Regeln. Darum darf das Repository öffentlich sein (für kostenloses GitHub Pages nötig).

### 4. Erster Start

1. App öffnen → unten **„Ersteinrichtung“** → E-Mail und Passwort für dein Admin-Konto wählen.
2. Namen eintragen → **Einrichtung abschließen**. Das erste Konto wird Admin; danach ist die Ersteinrichtung gesperrt.
3. **Einstellungen → Benutzer → Benutzer anlegen** für die Verkäufer:innen. Das Startpasswort persönlich weitergeben;
   ändern geht über das Benutzermenü (Kreis oben rechts → „Passwort ändern“).

> Wichtig: Die Ersteinrichtung direkt nach dem Veröffentlichen machen. Bis dahin könnte theoretisch jede Person mit
> dem Link sich als erster Admin eintragen.

### 5. Daten aufbauen

1. **Artikel & Varianten → Neuer Artikel**: Kluft, Kluftbluse (Merkmale Größe + Zustand), Stammeskleidung
   (Kollektion + Schnitt + Größe), Halstuch und jeden Aufnäher (ohne Merkmale = Standardgröße).
   Preise je Variante setzen, Fotos hinzufügen (am Handy direkt mit der Kamera).
2. **Einstellungen → Standardaufnäher**: die Aufnäher der Flatrate auswählen.
3. Pro Variante den geschätzten **Ø-EK** und optional einen **Mindestbestand** eintragen.
4. **Inventur → Eröffnungsinventur** starten, alles zählen, abschließen: Das ist dein Startbestand.

### 6. Logo und App-Icon

- Das Stammeslogo als **`public/logo.png`** ablegen (quadratisch oder quer, transparenter Hintergrund geht). Es erscheint
  dann in der Kopfleiste.
- Die App-Icons (`public/icon-*.png`, `apple-touch-icon.png`) können durch eigene PNGs gleicher Größe ersetzt werden.
  `npm run icons` erzeugt die Standard-Icons neu.

### 7. Als App installieren

- **Android (Chrome):** Seite öffnen → Menü ⋮ → „App installieren“.
- **iPhone (Safari):** Seite öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.
- **Laptop (Chrome/Edge):** Installations-Symbol in der Adressleiste.

---

## Wichtige Regeln im Alltag

- **Flatrate-Prüfung:** Es gibt kein Personenregister. Beim Umtausch sucht die App frühere Flatrates über den
  Käufernamen (Groß-/Kleinschreibung und ä/ae egal). Darum Namen immer gleich schreiben und die Vorschläge nutzen.
- **Inventur:** Vor dem Start sollten alle Geräte online gewesen sein. Offline gespeicherte Buchungen, die erst während
  der Inventur ankommen, werden abgelehnt (die App zeigt dann eine Meldung).
- **Minusbestand:** Verkaufen zwei Leute offline das letzte Teil, wird der Bestand negativ und rot markiert. Das wird bei
  der nächsten Zählung korrigiert.
- **Datensicherung:** Nach jeder Inventur unter *Einstellungen → Datensicherung* eine JSON-Sicherung im Stammes-Cloudordner ablegen.
- **Übergabe:** App und Daten hängen an deinem privaten Google-/GitHub-Konto. Bei einer Übergabe der Rüsthaus-Verantwortung
  das Firebase-Projekt (Projekteinstellungen → Nutzer und Berechtigungen) und das GitHub-Repository (Settings → Transfer)
  an die Nachfolge übertragen.
- **Datenschutz:** Käufernamen werden dauerhaft gespeichert (für den Flatrate-Nachweis). Bei einem Löschwunsch:
  *Einstellungen → Datenschutz → Person anonymisieren*.

---

## Entwicklung

```
src/
  domain/      reine Fachlogik (Buchungen, Rabattregeln, Inventur, CSV) + Tests
  data/        Firebase-Anbindung, Live-Daten, Buchen (offline-fähig)
  components/  Shell (Navigation), Auswahl-Dialoge, Formularbausteine
  features/    Seiten: dashboard, kasse, flatrate, bestand, vorgaenge, bewegungen, inventur, stammdaten, einstellungen
firestore.rules  Sicherheitsregeln (Rollen, Inventursperre, unveränderliche Buchungen)
```

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests der Buchungslogik (Vitest) |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` |
| `npm run emulators` | Firebase Emulator Suite (Auth + Firestore, braucht Java 11+ und `npx firebase-tools`) |
| `npm run seed` | Testdaten in den Emulator schreiben (Testkonten siehe `scripts/seed-emulator-konten.mjs`) |
| `npm run test:rules` | Prüft die Firestore-Regeln gegen den Emulator (nach `seed`) |
| `npm run dev:emulator` | App gegen den Emulator starten |

Buchungsprinzip: Jeder Vorgang ist ein unveränderlicher Beleg in `vorgaenge`. Bestandsänderungen werden im selben
atomaren Batch per `increment()` auf die Variante gebucht. Das funktioniert auch offline (Transaktionen würden das nicht).
