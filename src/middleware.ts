import { NextResponse, type NextRequest } from "next/server";

// /en/... e /ar/... riscrivono sulle stesse pagine dell'italiano: una sola serie di pagine, tre lingue.
// La lingua viaggia in un'intestazione interna, così nessuna pagina deve conoscere il prefisso.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const h = new Headers(req.headers);
  h.delete("x-lingua"); // mai fidarsi di una lingua mandata da fuori
  h.delete("x-percorso");
  const m = /^\/(en|ar)(\/.*)?$/.exec(pathname);
  if (m) {
    h.set("x-lingua", m[1]);
    h.set("x-percorso", (m[2] || "/") + req.nextUrl.search);
    const url = req.nextUrl.clone();
    url.pathname = m[2] || "/";
    return NextResponse.rewrite(url, { request: { headers: h } });
  }
  h.set("x-lingua", "it");
  h.set("x-percorso", pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next/|api/|media/|favicon.ico|robots.txt|sitemap.xml).*)"] };
