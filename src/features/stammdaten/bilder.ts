// Fotos werden im Browser verkleinert und als Data-URL in Firestore gespeichert.
// So bleibt das Projekt im kostenlosen Spark-Tarif und die Bilder sind offline verfügbar.

export const MAX_BILDER = 3;

export interface ArtikelFoto {
  id: string;
  bild: string;
  thumb: string;
  erstelltAm: number;
}

async function ladeBild(file: File): Promise<{ img: HTMLImageElement; freigeben: () => void }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Das Bild konnte nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden.');
  }
  return { img, freigeben: () => URL.revokeObjectURL(url) };
}

function zeichne(img: HTMLImageElement, maxKante: number, quadratisch: boolean): HTMLCanvasElement {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas wird nicht unterstützt.');
  if (quadratisch) {
    // Mittiger quadratischer Ausschnitt für Vorschaubilder
    const kante = Math.min(w0, h0);
    c.width = c.height = Math.min(maxKante, kante);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w0 - kante) / 2, (h0 - kante) / 2, kante, kante, 0, 0, c.width, c.height);
  } else {
    const f = Math.min(1, maxKante / Math.max(w0, h0));
    c.width = Math.round(w0 * f);
    c.height = Math.round(h0 * f);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c;
}

function alsDataUrl(c: HTMLCanvasElement, qualitaet: number, maxZeichen: number): string {
  let q = qualitaet;
  const kodiere = () => {
    const webp = c.toDataURL('image/webp', q);
    // Ältere Safari-Versionen können kein WebP kodieren und liefern PNG – dann JPEG nehmen.
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', q);
  };
  let url = kodiere();
  while (url.length > maxZeichen && q > 0.35) {
    q -= 0.1;
    url = kodiere();
  }
  return url;
}

/** Verkleinert ein Foto auf max. 800 px (~100 KB) plus ein 160-px-Vorschaubild. */
export async function verarbeiteFoto(file: File): Promise<ArtikelFoto> {
  const { img, freigeben } = await ladeBild(file);
  try {
    const bild = alsDataUrl(zeichne(img, 800, false), 0.8, 180_000);
    const thumb = alsDataUrl(zeichne(img, 160, true), 0.75, 20_000);
    return { id: crypto.randomUUID(), bild, thumb, erstelltAm: Date.now() };
  } finally {
    freigeben();
  }
}

/** Ungefähre Größe einer Data-URL in KB. */
export const dataUrlKb = (url: string) => Math.round((url.length * 3) / 4 / 1024);
