import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Farben aus dem Corporate-Design-Leitfaden der DPSG:
//   DPSG-Blau (Wort-Bild-Marke, Lilie)  #003056  RGB 0/48/86
//   DPSG-Rot  (Unterstrich, Wegzeichen) #810a1a  RGB 129/10/26
//   Rüsthaus-Grün                       #46bb00  RGB 70/187/0
//   Hellbeige #ecdfcb, Mittelbeige #c7bdad
export const FARBEN = {
  dpsgBlau: '#003056',
  dpsgRot: '#810a1a',
  ruesthausGruen: '#46bb00',
  hellbeige: '#ecdfcb',
  mittelbeige: '#c7bdad',
};

const dpsgBlau: MantineColorsTuple = [
  '#e7f0f8',
  '#cddff0',
  '#9bbfe0',
  '#669dcf',
  '#3b80c0',
  '#1f6db6',
  '#0d5a9c',
  '#054679',
  '#003056',
  '#001f3a',
];

const dpsgRot: MantineColorsTuple = [
  '#fbeaec',
  '#f3cdd1',
  '#e69aa3',
  '#d96574',
  '#cc3a4d',
  '#b51f33',
  '#9a1226',
  '#810a1a',
  '#650613',
  '#49030c',
];

const ruesthausGruen: MantineColorsTuple = [
  '#eefbe5',
  '#dcf5cb',
  '#b8eb96',
  '#93e15f',
  '#74d732',
  '#5cc911',
  '#46bb00',
  '#389600',
  '#2b7300',
  '#1d4f00',
];

const beige: MantineColorsTuple = [
  '#fbf8f3',
  '#f6efe4',
  '#ecdfcb',
  '#e0d0b6',
  '#d4c3a6',
  '#c7bdad',
  '#a99d89',
  '#8a7f6c',
  '#6b6253',
  '#4c463b',
];

export const theme = createTheme({
  primaryColor: 'dpsgBlau',
  primaryShade: { light: 8, dark: 4 },
  colors: { dpsgBlau, dpsgRot, ruesthausGruen, beige },
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  headings: { fontWeight: '600' },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { radius: 'sm' } },
    Card: { defaultProps: { withBorder: true, radius: 'md', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'md' } },
    NumberInput: { defaultProps: { decimalSeparator: ',', thousandSeparator: '.', hideControls: false } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
});
