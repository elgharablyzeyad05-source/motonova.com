import sharp from "sharp";

/** Foto da catalogo, senza ritocchi:
    - sfondo già bianco (o trasparente): solo ritaglio attorno al prodotto e margine uguale per tutte;
    - sfondo di un altro colore: cambia SOLO lo sfondo in bianco (riempimento dai bordi), il prodotto resta com'è.
    Niente rotazioni, niente ridisegni: loghi e dettagli restano quelli della foto originale. */
export async function pulisciFoto(buf: Buffer): Promise<{ img: sharp.Sharp; sfondo: "bianco" | "colorato" }> {
  const { data, info } = await sharp(buf, { limitInputPixels: 80e6 }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const at = (x: number, y: number) => (y * W + x) * 4;

  // colore del bordo (solo pixel opachi)
  const bordo: number[][] = [];
  for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) { const i = at(x, y); if (px[i + 3] > 200) bordo.push([px[i], px[i + 1], px[i + 2]]); }
  for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) { const i = at(x, y); if (px[i + 3] > 200) bordo.push([px[i], px[i + 1], px[i + 2]]); }
  const tot = Math.ceil(W / 2) * 2 + Math.ceil(H / 2) * 2;
  let sfondo: "bianco" | "colorato" = "bianco";
  if (bordo.length > tot * 0.5) {
    const med = [0, 1, 2].map((c) => bordo.map((p) => p[c]).sort((a, b) => a - b)[bordo.length >> 1]);
    if (Math.min(...med) < 235) {
      sfondo = "colorato";
      // riempimento dai bordi: diventano bianchi solo i pixel collegati al bordo e vicini al colore dello sfondo
      const vicino = (i: number) => px[i + 3] > 200 && Math.abs(px[i] - med[0]) < 28 && Math.abs(px[i + 1] - med[1]) < 28 && Math.abs(px[i + 2] - med[2]) < 28;
      const visto = new Uint8Array(W * H), coda = new Int32Array(W * H); let t = 0, h = 0;
      const metti = (x: number, y: number) => { const k = y * W + x; if (!visto[k] && vicino(k * 4)) { visto[k] = 1; coda[t++] = k; } };
      for (let x = 0; x < W; x++) { metti(x, 0); metti(x, H - 1); }
      for (let y = 0; y < H; y++) { metti(0, y); metti(W - 1, y); }
      while (h < t) {
        const k = coda[h++], x = k % W, y = (k / W) | 0, i = k * 4;
        px[i] = px[i + 1] = px[i + 2] = 255;
        if (x > 0) metti(x - 1, y); if (x < W - 1) metti(x + 1, y); if (y > 0) metti(x, y - 1); if (y < H - 1) metti(x, y + 1);
      }
    }
  }
  // su bianco, poi riquadro del prodotto
  const rgb = Buffer.alloc(W * H * 3);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y), a = px[i + 3] / 255, o = (y * W + x) * 3;
    const r = Math.round(px[i] * a + 255 * (1 - a)), g = Math.round(px[i + 1] * a + 255 * (1 - a)), b = Math.round(px[i + 2] * a + 255 * (1 - a));
    rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
    if (Math.min(r, g, b) < 248) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
  const w = x1 - x0 + 1, hh = y1 - y0 + 1, L = Math.round(Math.max(w, hh) * 1.12);
  const ritaglio = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).extract({ left: x0, top: y0, width: w, height: hh }).png().toBuffer();
  const img = sharp(ritaglio).extend({
    left: Math.floor((L - w) / 2), right: L - w - Math.floor((L - w) / 2), top: Math.floor((L - hh) / 2), bottom: L - hh - Math.floor((L - hh) / 2),
    background: { r: 255, g: 255, b: 255 },
  });
  return { img: sharp(await img.png().toBuffer()), sfondo };
}

/** Siti da cui si possono prendere le foto ufficiali (server-side, mai indirizzi interni). */
export const HOST_FOTO = ["dainese-cdn.thron.com", "www.agv.com", "agv.com", "www.shoei-europe.com", "www.alpinestars.com", "www.hjchelmets.eu", "www.mthelmets.com", "www.scorpion-helmets.eu", "www.arai-europe.com", "cdn.shopify.com"];
