/* =========================================================
   three-scenes.js — figuras 3D reales (Three.js + OrbitControls)
   para la Escena 3 (cadena helicoidal, empaquetamiento hexagonal)
   y la Escena 4 (trayectorias ion/atomo en la capa de no equilibrio).

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
  // Trayectorias ion/atomo (Escena 4). Diagrama esquematico (no una
  // simulacion de dinamica de particulas): flujo de fluor (F+..F6+)
  // escapando de la capa de no equilibrio adyacente a la superficie
  // (Keidar, Boyd & Beilis, 2001) y flujo de retorno de carbono que
  // se redeposita como char (Keidar, Boyd, Gulczinski, Antonsen &
  // Spanjers, 2001; Jakubczak, Jardin & Kurzyna, 2024). Sin estado
  // dependiente de la fase cristalina: no llama a setState().
  // ---------------------------------------------------------------
  function createIon(container){
    const b = baseSetup(container, {
      fov: 42, camPos: new THREE.Vector3(0, 3.6, 8.4), target: new THREE.Vector3(0,0.7,0),
      minDist: 4, maxDist: 18
    });

    const group = new THREE.Group();
    b.scene.add(group);

    const surfGeo = new THREE.BoxGeometry(6.4, 0.3, 3.4);
    const surfMat = new THREE.MeshStandardMaterial({ color: 0x232b4e, roughness: 0.85, metalness: 0.05 });
    const surf = new THREE.Mesh(surfGeo, surfMat);
    surf.position.set(0,-0.15,0);
    group.add(surf);
    const surfEdges = new THREE.LineSegments(new THREE.EdgesGeometry(surfGeo), new THREE.LineBasicMaterial({ color: 0x2c3868 }));
    surfEdges.position.copy(surf.position);
    group.add(surfEdges);

    const layerGeo = new THREE.BoxGeometry(6.4, 1.7, 3.4);
    const layerMat = new THREE.MeshBasicMaterial({ color: 0x3d8cff, transparent: true, opacity: 0.05, depthWrite: false });
    const layer = new THREE.Mesh(layerGeo, layerMat);
    layer.position.set(0, 0.85, 0);
    group.add(layer);

    function rand(seed){ const x = Math.sin(seed*127.1)*43758.5453; return x - Math.floor(x); }

    const NF = 18, NC = 6;
    const fluorCurves = [], carbonCurves = [];
    for(let i=0;i<NF;i++){
      const sx = -2.9 + rand(i*3.1)*5.8, sz = -1.4 + rand(i*7.7)*2.8;
      const dx = (rand(i*11.3)-0.5)*3.2, dz = (rand(i*17.9)-0.5)*2.2;
      const height = 3.2 + rand(i*5.5)*1.6;
      const p0 = new THREE.Vector3(sx,0,sz);
      const p1 = new THREE.Vector3(sx+dx*0.5, height*0.7, sz+dz*0.5);
      const p2 = new THREE.Vector3(sx+dx, height, sz+dz);
      fluorCurves.push({ curve: new THREE.QuadraticBezierCurve3(p0,p1,p2), speed: 0.22+rand(i*2.2)*0.12, phase: rand(i*9.9) });
    }
    for(let i=0;i<NC;i++){
      const sx = -2.2 + rand(i*13.1+2)*4.4, sz = -1.1 + rand(i*19.7+2)*2.2;
      const ex = sx + (rand(i*23.3+2)-0.5)*1.6, ez = sz + (rand(i*29.9+2)-0.5)*1.2;
      const peak = 1.1 + rand(i*3.7+2)*0.6;
      const p0 = new THREE.Vector3(sx,0,sz);
      const p1 = new THREE.Vector3((sx+ex)/2, peak, (sz+ez)/2);
      const p2 = new THREE.Vector3(ex,0,ez);
      carbonCurves.push({ curve: new THREE.QuadraticBezierCurve3(p0,p1,p2), speed: 0.4+rand(i*4.4+2)*0.15, phase: rand(i*15.5+2) });
    }

    function tubeFromCurve(curve, color, opacity){
      const geo = new THREE.TubeGeometry(curve, 24, 0.013, 6, false);
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity });
      return new THREE.Mesh(geo, mat);
    }
    fluorCurves.forEach(function(fc){ group.add(tubeFromCurve(fc.curve, 0x3d8cff, 0.22)); });
    carbonCurves.forEach(function(cc){ group.add(tubeFromCurve(cc.curve, 0xff5c5c, 0.3)); });

    const fGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const fMat = new THREE.MeshStandardMaterial({ color: 0x3d8cff, emissive: 0x0c1e44, emissiveIntensity: 0.85 });
    const fMarkers = new THREE.InstancedMesh(fGeo, fMat, NF);
    group.add(fMarkers);

    const cGeo = new THREE.SphereGeometry(0.062, 10, 10);
    const cMat = new THREE.MeshStandardMaterial({ color: 0xff5c5c, emissive: 0x4a0000, emissiveIntensity: 0.85 });
    const cMarkers = new THREE.InstancedMesh(cGeo, cMat, NC);
    group.add(cMarkers);

    const dummy = new THREE.Object3D();
    let clock = 0;

    function tick(dt){
      clock += dt;
      fluorCurves.forEach(function(fc,i){
        const t = (clock*fc.speed + fc.phase) % 1;
        const p = fc.curve.getPoint(t);
        dummy.position.copy(p);
        dummy.scale.setScalar(0.6+0.4*Math.sin(t*Math.PI));
        dummy.updateMatrix();
        fMarkers.setMatrixAt(i, dummy.matrix);
      });
      fMarkers.instanceMatrix.needsUpdate = true;

      carbonCurves.forEach(function(cc,i){
        const t = (clock*cc.speed + cc.phase) % 1;
        const p = cc.curve.getPoint(t);
        dummy.position.copy(p);
        dummy.scale.setScalar(0.7+0.4*Math.sin(t*Math.PI));
        dummy.updateMatrix();
        cMarkers.setMatrixAt(i, dummy.matrix);
      });
      cMarkers.instanceMatrix.needsUpdate = true;

      b.controls.update();
      b.renderer.render(b.scene, b.camera);
      markReady(container);
    }

    return { setState: function(){}, resize: b.fit, tick };
  }

  function init(){
    const helixEl = document.getElementById('gl-helix');
    const packingEl = document.getElementById('gl-packing');
    const ionEl = document.getElementById('gl-ion');
    if(!helixEl || !packingEl || !ionEl) return;

    const helix = createHelix(helixEl);
    const packing = createPacking(packingEl);
    const ion = createIon(ionEl);

    window.PTFE3D = { helix: helix, packing: packing, ion: ion };
    window.dispatchEvent(new Event('ptfe3d-ready'));

    let last = performance.now();
    function loop(now){
      const dt = Math.min(0.05, (now-last)/1000);
      last = now;
      helix.tick(dt);
      packing.tick(dt);
      ion.tick(dt);
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
