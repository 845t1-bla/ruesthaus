import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { AuthProvider, useAuth } from './data/AuthProvider';
import { DataProvider, useDaten } from './data/DataProvider';
import { Shell } from './components/Shell';
import { Login } from './features/auth/Login';
import { Ersteinrichtung } from './features/auth/Ersteinrichtung';
import { KeinZugriff } from './features/auth/KeinZugriff';
import { Dashboard } from './features/dashboard/Dashboard';
import { Kasse } from './features/kasse/Kasse';
import { Flatrate } from './features/flatrate/Flatrate';
import { Bestand } from './features/bestand/Bestand';
import { Vorgaenge } from './features/vorgaenge/Vorgaenge';
import { Bewegungen } from './features/bewegungen/Bewegungen';
import { InventurSeite } from './features/inventur/InventurSeite';
import { ArtikelListe } from './features/stammdaten/ArtikelListe';
import { ArtikelDetail } from './features/stammdaten/ArtikelDetail';
import { Einstellungen } from './features/einstellungen/Einstellungen';

function Laden() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}

function NurAdmin({ children }: { children: ReactNode }) {
  const { istAdmin } = useAuth();
  return istAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function Bereich() {
  const { geladen } = useDaten();
  if (!geladen) return <Laden />;
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kasse" element={<Kasse />} />
          <Route path="/flatrate" element={<Flatrate />} />
          <Route path="/bestand" element={<Bestand />} />
          <Route path="/vorgaenge" element={<Vorgaenge />} />
          <Route path="/inventur" element={<InventurSeite />} />
          <Route path="/bewegungen" element={<NurAdmin><Bewegungen /></NurAdmin>} />
          <Route path="/stammdaten" element={<NurAdmin><ArtikelListe /></NurAdmin>} />
          <Route path="/stammdaten/:artikelId" element={<NurAdmin><ArtikelDetail /></NurAdmin>} />
          <Route path="/einstellungen" element={<NurAdmin><Einstellungen /></NurAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

function Weiche() {
  const { status } = useAuth();
  switch (status) {
    case 'laden':
      return <Laden />;
    case 'abgemeldet':
      return <Login />;
    case 'ersteinrichtung':
      return <Ersteinrichtung />;
    case 'keinZugriff':
      return <KeinZugriff />;
    case 'bereit':
      return (
        <DataProvider>
          <Bereich />
        </DataProvider>
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Weiche />
    </AuthProvider>
  );
}
