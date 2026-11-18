import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import './styles.css';

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { theme } from './theme';
import { KonfigHinweis } from './features/auth/KonfigHinweis';

// Firebase wird erst geladen, wenn die Zugangsdaten konfiguriert sind.
const konfiguriert = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
const App = lazy(() => import('./App'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <ModalsProvider labels={{ confirm: 'Bestätigen', cancel: 'Abbrechen' }}>
        {konfiguriert ? (
          <Suspense
            fallback={
              <Center h="100vh">
                <Loader />
              </Center>
            }
          >
            <App />
          </Suspense>
        ) : (
          <KonfigHinweis />
        )}
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
