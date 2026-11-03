// Cosa mettere nei riquadri finché non ci sono le foto: una sagoma generica, tratteggiata,
// dichiaratamente un disegno. Una foto presa altrove sarebbe una bugia; un rettangolo vuoto
// farebbe sembrare il sito rotto.
const FORME: Record<string, React.ReactNode> = {
  caschi: (<><path d="M50 18c18 0 30 13 30 31v14c0 6-4 10-10 10H58l-4 8H36c-13 0-22-10-22-24 0-23 16-39 36-39z" /><path d="M26 44c6-10 16-16 28-16 11 0 19 4 24 11l3 14c-9-6-19-9-30-9-10 0-18 2-26 7z" /><path d="M54 73h16" /></>),
  giacche: (<><path d="M38 20 24 27c-5 2-8 7-8 12v14l9 3-3 26c0 3 2 5 5 5h46c3 0 5-2 5-5l-3-26 9-3V39c0-5-3-10-8-12L62 20z" /><path d="M38 20l12 13 12-13M50 33v54" /></>),
  guanti: (<><path d="M32 52V30c0-4 3-7 6-7s6 3 6 7v18M44 48V24c0-4 3-7 6-7s6 3 6 7v24M56 48V28c0-4 3-7 6-7s6 3 6 7v26" /><path d="M68 54V42c0-4 3-6 6-6s6 2 6 6v22c0 13-9 22-22 22H46c-11 0-14-6-18-13l-9-16c-2-4 3-8 6-5l7 7" /></>),
  stivali: (<><path d="M34 16h26l4 42 14 12c3 3 5 6 5 10v4H30c-4 0-7-3-7-7V26c0-6 5-10 11-10z" /><path d="M34 30h24M34 42h25M23 70h60" /></>),
  protezioni: (<><path d="M50 14 20 26v26c0 20 13 32 30 38 17-6 30-18 30-38V26z" /><path d="M50 26v54M32 34v20M68 34v20" /></>),
  accessori: (<><path d="M28 34h44c4 0 7 3 7 7v34c0 4-3 7-7 7H28c-4 0-7-3-7-7V41c0-4 3-7 7-7z" /><path d="M38 34V24c0-4 3-7 7-7h10c4 0 7 3 7 7v10M21 52h58" /></>),
  pantaloni: (<><path d="M30 16h40l6 70H56l-6-44-6 44H24z" /><path d="M30 28h40" /></>),
  tute: (<><path d="M38 14 26 20c-4 2-7 6-7 10v18l8 2v10l-3 26h14l6-24 6 24h14l-3-26V50l8-2V30c0-4-3-8-7-10L62 14z" /><path d="M50 26v26" /></>),
  gilet: (<><path d="M36 16 26 28v58h18V50l6 8 6-8v36h18V28L64 16 50 30z" /></>),
  manutenzione: (<><path d="M38 38h24v46c0 3-2 5-5 5H43c-3 0-5-2-5-5z" /><path d="M42 38V26h16v12M46 26v-8h8v8M44 54h12" /></>),
  generico: (<><path d="M22 26h56c3 0 5 2 5 5v38c0 3-2 5-5 5H22c-3 0-5-2-5-5V31c0-3 2-5 5-5z" /><path d="M17 62l16-14 12 10 14-16 24 20" /></>),
};

export function Sagoma({ categoria }: { categoria: string }) {
  return (
    <svg className="sagoma" viewBox="0 0 100 100" aria-hidden="true">
      {FORME[categoria] ?? FORME.generico}
    </svg>
  );
}

export function Cornice({ foto, categoria, alt, grande, children }: { foto?: string | null; categoria: string; alt: string; grande?: boolean; children?: React.ReactNode }) {
  return (
    <div className={"cornice" + (grande ? " grande" : "")}>
      {foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${foto}`} alt={alt} loading="lazy" /> : <Sagoma categoria={categoria} />}
      {children}
    </div>
  );
}
