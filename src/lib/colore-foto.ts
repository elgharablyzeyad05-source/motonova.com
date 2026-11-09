// Riconosce la colorazione di una foto da catalogo (sfondo bianco) senza IA:
// un istogramma di 16 caselle (4 di grigi per luminosità + 12 di tinta) calcolato sui soli pixel del prodotto.
// Due foto della stessa colorazione, anche da angoli diversi, hanno istogrammi vicini; colorazioni diverse no.

export type Firma = number[];

const NOMI_TINTA = ["Rosso", "Arancione", "Giallo", "Giallo", "Verde", "Verde", "Azzurro", "Blu", "Blu", "Viola", "Rosa", "Rosso"];
const NOMI_GRIGI = ["Nero", "Grigio scuro", "Grigio", "Bianco"];

export async function firmaDi(src: Blob | string): Promise<Firma | null> {
  try {
    const bmp = typeof src === "string" ? await createImageBitmap(await (await fetch(src)).blob()) : await createImageBitmap(src);
    const L = 72, k = L / Math.max(bmp.width, bmp.height);
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(bmp, 0, 0, w, h); bmp.close();
    const d = g.getImageData(0, 0, w, h).data;
    const f = new Array(16).fill(0); let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b), l = (max + min) / 2, s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
      if (min > 0.9 && s < 0.12) continue; // sfondo bianco
      let bin: number;
      if (s < 0.18 || l < 0.1) bin = l < 0.18 ? 0 : l < 0.42 ? 1 : l < 0.72 ? 2 : 3;
      else {
        let hue = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
        hue = (hue * 60 + 360) % 360;
        bin = 4 + Math.floor(hue / 30) % 12;
      }
      f[bin]++; n++;
    }
    return n ? f.map((x) => x / n) : null;
  } catch { return null; }
}

/** Distanza fra due firme. I grigi contano per quota; le tinte contano per come sono distribuite fra loro,
    così due caschi neri con grafiche rosse o blu (pochi pixel colorati) risultano comunque diversi. */
export function distanza(a: Firma, b: Firma) {
  const ca = a.slice(4).reduce((s, x) => s + x, 0), cb = b.slice(4).reduce((s, x) => s + x, 0);
  let grigi = 0; for (let i = 0; i < 4; i++) grigi += Math.abs(a[i] - b[i]);
  let tinte = 0; if (ca > 0 && cb > 0) for (let i = 4; i < 16; i++) tinte += Math.abs(a[i] / ca - b[i] / cb);
  const peso = Math.min(1, Math.min(ca, cb) / 0.04);
  return grigi + 0.8 * peso * tinte + 2 * Math.abs(ca - cb);
}
export const media = (fs: Firma[]) => fs[0].map((_, i) => fs.reduce((s, f) => s + f[i], 0) / fs.length);
/** Sotto questa distanza due foto sono la stessa colorazione (stessa colorazione da angoli diversi: ~0,1–0,3; colorazioni diverse: > 0,8). */
export const SOGLIA = 0.6;

/** Nome leggibile: il colore principale, più il secondo se è una parte importante (es. «Nero / Rosso»). */
export function nomeDi(f: Firma): string {
  const nome = (i: number) => (i < 4 ? NOMI_GRIGI[i] : NOMI_TINTA[i - 4]);
  const grigi = [0, 1, 2, 3].sort((x, y) => f[y] - f[x]);
  const tinte = Array.from({ length: 12 }, (_, i) => i + 4).sort((x, y) => f[y] - f[x]);
  const cromia = tinte.reduce((s, i) => s + f[i], 0);
  // Base: i grigi scuri insieme fanno «Nero»; se la tinta domina, è lei la base.
  const scuro = f[0] + f[1], chiaro = f[2] + f[3];
  const base = cromia > Math.max(scuro, chiaro) ? nome(tinte[0]) : scuro >= chiaro ? "Nero" : f[3] >= f[2] ? "Bianco" : "Grigio";
  const accento = cromia >= 0.03 && nome(tinte[0]) !== base ? nome(tinte[0]) : scuro > 0.2 && chiaro > 0.2 && base !== "Nero" ? "Nero" : chiaro > 0.2 && base === "Nero" ? (f[3] >= f[2] ? "Bianco" : "Grigio") : "";
  void grigi;
  return accento ? `${base} / ${accento}` : base;
}
