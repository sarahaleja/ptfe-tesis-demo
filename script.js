/* =========================================================
   script.js — Escenas 1 y 2 (fisica verificada: conduccion
   de Fourier vs. Cattaneo-Vernotte; problema de Stefan por
   capacidad calorifica aparente) y la logica de estado de
   las Escenas 3 y 4 (el detalle 3D vive en three-scenes.js).
   Cargado como script clasico; usa window.PTFE (common.js).
   ========================================================= */
(function(){
  "use strict";
  const PTFE = window.PTFE;

  /* =========================================================
     ESCENA 1 — Fourier vs Cattaneo-Vernotte, dominio fijo
     ========================================================= */
  const S1 = (function(){
    const N = 100;
    const L = 1.0;
    const alpha = 1.0;
    const dx = L/(N-1);
    const dtFrame = 0.0009;  // tiempo simulado avanzado por cuadro de animacion (u.a.)
    const tMax = 1.0;

    // Fourier: paso estable propio (limitado por dx^2), varios sub-pasos por cuadro
    const dtF = 0.9*0.5*dx*dx/alpha;
    const nsubF = Math.max(1, Math.ceil(dtFrame/dtF));
    const dtF_actual = dtFrame/nsubF;
    const rF = alpha*dtF_actual/(dx*dx);

    let tau0 = 0.15;
    let Ch = Math.sqrt(alpha/tau0);

    let x = [];
    for(let i=0;i<N;i++) x.push(i*dx);

    let T_f = new Float64Array(N); // Fourier
    let T0  = new Float64Array(N); // condicion inicial (para dibujar referencia)
    let T_c = new Float64Array(N); // CV: temperatura
    let q_c = new Float64Array(N); // CV: flujo de calor
    let Rp = new Float64Array(N), Rm = new Float64Array(N);
    let RpN = new Float64Array(N), RmN = new Float64Array(N);
    let tmpT = new Float64Array(N);

    let t = 0;
    let playing = false;
    let done = false;

    function initialPulse(arr){
      // Pulso depositado en la superficie irradiada x=0 (borde adiabatico/de simetria),
      // decayendo hacia el interior del material: T0(x) = exp(-(x/w)^2)
      const w = 0.05*L, amp = 1.0;
      for(let i=0;i<N;i++){
        const d = x[i]/w;
        arr[i] = amp*Math.exp(-d*d);
      }
    }

    function reset(){
      initialPulse(T_f);
      initialPulse(T_c);
      initialPulse(T0);
      q_c.fill(0); // reposo termico inicial: el flujo aun no ha respondido (Cattaneo-Vernotte, condicion "etapa 1")
      t = 0;
      done = false;
      yMaxShared = 1.05;
    }

    function stepFourier(){
      tmpT.set(T_f);
      for(let i=0;i<N;i++){
        const im1 = i===0 ? 1 : i-1;   // Neumann (espejo): pared adiabatica
        const ip1 = i===N-1 ? N-2 : i+1;
        tmpT[i] = T_f[i] + rF*(T_f[ip1] - 2*T_f[i] + T_f[im1]);
      }
      T_f.set(tmpT);
    }

    // Cattaneo-Vernotte resuelto como sistema hiperbolico de primer orden en variables
    // caracteristicas (invariantes de Riemann) R+ = T + q/Ch, R- = T - q/Ch, cada una
    // advectada a velocidad +-Ch mediante diferencias contra el viento (upwind) —
    // esquema monotono que preserva exactamente la velocidad finita de propagacion,
    // acoplado por separacion de Strang con la relajacion q -> q*exp(-dt/tau0).
    // (Un Lax-Wendroff clasico sobre (T,q) se probo primero y se descarto: para un
    // pulso inicial angosto introduce un precursor numerico no fisico por delante del
    // frente real — dispersión de alta frecuencia propia de esquemas centrados de
    // segundo orden — que aqui se evita por construccion.)
    function stepCV(){
      const dtC_CFL = 0.9*dx/Ch;
      const nsubC = Math.max(1, Math.ceil(dtFrame/dtC_CFL));
      const dtc = dtFrame/nsubC;
      const C = Ch*dtc/dx;
      const halfDecay = Math.exp(-dtc/(2*tau0));

      for(let s=0;s<nsubC;s++){
        for(let i=0;i<N;i++) q_c[i]*=halfDecay;
        for(let i=0;i<N;i++){ const Z=q_c[i]/Ch; Rp[i]=T_c[i]+Z; Rm[i]=T_c[i]-Z; }

        for(let i=1;i<N-1;i++){
          RpN[i] = Rp[i] - C*(Rp[i]-Rp[i-1]);
          RmN[i] = Rm[i] + C*(Rm[i+1]-Rm[i]);
        }
        // fronteras adiabaticas (q=0): la caracteristica entrante se refleja desde la saliente
        RmN[0] = Rm[0] + C*(Rm[1]-Rm[0]);
        RpN[0] = RmN[0];
        RpN[N-1] = Rp[N-1] - C*(Rp[N-1]-Rp[N-2]);
        RmN[N-1] = RpN[N-1];

        for(let i=0;i<N;i++){ T_c[i]=(RpN[i]+RmN[i])/2; q_c[i]=Ch*(RpN[i]-RmN[i])/2; }
        for(let i=0;i<N;i++) q_c[i]*=halfDecay;
      }
    }

    function advance(){
      if(!playing || done) return;
      for(let k=0;k<nsubF;k++) stepFourier();
      stepCV();
      t += dtFrame;
      if(t>=tMax){ done=true; playing=false; updatePlayButton(); }
    }

    const cvF = document.getElementById("cvFourier");
    const cvC = document.getElementById("cvHyperbolic");
    let gF, gC;
    const NAtoms = 44;
    const phasesF = PTFE.makePhases(NAtoms), phasesC = PTFE.makePhases(NAtoms);
    let clock = 0;

    function drawFrame(g, arr, color, showFront, yMax, phases, kind){
      const {ctx,w,h} = g;
      ctx.clearRect(0,0,w,h);
      const padL=32,padR=10,padT=10,padB=24;
      const latticeH = 60;
      const gap = 8;
      const plotW = w-padL-padR;
      const plotT = padT+latticeH+gap;
      const plotH = h-plotT-padB;
      const yMin = -0.03*yMax;

      // franja de red atomica
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL-4, padT-4, plotW+8, latticeH+8);
      ctx.clip();
      PTFE.drawLattice(ctx, padL, padT, plotW, latticeH, NAtoms, function(u){
        const idx = Math.min(N-1, Math.round(u*(N-1)));
        return arr[idx]/yMax;
      }, clock, phases);
      ctx.restore();
      ctx.strokeStyle = PTFE.cssVar('--border');
      ctx.lineWidth = 1;
      ctx.strokeRect(padL-4+0.5, padT-4+0.5, plotW+8-1, latticeH+8-1);
      ctx.save();
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = PTFE.cssVar('--muted-2');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('RED ATÓMICA', padL, padT-6);
      ctx.restore();

      // ejes numerados: T (u.a.) a la izquierda, x (u.a.) abajo
      PTFE.drawAxes(ctx, padL, plotT, plotW, plotH, yMin, yMax, [0,0.25,0.5,0.75,1.0], [0, yMax*0.5, yMax]);
      ctx.save();
      ctx.font = "9.5px 'IBM Plex Mono', monospace";
      ctx.fillStyle = PTFE.cssVar('--muted-2');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('T (u.a.)', padL+2, plotT-9);
      ctx.textAlign = 'right';
      ctx.fillText('x (u.a.)', padL+plotW, plotT+plotH+13);
      ctx.restore();

      // baseline inicial tenue
      ctx.beginPath();
      for(let i=0;i<N;i++){
        const px = padL + (x[i]/L)*plotW;
        const py = plotT + (1-(T0[i]-yMin)/(yMax-yMin))*plotH;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.strokeStyle = PTFE.cssVar('--muted');
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // curva actual
      ctx.beginPath();
      for(let i=0;i<N;i++){
        const px = padL + (x[i]/L)*plotW;
        const py = plotT + (1-(arr[i]-yMin)/(yMax-yMin))*plotH;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // relleno suave bajo la curva
      ctx.lineTo(padL+plotW, plotT+plotH);
      ctx.lineTo(padL, plotT+plotH);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;

      // frente de onda (CV) — atraviesa tanto la red como la curva
      let xfPix = null;
      if(showFront){
        const xf = Ch*t;
        if(xf>0 && xf<L){
          const px = padL + (xf/L)*plotW;
          xfPix = px;
          ctx.beginPath();
          ctx.setLineDash([5,4]);
          ctx.moveTo(px, padT-4);
          ctx.lineTo(px, plotT+plotH);
          ctx.strokeStyle = PTFE.cssVar('--red');
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // eje base
      ctx.beginPath();
      ctx.moveTo(padL, plotT+plotH+0.5);
      ctx.lineTo(padL+plotW, plotT+plotH+0.5);
      ctx.strokeStyle = PTFE.cssVar('--border');
      ctx.lineWidth = 1;
      ctx.stroke();

      // callouts de diagnostico, estilo banco de pruebas
      const midY = plotT + plotH*0.42;
      if(kind==='cv' && xfPix!==null){
        PTFE.drawLeaderLabel(ctx, xfPix, plotT+6, Math.min(padL+plotW-4, xfPix+34), plotT-2, 'FRENTE x=Cₕ·t', PTFE.cssVar('--red'), 'left');
        if(xfPix < padL+plotW-14){
          const ax = Math.min(padL+plotW-6, xfPix + (padL+plotW-xfPix)*0.55);
          PTFE.drawLeaderLabel(ctx, ax, midY, Math.max(padL+18, ax-28), midY+30, 'RED EN REPOSO\n(sin perturbar)', PTFE.cssVar('--muted'), 'right');
        }
      } else if(kind==='fourier'){
        const ax = padL + plotW*0.90;
        PTFE.drawLeaderLabel(ctx, ax, padT+latticeH*0.5, ax-30, padT+latticeH+22, 'PERTURBACIÓN\nYA PRESENTE', PTFE.cssVar('--blue'), 'right');
      }
    }

    let yMaxShared = 1.05;
    function render(){
      clock += 1/60;
      // eje vertical compartido, adaptado suavemente al pico actual (misma escala en ambos
      // paneles para que la comparacion de amplitudes siga siendo honesta)
      let peak = 0.08;
      for(let i=0;i<N;i++){ peak = Math.max(peak, T_f[i], T_c[i]); }
      const target = Math.min(1.05, Math.max(0.12, peak*1.35));
      yMaxShared += (target-yMaxShared)*0.10;

      drawFrame(gF, T_f, PTFE.cssVar('--blue'), false, yMaxShared, phasesF, 'fourier');
      drawFrame(gC, T_c, PTFE.cssVar('--red'), true, yMaxShared, phasesC, 'cv');
      document.getElementById('s1-t').innerHTML = t.toFixed(3)+'<span class="stat-unit">u.a.</span>';
    }

    function loop(){
      advance();
      render();
      requestAnimationFrame(loop);
    }

    const playBtn = document.getElementById('s1-play');
    function updatePlayButton(){
      playBtn.textContent = playing ? "Pausar" : "Reproducir";
    }

    function resizeAll(){
      gF = PTFE.setupCanvas(cvF);
      gC = PTFE.setupCanvas(cvC);
      render();
    }

    playBtn.addEventListener('click', function(){
      if(done){ reset(); }
      playing = !playing;
      updatePlayButton();
    });
    document.getElementById('s1-reset').addEventListener('click', function(){
      reset(); playing=false; updatePlayButton(); render();
    });
    const tauSlider = document.getElementById('s1-tau');
    tauSlider.addEventListener('input', function(){
      tau0 = parseFloat(tauSlider.value);
      Ch = Math.sqrt(alpha/tau0);
      document.getElementById('s1-tauval').innerHTML = tau0.toFixed(3)+'<span class="stat-unit">u.a.</span>';
      document.getElementById('s1-ch').innerHTML = Ch.toFixed(3)+'<span class="stat-unit">u.a.</span>';
      reset(); playing=false; updatePlayButton(); render();
    });

    reset();
    document.getElementById('s1-ch').innerHTML = Ch.toFixed(3)+'<span class="stat-unit">u.a.</span>';
    window.addEventListener('resize', resizeAll);

    return { start: function(){ resizeAll(); loop(); } };
  })();


  /* =========================================================
     ESCENA 2 — Stefan esquematico: fusion + retroceso por ablacion
     Metodo de capacidad calorifica aparente (Voller & Swaminathan, 1991)
     ========================================================= */
  const S2 = (function(){
    const N = 130;
    const L = 1.0;
    const dx = L/(N-1);
    const alpha0 = 1.0;       // difusividad base (u.a.)
    const rho = 1.0;
    const cpBase = 1.0;
    const Tmelt = 1.0;
    const dTwindow = 0.10;
    const Lfusion = 1.6;      // calor latente de fusion (u.a.)
    const Tvap = 2.3;         // umbral de vaporizacion superficial (u.a.)
    const Tambient = 0.0;
    const dt = 0.9 * 0.5*dx*dx/alpha0;
    const substepsPerFrame = 18;
    const tMax = 30;

    let flux = 6.0;
    let T = new Float64Array(N);
    let phase = new Uint8Array(N); // 0 solido, 1 fundido, 2 ablacionado
    let sIdx = 0;      // primera celda activa (superficie actual)
    let t = 0;
    let playing = false;
    let done = false;

    function reset(){
      T.fill(Tambient);
      phase.fill(0);
      sIdx = 0;
      t = 0;
      done = false;
    }

    function cpEff(Ti){
      return (Math.abs(Ti-Tmelt) < dTwindow/2) ? (cpBase + Lfusion/dTwindow) : cpBase;
    }

    let tmp = new Float64Array(N);
    function step(){
      tmp.set(T);
      for(let i=sIdx;i<N;i++){
        const im1 = i===sIdx ? sIdx : i-1;   // adiabatico en la nueva superficie
        const ip1 = i===N-1 ? N-1 : i+1;      // adiabatico en el fondo
        const lap = T[ip1]-2*T[i]+T[im1];
        const cpi = cpEff(T[i]);
        let dT = (alpha0/cpi) * lap/(dx*dx) * dt;
        if(i===sIdx){
          dT += (flux/(rho*cpi*dx)) * dt; // fuente superficial del pulso laser
        }
        tmp[i] = T[i] + dT;
      }
      T.set(tmp);

      // actualizar fases: fundido si T>=Tmelt
      for(let i=sIdx;i<N;i++){
        if(phase[i]!==2){
          phase[i] = (T[i] >= Tmelt) ? 1 : 0;
        }
      }

      // ablacion: si la celda superficial supera Tvap, se retira
      while(sIdx<N-2 && T[sIdx] >= Tvap){
        phase[sIdx] = 2;
        sIdx += 1;
        // la nueva superficie hereda temperatura residual (energia de vaporizacion se lleva el exceso)
        T[sIdx] = Math.min(T[sIdx], Tmelt*0.35);
      }
    }

    function advance(){
      if(!playing || done) return;
      for(let k=0;k<substepsPerFrame;k++){
        step();
        t += dt;
        if(t>=tMax || sIdx>=N-3){ done=true; playing=false; updatePlayButton(); break; }
      }
    }

    const cv = document.getElementById('cvStefan');
    let g;
    const NAtoms2 = 70;
    const phases2 = PTFE.makePhases(NAtoms2);
    const ablatePhaseOffset = new Float64Array(NAtoms2); // para animar la deriva de fragmentos expulsados
    let clock2 = 0;

    function thetaIndex(){
      // primer indice desde la superficie donde ya no esta fundido (frontera de fusion)
      for(let i=sIdx;i<N;i++){ if(phase[i]===0) return i; }
      return N-1;
    }

    function render(){
      clock2 += 1/60;
      const {ctx,w,h} = g;
      ctx.clearRect(0,0,w,h);
      const padL=34, padR=12, padT=14, padB=30;
      const plotW=w-padL-padR, plotH=h-padT-padB;
      const bandH = plotH*0.52;
      const bandY = padT;

      ctx.strokeStyle = PTFE.cssVar('--border');
      ctx.lineWidth = 1;
      ctx.strokeRect(padL+0.5, bandY+0.5, plotW-1, bandH-1);
      ctx.save();
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = PTFE.cssVar('--muted-2');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('CORTE TRANSVERSAL — RED CRISTALINA', padL, bandY-4);
      ctx.restore();

      // red cristalina: un sitio por muestra a lo largo de la profundidad
      const th = thetaIndex();
      for(let a=0;a<NAtoms2;a++){
        const u = a/(NAtoms2-1);
        const i = Math.min(N-1, Math.round(u*(N-1)));
        const px0 = padL + u*plotW;
        const ph = phases2[a];
        let color, amp, alphaMul=1, driftX=0, driftY=0;

        if(phase[i]===2){
          // ablacionado: fragmento se aleja y se desvanece con el tiempo transcurrido desde s(t) lo paso
          const since = Math.max(0, (sIdx-i)/N*L) / (Ch2Speed());
          const life = Math.min(1, since*0.6);
          color = PTFE.thermalColor(0.78);
          amp = 3;
          alphaMul = Math.max(0, 0.5 - life*0.5);
          driftX = -life*18 - Math.sin(clock2*1.2+ph)*2;
          driftY = -life*26 + Math.sin(clock2*2.3+ph)*3;
        } else if(phase[i]===1){
          color = PTFE.thermalColor(0.55 + 0.25*Math.min(1,(T[i]-Tmelt)/(Tvap-Tmelt)));
          amp = 7 + 4*Math.sin(clock2*3+ph)*0 + 7*Math.min(1, (T[i]-Tmelt)/(Tvap-Tmelt+0.001));
          amp = Math.min(11, 5 + 6*Math.sqrt(Math.max(0,(T[i])/Tvap)));
        } else {
          color = PTFE.thermalColor(0.10 + 0.10*Math.min(1, T[i]/Tmelt));
          amp = 0.6 + 1.1*Math.sqrt(Math.max(0, T[i]/Tmelt));
        }

        const jx = Math.sin(clock2*(phase[i]===1?2.6:1.4)+ph)*amp*0.5 + driftX;
        const jy = Math.cos(clock2*(phase[i]===1?3.1:1.7)+ph*1.6)*amp*0.5 + driftY;
        const py = bandY + bandH*0.5 + jy*0.6;
        const r = phase[i]===2 ? 1.6 : (1.7 + 1.4*Math.sqrt(amp));

        ctx.save();
        ctx.globalAlpha = alphaMul;
        ctx.shadowColor = color;
        ctx.shadowBlur = phase[i]===0 ? 2 : 8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px0+jx, py, r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      function Ch2Speed(){ return 0.03; }

      // marcador de superficie actual s(t)
      const xs = padL + (sIdx/N)*plotW;
      ctx.beginPath();
      ctx.moveTo(xs, bandY-4);
      ctx.lineTo(xs, bandY+bandH+4);
      ctx.strokeStyle = PTFE.cssVar('--red');
      ctx.lineWidth = 2;
      ctx.stroke();

      // marcador de frente de fusion theta(t)
      const xt = padL + (th/N)*plotW;
      ctx.beginPath();
      ctx.moveTo(xt, bandY-4);
      ctx.lineTo(xt, bandY+bandH+4);
      ctx.strokeStyle = PTFE.cssVar('--blue');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4,3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // callouts diagnosticos para los dos frentes moviles
      PTFE.drawLeaderLabel(ctx, xs, bandY-4, Math.min(padL+plotW-6, xs+26), bandY-16, 'SUPERFICIE s(t)', PTFE.cssVar('--red'), 'left');
      if(Math.abs(xt-xs) > 14){
        PTFE.drawLeaderLabel(ctx, xt, bandY+bandH+4, Math.max(padL+16, xt-26), bandY+bandH+18, 'FRENTE θ(t)\n(fusión)', PTFE.cssVar('--blue'), 'right');
      }

      // etiquetas de fase, centradas en cada region si hay espacio suficiente
      ctx.save();
      ctx.font = "600 9.5px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midBandY = bandY+bandH*0.5;
      if(sIdx>0 && xs-padL > 46){
        ctx.fillStyle = PTFE.cssVar('--red');
        ctx.fillText('ABLACIONADO', padL+(xs-padL)/2, midBandY);
      }
      if(xt-xs > 46){
        ctx.fillStyle = PTFE.cssVar('--blue');
        ctx.fillText('FUNDIDO', xs+(xt-xs)/2, midBandY);
      }
      if((padL+plotW)-xt > 46){
        ctx.fillStyle = PTFE.cssVar('--muted');
        ctx.fillText('SÓLIDO', xt+((padL+plotW)-xt)/2, midBandY);
      }
      ctx.restore();

      // curva de temperatura debajo, con eje T numerado y umbrales de fase marcados
      const tPlotY0 = bandY+bandH+22;
      const tPlotH = plotH-bandH-22;
      const yMax = Tvap*1.22, yMin = 0;
      PTFE.drawAxes(ctx, padL, tPlotY0, plotW, tPlotH, yMin, yMax, [0,0.25,0.5,0.75,1.0], [0, Tmelt, Tvap]);
      ctx.save();
      ctx.font = "9.5px 'IBM Plex Mono', monospace";
      ctx.fillStyle = PTFE.cssVar('--muted-2');
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('profundidad x (u.a.) →', padL+plotW, tPlotY0+tPlotH+13);
      ctx.restore();

      // lineas de referencia T_fusion y T_vap
      [[Tmelt,'T_fusión',PTFE.cssVar('--blue')],[Tvap,'T_vap',PTFE.cssVar('--red')]].forEach(function(ref){
        const py = tPlotY0 + (1-(ref[0]-yMin)/(yMax-yMin))*tPlotH;
        ctx.save();
        ctx.strokeStyle = ref[2];
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([2,3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL+plotW, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = ref[2];
        ctx.font = "9px 'IBM Plex Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ref[1], padL+4, py-2);
        ctx.restore();
      });

      ctx.beginPath();
      let started=false;
      for(let i=sIdx;i<N;i++){
        const px = padL + (i/N)*plotW;
        const py = tPlotY0 + (1-(T[i]-yMin)/(yMax-yMin))*tPlotH;
        if(!started){ ctx.moveTo(px,py); started=true; } else ctx.lineTo(px,py);
      }
      ctx.strokeStyle = PTFE.cssVar('--ink');
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      document.getElementById('s2-t').innerHTML = t.toFixed(2)+'<span class="stat-unit">u.a.</span>';
      document.getElementById('s2-s').innerHTML = (sIdx/N*L).toFixed(3)+'<span class="stat-unit">u.a.</span>';
      document.getElementById('s2-theta').innerHTML = (th/N*L).toFixed(3)+'<span class="stat-unit">u.a.</span>';
    }

    function loop(){
      advance();
      render();
      requestAnimationFrame(loop);
    }

    const playBtn = document.getElementById('s2-play');
    function updatePlayButton(){
      playBtn.textContent = playing ? "Pausar" : "Reproducir";
    }

    function resizeAll(){ g = PTFE.setupCanvas(cv); render(); }

    playBtn.addEventListener('click', function(){
      if(done){ reset(); }
      playing = !playing;
      updatePlayButton();
    });
    document.getElementById('s2-reset').addEventListener('click', function(){
      reset(); playing=false; updatePlayButton(); render();
    });
    const fluxSlider = document.getElementById('s2-flux');
    const fluxVal = document.getElementById('s2-fluxval');
    fluxSlider.addEventListener('input', function(){
      flux = parseFloat(fluxSlider.value);
      fluxVal.innerHTML = flux.toFixed(1)+'<span class="stat-unit">u.a.</span>';
      reset(); playing=false; updatePlayButton(); render();
    });

    reset();
    fluxVal.innerHTML = flux.toFixed(1)+'<span class="stat-unit">u.a.</span>';
    window.addEventListener('resize', resizeAll);
    return { start: function(){ resizeAll(); loop(); } };
  })();


  /* =========================================================
     ESCENA 3 — Ciencia de materiales: conformacion helicoidal
     y su efecto en E(T); soporte del anclaje estructural de tau0.
     Explorable por temperatura (sin integracion temporal de EDP).
     La cadena helicoidal y el empaquetamiento hexagonal se
     renderizan en 3D real (three-scenes.js); este modulo solo
     calcula el estado fisico (fase, conformacion, giro) y lo
     empuja hacia esas escenas via window.PTFE3D.
     ========================================================= */
  const S3 = (function(){
    const cvM = document.getElementById('cvModulus');
    let gM;
    const tempSlider = document.getElementById('s3-temp');
    let Tc = 25; // temperatura, grados C

    function phaseOf(Tval){
      if(Tval < 19) return 'II';
      if(Tval < 30) return 'IV';
      return 'I';
    }
    // Razones u/t (atomos por vuelta) de Clark (1999): Forma II = 13/6, Forma IV = 15/7.
    // Para T>30 grados C no hay razon u/t reportada en la literatura revisada: se deja
    // sin cambio geometrico adicional respecto a Forma IV, para no inventar un dato.
    function confOf(phase){
      if(phase==='II') return { label:'13/6 · hélice no conmensurable', short:'13/6 · no conmensurable', dens: 6/13, color: PTFE.cssVar('--blue') };
      if(phase==='IV') return { label:'15/7 · P3₁ (conmensurable)', short:'15/7 · P3₁', dens: 7/15, color: PTFE.cssVar('--red') };
      return { label:'destorcimiento adicional (T>30°C) · sin razón u/t reportada', short:'destorcimiento adicional (ver nota)', dens: 7/15, color: PTFE.cssVar('--muted') };
    }

    // E(T) esquematico: (-50,3.0), (25,1.0) y (150,0.1) son los tres puntos medidos por
    // Rae & Brown (2005); (14,2.4) y (17,2.6) son interpolacion cualitativa para mostrar
    // el maximo local que reportan cerca de la transicion II->IV (sin magnitud publicada
    // en ese punto exacto). La curva entre puntos es ilustrativa, no una funcion medida.
    const E_POINTS = [[-50,3.0],[14,2.4],[17,2.6],[25,1.0],[150,0.1]];
    function E_of(Tval){
      Tval = Math.max(-50, Math.min(150, Tval));
      for(let i=0;i<E_POINTS.length-1;i++){
        const a=E_POINTS[i], b=E_POINTS[i+1];
        if(Tval>=a[0] && Tval<=b[0]){
          const f=(b[0]-a[0])>0 ? (Tval-a[0])/(b[0]-a[0]) : 0;
          return a[1]+f*(b[1]-a[1]);
        }
      }
      return E_POINTS[E_POINTS.length-1][1];
    }

    // Empuja el estado fisico actual (fase, conformacion, giro exagerado ~30x
    // declarado en la nota de la escena) hacia las escenas 3D de la cadena
    // helicoidal y del empaquetamiento hexagonal. No dibuja nada aqui: three-scenes.js
    // posee su propio bucle de render (rotacion, damping de OrbitControls, etc.).
    function push3D(){
      if(!window.PTFE3D) return;
      const phase = phaseOf(Tc);
      const conf = confOf(phase);
      const baseTurns = 5.0;
      const densII = 6/13;
      const amplify = 30; // exageracion visual declarada — el cambio real en dens es ~1%
      const turns = baseTurns*(1 + amplify*(conf.dens/densII - 1));
      const state = { phase: phase, label: conf.label, colorHex: conf.color, turns: turns };
      if(window.PTFE3D.helix) window.PTFE3D.helix.setState(state);
      if(window.PTFE3D.packing) window.PTFE3D.packing.setState(state);
    }

    function renderModulus(){
      const {ctx,w,h} = gM;
      ctx.clearRect(0,0,w,h);
      const padL=30,padR=10,padT=16,padB=26;
      const plotW=w-padL-padR, plotH=h-padT-padB;
      const xMin=-50,xMax=150,yMin=0,yMax=3.3;
      function X(Tval){ return padL+(Tval-xMin)/(xMax-xMin)*plotW; }
      function Y(Eval){ return padT+(1-(Eval-yMin)/(yMax-yMin))*plotH; }

      ctx.save();
      ctx.strokeStyle = PTFE.cssVar('--border-bright');
      ctx.fillStyle = PTFE.cssVar('--muted-2');
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL+0.5,padT); ctx.lineTo(padL+0.5,padT+plotH); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      [0,1,2,3].forEach(function(v){
        const py=Y(v);
        ctx.beginPath(); ctx.moveTo(padL-3,py); ctx.lineTo(padL,py); ctx.stroke();
        ctx.fillText(v.toFixed(0), padL-6, py);
      });
      ctx.beginPath(); ctx.moveTo(padL,padT+plotH+0.5); ctx.lineTo(padL+plotW,padT+plotH+0.5); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      [-50,0,50,100,150].forEach(function(v){
        const px=X(v);
        ctx.beginPath(); ctx.moveTo(px,padT+plotH); ctx.lineTo(px,padT+plotH+3); ctx.stroke();
        ctx.fillText(v.toString(), px, padT+plotH+5);
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('E (GPa)', padL+2, padT-4);
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('T (°C)', padL+plotW, padT+plotH+15);
      ctx.restore();

      [19,30].forEach(function(v){
        const px = X(v);
        ctx.save();
        ctx.strokeStyle = PTFE.cssVar('--muted');
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([2,3]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px,padT); ctx.lineTo(px,padT+plotH); ctx.stroke();
        ctx.restore();
      });

      ctx.beginPath();
      for(let Tval=xMin; Tval<=xMax; Tval+=2){
        const px=X(Tval), py=Y(E_of(Tval));
        if(Tval===xMin) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.strokeStyle = PTFE.cssVar('--blue');
      ctx.lineWidth = 2;
      ctx.shadowColor = PTFE.cssVar('--blue');
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = PTFE.cssVar('--ink');
      [[-50,3.0],[25,1.0],[150,0.1]].forEach(function(p){
        ctx.beginPath();
        ctx.arc(X(p[0]), Y(p[1]), 2.6, 0, Math.PI*2);
        ctx.fill();
      });

      const px = X(Tc), py = Y(E_of(Tc));
      ctx.save();
      ctx.strokeStyle = PTFE.cssVar('--red');
      ctx.setLineDash([3,3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px,padT); ctx.lineTo(px,padT+plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PTFE.cssVar('--red');
      ctx.shadowColor = PTFE.cssVar('--red');
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function render(){
      renderModulus();
    }

    function update(){
      Tc = parseFloat(tempSlider.value);
      const phase = phaseOf(Tc);
      const conf = confOf(phase);
      document.getElementById('s3-t').innerHTML = Tc.toFixed(0)+'<span class="stat-unit">°C</span>';
      document.getElementById('s3-phase').textContent = 'Fase '+phase;
      document.getElementById('s3-conf').textContent = conf.short;
      document.getElementById('s3-E').innerHTML = E_of(Tc).toFixed(2)+'<span class="stat-unit">GPa</span>';
      push3D();
    }

    function loop(){
      render();
      requestAnimationFrame(loop);
    }

    function resizeAll(){
      gM = PTFE.setupCanvas(cvM);
      if(window.PTFE3D){
        if(window.PTFE3D.helix) window.PTFE3D.helix.resize();
        if(window.PTFE3D.packing) window.PTFE3D.packing.resize();
      }
    }

    tempSlider.addEventListener('input', update);
    window.addEventListener('resize', function(){ resizeAll(); render(); });
    // Los modulos 3D (three-scenes.js) cargan como <script type="module">, siempre
    // despues de este script clasico: cuando avisan que ya existen, se reenvia el
    // estado fisico actual para que la escena no arranque con los valores por defecto.
    window.addEventListener('ptfe3d-ready', function(){ push3D(); resizeAll(); });

    return { start: function(){ resizeAll(); update(); loop(); } };
  })();

  /* =========================================================
     ESCENA 4 — Acoplamiento superficie-plasma: transporte
     diferencial de especies y flujo de retorno (returned atom
     flux). Diagrama decorativo/ilustrativo, sin EDP resuelta;
     los numeros de composicion mostrados en el panel derecho y
     en el stat-row si son datos medidos (Jakubczak et al., 2024).
     El diagrama de trayectorias (capa de no equilibrio) es una
     escena 3D real, manejada por three-scenes.js; aqui solo
     queda el grafico de composicion (2D).
     ========================================================= */
  const S4 = (function(){
    const cvC = document.getElementById('cvComposition');
    let gC2;
    const tauMirror = document.getElementById('s4-tau-mirror');
    let lastTauText = '';

    // Vinculo conceptual (no numerico): refleja el mismo tau0 que se ajusta
    // en la Escena 1 dentro del recuadro "Bloques 1-3" del pipeline de esta
    // escena, para dejar visualmente claro que es la misma variable, no una
    // nueva. No calcula ningun valor de empuje a partir de ella.
    function mirrorTau(){
      if(!tauMirror) return;
      const src = document.getElementById('s1-tauval');
      if(!src) return;
      const text = src.innerHTML;
      if(text !== lastTauText){
        lastTauText = text;
        tauMirror.innerHTML = 'τ₀ = '+text;
      }
    }

    function renderComposition(){
      const {ctx,w,h} = gC2;
      ctx.clearRect(0,0,w,h);
      const padL=8,padR=14,padT=22,padB=44;
      const plotW=w-padL-padR, plotH=h-padT-padB;
      const bars = [
        { label:'F (todos los estados)', frac:0.94, color: PTFE.cssVar('--blue'), tag:'F₂⁺ >40%' },
        { label:'C (trazas)', frac:0.09, color: PTFE.cssVar('--red'), tag:'trazas' }
      ];
      const bh = plotH/bars.length*0.46;
      bars.forEach(function(b,i){
        const cy = padT + plotH*(i+0.5)/bars.length;
        ctx.fillStyle = PTFE.cssVar('--border');
        ctx.fillRect(padL, cy-bh/2, plotW*0.62, bh);
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = b.color;
        ctx.fillRect(padL, cy-bh/2, plotW*0.62*b.frac, bh);
        ctx.restore();
        ctx.fillStyle = PTFE.cssVar('--muted-2');
        ctx.font = "9px 'IBM Plex Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.label, padL, cy-bh/2-3);
        ctx.fillStyle = PTFE.cssVar('--ink');
        ctx.textBaseline = 'middle';
        ctx.fillText(b.tag, padL+plotW*0.62+6, cy);
      });
      ctx.save();
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = PTFE.cssVar('--muted');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      wrapText(ctx, 'tiempo de residencia en el canal: mayor para C (Jakubczak et al., 2024)', padL, padT+plotH+8, plotW+padR-2, 11);
      ctx.restore();
    }

    function wrapText(ctx, text, x, y, maxW, lineH){
      const words = text.split(' ');
      let line = '';
      let yy = y;
      for(let i=0;i<words.length;i++){
        const test = line + words[i] + ' ';
        if(ctx.measureText(test).width > maxW && line !== ''){
          ctx.fillText(line, x, yy);
          line = words[i] + ' ';
          yy += lineH;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, x, yy);
    }

    function render(){
      renderComposition();
      mirrorTau();
    }

    function loop(){
      render();
      requestAnimationFrame(loop);
    }

    function resizeAll(){
      gC2 = PTFE.setupCanvas(cvC);
      if(window.PTFE3D && window.PTFE3D.engine) window.PTFE3D.engine.resize();
    }

    window.addEventListener('resize', function(){ resizeAll(); render(); });

    return { start: function(){ resizeAll(); loop(); } };
  })();

  S1.start();
  S2.start();
  S3.start();
  S4.start();
})();
