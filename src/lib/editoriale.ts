import guide from "../../dati/guide.json";
import legali from "../../dati/legali.json";
import type { Blocco } from "@/componenti/Blocchi";

export type Voce = { id: string; occhiello: string; titolo: string; sommario: string; tempo: string; blocchi: Blocco[]; collegamenti?: [string, string][] };
export const GUIDE = guide as unknown as Voce[];
export const PAGINE = legali as unknown as Voce[];
export const guidaPerId = (id: string) => GUIDE.find((g) => g.id === id);
export const paginaPerId = (id: string) => PAGINE.find((g) => g.id === id);
