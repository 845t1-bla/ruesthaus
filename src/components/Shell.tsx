import { useState, type ReactNode } from 'react';
import { NavLink as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  AppShell,
  Avatar,
  Box,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBuildingWarehouse,
  IconClipboardCheck,
  IconDots,
  IconKey,
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconPackages,
  IconReceipt2,
  IconSettings,
  IconShirt,
  IconShoppingCart,
  IconSun,
  IconTags,
  IconTruckDelivery,
  type Icon,
} from '@tabler/icons-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../data/AuthProvider';
import { useDaten } from '../data/DataProvider';
import { SyncAnzeige } from './SyncAnzeige';
import { PasswortAendern } from '../features/auth/PasswortAendern';

interface NavEintrag {
  to: string;
  label: string;
  icon: Icon;
  admin?: boolean;
}

const NAVIGATION: { gruppe: string; eintraege: NavEintrag[] }[] = [
  {
    gruppe: 'Verkauf',
    eintraege: [
      { to: '/', label: 'Übersicht', icon: IconLayoutDashboard },
      { to: '/kasse', label: 'Kasse', icon: IconShoppingCart },
      { to: '/flatrate', label: 'Kluft-Flatrate', icon: IconShirt },
    ],
  },
  {
    gruppe: 'Lager',
    eintraege: [
      { to: '/bestand', label: 'Bestand', icon: IconPackages },
      { to: '/vorgaenge', label: 'Vorgänge & Verkäufe', icon: IconReceipt2 },
      { to: '/bewegungen', label: 'Einkauf & Bewegungen', icon: IconTruckDelivery, admin: true },
      { to: '/inventur', label: 'Inventur', icon: IconClipboardCheck },
    ],
  },
  {
    gruppe: 'Verwaltung',
    eintraege: [
      { to: '/stammdaten', label: 'Artikel & Varianten', icon: IconTags, admin: true },
      { to: '/einstellungen', label: 'Einstellungen', icon: IconSettings, admin: true },
    ],
  },
];

const MOBIL: NavEintrag[] = [
  { to: '/', label: 'Übersicht', icon: IconLayoutDashboard },
  { to: '/kasse', label: 'Kasse', icon: IconShoppingCart },
  { to: '/flatrate', label: 'Flatrate', icon: IconShirt },
  { to: '/bestand', label: 'Bestand', icon: IconPackages },
];

function Logo() {
  const [logoDa, setLogoDa] = useState(true);
  return logoDa ? (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt=""
      height={34}
      style={{ borderRadius: 4, background: '#fff', padding: 2 }}
      onError={() => setLogoDa(false)}
    />
  ) : (
    <IconBuildingWarehouse size={28} color="#ecdfcb" stroke={1.6} />
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [offen, { toggle, close }] = useDisclosure();
  const [pwOffen, pw] = useDisclosure();
  const { benutzer, istAdmin } = useAuth();
  const { einstellungen, aktiveInventur } = useDaten();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const location = useLocation();
  const navigate = useNavigate();

  const aktiv = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <AppShell
      header={{ height: 58 }}
      navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !offen } }}
      footer={{ height: { base: 62, sm: 0 } }}
      padding={{ base: 'sm', sm: 'lg' }}
      styles={{ main: { background: 'var(--rh-bg)' } }}
    >
      <AppShell.Header
        style={{ background: 'var(--rh-shell)', borderBottom: '3px solid var(--rh-akzent)', color: '#fff' }}
        className="rh-no-print"
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={offen} onClick={toggle} hiddenFrom="sm" size="sm" color="#fff" aria-label="Navigation" />
            <UnstyledButton onClick={() => navigate('/')}>
              <Group gap={10} wrap="nowrap">
                <Logo />
                <Box>
                  <Text fw={700} size="lg" lh={1.1} c="#fff">
                    Rüsthaus
                  </Text>
                  <Text size="xs" c="#c7bdad" lh={1.1} visibleFrom="xs">
                    {einstellungen.stammName}
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <SyncAnzeige />
            <Menu position="bottom-end" width={230} shadow="md">
              <Menu.Target>
                <UnstyledButton aria-label="Benutzermenü">
                  <Avatar color="beige" variant="filled" radius="xl" size={34}>
                    {(benutzer?.name ?? '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  {benutzer?.name} · {istAdmin ? 'Admin' : 'Verkäufer'}
                </Menu.Label>
                <Menu.Item leftSection={<IconKey size={16} />} onClick={pw.open}>
                  Passwort ändern
                </Menu.Item>
                <Menu.Item
                  leftSection={colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
                  onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                >
                  {colorScheme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => signOut(auth)}>
                  Abmelden
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" className="rh-no-print">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap="md" py="xs">
            {NAVIGATION.map((g) => {
              const eintraege = g.eintraege.filter((e) => !e.admin || istAdmin);
              if (!eintraege.length) return null;
              return (
                <Box key={g.gruppe}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" mb={4}>
                    {g.gruppe}
                  </Text>
                  {eintraege.map((e) => (
                    <NavLink
                      key={e.to}
                      component={RouterLink}
                      to={e.to}
                      label={e.label}
                      leftSection={<e.icon size={19} stroke={1.6} />}
                      active={aktiv(e.to)}
                      onClick={close}
                      style={{ borderRadius: 6 }}
                      fw={500}
                    />
                  ))}
                </Box>
              );
            })}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Text size="xs" c="dimmed" px="sm" pb="xs">
            DPSG · Rüsthaus-Verwaltung
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {aktiveInventur && location.pathname !== '/inventur' && (
          <Alert color="yellow" mb="md" icon={<IconClipboardCheck />} title={`Inventur läuft: ${aktiveInventur.bezeichnung}`}>
            Verkäufe und Lagerbuchungen sind bis zum Abschluss gesperrt.{' '}
            <Anchor component={RouterLink} to="/inventur">
              Zur Zählliste
            </Anchor>
          </Alert>
        )}
        {children}
      </AppShell.Main>

      <AppShell.Footer hiddenFrom="sm" className="rh-no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Group grow h="100%" gap={0}>
          {MOBIL.map((e) => (
            <UnstyledButton key={e.to} onClick={() => navigate(e.to)} h="100%">
              <Stack gap={2} align="center" c={aktiv(e.to) ? 'dpsgBlau.8' : 'dimmed'}>
                <e.icon size={22} stroke={aktiv(e.to) ? 2 : 1.6} />
                <Text size="10px" fw={aktiv(e.to) ? 700 : 500}>
                  {e.label}
                </Text>
              </Stack>
            </UnstyledButton>
          ))}
          <UnstyledButton onClick={toggle} h="100%">
            <Stack gap={2} align="center" c="dimmed">
              <IconDots size={22} stroke={1.6} />
              <Text size="10px" fw={500}>
                Mehr
              </Text>
            </Stack>
          </UnstyledButton>
        </Group>
      </AppShell.Footer>

      <PasswortAendern offen={pwOffen} onClose={pw.close} />
    </AppShell>
  );
}
