import Link from "next/link";
import { href, tr, type Lingua } from "@/lib/i18n";

export type Blocco =
  | { t: "p"; v: string } | { t: "h"; v: string } | { t: "nota"; v: string }
  | { t: "lista"; v: string[] } | { t: "tabella"; intestazioni: string[]; righe: string[][] };

/** I contenuti editoriali sono dati: guide e pagine legali usano lo stesso disegno.
 *  Ogni frase passa dal dizionario; se manca la traduzione resta l'italiano. */
export function Blocchi({ blocchi, l }: { blocchi: Blocco[]; l: Lingua }) {
  return (
    <div style={{ maxWidth: 680 }}>
      {blocchi.map((b, i) => {
        switch (b.t) {
          case "p": return <p key={i} style={{ marginBottom: 16 }}>{tr(l, b.v)}</p>;
          case "h": return <h2 key={i} style={{ fontSize: 22, margin: "36px 0 14px" }}>{tr(l, b.v)}</h2>;
          case "nota": return <p key={i} className="nota" style={{ margin: "20px 0" }}>{tr(l, b.v)}</p>;
          case "lista": return <ul key={i} style={{ margin: "0 0 18px", paddingInlineStart: 20 }}>{b.v.map((x, j) => <li key={j} style={{ marginBottom: 6 }}>{tr(l, x)}</li>)}</ul>;
          case "tabella": return (
            <div key={i} style={{ overflowX: "auto", margin: "18px 0" }}>
              <table className="dati"><thead><tr>{b.intestazioni.map((h, j) => <th key={j}>{tr(l, h)}</th>)}</tr></thead>
                <tbody>{b.righe.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{tr(l, c)}</td>)}</tr>)}</tbody></table>
            </div>);
        }
      })}
    </div>
  );
}

export function Collegamenti({ l, voci }: { l: Lingua; voci: [string, string][] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", gap: 18, flexWrap: "wrap" }}>
      {voci.map(([testo, url]) => {
        const m = /^(guida|pagina)\.html\?[gp]=(.+)$/.exec(url);
        const dove = m ? (m[1] === "guida" ? `/guide/${m[2]}` : `/pagina/${m[2]}`) : url;
        return <li key={url}><Link style={{ textDecoration: "underline" }} href={href(l, dove)}>{tr(l, testo)}</Link></li>;
      })}
    </ul>
  );
}
