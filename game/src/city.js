// Procedural Crimson Harbor: ground texture with roads and markings, ~90 canvas-windowed
// buildings, palms, streetlights, docks, beach props. Seeded, so seed 7 always builds the same city.
import * as THREE from 'three';
import { WORLD, ROADS } from './config.js';
import { mulberry32, canvasTexture, pick } from './util.js';

function groundTexture(THREE, rng) {
  const S = WORLD.size; // world units across the texture
  const toPx = (v) => (v + S / 2) / S * 1024;
  return canvasTexture(THREE, 1024, 1024, (x) => {
    x.fillStyle = '#3d4148'; x.fillRect(0, 0, 1024, 1024); // asphalt base
    // Sand (east) and docks apron (south)
    x.fillStyle = '#e8d29a'; x.fillRect(toPx(WORLD.beachX), 0, 1024 - toPx(WORLD.beachX), 1024);
    x.fillStyle = '#9a8f74'; x.fillRect(0, toPx(WORLD.harborZ), toPx(WORLD.beachX), 1024 - toPx(WORLD.harborZ));
    // Speckle the sand
    for (let i = 0; i < 900; i++) { x.fillStyle = rng() > 0.5 ? '#dcc489' : '#f2e2ac'; x.fillRect(toPx(WORLD.beachX) + rng() * (1024 - toPx(WORLD.beachX)), rng() * 1024, 2, 2); }
    // Sidewalk slabs per block
    x.fillStyle = '#6f7278';
    for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
      const ax = toPx(ROADS[i] + WORLD.roadWidth / 2), az = toPx(ROADS[j] + WORLD.roadWidth / 2);
      const bw = toPx(ROADS[i + 1] - WORLD.roadWidth / 2) - ax, bh = toPx(ROADS[j + 1] - WORLD.roadWidth / 2) - az;
      x.fillRect(ax, az, bw, bh);
      x.fillStyle = (i + j) % 5 === 0 ? '#5d8a5a' : '#6f7278'; // a few green lots
      x.fillRect(ax + 2, az + 2, bw - 4, bh - 4);
      x.fillStyle = '#6f7278';
    }
    // Lane dashes
    x.fillStyle = '#e8e6da';
    for (const r of ROADS) {
      for (let v = -260; v < 260; v += 18) { x.fillRect(toPx(r) - 1, toPx(v), 2, 8); x.fillRect(toPx(v), toPx(r) - 1, 8, 2); }
    }
    // Crosswalks at every intersection
    x.fillStyle = 'rgba(232,230,218,.85)';
    for (const rx of ROADS) for (const rz of ROADS) {
      for (let k = -5; k <= 5; k += 2.6) { x.fillRect(toPx(rx + k) - 1, toPx(rz - 8), 2, 4); x.fillRect(toPx(rx - 8), toPx(rz + k) - 1, 4, 2); }
    }
    // Boardwalk planks between the beach road (x=210) and the sand.
    x.fillStyle = '#a98056';
    x.fillRect(toPx(217), 0, toPx(224) - toPx(217), 1024);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1;
    for (let v = -280; v < 280; v += 6) { x.beginPath(); x.moveTo(toPx(217), toPx(v)); x.lineTo(toPx(224), toPx(v)); x.stroke(); }
    // Dock piers (south)
    x.fillStyle = '#7a6248';
    for (const px of [-150, -30, 90]) x.fillRect(toPx(px - 5), toPx(216), toPx(px + 5) - toPx(px - 5), toPx(262) - toPx(216));
  });
}

function windowTexture(THREE, rng, base, lit) {
  return canvasTexture(THREE, 128, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) for (let c = 0; c < 5; c++) {
      const on = rng() < lit;
      x.fillStyle = on ? '#ffd97a' : (rng() < 0.5 ? '#2b3542' : '#35424f');
      x.fillRect(8 + c * 23, 10 + r * 24, 16, 14);
    }
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h - 12, w, 12);
  });
}

export function buildCity(G) {
  const rng = mulberry32(G.seed);
  const scene = G.scene;
  const colliders = []; // {x0,z0,x1,z1} building footprints
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshLambertMaterial({ map: groundTexture(THREE, rng) }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Ocean (east) and harbor water (south)
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(240, WORLD.size + 240), waterMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(WORLD.waterX + 120, 0.05, 0); scene.add(ocean);
  const harbor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 240, 240), waterMat.clone());
  harbor.rotation.x = -Math.PI / 2; harbor.position.set(0, 0.05, WORLD.waterZ + 120); scene.add(harbor);
  G.water = [ocean, harbor];

  // Building materials: 3 facades x (sides + roof)
  const facades = [
    windowTexture(THREE, rng, '#c9b8a3', 0.25),
    windowTexture(THREE, rng, '#a8b5c4', 0.3),
    windowTexture(THREE, rng, '#b7a6b0', 0.2),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const sideMats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const neonColors = [0xff2e63, 0x08d9d6, 0xffd166, 0xf72585];

  // One or two buildings per block; taller near Old Town centre.
  for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
    const cx = (ROADS[i] + ROADS[i + 1]) / 2, cz = (ROADS[j] + ROADS[j + 1]) / 2;
    const bx = ROADS[i] + WORLD.roadWidth / 2 + WORLD.blockInset, bz = ROADS[j] + WORLD.roadWidth / 2 + WORLD.blockInset;
    const bw = ROADS[i + 1] - ROADS[i] - WORLD.roadWidth - WORLD.blockInset * 2;
    const bd = ROADS[j + 1] - ROADS[j] - WORLD.roadWidth - WORLD.blockInset * 2;
    const centre = Math.hypot(cx, cz);
    if ((i + j) % 7 === 3) { // pocket park: palms + benches instead of a building
      for (let k = 0; k < 5; k++) palms.push([bx + 4 + rng() * (bw - 8), bz + 4 + rng() * (bd - 8)]);
      continue;
    }
    const n = rng() < 0.4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = n === 1 ? bw : bw / 2 - 2, d = n === 1 ? bd : bd;
      const px = n === 1 ? cx : bx + w / 2 + k * (w + 4);
      const tall = centre < 90 ? 16 + rng() * 30 : 8 + rng() * 14;
      const h = Math.min(46, tall);
      const mat = sideMats[Math.floor(rng() * 3)];
      const mesh = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
      mesh.scale.set(w, h, d); mesh.position.set(px, h / 2, cz);
      mesh.castShadow = true;
      scene.add(mesh);
      colliders.push({ x0: px - w / 2, z0: cz - d / 2, x1: px + w / 2, z1: cz + d / 2 });
      buildings.push(mesh);
      if (rng() < 0.3) { // rooftop AC box
        const ac = new THREE.Mesh(boxGeo, roofMat);
        ac.scale.set(3, 1.4, 2.4); ac.position.set(px + w / 4, h + 0.7, cz); scene.add(ac);
      }
      if (rng() < 0.35) { // neon shop sign on the street face
        const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 0.4),
          new THREE.MeshBasicMaterial({ color: pick(rng, neonColors) }));
        sign.position.set(px, 4.2, cz + d / 2 + 0.3); scene.add(sign);
        G.neon = G.neon || []; G.neon.push(sign);
      }
    }
  }

  // Landmark: the Harbor Tower in Old Town, tallest in the city.
  const tower = new THREE.Mesh(boxGeo, [sideMats[1], sideMats[1], roofMat, roofMat, sideMats[1], sideMats[1]]);
  tower.scale.set(24, 64, 24); tower.position.set(0, 32, 0); tower.castShadow = true; scene.add(tower);
  colliders.push({ x0: -12, z0: -12, x1: 12, z1: 12 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2e63 }));
  beacon.position.set(0, 65.5, 0); scene.add(beacon); G.beacon = beacon;

  // Palms: trunk + 6 fronds (crossed planes). Shared geometry/materials.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const frondGeo = new THREE.PlaneGeometry(5.4, 1.3);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57, side: THREE.DoubleSide });
  function addPalm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 3.5; trunk.rotation.z = (rng() - 0.5) * 0.25; g.add(trunk);
    for (let f = 0; f < 6; f++) {
      const fr = new THREE.Mesh(frondGeo, frondMat);
      fr.position.y = 7; fr.rotation.y = f * Math.PI / 3; fr.rotation.x = -0.5;
      fr.translateY(0.2); fr.translateX(0); fr.position.x = Math.cos(f * Math.PI / 3) * 1.6; fr.position.z = Math.sin(f * Math.PI / 3) * 1.6;
      g.add(fr);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  for (let z = -260; z <= 200; z += 26) { addPalm(220.5, z); if (rng() < 0.6) addPalm(232 + rng() * 20, z + 8); }
  for (let x = -240; x <= 180; x += 30) if (rng() < 0.7) addPalm(x, 220);
  for (const [x, z] of palms) addPalm(x, z);

  // Streetlights along every road, every 60 units.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const lampOff = new THREE.MeshBasicMaterial({ color: 0x555a63 });
  for (const r of ROADS) for (let v = -210; v <= 210; v += 60) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(r + 7.5, 3.25, v); scene.add(pole);
    const lamp = new THREE.Mesh(lampGeo, lampOff);
    lamp.position.set(r + 7.5, 6.6, v); scene.add(lamp);
    lamps.push(lamp);
  }
  G.lamps = lamps; G.lampMat = lampMat; G.lampOff = lampOff;

  // Beach props: umbrellas + loungers.
  const umbGeo = new THREE.ConeGeometry(2.2, 1.1, 8);
  const umbMats = [0xff6b6b, 0x4ecdc4, 0xffd166, 0x118ab2].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 22; i++) {
    const x = 228 + rng() * 32, z = -240 + rng() * 440;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4), poleMat);
    pole.position.set(x, 1.2, z); scene.add(pole);
    const umb = new THREE.Mesh(umbGeo, umbMats[i % 4]);
    umb.position.set(x, 2.7, z); scene.add(umb);
    const lounger = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf4f1de }));
    lounger.scale.set(0.8, 0.25, 2); lounger.position.set(x + 1.8, 0.25, z + 1); scene.add(lounger);
  }
  // Dock crates + containers.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const contMats = [0x2a9d8f, 0xe76f51, 0x264653].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 18; i++) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    const s = 1.6 + rng() * 1.6;
    crate.scale.set(s, s, s);
    crate.position.set(-200 + rng() * 360, s / 2, 218 + rng() * 30);
    crate.rotation.y = rng() * Math.PI; scene.add(crate);
    colliders.push({ x0: crate.position.x - s / 2, z0: crate.position.z - s / 2, x1: crate.position.x + s / 2, z1: crate.position.z + s / 2 });
  }
  for (let i = 0; i < 8; i++) {
    const cont = new THREE.Mesh(boxGeo, contMats[i % 3]);
    cont.scale.set(8, 2.6, 2.6);
    cont.position.set(-180 + i * 48, 1.3, 236 + (i % 2) * 8);
    scene.add(cont);
    colliders.push({ x0: cont.position.x - 4, z0: cont.position.z - 1.3, x1: cont.position.x + 4, z1: cont.position.z + 1.3 });
  }
  // Moored boats in the harbor.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe9e5d8 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, hullMat); hull.scale.set(3, 1.4, 9); boat.add(hull);
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x457b9d })); cab.scale.set(2.2, 1.4, 3); cab.position.set(0, 1.3, -1); boat.add(cab);
    boat.position.set(-160 + i * 62, 0.4, 282 + (i % 2) * 14);
    boat.rotation.y = (rng() - 0.5) * 0.4;
    scene.add(boat);
    G.boats = G.boats || []; G.boats.push(boat);
  }
  G.city = { colliders, buildings, count: buildings.length };
  return G.city;
}
// Circle vs building colliders: returns push-out offset or null.
export function collideCircle(G, x, z, r) {
  for (const c of G.city.colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1)), nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) { const d = Math.sqrt(d2); return { x: dx / d * (r - d), z: dz / d * (r - d) }; }
      return { x: r, z: 0 };
    }
  }
  return null;
}
