"use client";
import { useEffect, useId, useState } from "react";

export function CercaTestata({ azione, segnaposto, etichetta }: { azione: string; segnaposto: string; etichetta: string }) {
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<string[]>([]);
  const id = useId();
  useEffect(() => {
    if (q.trim().length < 2) { setSugg([]); return; }
    const c = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggerimenti?q=${encodeURIComponent(q)}`, { signal: c.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((l: { etichetta: string }[]) => setSugg(l.map((x) => x.etichetta)))
        .catch(() => {});
    }, 180);
    return () => { clearTimeout(t); c.abort(); };
  }, [q]);
  return (
    <form action={azione} method="get" className="cerca-testata" role="search">
      <label htmlFor={id} className="salta">{etichetta}</label>
      <input id={id} name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={segnaposto} list={id + "-l"} autoComplete="off" />
      <datalist id={id + "-l"}>{sugg.map((s) => <option key={s} value={s} />)}</datalist>
    </form>
  );
}
