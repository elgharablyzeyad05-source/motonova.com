/* ══════════════════════════════════════════════════════════════════════════
   Scena 3D dell'hero — traiettorie di pista.
   Niente librerie: geometria e proiezione prospettica scritte a mano, ~10 KB.
   Nessun file modello da scaricare, quindi parte anche con connessioni lente.

   Vive solo dentro la fascia scura in cima alla pagina e non dipende dallo
   scroll: da sola si apre in un ventaglio di traiettorie e si richiude in un
   guscio protettivo, all'infinito. Le linee sono una famiglia ordinata —
   nascono tutte dalla stessa curva madre — perché un fascio si legge, un
   groviglio no.
   ══════════════════════════════════════════════════════════════════════════ */
export function avviaScena(hero, cv) {
  if (!hero || !cv || !cv.getContext) return function(){};
  var pulizia = [];
  var ctx = null;
  try { ctx = cv.getContext("2d"); } catch(err){ return; }
  if (!ctx) return;

  var PAPER = "239,237,232", ROSSO = "224,52,31", VERDE = "14,147,84";
  var TAU = Math.PI * 2, HALF = Math.PI / 2;
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(err){}

  var W = 0, H = 0, dpr = 1, unit = 320, unitAperto = 520, cx = 0, cy = 0, mobile = false;
  var K = 18, P = 56, ribs = [], rings = [];
  var px = 0, py = 0;                    // parallasse col puntatore, solo desktop
  var CAM = 3.35, FOC = 2.0;
  var TICK_EVERY = 7;

  /* La stella del marchio, presa dal logo: quattro punte lunghe e lati
     concavi. Gli stessi otto vertici del segno che sta nell'intestazione. */
  var PUNTA = 1, RIENTRO = 0.1917 * Math.SQRT2;     // raggio esterno e interno
  var VERT = [];
  (function(){
    for (var k = 0; k < 8; k++){
      var a = Math.PI / 2 - k * (TAU / 8);           // parte dalla punta in alto
      var r = (k % 2 === 0) ? PUNTA : RIENTRO;
      VERT.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  })();
  var LUNG = [], PERIM = 0;
  (function(){
    for (var k = 0; k < 8; k++){
      var a = VERT[k], b = VERT[(k + 1) % 8];
      var d = Math.sqrt((b[0]-a[0])*(b[0]-a[0]) + (b[1]-a[1])*(b[1]-a[1]));
      LUNG.push(d); PERIM += d;
    }
  })();

  /* Un punto sul contorno della stella, a frazione p del perimetro */
  function stella(p, out){
    var d = ((p % 1) + 1) % 1 * PERIM, k = 0;
    while (k < 8 && d > LUNG[k]) { d -= LUNG[k]; k++; }
    if (k > 7) k = 7;
    var a = VERT[k], b = VERT[(k + 1) % 8];
    var f = LUNG[k] ? d / LUNG[k] : 0;
    out[0] = a[0] + (b[0] - a[0]) * f;
    out[1] = a[1] + (b[1] - a[1]) * f;
  }

  // la curva madre: una sola traiettoria, quella che tutte le altre seguono
  function master(p, out){
    out[0] = 0.92 * Math.sin(p * Math.PI * 1.02) - 0.26;
    out[1] = 0.30 * Math.sin(p * Math.PI * 0.72);
    out[2] = -2.05 + p * 2.45;
  }

  /* Gli spigoli del marchio in tre dimensioni.
     Non una pila di contorni sovrapposti — quello era un'estrusione, e si
     vedeva. Qui la stella è un solido: il contorno a otto vertici, i costoloni
     che salgono alla punta davanti e quelli che scendono a quella dietro.
     Ogni nervatura del fascio diventa uno spigolo preciso di quel solido. */
  var SPIGOLI = [];
  function costruisciSpigoli(){
    SPIGOLI = [];
    var S = 1.16, d = 0.38;
    var V = VERT.map(function(v){ return [v[0] * S, v[1] * S, 0]; });
    var AV = [0, 0, d], IN = [0, 0, -d];      // punta davanti e punta dietro

    // il contorno: è la sagoma che rende il marchio riconoscibile
    for (var k = 0; k < 8; k++) SPIGOLI.push({ a: V[k], b: V[(k+1) % 8], tipo: "silhouette" });
    // i costoloni verso la punta davanti: danno il volume
    for (k = 0; k < 8; k++) SPIGOLI.push({ a: V[k], b: AV, tipo: "davanti" });
    // e quelli dietro, appena accennati: fanno leggere lo spessore
    [0, 2, 4, 6].forEach(function(k){ SPIGOLI.push({ a: V[k], b: IN, tipo: "dietro" }); });

    /* Il tricolore va dove ce l'ha il logo: il cuneo verde sulla punta in
       alto, quello rosso sulla punta in basso. Non un filo a caso. */
    var VERDI = [0, 8, 9], ROSSI = [4, 12, 13];
    SPIGOLI.forEach(function(s, n){
      s.colore = VERDI.indexOf(n) !== -1 ? "verde" : (ROSSI.indexOf(n) !== -1 ? "rosso" : "carta");
    });
  }

  function build(){
    costruisciSpigoli();
    K = SPIGOLI.length;
    ribs = [];
    var mp = [0,0,0];
    for (var i = 0; i < K; i++){
      var u = K > 1 ? i / (K - 1) : 0.5;
      var off = (u - 0.5) * 1.55;                 // posizione nel ventaglio
      var sp = SPIGOLI[i];
      var open = new Float32Array(P * 3), shut = new Float32Array(P * 3);
      for (var j = 0; j < P; j++){
        var p = P > 1 ? j / (P - 1) : 0;
        master(p, mp);
        // ── aperta: ventaglio di traiettorie che si svasa e ruota su sé stesso
        var tw = p * 0.95;
        var spread = 0.50 + 0.50 * p;
        open[j*3]     = mp[0] + off * Math.cos(tw) * 0.58 * spread;
        open[j*3 + 1] = mp[1] + off * Math.sin(tw) * 1.00 * spread;
        open[j*3 + 2] = mp[2] + off * 0.14;
        // ── chiusa: lo spigolo, dritto e al suo posto
        shut[j*3]     = sp.a[0] + (sp.b[0] - sp.a[0]) * p;
        shut[j*3 + 1] = sp.a[1] + (sp.b[1] - sp.a[1]) * p;
        shut[j*3 + 2] = sp.a[2] + (sp.b[2] - sp.a[2]) * p;
      }
      /* La curva non scivola dritta al suo posto: arriva curvando. Ogni
         nervatura ha la sua direzione di scarto, che si annulla all'arrivo. */
      var ang = i * 2.39996;                       // angoli ben distribuiti
      ribs.push({
        open: open, shut: shut,
        arco: [Math.cos(ang) * 0.42, Math.sin(ang) * 0.42, Math.sin(ang * 1.7) * 0.22],
        tipo: sp.tipo, colore: sp.colore,
        scr: new Float32Array(P * 2),
        vis: new Uint8Array(P),
        delay: i * 0.035                          // arriva a onda, non in blocco
      });
    }
    rings = [];
  }

  function resize(){
    var w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);      // da qui si ragiona in px CSS
    var m = w <= 700;
    // la scena sta in alto, lontano dal titolo che occupa il fondo dell'hero
    if (m){ cx = W * 0.50; cy = H * 0.27; unit = Math.min(W * 0.40, H * 0.23); unitAperto = W * 0.62; }
    else  { cx = W * 0.66; cy = H * 0.35; unit = Math.min(W * 0.25, H * 0.32); unitAperto = W * 0.44; }
    if (m !== mobile || !ribs.length){
      mobile = m;
      P = mobile ? 40 : 56;
      TICK_EVERY = mobile ? 8 : 7;
      build();
    }
  }

  function smooth(t){ return t * t * (3 - 2 * t); }

  /* Chiusura con un filo di rimbalzo: la forma supera di poco il segno e
     rientra. È la differenza tra un pezzo che si posa e uno che si spegne. */
  function posa(t){
    var s = smooth(t);
    return s + Math.sin(Math.PI * Math.min(1, t)) * 0.055 * t * t;
  }

  /* Il ciclo, in quattro tempi e senza soste morte:
       movimento   le traiettorie attraversano tutta la fascia scura
       raccolta    si stringono nel marchio
       marchio     la stella resta, e respira
       dispersione escono di quadro dall'altro lato, e si ricomincia
     Il salto di posizione fra la fine e l'inizio avviene fuori inquadratura,
     quindi non si vede: il movimento sembra continuo. */
  var PERIOD = 11.7;
  var ENTRA = 0.75, ESCE = 0.80;      // quanto fuori quadro sta ai due estremi

  function ciclo(ts){
    var t = ts % PERIOD; if (t < 0) t += PERIOD;
    /* Entra subito e rallenta arrivando; riparte piano e scappa via.
       Un movimento addolcito a tutt'e due i capi lascerebbe la fascia vuota
       proprio mentre dovrebbe essere attraversata. */
    if (t < 4.2){
      var e = (t / 4.2);
      return { m: 0, s: -ENTRA * (1 - e) * (1 - e) };
    }
    if (t < 7.2)  return { m: posa((t - 4.2) / 3.0), s: 0 };
    if (t < 9.4)  return { m: 1, s: 0 };
    var k = (t - 9.4) / 2.2;
    return { m: 1 - smooth(k), s: ESCE * k * k };
  }
  function morphAt(ts){ return ciclo(ts).m; }

  /* Aperto il fascio è largo quanto la fascia; chiuso è il marchio, compatto
     e al suo posto. Posizione e scala viaggiano insieme al ciclo. */
  var cxNow = 0, cyNow = 0, unitNow = 320;
  function framing(m, s){
    var mc = Math.max(0, Math.min(1, m));
    cxNow = cx + s * W;
    cyNow = cy + (1 - mc) * (H * 0.06);
    unitNow = unitAperto + (unit - unitAperto) * mc;
  }

  function p0(j){ return P > 1 ? j / (P - 1) : 0; }

  function projectPts(src, n, scr, vis, m, shut, ry, rx){
    var cry = Math.cos(ry), sry = Math.sin(ry);
    var crx = Math.cos(rx), srx = Math.sin(rx);
    for (var j = 0; j < n; j++){
      var k = j * 3, x, y, z;
      if (shut){ x = src[k]; y = src[k+1]; z = src[k+2]; }
      else {
        x = src.o[k]   + (src.s[k]   - src.o[k])   * m;
        y = src.o[k+1] + (src.s[k+1] - src.o[k+1]) * m;
        z = src.o[k+2] + (src.s[k+2] - src.o[k+2]) * m;
        if (src.arco){
          // scarto laterale massimo a metà strada, nullo alle due estremità
          var w = Math.sin(Math.PI * Math.max(0, Math.min(1, m))) * (0.35 + 0.65 * p0(j));
          x += src.arco[0] * w; y += src.arco[1] * w; z += src.arco[2] * w;
        }
      }
      var x1 = x * cry - z * sry, z1 = x * sry + z * cry;
      var y1 = y * crx - z1 * srx, z2 = y * srx + z1 * crx;
      var d = CAM - z2;
      if (d < 0.32){ vis[j] = 0; continue; }
      var s = FOC / d * unitNow;
      scr[j*2] = cxNow + x1 * s;
      scr[j*2 + 1] = cyNow - y1 * s;
      vis[j] = 1;
    }
  }

  function tracePath(scr, vis, n){
    var open = false;
    for (var j = 0; j < n; j++){
      if (!vis[j]){ open = false; continue; }
      var sx = scr[j*2], sy = scr[j*2 + 1];
      if (!open){ ctx.moveTo(sx, sy); open = true; }
      else ctx.lineTo(sx, sy);
    }
  }

  var giro = 0, ultimo = 0;

  function frame(ts){
    if (!W || !H) return;
    var t = ts * 0.001;
    var fase = ciclo(t);
    var mMain = fase.m;

    /* Il fascio ruota mentre è aperto; man mano che si chiude la rotazione
       rallenta e viene tirata verso il punto in cui la stella è frontale.
       Un marchio visto di taglio non è un marchio. */
    var dt = ultimo ? Math.min(0.06, t - ultimo) : 0;
    ultimo = t;
    var mr = Math.max(0, Math.min(1, mMain));
    giro += dt * 0.34 * (1 - mr);
    if (mr > 0.3){
      var meta = Math.round(giro / TAU) * TAU;
      giro += (meta - giro) * Math.min(1, (mr - 0.3) / 0.7) * 0.14;
    }
    var mc0 = Math.max(0, Math.min(1, mMain));
    var respiro = Math.sin(t * 0.62) * 0.045 * mc0;   // appena, per non sembrare un'immagine
    var ry = giro + respiro + px * 0.22 * (1 - mc0 * 0.7);
    var rx = -0.12 * (1 - mc0) + Math.cos(t * 0.48) * 0.022 * mc0 + py * 0.14 * (1 - mc0 * 0.7);

    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    framing(mMain, fase.s);

    // proiezione — ogni nervatura ha il proprio ritardo, così l'apertura è un'onda
    for (var i = 0; i < ribs.length; i++){
      var rb = ribs[i];
      projectPts({ o: rb.open, s: rb.shut, arco: rb.arco }, P, rb.scr, rb.vis,
                 morphAt(t - rb.delay), false, ry, rx);
    }

    /* Le passate di disegno seguono una gerarchia: il contorno è il marchio e
       sta davanti, i costoloni danno il volume, quelli dietro sono appena
       accennati. Aperto invece è tutto un fascio solo: lì la gerarchia non
       esiste ancora. */
    function passata(filtro, colore, alpha, spessore){
      if (alpha <= 0.015) return;
      ctx.strokeStyle = "rgba(" + colore + "," + alpha.toFixed(3) + ")";
      ctx.lineWidth = spessore;
      ctx.beginPath();
      for (var q = 0; q < ribs.length; q++){
        if (filtro(ribs[q])) tracePath(ribs[q].scr, ribs[q].vis, P);
      }
      ctx.stroke();
    }

    var mc = Math.max(0, Math.min(1, mMain));
    var neutre = function(r){ return r.colore === "carta"; };

    passata(function(r){ return neutre(r) && r.tipo === "dietro"; },
            PAPER, 0.30 - 0.13 * mc, 1);
    passata(function(r){ return neutre(r) && r.tipo === "davanti"; },
            PAPER, 0.30 + 0.08 * mc, 1);
    passata(function(r){ return neutre(r) && r.tipo === "silhouette"; },
            PAPER, 0.30 + 0.62 * mc, 1 + 0.6 * mc);

    // il tricolore, dove il logo ce l'ha davvero
    passata(function(r){ return r.colore === "verde"; }, VERDE, 0.45 + 0.42 * mc, 1.2 + 0.5 * mc);
    passata(function(r){ return r.colore === "rosso"; }, ROSSO, 0.55 + 0.35 * mc, 1.2 + 0.5 * mc);

    /* Le tacche sono dettaglio da telemetria: sulla traiettoria raccontano,
       sul marchio sporcano. Si spengono mentre la stella si chiude. */
    var tickA = 0.34 * (1 - mc);
    if (tickA > 0.02){
      ctx.strokeStyle = "rgba(" + PAPER + "," + tickA.toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      var tickLen = mobile ? 3 : 4.5;
      for (i = 0; i < ribs.length; i++){
        var r2 = ribs[i], scr = r2.scr, vis = r2.vis;
        for (var j2 = TICK_EVERY; j2 < P - 1; j2 += TICK_EVERY){
          if (!vis[j2] || !vis[j2-1] || !vis[j2+1]) continue;
          var ax = scr[(j2+1)*2] - scr[(j2-1)*2], ay = scr[(j2+1)*2+1] - scr[(j2-1)*2+1];
          var len = Math.sqrt(ax*ax + ay*ay);
          if (len < 0.001) continue;
          var nx = -ay / len * tickLen, ny = ax / len * tickLen;
          ctx.moveTo(scr[j2*2] - nx, scr[j2*2+1] - ny);
          ctx.lineTo(scr[j2*2] + nx, scr[j2*2+1] + ny);
        }
      }
      ctx.stroke();
    }
  }

  var running = false, rafId = 0;
  function loop(ts){ frame(ts || 0); rafId = requestAnimationFrame(loop); }
  function start(){
    if (running) return;
    running = true;
    if (reduce) frame(8200);          // un fotogramma solo, a guscio chiuso
    else rafId = requestAnimationFrame(loop);
  }
  function stop(){ if (!running) return; running = false; cancelAnimationFrame(rafId); }

  var rt = 0;
  var onResize = function(){
    clearTimeout(rt);
    rt = setTimeout(function(){ resize(); if (reduce) frame(8200); }, 120);
  };
  window.addEventListener("resize", onResize, {passive:true});
  pulizia.push(function(){ window.removeEventListener("resize", onResize); clearTimeout(rt); });

  if (!reduce && !window.matchMedia("(max-width:700px)").matches){
    var onMove = function(e){
      var r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
    };
    var onLeave = function(){ px = 0; py = 0; };
    hero.addEventListener("pointermove", onMove, {passive:true});
    hero.addEventListener("pointerleave", onLeave, {passive:true});
    pulizia.push(function(){ hero.removeEventListener("pointermove", onMove); hero.removeEventListener("pointerleave", onLeave); });
  }

  var io = null;
  if (!reduce){
    var onVis = function(){ if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVis);
    pulizia.push(function(){ document.removeEventListener("visibilitychange", onVis); });
    // la scena si ferma quando l'hero esce di scena: niente lavoro inutile
    if (window.IntersectionObserver){
      io = new IntersectionObserver(function(es){
        if (es[0].isIntersecting) start(); else stop();
      }, { threshold: 0 });
      io.observe(hero);
      pulizia.push(function(){ io.disconnect(); });
    }
  }

  resize();
  start();
  return function(){ stop(); pulizia.forEach(function(f){ f(); }); };
}
