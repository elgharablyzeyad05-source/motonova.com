let ok = 0, ko = 0;
export function verifica(nome: string, cond: boolean, dettaglio?: unknown) {
  if (cond) { ok++; console.log("  ✓", nome); }
  else { ko++; console.log("  ✗", nome, dettaglio !== undefined ? "→ " + JSON.stringify(dettaglio) : ""); }
}
export function uguale<T>(nome: string, got: T, atteso: T) {
  verifica(nome, JSON.stringify(got) === JSON.stringify(atteso), { got, atteso });
}
export function titolo(t: string) { console.log("\n" + t); }
export function fine(nomeSuite: string) {
  console.log(`\n${nomeSuite}: ${ok} ok, ${ko} falliti`);
  if (ko) process.exit(1);
}
