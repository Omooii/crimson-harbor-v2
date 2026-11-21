// The harbor city: ground, roads, buildings, pier + ferris wheel, beach,
// bridge, palms, streetlights, sun and sky. Also owns collision (building
// AABBs, water) and the day/night cycle.
import { G, rng } from './state.js';
import { clamp, lerp, pick } from './utils.js';

export const WORLD = { minX: -160, maxX: 220, minZ: -210, maxZ: 220 };
export const V_ROADS = [
  { x: -50, z0: -60, z1: 200, name: 'Ocean Drive' },
  { x: -20, z0: -132, z1: 200, name: 'Bridge Road' },
  { x: 20, z0: -100, z1: 200, name: 'Harbor Blvd' },
  { x: 80, z0: -60, z1: 200, name: 'Pier Avenue' },
  { x: 140, z0: -60, z1: 160, name: 'Northside Ave' },
];
export const H_ROADS = [
  { z: -100, x0: -60, x1: 200, name: 'Bayfront St' },
  { z: -40, x0: -60, x1: 200, name: 'Coral St' },
  { z: 20, x0: -60, x1: 200, name: 'Palm Row' },
  { z: 80, x0: -60, x1: 200, name: 'Anchor St' },
  { z: 140, x0: -60, x1: 200, name: 'Seagull St' },
];
// Road points the police use to spawn on the network.
export const ROAD_POINTS = [];
for (const r of V_ROADS) for (let z = r.z0 + 10; z < r.z1; z += 20) ROAD_POINTS.push([r.x, z]);
for (const r of H_ROADS) for (let x = r.x0 + 10; x < r.x1; x += 20) ROAD_POINTS.push([x, r.z]);

export const colliders = []; // {x0,z0,x1,z1}
export const world = { ferris: null, sun: null, moon: null, hemi: null, dir: null, lamps: [], clouds: [], water: null, windowMats: [] };

function canvasTexture(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
function roadTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#3d4148'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#43484f';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
    g.fillStyle = '#f5d90a'; g.fillRect(62, 8, 4, 44); g.fillRect(62, 72, 4, 44);
    g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 3, 128); g.fillRect(119, 0, 3, 128);
  });
}
function windowTexture() {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
    for (let y = 10; y < 250; y += 24) for (let x = 10; x < 120; x += 24) {
      g.fillStyle = Math.random() < 0.35 ? '#ffd97a' : '#2c3e55';
      g.fillRect(x, y, 16, 14);
    }
  });
}
function signTexture(text, bg, fg) {
  return canvasTexture(256, 64, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
  });
}
function glowTexture() {
  return canvasTexture(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,240,180,0.7)');
    gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

export function groundHeightAt(x, z) {
  if (x >= -27 && x <= -13 && z >= -200 && z <= -148) return 6; // bridge deck
  if (x >= -27 && x <= -13 && z > -148 && z < -132) return 6 * (-132 - z) / 16 + 0.3; // south ramp
  if (x >= -140 && x <= -58 && z >= 94 && z <= 106) return 0.6; // pier deck
  return 0;
}
export function inWater(x, z) {
  if (x < -70) return true;
  if (z < -140 && x < 60) return true;
  return false;
}
export function blockedByWater(x, z) {
  if (!inWater(x, z)) return false;
  if (x >= -140 && x <= -58 && z >= 94 && z <= 106) return false; // pier
  if (x >= -27 && x <= -13 && z >= -200 && z <= -132) return false; // bridge + ramp
  return true;
}
// Push a circle out of building colliders, water and the map edge.
export function collideCircle(x, z, r) {
  for (const b of colliders) {
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
      else {
        const pl = x - b.x0, pr = b.x1 - x, pt = z - b.z0, pb = b.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x0 - r; else if (m === pr) x = b.x1 + r;
        else if (m === pt) z = b.z0 - r; else z = b.z1 + r;
      }
    }
  }
  if (blockedByWater(x, z)) {
    // Slide back toward land: clamp to the nearest dry edge.
    if (x < -70 && !(z >= 94 && z <= 106)) x = -70 + r;
    if (z < -140 && x < 60 && !(x >= -27 && x <= -13)) z = -140 + r;
  }
  x = clamp(x, WORLD.minX + 2, WORLD.maxX - 2);
  z = clamp(z, WORLD.minZ + 2, WORLD.maxZ - 2);
  return [x, z];
}

const PALETTE = [0xff8f7a, 0x7fd4c1, 0xffd166, 0xf78fb3, 0x8ecae6, 0xb5e48c, 0xffb703, 0x90be6d, 0xf9c74f, 0x4cc9f0];
const ROOFS = [0x5a5a66, 0x7a4a3a, 0x3a5a7a, 0x6a6a5a];

export function buildWorld(scene) {
  const winTex = windowTexture();
  const roadTex = roadTexture();
  const glowTex = glowTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // Lights + sky.
  world.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a9a6a, 0.9);
  scene.add(world.hemi);
  world.dir = new THREE.DirectionalLight(0xfff2d0, 1.6);
  world.dir.position.set(80, 120, 40);
  scene.add(world.dir);
  scene.fog = new THREE.Fog(0xa8d8f0, 180, 420);

  // The sun: a bright core inside a wide glow, never a flat disc.
  const sunMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3b0, transparent: true, depthWrite: false });
  world.sun = new THREE.Sprite(sunMat);
  world.sun.scale.set(110, 110, 1);
  world.sun.position.set(180, 160, -160);
  scene.add(world.sun);
  const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false });
  const sunCore = new THREE.Sprite(coreMat);
  sunCore.scale.set(34, 34, 1);
  sunCore.position.set(180, 160, -160);
  scene.add(sunCore);
  world.sunCore = sunCore;
  const moonMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe8ff, transparent: true, depthWrite: false, opacity: 0 });
  world.moon = new THREE.Sprite(moonMat);
  world.moon.scale.set(45, 45, 1);
  world.moon.position.set(-140, 150, -180);
  scene.add(world.moon);

  // Ground: grass base, then city concrete, beach sand, water.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshLambertMaterial({ color: 0x79c25f }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(30, -0.05, 0); scene.add(ground);
  const city = new THREE.Mesh(new THREE.PlaneGeometry(300, 380), new THREE.MeshLambertMaterial({ color: 0xb9b3a4 }));
  city.rotation.x = -Math.PI / 2; city.position.set(75, 0, 30); scene.add(city);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(16, 260), new THREE.MeshLambertMaterial({ color: 0xf2d492 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-64, 0.01, 90); scene.add(sand);
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2aa5d8, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 520), waterMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(-170, 0.05, 0); scene.add(sea);
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), waterMat);
  bay.rotation.x = -Math.PI / 2; bay.position.set(-10, 0.05, -180); scene.add(bay);
  world.water = waterMat;

  // Roads with markings + sidewalks.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xcfc9b8 });
  function road(cx, cz, w, l, vertical) {
    const t = roadTex.clone(); t.needsUpdate = true;
    t.repeat.set(1, Math.max(1, Math.round(l / 12)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; if (!vertical) m.rotation.z = Math.PI / 2;
    m.position.set(cx, 0.02, cz); scene.add(m);
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 2.5 : l, vertical ? l : 2.5), walkMat);
    const s2 = s1.clone();
    s1.rotation.x = s2.rotation.x = -Math.PI / 2;
    if (vertical) { s1.position.set(cx - 7.2, 0.015, cz); s2.position.set(cx + 7.2, 0.015, cz); }
    else { s1.position.set(cx, 0.015, cz - 7.2); s2.position.set(cx, 0.015, cz + 7.2); }
    scene.add(s1); scene.add(s2);
  }
  for (const r of V_ROADS) road(r.x, (r.z0 + r.z1) / 2, 12, r.z1 - r.z0, true);
  for (const r of H_ROADS) road((r.x0 + r.x1) / 2, r.z, 12, r.x1 - r.x0, false);

  // Buildings: solid colored blocks with lit windows. The hand-placed one at
  // (35,40) is the collision-test wall: its west face sits at x = 28.8.
  const winMats = PALETTE.map((c) => {
    const m = new THREE.MeshLambertMaterial({ color: c, emissive: 0xffc46b, emissiveMap: winTex, emissiveIntensity: 0.25 });
    world.windowMats.push(m); return m;
  });
  function building(cx, cz, w, d, h) {
    const m = new THREE.Mesh(boxGeo, pick(rng, winMats));
    m.scale.set(w, h, d); m.position.set(cx, h / 2, cz); scene.add(m);
    const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, ROOFS) }));
    roof.scale.set(w * 0.94, 0.5, d * 0.94); roof.position.set(cx, h + 0.25, cz); scene.add(roof);
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
  }
  building(35, 40, 12.4, 10, 14);
  const vEdges = [-50, -20, 20, 80, 140, 200];
  const hEdges = [-100, -40, 20, 80, 140, 200];
  for (let i = 0; i < vEdges.length - 1; i++) for (let j = 0; j < hEdges.length - 1; j++) {
    const x0 = vEdges[i] + 9, x1 = vEdges[i + 1] - 9, z0 = hEdges[j] + 9, z1 = hEdges[j + 1] - 9;
    if (x1 - x0 < 12 || z1 - z0 < 12) continue;
    if (x0 < -40) continue; // keep the coast open for beach + pier
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const w = 9 + rng() * 9, d = 9 + rng() * 9;
      const cx = x0 + w / 2 + rng() * Math.max(0, x1 - x0 - w);
      const cz = z0 + d / 2 + rng() * Math.max(0, z1 - z0 - d);
      if (Math.abs(cx - 35) < 14 && Math.abs(cz - 40) < 12) continue; // keep the test wall clear
      if (colliders.some((b) => cx + w / 2 > b.x0 - 2 && cx - w / 2 < b.x1 + 2 && cz + d / 2 > b.z0 - 2 && cz - d / 2 < b.z1 + 2)) continue;
      building(cx, cz, w, d, 6 + rng() * rng() * 26);
    }
  }
  // North-of-bay towers for the skyline.
  building(90, -170, 16, 14, 34); building(120, -165, 14, 12, 26); building(150, -175, 18, 14, 40);
  building(180, -160, 12, 12, 22); building(70, -185, 12, 10, 20);

  // Street signs on posts.
  function sign(x, z, text, bg) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x666666 }));
    pole.position.set(x, 1.7, z); scene.add(pole);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), new THREE.MeshLambertMaterial({ map: signTexture(text, bg || '#0e6b3c', '#ffffff'), side: THREE.DoubleSide }));
    p.position.set(x, 3.4, z); scene.add(p);
  }
  sign(13, 12, 'HARBOR BLVD'); sign(73, 12, 'PIER AVENUE'); sign(-43, 72, 'OCEAN DRIVE');
  sign(-43, 124, 'MARINA PIER', '#7a2e2e'); sign(133, 12, 'NORTHSIDE AVE'); sign(-13, -52, 'HARBOR BRIDGE', '#2e4a7a');

  // Streetlights: pole + lamp + glow sprite (glows at night).
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampSpots = [];
  for (const r of V_ROADS) for (let z = r.z0 + 8; z < r.z1; z += 34) lampSpots.push([r.x + 7.5, z]);
  for (const r of H_ROADS) for (let x = r.x0 + 8; x < r.x1; x += 34) lampSpots.push([x, r.z + 7.5]);
  for (let i = 0; i < 10; i++) lampSpots.push([-60 - i * 8, 94.5]);
  for (const [x, z] of lampSpots) {
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, 3, z); scene.add(pole);
    const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.set(x, 6.1, z); scene.add(lamp);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false }));
    spr.scale.set(7, 7, 1); spr.position.set(x, 6.1, z); scene.add(spr);
    world.lamps.push(spr);
  }

  // Palm trees along the beach, Ocean Drive and the pier.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 5, 6);
  const frondGeo = new THREE.ConeGeometry(2.6, 1.6, 6);
  function palm(x, z) {
    const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.set(x, 2.5, z); t.rotation.z = (rng() - 0.5) * 0.25; scene.add(t);
    const f = new THREE.Mesh(frondGeo, frondMat); f.position.set(x, 5.6, z); f.scale.y = 0.7; scene.add(f);
    const f2 = new THREE.Mesh(frondGeo, frondMat); f2.position.set(x, 5.1, z); f2.scale.set(0.7, 0.5, 0.7); f2.rotation.y = 1; scene.add(f2);
  }
  for (let z = -10; z < 200; z += 14) palm(-58 + rng() * 3, z);
  for (let z = 0; z < 200; z += 26) palm(-42, z);
  for (let x = -64; x > -136; x -= 16) { palm(x, 95.5); palm(x + 8, 104.5); }

  // Beach umbrellas + loungers.
  const umbColors = [0xff4757, 0x2ed573, 0x1e90ff, 0xffa502, 0xeccc68, 0xff6b81];
  for (let i = 0; i < 14; i++) {
    const x = -68 + rng() * 8, z = -5 + rng() * 190;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), poleMat);
    pole.position.set(x, 1.2, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.9, 8), new THREE.MeshLambertMaterial({ color: pick(rng, umbColors) }));
    top.position.set(x, 2.7, z); scene.add(top);
  }

  // The pier: deck, posts, and the big ferris wheel landmark.
  const deckMat = new THREE.MeshLambertMaterial({ color: 0xa9805a });
  const deck = new THREE.Mesh(boxGeo, deckMat);
  deck.scale.set(82, 0.6, 12); deck.position.set(-99, 0.3, 100); scene.add(deck);
  for (let x = -64; x > -140; x -= 8) for (const zz of [95.5, 104.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), deckMat);
    post.position.set(x, -0.6, zz); scene.add(post);
  }
  // Getaway boat moored at the pier end.
  const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
  hull.scale.set(7, 1.6, 2.6); hull.position.set(-136, 0.7, 112); hull.rotation.y = 0.5; scene.add(hull);
  const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cabin.scale.set(3, 1.4, 2); cabin.position.set(-136, 2.1, 112); cabin.rotation.y = 0.5; scene.add(cabin);

  const wheel = new THREE.Group();
  wheel.position.set(-105, 19, 100);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.55, 8, 40), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(10, 0.35, 8, 32), new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
  wheel.add(rim2);
  const spokeGeo = new THREE.CylinderGeometry(0.18, 0.18, 30, 5);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(spokeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    s.rotation.z = (i * Math.PI) / 4; wheel.add(s);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
  wheel.add(hub);
  const cabGeo = new THREE.BoxGeometry(1.8, 1.5, 1.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(cabGeo, new THREE.MeshLambertMaterial({ color: pick(rng, umbColors) }));
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    wheel.add(cab);
  }
  scene.add(wheel);
  world.ferris = wheel;
  // Wheel supports + ticket booth.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 21, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    leg.position.set(-105 + s * 5, 9.5, 100); leg.rotation.z = s * 0.28; scene.add(leg);
  }
  const booth = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xff6b81 }));
  booth.scale.set(4, 3, 3); booth.position.set(-96, 2.1, 100); scene.add(booth);

  // Harbor Bridge over the bay: deck, railings, pillars, approach ramp.
  const bMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  const bDeck = new THREE.Mesh(boxGeo, bMat);
  bDeck.scale.set(14, 1.2, 52); bDeck.position.set(-20, 5.4, -174); scene.add(bDeck);
  const bRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 52), roadMat);
  bRoad.rotation.x = -Math.PI / 2; bRoad.position.set(-20, 6.05, -174); scene.add(bRoad);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd35400 }));
    rail.scale.set(0.4, 1.1, 52); rail.position.set(-20 + s * 6.8, 6.6, -174); scene.add(rail);
  }
  for (const z of [-160, -175, -190, -198]) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 7, 8), bMat);
    pil.position.set(-20, 2, z); scene.add(pil);
  }
  const ramp = new THREE.Mesh(boxGeo, bMat);
  ramp.scale.set(14, 5, 16); ramp.position.set(-20, 0.8, -140); ramp.rotation.x = 0.35; scene.add(ramp);
  const turn = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.2, 16), bMat);
  turn.position.set(-20, 5.4, -204); scene.add(turn);

  // Drifting clouds: soft white blobs high up.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  world.cloudMat = cloudMat;
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rng() * 6, 8, 6), cloudMat);
      puff.scale.y = 0.45; puff.position.set(k * 7 - 7, rng() * 2, rng() * 4); cl.add(puff);
    }
    cl.position.set(-120 + rng() * 300, 70 + rng() * 25, -160 + rng() * 320);
    scene.add(cl); world.clouds.push(cl);
  }
  return world;
}

// Day/night: the clock drives sky, sun, lamps and window glow.
export function updateWorld(dt, scene) {
  world.ferris.rotation.z += dt * 0.12;
  for (const c of world.clouds) { c.position.x += dt * 0.6; if (c.position.x > 260) c.position.x = -180; }
  const wasNight = G.night;
  G.night = G.clock >= 19 || G.clock < 6;
  const dayF = G.night ? 0 : 1;
  const skyDay = new THREE.Color(0x87cdef), skyNight = new THREE.Color(0x0b1a2e);
  const sky = skyDay.clone().lerp(skyNight, 1 - dayF);
  scene.background = sky;
  if (scene.fog) scene.fog.color.copy(sky);
  world.hemi.intensity = lerp(0.35, 0.9, dayF);
  world.dir.intensity = lerp(0.25, 1.6, dayF);
  world.sun.material.opacity = dayF;
  world.sun.visible = dayF > 0.5;
  if (world.sunCore) { world.sunCore.material.opacity = dayF; world.sunCore.visible = dayF > 0.5; }
  if (world.cloudMat) world.cloudMat.opacity = lerp(0.22, 0.92, dayF);
  world.moon.material.opacity = 1 - dayF;
  world.moon.visible = dayF < 0.5;
  for (const m of world.windowMats) m.emissiveIntensity = lerp(1.4, 0.25, dayF);
  for (const s of world.lamps) { s.material.opacity = lerp(0.85, 0, dayF); s.visible = dayF < 0.5; }
  if (G.night !== wasNight && G.started && !G.shotCam) {
    G.banner = G.night ? 'NIGHT FALLS OVER CRIMSON HARBOR' : 'DAWN BREAKS OVER THE HARBOR';
    G.bannerT = 3;
  }
}
