/* =========================================================
   common.js — utilidades compartidas por las cuatro escenas
   (lectura de tokens CSS, mapa termico, dibujo de ejes y
   callouts tipo "diagnostico de banco de pruebas").
   Cargado como script clasico; expone window.PTFE.
   ========================================================= */
(function(){
  "use strict";

  function cssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function setupCanvas(canvas){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.width ? canvas.height * (cssW/canvas.width) : canvas.height;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return { ctx, w: cssW, h: cssH };
  }

  // Mapa termico: negro-azul (frio) -> azul institucional -> purpura -> rojo institucional -> ambar (caliente).
  // Construido sobre la paleta de Unicauca (azul profundo, azul claro, rojo) con un puente
  // purpura y un tope ambar, necesarios para que el ojo perciba el rango completo de energia.
  const THERMAL_STOPS = [
    [0.00,   6,  9, 20],
    [0.16,   0, 18,130],
    [0.42,  61,140,255],
    [0.62, 150, 70,215],
    [0.82, 255, 92, 92],
    [1.00, 255,205,120]
  ];
  function thermalColor(v){
    v = v<0?0:(v>1?1:v);
    for(let i=0;i<THERMAL_STOPS.length-1;i++){
      const a = THERMAL_STOPS[i], b = THERMAL_STOPS[i+1];
      if(v>=a[0] && v<=b[0]){
        const f = (b[0]-a[0])>0 ? (v-a[0])/(b[0]-a[0]) : 0;
        const r = Math.round(a[1]+f*(b[1]-a[1]));
        const g = Math.round(a[2]+f*(b[2]-a[2]));
        const bch = Math.round(a[3]+f*(b[3]-a[3]));
        return "rgb("+r+","+g+","+bch+")";
      }
    }
    return "rgb(255,205,120)";
  }

  // Dibuja una fila de sitios de red atomica: color = energia local (mapa termico),
  // agitacion (jitter) con amplitud ~ sqrt(energia) (equiparticion clasica: <x^2> ~ kT),
  // sobre una franja horizontal del canvas. `sample(u)` devuelve v en [0,1] para u en [0,1].
  function drawLattice(ctx, x0, y0, w, bandH, Natoms, sample, clock, phases){
    const cy = y0 + bandH/2;
    for(let a=0;a<Natoms;a++){
      const u = Natoms>1 ? a/(Natoms-1) : 0;
      const v = sample(u);
      const amp = Math.min(bandH*0.34, bandH*0.10 + bandH*0.30*Math.sqrt(Math.max(v,0)));
      const ph = phases[a];
      const jx = Math.sin(clock*1.7+ph)*amp*0.35;
      const jy = Math.cos(clock*2.1+ph*1.6)*amp*0.55;
      const px = x0 + u*w + jx;
      const py = cy + jy;
      const r = 1.6 + 2.6*Math.sqrt(Math.max(v,0));
      const color = thermalColor(v);
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 3 + 10*v;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
  function makePhases(n){
    const arr = new Float64Array(n);
    for(let i=0;i<n;i++) arr[i] = Math.random()*Math.PI*2;
    return arr;
  }

  // Callout tipo "diagnostico de banco de pruebas": marcador en el punto de interes +
  // linea guia en codo + etiqueta monoespaciada. Mismo lenguaje visual en Escena 1 y 2.
  function drawLeaderLabel(ctx, x0, y0, x1, y1, text, color, align){
    align = align || 'left';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x0, y0, 2.4, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = "600 9.5px 'IBM Plex Mono', monospace";
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const tx = align==='left' ? x1+5 : x1-5;
    const lines = String(text).split('\n');
    const lineH = 11;
    const yStart = y1 - (lines.length-1)*lineH*0.5;
    lines.forEach(function(ln, i){ ctx.fillText(ln, tx, yStart+i*lineH); });
    ctx.restore();
  }

  // Ejes numerados: linea vertical con marcas de T (izquierda) y linea horizontal con
  // marcas de x (abajo), en las unidades normalizadas u.a. usadas en toda la pagina.
  function drawAxes(ctx, padL, plotT, plotW, plotH, yMin, yMax, xTicks, yTicks){
    ctx.save();
    ctx.strokeStyle = cssVar('--border-bright');
    ctx.fillStyle = cssVar('--muted-2');
    ctx.font = "9.5px 'IBM Plex Mono', monospace";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(padL+0.5, plotT);
    ctx.lineTo(padL+0.5, plotT+plotH);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach(function(tv){
      const py = plotT + (1-(tv-yMin)/(yMax-yMin))*plotH;
      ctx.beginPath();
      ctx.moveTo(padL-3, py);
      ctx.lineTo(padL, py);
      ctx.stroke();
      ctx.fillText(tv.toFixed(2), padL-6, py);
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    xTicks.forEach(function(xv){
      const px = padL + xv*plotW;
      ctx.beginPath();
      ctx.moveTo(px, plotT+plotH);
      ctx.lineTo(px, plotT+plotH+3);
      ctx.stroke();
      ctx.fillText(xv.toFixed(2), px, plotT+plotH+5);
    });
    ctx.restore();
  }

  window.PTFE = {
    cssVar, setupCanvas, THERMAL_STOPS, thermalColor,
    drawLattice, makePhases, drawLeaderLabel, drawAxes
  };
})();
