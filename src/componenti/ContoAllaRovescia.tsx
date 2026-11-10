"use client";
import { useEffect, useState } from "react";

/* Conto alla rovescia verso il drop: giorni, ore, minuti, secondi. Prima dell'idratazione mostra «--» per non
   disegnare sul server un orario diverso da quello del browser. */
export default function ContoAllaRovescia({ fine, etichette, finito }: { fine: string; etichette: [string, string, string, string]; finito: string }) {
  const [ora, setOra] = useState<number | null>(null);
  useEffect(() => { setOra(Date.now()); const t = setInterval(() => setOra(Date.now()), 1000); return () => clearInterval(t); }, []);
  const resto = ora === null ? null : Math.max(0, new Date(fine).getTime() - ora);
  if (resto === 0) return <p className="cs-finito">{finito}</p>;
  const parti = resto === null ? [null, null, null, null] : [Math.floor(resto / 864e5), Math.floor(resto / 36e5) % 24, Math.floor(resto / 6e4) % 60, Math.floor(resto / 1e3) % 60];
  return (
    <div className="cs-timer" role="timer" aria-live="off" dir="ltr">
      {parti.map((n, i) => (
        <div key={i} className="cs-cella"><b className="tab">{n === null ? "--" : String(n).padStart(2, "0")}</b><span>{etichette[i]}</span></div>
      ))}
    </div>
  );
}
