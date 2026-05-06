import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import { strategyValue, presetLegs } from './bsm.js';

// ---------- Market state (fake but realistic) ----------
const state = {
  spot: 23750,
  iv: 0.185,
  r: 0.015,
  expiryIdx: 4,             // pick Friday by default
  strategy: 'bull-call',
  legs: [],
  initialDebit: 0,
};

// Build 5 weekday expiries from "today".
function buildDates() {
  const out = [];
  const d = new Date(2026, 4, 4); // Mon May 4, 2026 — fixed for demo determinism
  for (let i = 0; i < 5; i++) {
    const day = new Date(d.getTime() + i * 86400000);
    out.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }) + ', ' + (day.getMonth()+1) + '/' + day.getDate(),
      date: day,
      dteHours: (i + 1) * 24, // 1..5 day(s) to expiry
    });
  }
  return out;
}
const DATES = buildDates();

function dteYears() {
  const hours = DATES[state.expiryIdx].dteHours;
  return Math.max(hours / 24 / 365, 1e-6);
}

function recomputeLegs() {
  state.legs = presetLegs(state.strategy, state.spot);
  // Initial debit = strategy value at "entry" assuming entry was a tick ago.
  state.initialDebit = strategyValue(state.legs, state.spot, dteYears(), state.r, state.iv);
}

// ---------- Three.js setup ----------
const canvas = document.getElementById('surface');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
camera.position.set(8, 6.5, 11);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 22;
controls.target.set(0, 1.5, 0);

// Lighting (BasicMaterial doesn't need it, but Edges + bloom benefit from amb.)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// Bloom composer for neon glow.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Surface mesh ----------
const SURF_X = 60; // price samples
const SURF_Y = 40; // dte samples
const surfaceGroup = new THREE.Group();
scene.add(surfaceGroup);

let surfaceMesh = null;
let wireMesh = null;
let marketLine = null;

// Color ramp from low P&L (magenta) → mid (violet/amber) → high (teal).
function pnlColor(t) {
  // t in [0,1]
  const stops = [
    { t: 0.0, c: [1.0, 0.18, 0.54] }, // magenta
    { t: 0.4, c: [0.6, 0.42, 1.0]  }, // violet
    { t: 0.7, c: [1.0, 0.81, 0.30] }, // amber
    { t: 1.0, c: [0.18, 1.0, 0.78] }, // teal
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i+1];
    if (t <= b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return [
        a.c[0] + (b.c[0]-a.c[0]) * u,
        a.c[1] + (b.c[1]-a.c[1]) * u,
        a.c[2] + (b.c[2]-a.c[2]) * u,
      ];
    }
  }
  return stops[stops.length-1].c;
}

function buildSurface() {
  if (surfaceMesh) { surfaceGroup.remove(surfaceMesh); surfaceMesh.geometry.dispose(); surfaceMesh.material.dispose(); }
  if (wireMesh)    { surfaceGroup.remove(wireMesh);    wireMesh.geometry.dispose();    wireMesh.material.dispose(); }
  if (marketLine)  { surfaceGroup.remove(marketLine);  marketLine.geometry.dispose();  marketLine.material.dispose(); }

  const priceMin = state.spot * 0.95;
  const priceMax = state.spot * 1.05;
  const dteMaxHrs = DATES[state.expiryIdx].dteHours;
  const dteMinHrs = 0.5;

  // Sample premium z(price, dte_hours)
  const zs = new Float32Array(SURF_X * SURF_Y);
  let zMin = Infinity, zMax = -Infinity;
  let pnlMin = Infinity, pnlMax = -Infinity;
  const pnls = new Float32Array(SURF_X * SURF_Y);

  for (let j = 0; j < SURF_Y; j++) {
    const dteHrs = dteMinHrs + (dteMaxHrs - dteMinHrs) * (j / (SURF_Y - 1));
    const T = dteHrs / 24 / 365;
    for (let i = 0; i < SURF_X; i++) {
      const price = priceMin + (priceMax - priceMin) * (i / (SURF_X - 1));
      const v = strategyValue(state.legs, price, T, state.r, state.iv);
      zs[j*SURF_X + i] = v;
      const pnl = v - state.initialDebit;
      pnls[j*SURF_X + i] = pnl;
      if (v < zMin) zMin = v; if (v > zMax) zMax = v;
      if (pnl < pnlMin) pnlMin = pnl; if (pnl > pnlMax) pnlMax = pnl;
    }
  }
  // Normalize z to a nice height in scene units.
  const zScene = (z) => 3 * (z - zMin) / Math.max(zMax - zMin, 1e-6);
  const xScene = (i) => -3.5 + 7 * (i / (SURF_X - 1));
  const yScene = (j) => -2.5 + 5 * (j / (SURF_Y - 1));

  // Build positions + colors
  const positions = new Float32Array(SURF_X * SURF_Y * 3);
  const colors    = new Float32Array(SURF_X * SURF_Y * 3);
  const pnlRange = Math.max(pnlMax - pnlMin, 1e-6);
  for (let j = 0; j < SURF_Y; j++) {
    for (let i = 0; i < SURF_X; i++) {
      const idx = j*SURF_X + i;
      positions[idx*3+0] = xScene(i);
      positions[idx*3+1] = zScene(zs[idx]);
      positions[idx*3+2] = yScene(j);
      const t = (pnls[idx] - pnlMin) / pnlRange;
      const c = pnlColor(t);
      colors[idx*3+0] = c[0]; colors[idx*3+1] = c[1]; colors[idx*3+2] = c[2];
    }
  }

  // Index triangles
  const indices = [];
  for (let j = 0; j < SURF_Y - 1; j++) {
    for (let i = 0; i < SURF_X - 1; i++) {
      const a = j*SURF_X + i;
      const b = a + 1;
      const c = a + SURF_X;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  surfaceMesh = new THREE.Mesh(geom, mat);
  surfaceGroup.add(surfaceMesh);

  // Wireframe overlay — only every Nth line for clarity.
  const wirePts = [];
  const step = 3;
  for (let j = 0; j < SURF_Y; j += step) {
    for (let i = 0; i < SURF_X - 1; i++) {
      const a = j*SURF_X + i, b = a + 1;
      wirePts.push(positions[a*3], positions[a*3+1], positions[a*3+2]);
      wirePts.push(positions[b*3], positions[b*3+1], positions[b*3+2]);
    }
  }
  for (let i = 0; i < SURF_X; i += step) {
    for (let j = 0; j < SURF_Y - 1; j++) {
      const a = j*SURF_X + i, b = a + SURF_X;
      wirePts.push(positions[a*3], positions[a*3+1], positions[a*3+2]);
      wirePts.push(positions[b*3], positions[b*3+1], positions[b*3+2]);
    }
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  const wmat = new THREE.LineBasicMaterial({ color: 0x2dffc8, transparent: true, opacity: 0.18 });
  wireMesh = new THREE.LineSegments(wgeo, wmat);
  surfaceGroup.add(wireMesh);

  // Market price slice — vertical line at current spot across the surface.
  const slicePts = [];
  const iSpot = Math.round(((state.spot - priceMin) / (priceMax - priceMin)) * (SURF_X - 1));
  for (let j = 0; j < SURF_Y; j++) {
    const idx = j*SURF_X + iSpot;
    slicePts.push(positions[idx*3], positions[idx*3+1], positions[idx*3+2]);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.Float32BufferAttribute(slicePts, 3));
  const smat = new THREE.LineBasicMaterial({ color: 0xff2d8a, linewidth: 2 });
  marketLine = new THREE.Line(sgeo, smat);
  surfaceGroup.add(marketLine);

  // Update readout
  const tooltipPnL = pnls[Math.floor(SURF_Y * 0.5) * SURF_X + iSpot];
  const tooltipV   = zs[Math.floor(SURF_Y * 0.5) * SURF_X + iSpot];
  setReadout(state.spot, dteYears(), tooltipV, tooltipPnL);
}

// Axes + labels
function buildAxes() {
  const ax = new THREE.Group();
  const make = (a, b, color) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
    return new THREE.Line(g, m);
  };
  ax.add(make(new THREE.Vector3(-3.5, 0, -2.5), new THREE.Vector3(3.5, 0, -2.5), 0x2dffc8));   // x
  ax.add(make(new THREE.Vector3(-3.5, 0, -2.5), new THREE.Vector3(-3.5, 3.5, -2.5), 0x6dffb6)); // z (up)
  ax.add(make(new THREE.Vector3(-3.5, 0, -2.5), new THREE.Vector3(-3.5, 0, 2.5), 0x9a6bff));   // y
  scene.add(ax);

  // Soft grid floor
  const grid = new THREE.GridHelper(8, 16, 0x1a1f2c, 0x12141c);
  grid.position.y = -0.001;
  scene.add(grid);
}
buildAxes();

// ---------- Resize ----------
function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  composer.setSize(r.width, r.height);
  bloom.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

// ---------- Animate ----------
let rotateBase = 0;
function tick() {
  controls.update();
  // Slow auto-orbit when user not interacting (visual demo).
  if (!controls._dragging) {
    rotateBase += 0.0008;
    surfaceGroup.rotation.y = Math.sin(rotateBase) * 0.18;
  }
  composer.render();
  requestAnimationFrame(tick);
}
controls.addEventListener('start', () => controls._dragging = true);
controls.addEventListener('end',   () => controls._dragging = false);

// ---------- UI wiring ----------
function fmt(n, dec=2) { return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

function setReadout(S, T, V, pnl) {
  document.getElementById('r-s').textContent = fmt(S);
  document.getElementById('r-t').textContent = T.toFixed(6);
  document.getElementById('r-v').textContent = fmt(V);
  const pnlEl = document.getElementById('r-pnl');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + fmt(pnl, 0);
  pnlEl.classList.toggle('pos', pnl >= 0);
  pnlEl.classList.toggle('neg', pnl < 0);
}

// Date pills
function renderDates() {
  const host = document.getElementById('dates');
  host.innerHTML = '';
  DATES.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'date-pill' + (i === state.expiryIdx ? ' active' : '');
    b.textContent = d.label;
    b.addEventListener('click', () => {
      state.expiryIdx = i;
      renderDates();
      updateExpText();
      recomputeLegs();
      buildSurface();
    });
    host.appendChild(b);
  });
}
function updateExpText() {
  const d = DATES[state.expiryIdx];
  const hrs = d.dteHours;
  const dte = (hrs / 24).toFixed(0);
  document.getElementById('exp-text').textContent = d.label + ` at 1:30 PM (${dte}DTE)`;
}
renderDates();
updateExpText();

// Strategy selector
document.getElementById('strategy').addEventListener('change', (e) => {
  state.strategy = e.target.value;
  recomputeLegs();
  buildSurface();
});

// Ticks for scrubbers
function renderPriceTicks() {
  const host = document.getElementById('price-ticks');
  host.innerHTML = '';
  const center = state.spot;
  for (let i = -3; i <= 3; i++) {
    const v = center + i * 50;
    const sp = document.createElement('span');
    sp.textContent = '$' + v.toLocaleString();
    host.appendChild(sp);
  }
}
function renderIvTicks() {
  const host = document.getElementById('iv-ticks');
  host.innerHTML = '';
  [5, 10, 15, 20, 25, 30].forEach(p => {
    const sp = document.createElement('span');
    sp.textContent = p + '%';
    host.appendChild(sp);
  });
}
renderPriceTicks();
renderIvTicks();

// Init
recomputeLegs();
buildSurface();
tick();

// Expose for poking in console
window.__demo = { state, buildSurface, recomputeLegs };
