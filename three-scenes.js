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
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;');
    layer.appendChild(svg);
    layer._svg = svg;
    return layer;
  }
  function addLabel(layer, text){
    const svgNS = 'http://www.w3.org/2000/svg';
    const el = document.createElement('div');
    el.className = 'gl-label';
    el.textContent = text;
    layer.appendChild(el);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'gl-leader');
    layer._svg.appendChild(line);
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('class', 'gl-anchor');
    dot.setAttribute('r', '2.2');
    layer._svg.appendChild(dot);
    return { el: el, line: line, dot: dot, _w: 0, _h: 0 };
  }
  // Reubica todas las etiquetas de una escena a la vez (no una por una), para
  // poder detectar y resolver encimamientos entre ellas -- necesario porque el
  // usuario puede rotar la camara libremente (OrbitControls), y un layout de
  // etiquetas ajustado a mano solo para el angulo por defecto se rompe en
  // cuanto se gira. Cuando una etiqueta se desplaza de su ancla real para
  // hacerle espacio a otra, se dibuja una linea guia punteada + un punto en el
  // ancla, para no perder la asociacion etiqueta-pieza.
  function layoutLabels(labelEls, camera, container){
    const w = container.clientWidth, h = container.clientHeight;
    const items = [];
    labelEls.forEach(function(le){
      const v = le.pos.clone().project(camera);
      const x = (v.x*0.5+0.5)*w, y = (1-(v.y*0.5+0.5))*h;
      const behind = (v.z > 1 || v.z < -1);
      const offscreen = (x < -30 || x > w+30 || y < -20 || y > h+20);
      if(behind || offscreen){
        le.el.style.opacity = '0';
        le.line.style.opacity = '0';
        le.dot.style.opacity = '0';
        return;
      }
      if(!le._w){ le._w = le.el.offsetWidth || 60; le._h = le.el.offsetHeight || 15; }
      items.push({ le: le, ax: x, ay: y, x: x, y: y, w: le._w, h: le._h });
    });

    const pad = 4;
    for(let pass=0; pass<4; pass++){
      for(let i=0;i<items.length;i++){
        for(let j=i+1;j<items.length;j++){
          const A = items[i], B = items[j];
          const dx = (B.x-A.x), dy = (B.y-A.y);
          const overlapX = (A.w+B.w)/2+pad - Math.abs(dx);
          const overlapY = (A.h+B.h)/2+pad - Math.abs(dy);
          if(overlapX > 0 && overlapY > 0){
            if(overlapX < overlapY){
              const push = overlapX/2 * (dx>=0 ? 1 : -1);
              A.x -= push; B.x += push;
            } else {
              const push = overlapY/2 * (dy>=0 ? 1 : -1);
              A.y -= push; B.y += push;
            }
          }
        }
      }
    }

    items.forEach(function(it){
      const le = it.le;
      le.el.style.opacity = '1';
      le.el.style.left = it.x+'px';
      le.el.style.top = it.y+'px';
      const moved = Math.hypot(it.x-it.ax, it.y-it.ay) > 9;
      if(moved){
        le.dot.setAttribute('cx', it.ax); le.dot.setAttribute('cy', it.ay);
        le.dot.style.opacity = '1';
        le.line.setAttribute('x1', it.ax); le.line.setAttribute('y1', it.ay);
        le.line.setAttribute('x2', it.x); le.line.setAttribute('y2', it.y);
        le.line.style.opacity = '0.85';
      } else {
        le.dot.style.opacity = '0';
        le.line.style.opacity = '0';
      }
    });
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
    // corriente de descarga lo atraviesa. Nucleo blanco-caliente + halo rojo
    // translucido con blending aditivo (efecto de resplandor sin post-procesado
    // real) y un par de ramificaciones cortas, para que se vea como una
    // descarga real y no como una linea geometrica. La intensidad sigue un
    // ciclo real de encendido/decaimiento -- no solo tiembla, se apaga y
    // vuelve a encender -- porque este es un propulsor de plasma PULSADO: la
    // misma ecuacion de circuito RLC del marco teorico, L0 d2qc/dt2 +
    // R0 dqc/dt + qc/C = Vsh+Vpl, describe una descarga que sube, pica y
    // decae en cada pulso, no una corriente continua.
    const arcX = collarX + 0.5;
    const ARC_N = 9;
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff2df, transparent: true, opacity: 1, depthWrite: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff5c5c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const branchMat = new THREE.MeshBasicMaterial({ color: 0xff8f6b, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    let coreMesh = null, haloMesh = null, branchMeshes = [];

    function arcPoints(seed){
      const pts = [];
      for(let i=0;i<=ARC_N;i++){
        const t = i/ARC_N;
        const y = 0.6 - t*1.2;
        const j = Math.sin(seed*3.1+i*1.9)*0.05*Math.sin(t*Math.PI);
        pts.push(new THREE.Vector3(arcX+j, y, Math.cos(seed*2.3+i)*0.04));
      }
      return pts;
    }
    function branchPoints(base, seed, dir){
      const pts = [];
      const M = 4;
      for(let i=0;i<=M;i++){
        const t = i/M;
        pts.push(new THREE.Vector3(
          base.x + dir.x*t*0.32 + Math.sin(seed*4+i)*0.018,
          base.y + dir.y*t*0.32,
          base.z + dir.z*t*0.32 + Math.cos(seed*5+i)*0.018
        ));
      }
      return pts;
    }
    function rebuildArc(seed){
      if(coreMesh){ group.remove(coreMesh); coreMesh.geometry.dispose(); }
      if(haloMesh){ group.remove(haloMesh); haloMesh.geometry.dispose(); }
      branchMeshes.forEach(function(m){ group.remove(m); m.geometry.dispose(); });
      branchMeshes = [];

      const pts = arcPoints(seed);
      const curve = new THREE.CatmullRomCurve3(pts);
      coreMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.022, 6, false), coreMat);
      group.add(coreMesh);
      haloMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.085, 6, false), haloMat);
      group.add(haloMesh);

      [3, 6].forEach(function(idx, k){
        const base = pts[idx];
        const dir = new THREE.Vector3(k===0 ? 0.6 : -0.6, k===0 ? 0.35 : -0.35, k===0 ? 0.5 : -0.5).normalize();
        const bcurve = new THREE.CatmullRomCurve3(branchPoints(base, seed+k*7.7, dir));
        const bmesh = new THREE.Mesh(new THREE.TubeGeometry(bcurve, 8, 0.012, 5, false), branchMat);
        group.add(bmesh);
        branchMeshes.push(bmesh);
      });
    }
    rebuildArc(0);

    // Envolvente de un pulso de descarga: encendido rapido, pico, decaimiento,
    // y un valle oscuro (con un leve parpadeo residual) antes del siguiente
    // pulso -- no es un valor medido, es la forma cualitativa esperada de una
    // solucion de circuito RLC subamortiguado tras el disparo.
    function pulseEnvelope(t){
      if(t < 0.15) return 0.35 + (t/0.15)*0.65;
      if(t < 0.5) return 1 - ((t-0.15)/0.35)*0.45;
      return 0.55 - ((t-0.5)/0.5)*0.2;
    }
    const arcPeriod = 1.1;

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

    // Plasma acelerado: dos especies con transporte diferencial (Jakubczak et
    // al., 2024). La mayoria (azul, fluor) nace en el puente de plasma, cruza
    // todo el canal cátodo-ánodo y escapa como el chorro de plasma. Una
    // minoria (café, carbono) nace igual pero se detiene a medio camino del
    // canal, deriva hacia el riel mas cercano y se desvanece ahi -- fundiendose
    // visualmente con el carbonizado estatico en vez de llegar a la salida.
    // La proporcion azul:café es ilustrativa (mayoria clara / minoria
    // ocasional), no una fraccion medida particula-por-particula: la fuente
    // solo da "fluor domina, carbono en trazas", no un conteo por particula.
    const exhaustStart = railCenterX + railLen/2, exhaustEnd = exhaustStart + 2.3;
    const channelStart = arcX;
    const channelLen = exhaustStart - channelStart;

    const NP_F = 34;
    const pGeoF = new THREE.SphereGeometry(0.045, 8, 8);
    const pMatF = new THREE.MeshStandardMaterial({ color: 0x3d8cff, emissive: 0x0c1e44, emissiveIntensity: 0.8 });
    const particlesF = new THREE.InstancedMesh(pGeoF, pMatF, NP_F);
    group.add(particlesF);
    const seedsF = [];
    for(let i=0;i<NP_F;i++) seedsF.push({ a: (i/NP_F)*Math.PI*2*3.1, r: 0.05+((i*37)%100)/100*0.45, phase: (i*0.6180339887)%1 });

    const NP_C = 8;
    const pGeoC = new THREE.SphereGeometry(0.06, 8, 8);
    const pMatC = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, emissive: 0x2a1c10, emissiveIntensity: 0.5, roughness: 0.8 });
    const particlesC = new THREE.InstancedMesh(pGeoC, pMatC, NP_C);
    group.add(particlesC);
    const seedsC = [];
    for(let i=0;i<NP_C;i++){
      seedsC.push({
        phase: (i*0.4142135624)%1,
        captureFrac: 0.35 + ((i*53)%100)/100*0.5,
        rail: (i%2===0) ? 0.62 : -0.62,
        jitter: ((i*17)%100)/100*0.3 - 0.15
      });
    }

    const dummy = new THREE.Object3D();
    let clock = 0;

    const labelDefs = [
      { text: 'Láser Nd:YAG, 1064 nm', pos: laserPos },
      { text: 'PTFE (ablación)', pos: new THREE.Vector3(ptfe.position.x, -1.5, 0) },
      { text: 'Tubo cerámico', pos: new THREE.Vector3(collarX, 1.6, 0) },
      { text: 'Descarga (arco)', pos: new THREE.Vector3(arcX+1.0, -1.6, 0) },
      { text: 'Cátodo', pos: new THREE.Vector3(railCenterX+0.8, 1.5, 0) },
      { text: 'Ánodo', pos: new THREE.Vector3(railCenterX+0.8, -1.6, 0) },
      { text: 'Plasma acelerado →', pos: new THREE.Vector3(exhaustStart+1.4, 0.9, 0.6) },
      { text: 'Carbonizado (char)', pos: new THREE.Vector3(0.5, -2.6, 0) }
    ];
    const labelEls = labelDefs.map(function(d){
      const lbl = addLabel(labelLayer, d.text);
      lbl.pos = d.pos;
      return lbl;
    });

    function tick(dt){
      clock += dt;
      if(Math.floor(clock*10) !== Math.floor((clock-dt)*10)) rebuildArc(clock);
      const arcCycle = (clock % arcPeriod) / arcPeriod;
      const arcEnv = pulseEnvelope(arcCycle);
      coreMat.opacity = Math.min(1, arcEnv*1.2);
      haloMat.opacity = 0.5*arcEnv;
      branchMat.opacity = Math.max(0, arcEnv-0.4)*0.9;

      for(let i=0;i<NP_F;i++){
        const s = seedsF[i];
        const t = (clock*0.35 + s.phase) % 1;
        const x = channelStart + t*(exhaustEnd-channelStart);
        let spread, scale;
        if(x < exhaustStart){
          spread = 0.22;
          scale = 1;
        } else {
          const tp = (x-exhaustStart)/(exhaustEnd-exhaustStart);
          spread = 0.08 + tp*0.6;
          scale = 1 - tp*0.4;
        }
        dummy.position.set(x, Math.sin(s.a)*s.r*spread/0.5, Math.cos(s.a)*s.r*spread/0.5);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        particlesF.setMatrixAt(i, dummy.matrix);
      }
      particlesF.instanceMatrix.needsUpdate = true;

      for(let i=0;i<NP_C;i++){
        const s = seedsC[i];
        const cycle = (clock*0.35 + s.phase) % 1;
        const captureX = channelStart + s.captureFrac*channelLen;
        let x, y, z, scale;
        if(cycle < 0.75){
          const tt = cycle/0.75;
          x = channelStart + tt*(captureX-channelStart);
          y = tt*s.rail*0.85;
          z = (1-tt)*s.jitter;
          scale = 1;
        } else {
          const tt = (cycle-0.75)/0.25;
          x = captureX;
          y = s.rail*0.85 + tt*(s.rail*0.15);
          z = 0;
          scale = Math.max(1-tt, 0.001);
        }
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        particlesC.setMatrixAt(i, dummy.matrix);
      }
      particlesC.instanceMatrix.needsUpdate = true;

      b.controls.update();
      b.renderer.render(b.scene, b.camera);
      layoutLabels(labelEls, b.camera, container);
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
