import { NextResponse, type NextRequest } from "next/server";

// /it/... e /ar/... riscrivono sulle stesse pagine dell'inglese (lingua principale, senza prefisso): una sola serie di pagine, tre lingue.
// La lingua viaggia in un'intestazione interna, così nessuna pagina deve conoscere il prefisso.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const h = new Headers(req.headers);
  h.delete("x-lingua"); // mai fidarsi di una lingua mandata da fuori
  h.delete("x-percorso");
  // /en/... è l'indirizzo vecchio dell'inglese: ora l'inglese è la lingua principale, senza prefisso
  const vecchio = /^\/en(\/.*)?$/.exec(pathname);
  if (vecchio) {
    const url = req.nextUrl.clone();
    url.pathname = vecchio[1] || "/";
    return NextResponse.redirect(url, 308);
  }
  const m = /^\/(it|ar)(\/.*)?$/.exec(pathname);
  if (m) {
    h.set("x-lingua", m[1]);
    h.set("x-percorso", (m[2] || "/") + req.nextUrl.search);
    const url = req.nextUrl.clone();
    url.pathname = m[2] || "/";
    return NextResponse.rewrite(url, { request: { headers: h } });
  }
  h.set("x-lingua", "en");
  h.set("x-percorso", pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next/|api/|media/|immagini/|favicon.ico|robots.txt|sitemap.xml).*)"] };
