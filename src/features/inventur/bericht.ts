import { csvZahl, toCsv } from '../../domain/csv';
import { formatDatum, formatDatumZeit } from '../../domain/format';
import { inventurSummen } from '../../domain/inventur';
import { KATEGORIE_LABEL, type Inventur, type InventurZeile } from '../../domain/types';

export function inventurCsv(inv: Inventur): string {
  return toCsv<InventurZeile>(
    [
      { titel: 'Kategorie', wert: (z) => KATEGORIE_LABEL[z.kategorie] },
      { titel: 'Artikel', wert: (z) => z.artikel },
      { titel: 'Variante', wert: (z) => z.variante },
      { titel: 'Soll', wert: (z) => z.soll },
      { titel: 'Ist', wert: (z) => z.ist },
      { titel: 'Differenz', wert: (z) => z.differenz },
      { titel: 'Ø-EK (EUR)', wert: (z) => csvZahl(z.ekPreis, 2) },
      { titel: 'Wert Soll (EUR)', wert: (z) => csvZahl(Math.max(z.soll, 0) * z.ekPreis, 2) },
      { titel: 'Wert Ist (EUR)', wert: (z) => csvZahl(Math.max(z.ist, 0) * z.ekPreis, 2) },
      { titel: 'Wertdifferenz (EUR)', wert: (z) => csvZahl((Math.max(z.ist, 0) - Math.max(z.soll, 0)) * z.ekPreis, 2) },
      { titel: 'Gezählt', wert: (z) => (z.gezaehlt ? 'ja' : 'nein (= 0)') },
    ],
    inv.ergebnis ?? [],
  );
}

// Die Standardschriften von PDF kennen nur Latin-1: Euro-Zeichen, Gedankenstriche und
// typografische Anführungszeichen werden ersetzt (Umlaute funktionieren).
const pdfText = (s: string) =>
  s
    .replace(/€/g, 'EUR')
    .replace(/[–—]/g, '-')
    .replace(/[„“”]/g, '"')
    .replace(/ /g, ' ');

const geld = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
const stk = (n: number) => (n > 0 ? `+${n}` : String(n));

const BLAU: [number, number, number] = [0, 48, 86];
const ROT: [number, number, number] = [129, 10, 26];
const BEIGE: [number, number, number] = [236, 223, 203];

export async function inventurPdf(inv: Inventur, stammName: string): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const zeilen = inv.ergebnis ?? [];
  const s = inventurSummen(zeilen);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const breite = doc.internal.pageSize.getWidth();
  const hoehe = doc.internal.pageSize.getHeight();

  const kopf = () => {
    doc.setFillColor(...BLAU);
    doc.rect(0, 0, breite, 22, 'F');
    doc.setFillColor(...ROT);
    doc.rect(0, 22, breite, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Inventurbericht', 14, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(pdfText(`${stammName} - Rüsthaus`), 14, 16.5);
    doc.text(pdfText(inv.bezeichnung), breite - 14, 10, { align: 'right' });
    doc.text(`Stichtag ${formatDatum(inv.stichtag)}`, breite - 14, 16.5, { align: 'right' });
    doc.setTextColor(30, 30, 30);
  };

  kopf();
  doc.setFontSize(9);
  doc.text(pdfText(`Gestartet: ${formatDatumZeit(inv.gestartetAm)} von ${inv.gestartetVon}`), 14, 31);
  if (inv.abgeschlossenAm) {
    doc.text(pdfText(`Abgeschlossen: ${formatDatumZeit(inv.abgeschlossenAm)} von ${inv.abgeschlossenVon ?? ''}`), 14, 36);
  }

  autoTable(doc, {
    startY: 41,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: BEIGE, textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['Kennzahl', 'Wert', 'Kennzahl', 'Wert']],
    body: [
      ['Positionen', String(s.positionen), 'Stück Soll', String(s.stueckSoll)],
      ['Gezählt', String(s.gezaehlt), 'Stück Ist', String(s.stueckIst)],
      ['Nicht gezählt (als 0)', String(s.nichtGezaehlt), 'Lagerwert Soll', geld(s.wertSoll)],
      ['Positionen mit Abweichung', String(s.abweichungen), 'Lagerwert Ist', geld(s.wertIst)],
      ['', '', 'Wertdifferenz', geld(s.wertDifferenz)],
    ],
    margin: { left: 14, right: 14 },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.4 },
    headStyles: { fillColor: BLAU, textColor: 255 },
    alternateRowStyles: { fillColor: [246, 239, 228] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    head: [['Artikel', 'Variante', 'Soll', 'Ist', 'Diff.', 'Ø-EK', 'Wert Ist']],
    body: zeilen.map((z) => [
      pdfText(z.artikel),
      pdfText(z.variante) + (z.gezaehlt ? '' : ' (nicht gezählt)'),
      String(z.soll),
      String(z.ist),
      z.differenz === 0 ? '0' : stk(z.differenz),
      geld(z.ekPreis),
      geld(Math.max(z.ist, 0) * z.ekPreis),
    ]),
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) {
        const diff = zeilen[d.row.index]?.differenz ?? 0;
        if (diff < 0) d.cell.styles.textColor = ROT;
        if (diff > 0) d.cell.styles.textColor = [43, 115, 0];
      }
    },
    margin: { left: 14, right: 14, top: 30 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) kopf();
    },
  });

  // Unterschriften
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  if (y > hoehe - 40) {
    doc.addPage();
    kopf();
    y = 45;
  }
  doc.setFontSize(9);
  doc.text('Die Inventur wurde ordnungsgemäß durchgeführt.', 14, y - 6);
  const linien: [number, string][] = [
    [14, 'Ort, Datum'],
    [78, 'Rüsthaus-Verantwortliche/r'],
    [142, 'Kassenprüfer/in'],
  ];
  for (const [x, label] of linien) {
    doc.setDrawColor(120);
    doc.line(x, y + 10, x + 54, y + 10);
    doc.text(pdfText(label), x, y + 15);
  }

  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Seite ${i} von ${seiten}`, breite - 14, hoehe - 8, { align: 'right' });
    doc.text(pdfText(`Erstellt mit der Rüsthaus-App · ${formatDatumZeit(Date.now())}`), 14, hoehe - 8);
  }
  return doc.output('blob');
}
