"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Conto alla rovescia e aggiornamento periodico della pagina mentre l'asta è aperta. */
export function Orologio({ fine, aperta, chiusa }: { fine: string; aperta: boolean; chiusa: string }) {
  const router = useRouter();
  const [ora, setOra] = useState<number | null>(null);
  useEffect(() => {
    setOra(Date.now());
    const t = setInterval(() => setOra(Date.now()), 1000);
    const r = aperta ? setInterval(() => router.refresh(), 8000) : undefined;
    return () => { clearInterval(t); if (r) clearInterval(r); };
  }, [aperta, router]);
  const ms = new Date(fine).getTime() - (ora ?? new Date(fine).getTime());
  if (!aperta || ms <= 0) return <span className="orologio">{chiusa}</span>;
  const s = Math.floor(ms / 1000), g = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const due = (n: number) => String(n).padStart(2, "0");
  const testo = g > 0 ? `${g}g ${due(h)}:${due(m)}:${due(x)}` : `${h > 0 ? due(h) + ":" : ""}${due(m)}:${due(x)}`;
  return <span className={"orologio tab" + (s <= 120 ? " caldo" : "")} role="timer" dir="ltr">{ora === null ? "—" : testo}</span>;
}
