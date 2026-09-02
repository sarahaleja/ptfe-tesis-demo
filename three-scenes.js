/* =========================================================
   three-scenes.js — figuras 3D reales (Three.js + OrbitControls)
   para la Escena 3 (cadena helicoidal, empaquetamiento hexagonal)
   y la Escena 4 (motor hibrido laser+arco: laser, PTFE, tubo
   ceramico, catodo/anodo y el chorro de plasma acelerado).

   Cargado como <script type="module">. Expone window.PTFE3D y
   dispara el evento 'ptfe3d-ready' una vez que las tres escenas
   existen; script.js (clasico) las alimenta con el estado fisico
   (fase cristalina, conformacion, giro) calculado en la Escena 3.

   Todas las geometrias son esquematicas / a escala cualitativa,
   igual que sus antecesoras en canvas 2D — ver las notas de cada
   escena en index.html para el alcance declarado de cada dibujo.
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function(){
  "use strict";

  function cssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function markReady(container){
    const ph = container.querySelector('.gl-loading');
    if(ph) ph.remove();
  }

  // Capa de etiquetas HTML ancladas a puntos 3D (proyeccion pantalla), estilo
  // "callout de banco de pruebas" — mismo lenguaje visual que drawLeaderLabel()
  // en los paneles 2D, pero siguiendo la rotacion de la camara en vivo.
  function makeLabelLayer(container){
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    container.appendChild(layer);
    return layer;
  }
  function addLabel(layer, text){
    const el = document.createElement('div');
    el.className = 'gl-label';
    el.textContent = text;
    layer.appendChild(el);
    return el;
  }
  function projectLabel(el, worldPos, camera, container){
    const v = worldPos.clone().project(camera);
    if(v.z > 1 || v.z < -1){ el.style.opacity = '0'; return; }
    const w = container.clientWidth, h = container.clientHeight;
    const x = (v.x*0.5+0.5)*w, y = (1-(v.y*0.5+0.5))*h;
    if(x < -30 || x > w+30 || y < -20 || y > h+20){ el.style.opacity = '0'; return; }
    el.style.opacity = '1';
    el.style.left = x+'px';
    el.style.top = y+'px';
  }

  function baseSetup(container, opts){
    opts = opts || {};
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov || 40, 1, 0.1, 100);
    camera.position.copy(opts.camPos || new THREE.Vector3(0, 3, 8));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.copy(opts.target || new THREE.Vector3(0, 0, 0));
    controls.minDistance = opts.minDist || 3;
    controls.maxDistance = opts.maxDist || 24;
    controls.autoRotate = !!opts.autoRotate;
    controls.autoRotateSpeed = 0.6;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3d8cff, 0.55);
    rim.position.set(-5, -3, -4);
    scene.add(rim);

    function fit(){
      const w = container.clientWidth, h = container.clientHeight;
      if(w <= 0 || h <= 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    fit();
    window.addEventListener('resize', fit);

    return { scene, camera, renderer, controls, fit };
  }

  // ---------------------------------------------------------------
  // Cadena helicoidal (Escena 3, panel izquierdo). Analogo 3D de la
  // vista "corte lateral": el eje de la cadena es el eje X; el radio
  // de la helice (R) y el numero de vueltas (turns) llegan desde
  // script.js via setState(), derivados de la razon u/t de Clark (1999)
  // con la misma exageracion visual (~30x) declarada en la nota de la
  // escena. Los satelites tenues representan la vaina de fluor.
  // ---------------------------------------------------------------
  function createHelix(container){
    const b = baseSetup(container, {
      fov: 36, camPos: new THREE.Vector3(0.6, 3.4, 9.2), minDist: 5, maxDist: 18
    });

    const group = new THREE.Group();
    b.scene.add(group);

    const N = 56, L = 8.6, R = 0.95, rSat = 0.46;

    const carbonGeo = new THREE.SphereGeometry(0.115, 20, 16);
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x3d8cff, roughness: 0.35, metalness: 0.12, emissive: 0x0c1e44, emissiveIntensity: 0.6 });
    const carbons = new THREE.InstancedMesh(carbonGeo, carbonMat, N);
    group.add(carbons);

    const satGeo = new THREE.SphereGeometry(0.05, 10, 8);
    const satMat = new THREE.MeshStandardMaterial({ color: 0x96b4ff, transparent: true, opacity: 0.55, roughness: 0.6 });
    const satA = new THREE.InstancedMesh(satGeo, satMat, N);
    const satB = new THREE.InstancedMesh(satGeo, satMat, N);
    group.add(satA, satB);

    const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-L/2,0,0), new THREE.Vector3(L/2,0,0)]);
    const axisMat = new THREE.LineDashedMaterial({ color: 0x2c3868, dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.75 });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.computeLineDistances();
    group.add(axisLine);

    const dummy = new THREE.Object3D();
    let turns = 5.0, clock = 0;

    function setState(state){
      turns = state.turns;
      carbonMat.color.set(state.colorHex);
      carbonMat.emissive.set(state.colorHex);
      carbonMat.emissiveIntensity = 0.45;
    }

    function rebuild(){
      for(let i=0;i<N;i++){
        const u = i/(N-1);
        const x = -L/2 + u*L;
        const theta = u*turns*Math.PI*2 + clock*0.4;
        const y = R*Math.cos(theta), z = R*Math.sin(theta);
        dummy.position.set(x,y,z); dummy.updateMatrix();
        carbons.setMatrixAt(i, dummy.matrix);

        const sTheta = theta*1.6;
        dummy.position.set(x, y - rSat*Math.cos(sTheta), z + rSat*Math.sin(sTheta));
        dummy.updateMatrix();
        satA.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + rSat*Math.cos(sTheta), z - rSat*Math.sin(sTheta));
        dummy.updateMatrix();
        satB.setMatrixAt(i, dummy.matrix);
      }
      carbons.instanceMatrix.needsUpdate = true;
      satA.instanceMatrix.needsUpdate = true;
      satB.instanceMatrix.needsUpdate = true;
    }

    function tick(dt){
      clock += dt;
      rebuild();
      b.controls.update();
      b.renderer.render(b.scene, b.camera);
      markReady(container);
    }

    return { setState, resize: b.fit, tick };
  }

  // ---------------------------------------------------------------
  // Empaquetamiento hexagonal (Escena 3, panel central). Cada cadena
  // se representa como un cilindro extendido a lo largo de Y (en la
  // realidad, la cadena helicoidal completa); Clark (1999) describe
  // el empaquetamiento de estas cadenas "casi cilindricas" como
  // hexagonal. La celda unitaria es ahora un prisma 3D: el rombo de
  // la version 2D (v1, v2) extruido a lo largo del eje de cadena (v3).
  // ---------------------------------------------------------------
  function createPacking(container){
    const b = baseSetup(container, {
      fov: 38, camPos: new THREE.Vector3(4.4, 4.4, 6.6), minDist: 4, maxDist: 16
    });

    const group = new THREE.Group();
    b.scene.add(group);

    const R = 0.42, chainH = 3.0;
    const dx = R*2*1.35, dz = dx*Math.sqrt(3)/2;
    const cols = 4, rows = 4;
    const count = cols*rows;

    const chainGeo = new THREE.CylinderGeometry(R, R, chainH, 22, 1, false);
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x3d8cff, roughness: 0.4, metalness: 0.1, emissive: 0x0c1e44, emissiveIntensity: 0.45 });
    const chains = new THREE.InstancedMesh(chainGeo, chainMat, count);
    group.add(chains);

    const positions = [];
    const dummy = new THREE.Object3D();
    const totalW = (cols-1)*dx, totalD = (rows-1)*dz;
    let idx = 0;
    for(let row=0; row<rows; row++){
      const rowOffset = (row%2===0) ? 0 : dx/2;
      for(let col=0; col<cols; col++){
        const x = -totalW/2 + rowOffset + col*dx;
        const z = -totalD/2 + row*dz;
        positions.push([x,z]);
        dummy.position.set(x,0,z); dummy.updateMatrix();
        chains.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    chains.instanceMatrix.needsUpdate = true;

    const satGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const satMat = new THREE.MeshStandardMaterial({ color: 0x96b4ff, transparent: true, opacity: 0.5 });
    const NSAT = 6;
    const sats = new THREE.InstancedMesh(satGeo, satMat, count*NSAT);
    group.add(sats);

    // celda unitaria primitiva: v1=(dx,0,0), v2=(dx/2,0,dz) generan la red hexagonal
    // (triangular) en el plano XZ (igual que en la version 2D); v3=(0,chainH,0) la
    // extrude a lo largo del eje de cadena. Contiene un unico punto de red, como
    // corresponde a la celda primitiva de un empaquetamiento hexagonal.
    let central = [0,0], bestD = Infinity;
    positions.forEach(function(p){ const dd = Math.hypot(p[0],p[1]); if(dd<bestD){ bestD=dd; central=p; } });
    const v1 = [dx,0,0], v2 = [dx/2,0,dz], v3 = [0,chainH,0];
    const P0 = [central[0], -chainH/2, central[1]];
    function add(a,b2){ return [a[0]+b2[0], a[1]+b2[1], a[2]+b2[2]]; }
    const P1=add(P0,v1), P2=add(add(P0,v1),v2), P3=add(P0,v2);
    const P4=add(P0,v3), P5=add(P1,v3), P6=add(P2,v3), P7=add(P3,v3);
    const edges = [[P0,P1],[P1,P2],[P2,P3],[P3,P0],[P4,P5],[P5,P6],[P6,P7],[P7,P4],[P0,P4],[P1,P5],[P2,P6],[P3,P7]];
    const cellPts = [];
    edges.forEach(function(e){
      cellPts.push(new THREE.Vector3(e[0][0],e[0][1],e[0][2]), new THREE.Vector3(e[1][0],e[1][1],e[1][2]));
    });
    const cellGeo = new THREE.BufferGeometry().setFromPoints(cellPts);
    const cellMat = new THREE.LineDashedMaterial({ color: 0x5c6690, dashSize: 0.1, gapSize: 0.07, transparent: true, opacity: 0.9 });
    const cellLines = new THREE.LineSegments(cellGeo, cellMat);
    cellLines.computeLineDistances();
    group.add(cellLines);

    let clock = 0;
    function setState(state){
      chainMat.color.set(state.colorHex);
      chainMat.emissive.set(state.colorHex);
      chainMat.emissiveIntensity = 0.35;
    }

    function tick(dt){
      clock += dt;
      let s = 0;
      for(let c=0;c<count;c++){
        const x = positions[c][0], z = positions[c][1];
        for(let k=0;k<NSAT;k++){
          const ang = k*Math.PI*2/NSAT + clock*0.5;
          const sx = x + Math.cos(ang)*(R+0.14);
          const sz = z + Math.sin(ang)*(R+0.14);
          const sy = ((k%3)-1)*chainH*0.28;
          dummy.position.set(sx,sy,sz); dummy.updateMatrix();
          sats.setMatrixAt(s, dummy.matrix);
          s++;
        }
      }
      sats.instanceMatrix.needsUpdate = true;
      b.controls.update();
      b.renderer.render(b.scene, b.camera);
      markReady(container);
    }

    return { setState, resize: b.fit, tick };
  }

  // ---------------------------------------------------------------
  // Motor hibrido laser+arco (Escena 4). Arquitectura definida en el
  // Marco Teorico de la tesis (Sec. 3.2-3.3), sustentada en Horisawa,
  // Kawakami & Kimura (2005): el laser (baja intensidad) crea solo un
  // puente delgado de plasma conductor sobre el PTFE; ese puente
  // cierra el circuito catodo-anodo de un banco de capacitores ya
  // cargado, y la fuerza de Lorentz (J×B) de la corriente resultante
  // acelera el plasma como fuerza de cuerpo — segunda etapa superpuesta
  // a la expansion termica inicial. El tubo ceramico que separa la
  // zona de ablacion de la zona de aceleracion tambien sigue esa
  // referencia. Geometria (proporciones, distancias) esquematica;
  // no son las dimensiones de ningun propulsor especifico. Sin estado
  // dependiente de la fase cristalina: no usa setState() para nada
  // mas que mantener la misma interfaz que las otras escenas.
  // ---------------------------------------------------------------
  function createEngine(container){
    const b = baseSetup(container, {
      fov: 34, camPos: new THREE.Vector3(3.0, 4.3, 13.2), target: new THREE.Vector3(0.4,0,0),
      minDist: 7, maxDist: 28
    });

    const group = new THREE.Group();
    b.scene.add(group);
    const labelLayer = makeLabelLayer(container);

    // Propelente PTFE (zona de ablacion)
    const ptfeGeo = new THREE.BoxGeometry(0.6, 1.0, 1.0);
    const ptfeMat = new THREE.MeshStandardMaterial({ color: 0x5c6690, roughness: 0.8, metalness: 0.05 });
    const ptfe = new THREE.Mesh(ptfeGeo, ptfeMat);
    ptfe.position.set(-4.1, 0, 0);
    group.add(ptfe);
    const ptfeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ptfeGeo), new THREE.LineBasicMaterial({ color: 0x2c3868 }));
    ptfeEdges.position.copy(ptfe.position);
    group.add(ptfeEdges);

    // Laser: emisor (housing) + haz hasta la superficie del PTFE
    const laserPos = new THREE.Vector3(-6.6, 2.4, 0.9);
    const hitPoint = new THREE.Vector3(-4.4, 0.15, 0.15);
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0x3d8cff, emissive: 0x0c1e44, emissiveIntensity: 0.6 });
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), emitterMat);
    emitter.position.copy(laserPos);
    group.add(emitter);
    const beamGeo = new THREE.BufferGeometry().setFromPoints([laserPos, hitPoint]);
    const beamMat = new THREE.LineBasicMaterial({ color: 0x3d8cff, transparent: true, opacity: 0.85 });
    group.add(new THREE.Line(beamGeo, beamMat));
    const hitGlow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), new THREE.MeshBasicMaterial({ color: 0x9fc4ff }));
    hitGlow.position.copy(hitPoint);
    group.add(hitGlow);

    // Tubo ceramico aislante: separa la zona de ablacion laser de la zona de aceleracion
    const collarX = -2.9;
    const collarGeo = new THREE.TorusGeometry(0.85, 0.05, 10, 24);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.4, roughness: 0.5 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.y = Math.PI/2;
    collar.position.set(collarX, 0, 0);
    group.add(collar);

    // Catodo y anodo: rieles paralelos a lo largo de la zona de aceleracion
    const railLen = 5.6;
    const railCenterX = 0.8;
    const railGeo = new THREE.CylinderGeometry(0.07, 0.07, railLen, 12);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8891b4, roughness: 0.35, metalness: 0.6 });
    const cathode = new THREE.Mesh(railGeo, railMat);
    cathode.rotation.z = Math.PI/2;
    cathode.position.set(railCenterX, 0.62, 0);
    group.add(cathode);
    const anode = new THREE.Mesh(railGeo, railMat.clone());
    anode.rotation.z = Math.PI/2;
    anode.position.set(railCenterX, -0.62, 0);
    group.add(anode);

    // Carbonizado (char): residuo de carbono redepositado sobre los electrodos,
    // no producto de descomposicion local del PTFE alli -- evidenciado por SEM
    // y rayos X incluso sobre las capas de cobre de los electrodos (Keidar,
    // Boyd, Gulczinski, Antonsen & Spanjers, 2001, IEPC-01-155). Disperso a lo
    // largo de todo el canal, sin gradiente espacial especifico (la fuente no
    // reporta uno); consistente con el mayor tiempo de residencia del carbono
    // en el canal de descarga frente al fluor (Jakubczak et al., 2024).
    const NCHAR = 40;
    const charGeo = new THREE.SphereGeometry(0.11, 7, 7);
    const charMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.85, metalness: 0.05 });
    const charMesh = new THREE.InstancedMesh(charGeo, charMat, NCHAR);
    const charDummy = new THREE.Object3D();
    for(let i=0;i<NCHAR;i++){
      const rail = (i % 2 === 0) ? cathode : anode;
      const railY = rail.position.y;
      const t = Math.random();
      const x = railCenterX - railLen/2 + t*railLen;
      const ang = Math.random()*Math.PI*2;
      const r = 0.09 + Math.random()*0.035;
      charDummy.position.set(x, railY + Math.cos(ang)*r, Math.sin(ang)*r);
      const s = 0.7 + Math.random()*0.9;
      charDummy.scale.set(s, s*(0.6+Math.random()*0.5), s);
      charDummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      charDummy.updateMatrix();
      charMesh.setMatrixAt(i, charDummy.matrix);
    }
    charMesh.instanceMatrix.needsUpdate = true;
    group.add(charMesh);

    // Camara/chorro de descarga (envoltura tenue, solo para dar contexto espacial)
    const chamberLen = (railCenterX+railLen/2) - (ptfe.position.x-0.3) + 0.4;
    const chamberGeo = new THREE.CylinderGeometry(0.95, 0.95, chamberLen, 22, 1, true);
    const chamberMat = new THREE.MeshBasicMaterial({ color: 0x2c3868, wireframe: true, transparent: true, opacity: 0.14 });
    const chamber = new THREE.Mesh(chamberGeo, chamberMat);
    chamber.rotation.z = Math.PI/2;
    chamber.position.set((ptfe.position.x-0.3 + railCenterX+railLen/2)/2, 0, 0);
    group.add(chamber);

    // Puente de plasma (arco) justo tras el tubo ceramico: el laser lo crea, la
    // corriente de descarga lo atraviesa. Se redibuja con jitter para sugerir
    // una descarga viva, no estatica.
    const arcX = collarX + 0.5;
    const arcMat = new THREE.LineBasicMaterial({ color: 0xff5c5c, transparent: true, opacity: 0.95 });
    let arcLine = null;
    function rebuildArc(seed){
      if(arcLine){ group.remove(arcLine); arcLine.geometry.dispose(); }
      const pts = [];
      const N = 9;
      for(let i=0;i<=N;i++){
        const t = i/N;
        const y = 0.6 - t*1.2;
        const j = Math.sin(seed*3.1+i*1.9)*0.05*Math.sin(t*Math.PI);
        pts.push(new THREE.Vector3(arcX+j, y, Math.cos(seed*2.3+i)*0.04));
      }
      arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat);
      group.add(arcLine);
    }
    rebuildArc(0);

    // Banco de capacitores + conexiones a los electrodos
    const capMat = new THREE.MeshStandardMaterial({ color: 0x232b4e, roughness: 0.6 });
    for(let i=0;i<3;i++){
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), capMat);
      cap.position.set(-0.6+0.42*i, -1.85, 1.0);
      group.add(cap);
    }
    const wireMat = new THREE.LineBasicMaterial({ color: 0x5c6690 });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.6,-1.6,1.0), new THREE.Vector3(-0.6,0.62,0.05)]), wireMat));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.24,-1.6,1.0), new THREE.Vector3(0.24,-0.62,0.05)]), wireMat));

    // Plasma acelerado: chorro de particulas saliendo por el extremo abierto
    const NP = 42;
    const pGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const pMat = new THREE.MeshStandardMaterial({ color: 0x3d8cff, emissive: 0x0c1e44, emissiveIntensity: 0.8 });
    const particles = new THREE.InstancedMesh(pGeo, pMat, NP);
    group.add(particles);
    const seeds = [];
    for(let i=0;i<NP;i++) seeds.push({ a: (i/NP)*Math.PI*2*3.1, r: 0.05+((i*37)%100)/100*0.45, phase: (i*0.6180339887)%1 });

    const dummy = new THREE.Object3D();
    let clock = 0;
    const exhaustStart = railCenterX + railLen/2, exhaustEnd = exhaustStart + 2.3;

    const labelDefs = [
      { text: 'Láser Nd:YAG, 1064 nm', pos: laserPos },
      { text: 'PTFE (ablación)', pos: new THREE.Vector3(ptfe.position.x, -1.5, 0) },
      { text: 'Tubo cerámico', pos: new THREE.Vector3(collarX, 1.6, 0) },
      { text: 'Descarga (arco)', pos: new THREE.Vector3(arcX+1.0, -1.6, 0) },
      { text: 'Cátodo', pos: new THREE.Vector3(railCenterX+0.8, 1.5, 0) },
      { text: 'Ánodo', pos: new THREE.Vector3(railCenterX+0.8, -1.6, 0) },
      { text: 'Plasma acelerado →', pos: new THREE.Vector3(exhaustStart+1.4, 0.9, 0.6) }
    ];
    const labelEls = labelDefs.map(function(d){ return { el: addLabel(labelLayer, d.text), pos: d.pos }; });

    function tick(dt){
      clock += dt;
      if(Math.floor(clock*7) !== Math.floor((clock-dt)*7)) rebuildArc(clock);

      for(let i=0;i<NP;i++){
        const s = seeds[i];
        const t = (clock*0.5 + s.phase) % 1;
        const x = exhaustStart + t*(exhaustEnd-exhaustStart);
        const spread = 0.08 + t*0.6;
        dummy.position.set(x, Math.sin(s.a)*s.r*spread/0.5, Math.cos(s.a)*s.r*spread/0.5);
        dummy.scale.setScalar(1 - t*0.4);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      b.controls.update();
      b.renderer.render(b.scene, b.camera);
      labelEls.forEach(function(le){ projectLabel(le.el, le.pos, b.camera, container); });
      markReady(container);
    }

    return { setState: function(){}, resize: b.fit, tick };
  }

  function init(){
    const helixEl = document.getElementById('gl-helix');
    const packingEl = document.getElementById('gl-packing');
    const engineEl = document.getElementById('gl-engine');
    if(!helixEl || !packingEl || !engineEl) return;

    const helix = createHelix(helixEl);
    const packing = createPacking(packingEl);
    const engine = createEngine(engineEl);

    window.PTFE3D = { helix: helix, packing: packing, engine: engine };
    window.dispatchEvent(new Event('ptfe3d-ready'));

    let last = performance.now();
    function loop(now){
      const dt = Math.min(0.05, (now-last)/1000);
      last = now;
      helix.tick(dt);
      packing.tick(dt);
      engine.tick(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
