import { chromium } from "playwright";
import { verifica, titolo, fine } from "./util";
const B = "http://localhost:3100";
const b = await chromium.launch(); 
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errori: string[] = [];
p.on("response", (r) => { if (r.status() === 404 && !/operativo$/.test(r.url())) errori.push("404 " + r.url()); });
p.on("pageerror", (e) => errori.push(String(e)));
p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errori.push(m.text()); });

titolo("Home e negozio");
await p.goto(B + "/"); verifica("home carica con titolo", (await p.locator("h1").first().innerText()).length > 3);
verifica("canvas hero presente", (await p.locator("canvas.hero-canvas").count()) === 1);
await p.goto(B + "/negozio");
const href = await p.locator("a[href^='/prodotto/']").first().getAttribute("href");
verifica("il negozio elenca prodotti", !!href, href);

titolo("Prodotto → carrello");
await p.goto(B + href!);
await p.locator(".taglie label:not(:has(input:disabled))").first().click();
await p.locator("button.aggiungi-carrello").click();
await p.waitForResponse((r) => r.request().method() === "POST", { timeout: 10000 }); await p.waitForLoadState("networkidle");
await p.goto(B + "/carrello");
verifica("carrello ha una riga", (await p.locator("body").innerText()).includes("EGP"));

titolo("Checkout contrassegno");
await p.goto(B + "/checkout");
await p.fill("#nome", "Test Cliente"); await p.fill("#telefono", "01012345678"); await p.fill("#email", "test@example.com");
await p.selectOption("#governatorato", "Giza"); await p.fill("#indirizzo", "Dokki, via Tahrir 12");
await p.locator("button.conferma-ordine").click();
await p.waitForURL(/\/ordine\/MN-/, { timeout: 15000 });
const numero = /\/ordine\/(MN-[\d-]+)/.exec(p.url())![1];
verifica("ordine creato", !!numero, numero);

titolo("Pubblico non vede admin");
const r = await p.goto(B + "/operativo"); verifica("/operativo è 404 per anonimi", r!.status() === 404); errori.length = 0;

titolo("Admin");
await p.goto(B + "/accedi?torna=/operativo");
await p.fill("#email", process.env.ADMIN_EMAIL!); await p.fill("#password", process.env.ADMIN_PASSWORD!);
await p.locator("button.entra").click(); await p.waitForURL((u) => u.pathname === "/operativo", { timeout: 15000 });
verifica("admin vede l'ordine", (await p.locator("body").innerText()).toUpperCase().includes(numero));
await p.locator(`article:has-text("${numero}") button:has-text("Confermato")`).click();
await p.waitForLoadState("networkidle");
verifica("stato avanzato", (await p.locator(`article:has-text("${numero}")`).innerText()).toUpperCase().includes("CONFERMATO"));

titolo("Chat");
const cliente = await b.newContext(); const pc = await cliente.newPage();
await pc.goto(B + "/"); await pc.locator("button.chat-fab").click();
await pc.fill(".chat-pannello input", "Che taglia per 1,80 m?"); await pc.locator(".chat-pannello form button").click();
await pc.waitForSelector(".chat-msgs .io");
verifica("messaggio del cliente visibile", (await pc.locator(".chat-msgs .io").innerText()).includes("1,80"));
await pc.fill(".chat-pannello input", "<img src=x onerror=alert(1)>"); await pc.locator(".chat-pannello form button").click();
await pc.waitForFunction(() => document.querySelectorAll(".chat-msgs .io").length === 2);
verifica("HTML nel messaggio resta testo", (await pc.locator(".chat-msgs img").count()) === 0);
await p.goto(B + "/operativo?tab=chat");
verifica("admin vede la conversazione", (await p.locator("body").innerText()).includes("Visitatore"));
await p.locator("a[href*='conv=']").first().click(); await p.waitForLoadState("networkidle");
verifica("admin legge il messaggio", (await p.locator("body").innerText()).includes("1,80"));
await p.fill("#testo", "Per 1,80 m ti consigliamo la L."); await p.locator("button:has-text('Invia')").last().click(); await p.waitForLoadState("networkidle");
await pc.waitForSelector(".chat-msgs .staff", { timeout: 12000 });
verifica("il cliente riceve la risposta", (await pc.locator(".chat-msgs .staff").innerText()).includes("consigliamo"));
const g = await cliente.request.get(B + "/api/chat"); verifica("API chat non espone altri utenti", (await g.json()).messaggi.length === 3);
const altro = await b.newContext(); const g2 = await altro.request.get(B + "/api/chat"); verifica("altro visitatore vede chat vuota", (await g2.json()).messaggi.length === 0);
errori.length = 0;

titolo("Lingue");
await p.goto(B + "/ar"); verifica("arabo è rtl", (await p.locator("html").getAttribute("dir")) === "rtl");
await p.goto(B + "/en/negozio"); verifica("inglese ok", (await p.locator("html").getAttribute("lang")) === "en");

verifica("nessun errore in console", errori.length === 0, errori.slice(0, 3));
await b.close(); fine("web");
