// Pedestrians: sidewalk walkers and beachgoers, plus the shared low-poly
// person mesh the player uses too. Peds can be knocked down, flee gunfire,
// and get back up after a while.
import { G, rng } from './state.js';
import { dist, pick } from './utils.js';
import { collideCircle, groundHeightAt } from './world.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8, 0x00cec9];
const PANTS = [0x2c3e50, 0x5d4037, 0x37474f, 0x4a6572, 0x3e2723];

export function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin || 0xe8b88a }));
  head.position.y = 1.68; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2d1a12 }));
  hair.position.y = 1.76; hair.scale.set(1, 0.7, 1); g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.26);
  const lLeg = new THREE.Mesh(legGeo, legMat); lLeg.position.set(-0.17, 0.35, 0); g.add(lLeg);
  const rLeg = new THREE.Mesh(legGeo, legMat); rLeg.position.set(0.17, 0.35, 0); g.add(rLeg);
  const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.2);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const lArm = new THREE.Mesh(armGeo, armMat); lArm.position.set(-0.42, 1.05, 0); g.add(lArm);
  const rArm = new THREE.Mesh(armGeo, armMat); rArm.position.set(0.42, 1.05, 0); g.add(rArm);
  g.userData = { lLeg, rLeg, lArm, rArm, torso, head };
  return g;
}

// Sidewalk strolls: each ped paces a short segment, back and forth.
const STROLLS = [
  [27, 30, 27, 70], [13, 90, 13, 130], [73, 30, 73, 70], [87, 90, 87, 130],
  [27, -90, 27, -50], [133, 30, 133, 70], [27, 150, 27, 190], [87, 150, 87, 190],
  [-43, 30, -43, 70], [-43, 150, -43, 190], [13, -30, 13, 10], [147, 90, 147, 130],
  [30, 27, 70, 27], [90, 87, 130, 87], [30, 147, 70, 147], [90, -33, 130, -33],
  [30, -93, 70, -93], [-57, 30, -57, 70], [-57, 120, -57, 160], [-64, 150, -64, 185],
  [-58, 10, -58, 50], [133, -90, 133, -50], [27, 90, 27, 130], [73, -90, 73, -50],
];

export function spawnPeds(scene) {
  for (let i = 0; i < STROLLS.length; i++) {
    const [ax, az, bx, bz] = STROLLS[i];
    const t = rng();
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const ped = {
      x, z, heading: Math.atan2(bx - ax, bz - az), speed: 1 + rng() * 0.7,
      ax, az, bx, bz, toB: rng() < 0.5, down: false, downT: 0, hp: 100,
      fleeT: 0, phase: rng() * 6, group: makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS)),
    };
    ped.group.position.set(x, groundHeightAt(x, z), z);
    ped.group.rotation.y = ped.heading;
    scene.add(ped.group);
    G.peds.push(ped);
  }
}

export function updatePeds(dt) {
  for (const p of G.peds) {
    if (p.down) {
      p.downT -= dt;
      if (p.downT <= 0) {
        p.down = false; p.hp = 100;
        p.group.rotation.x = 0;
        p.group.position.y = groundHeightAt(p.x, p.z);
      }
      continue;
    }
    if (p.fleeT > 0) p.fleeT -= dt;
    const tx = p.toB ? p.bx : p.ax, tz = p.toB ? p.bz : p.az;
    const d = dist(p.x, p.z, tx, tz);
    if (d < 1.5) { p.toB = !p.toB; continue; }
    const want = Math.atan2(tx - p.x, tz - p.z);
    p.heading = want;
    const sp = p.speed * (p.fleeT > 0 ? 3.2 : 1);
    p.x += Math.sin(p.heading) * sp * dt;
    p.z += Math.cos(p.heading) * sp * dt;
    const [rx, rz] = collideCircle(p.x, p.z, 0.4);
    p.x = rx; p.z = rz;
    p.phase += dt * sp * 2.4;
    const s = Math.sin(p.phase) * 0.5;
    p.group.userData.lLeg.rotation.x = s;
    p.group.userData.rLeg.rotation.x = -s;
    p.group.userData.lArm.rotation.x = -s * 0.7;
    p.group.userData.rArm.rotation.x = s * 0.7;
    p.group.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
    p.group.rotation.y = p.heading;
  }
}

export function knockDown(ped) {
  ped.down = true; ped.downT = 15; ped.hp = 0;
  ped.group.rotation.x = -Math.PI / 2;
  ped.group.position.y = groundHeightAt(ped.x, ped.z) + 0.3;
  G.stats.pedsDown++;
}

export function damagePed(ped, dmg) {
  if (ped.down) return;
  ped.hp -= dmg;
  if (ped.hp <= 0) knockDown(ped);
  else ped.fleeT = 4;
}

export function scarePeds(x, z, radius) {
  for (const p of G.peds) {
    if (!p.down && dist(p.x, p.z, x, z) < radius) p.fleeT = 5;
  }
}

export function nearestPed(x, z, maxD) {
  let best = null, bd = maxD;
  for (const p of G.peds) {
    if (p.down) continue;
    const dd = dist(p.x, p.z, x, z);
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}
