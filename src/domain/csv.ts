// CSV im Format, das deutsches Excel direkt korrekt öffnet:
// UTF-8 mit BOM, Semikolon als Trenner, Dezimalkomma, CRLF-Zeilenenden.

export interface CsvSpalte<T> {
  titel: string;
  wert: (zeile: T) => string | number | null | undefined;
  /** Nachkommastellen für Zahlen (Standard: 2 für Nicht-Ganzzahlen, 0 für Ganzzahlen). */
  stellen?: number;
}

export function csvZahl(n: number, stellen?: number): string {
  const s = stellen ?? (Number.isInteger(n) ? 0 : 2);
  return n.toFixed(s).replace('.', ',');
}

function zelle(v: string | number | null | undefined, stellen?: number): string {
  if (v == null) return '';
  const text = typeof v === 'number' ? csvZahl(v, stellen) : v;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(spalten: CsvSpalte<T>[], zeilen: T[]): string {
  const kopf = spalten.map((s) => zelle(s.titel)).join(';');
  const rumpf = zeilen.map((z) => spalten.map((s) => zelle(s.wert(z), s.stellen)).join(';'));
  return '﻿' + [kopf, ...rumpf].join('\r\n') + '\r\n';
}

export function dateiDatum(ms = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
