// Pedestrians and the player character — simple animated capsule people.
import { mulberry32, rand, pick, clamp } from './util.js';
import { ROADS, BEACH_X } from './world.js';

const SHIRTS = [0xff6b6b, 0xffd166, 0x4ecdc4, 0xff8fab, 0x7fd1ff, 0x9b5de5, 0xf2ead8, 0x2f9e5f, 0xff6b35, 0x8ecae6];
const PANTS = [0x2a3a5c, 0x3a3a3a, 0x5c4a2a, 0x1f4d3a, 0x6b4a8a];
const SKINS = [0xf2c89b, 0xc98a5e, 0x8a5a3a, 0xe8b48a, 0x6b4226];

export function makePersonMesh(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin || pick(rng, SKINS);
  const shirt = opts.shirt || pick(rng, SHIRTS);
  const pants = opts.pants || pick(rng, PANTS);
  const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.28);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.16, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.16, 0.4, 0);
  legL.castShadow = legR.castShadow = true;
  g.add(legL); g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.16; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, 1.4), new THREE.MeshLambertMaterial({ color: opts.hair || pick(rng, [0x2b1c12, 0x4a2f1a, 0x111111, 0x8a6a3a, 0xd43a3a]) }));
  hair.position.y = 1.82; g.add(hair);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xd43a3a }));
    cap.position.y = 1.98; g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), new THREE.MeshLambertMaterial({ color: 0xd43a3a }));
    brim.position.set(0, 1.95, 0.32); g.add(brim);
  }
  g.userData = { legL, legR, phase: rand(rng, 0, 6) };
  return g;
}

export class Pedestrians {
  constructor(scene, world, count) {
    this.scene = scene; this.world = world;
    this.rng = mulberry32(31337);
    this.list = [];
    for (let i = 0; i < count; i++) this.spawn(i < 6); // first few on the beach
  }
  spawn(beach) {
    const rng = this.rng;
    let x, z;
    if (beach) { x = rand(rng, 308, 352); z = rand(rng, -280, 280); }
    else {
      const road = pick(rng, [...ROADS, BEACH_X]);
      if (rng() < 0.5) { x = road + pick(rng, [-10, 10]); z = rand(rng, -300, 300); }
      else { x = rand(rng, -300, 300); z = road + pick(rng, [-10, 10]); }
    }
    const mesh = makePersonMesh(rng, {});
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const p = { mesh, x, z, heading: rand(rng, 0, Math.PI * 2), speed: rand(rng, 1.1, 1.9), panic: 0, beach: !!beach, hp: 100, dead: false };
    this.list.push(p);
    return p;
  }
  update(dt, threat) {
    for (const p of this.list) {
      if (p.dead) continue;
      // panic near threat (player car / gunfire)
      if (threat) {
        const d = Math.hypot(p.x - threat.x, p.z - threat.z);
        if (d < 10) p.panic = 1;
      }
      if (p.panic > 0) {
        p.panic = Math.max(0, p.panic - dt * 0.25);
        p.heading += rand(this.rng, -1, 1) * dt * 2;
      } else if (this.rng() < dt * 0.08) {
        p.heading += rand(this.rng, -1.2, 1.2);
      }
      const sp = p.speed * (p.panic > 0 ? 2.6 : 1);
      let nx = p.x + Math.sin(p.heading) * sp * dt;
      let nz = p.z + Math.cos(p.heading) * sp * dt;
      if (p.beach) { nx = clamp(nx, 304, 356); nz = clamp(nz, -310, 310); }
      else {
        const [cx, cz] = this.world.collide(nx, nz, 0.6);
        nx = cx; nz = cz;
        if (Math.abs(nx - p.x) < 0.001 && Math.abs(nz - p.z) < 0.001) p.heading += Math.PI / 2;
      }
      p.x = nx; p.z = nz;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // walk cycle
      const u = p.mesh.userData;
      u.phase += dt * sp * 4.2;
      u.legL.rotation.x = Math.sin(u.phase) * 0.55;
      u.legR.rotation.x = -Math.sin(u.phase) * 0.55;
    }
  }
  // place N pedestrians near a point (sidewalks / beach) for screenshots
  stageNear(x, z, n, beach) {
    const rng = mulberry32(999);
    let placed = 0;
    for (const p of this.list) {
      if (placed >= n) break;
      if (beach) { p.x = 312 + (placed % 5) * 6 + rand(rng, -2, 2); p.z = z - 30 + placed * 9; p.beach = true; }
      else {
        const side = placed % 2 === 0 ? -10 : 10;
        p.x = x + side + rand(rng, -2, 2); p.z = z - 34 + placed * 8;
        p.beach = false;
      }
      p.heading = rand(rng, 0, Math.PI * 2); p.panic = 0;
      p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.heading;
      placed++;
    }
  }
  // hit test: returns ped within cone of (x,z,heading)
  hitTest(x, z, heading, range) {
    let best = null, bestD = range;
    for (const p of this.list) {
      if (p.dead) continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d > range) continue;
      const dot = (dx * Math.sin(heading) + dz * Math.cos(heading)) / Math.max(d, 0.001);
      if (dot > 0.86 && d < bestD) { best = p; bestD = d; }
    }
    return best;
  }
  kill(p) {
    p.dead = true;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.3;
    for (const other of this.list) {
      if (!other.dead && Math.hypot(other.x - p.x, other.z - p.z) < 25) other.panic = 1;
    }
  }
}
