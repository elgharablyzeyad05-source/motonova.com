// Limitatore in memoria: ferma chi prova cento password o iscrive mille email.
// È per istanza: su un solo server basta; con più server serve uno store condiviso.
const colpi = new Map<string, number[]>();

export function limita(chiave: string, max: number, finestraMs: number): boolean {
  const ora = Date.now();
  const lista = (colpi.get(chiave) ?? []).filter((t) => ora - t < finestraMs);
  if (lista.length >= max) { colpi.set(chiave, lista); return false; }
  lista.push(ora);
  colpi.set(chiave, lista);
  if (colpi.size > 5000) for (const [k, v] of colpi) if (!v.some((t) => ora - t < finestraMs)) colpi.delete(k);
  return true;
}

export function azzera(chiave: string) { colpi.delete(chiave); }
