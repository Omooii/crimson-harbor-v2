// Crimson Harbor: a procedural sun-soaked coastal city — grid streets, colourful
// facades, shop signs, beach, palms, props, and a day/night sky.
import { mulberry32, rand, pick, clamp, lerp, facadeTexture, signTexture, canvasTexture } from './util.js';

export const ROADS = [-240, -160, -80, 0, 80, 160, 240];
export const BEACH_X = 280;
export const CITY = 330;
const AVE_NAMES = { '-240': 'Harbor Ave', '-160': 'Crimson St', '-80': 'Market St', '0': 'Meridian Ave', '80': 'Palm Row', '160': 'Coral Ave', '240': 'Sunset Blvd', '280': 'Ocean Blvd' };
const ST_NAMES = { '-240': 'Northgate', '-160': 'Lighthouse Rd', '-80': 'Juniper St', '0': 'Central St', '80': 'Marina Way', '160': 'Coral St', '240': 'Southpoint' };
const PALETTE = ['#ff9fb2', '#ffb36b', '#ffd166', '#ff8f6b', '#f4a7c3', '#7fd1c0', '#8ecae6', '#f2b880', '#e07a9a', '#ffc4d6'];
const SHOPS = ['TACOS', 'SURF SHOP', 'CAFÉ LUNA', 'PIER 9', 'NEON BAR', 'BAIT & TACKLE', 'DONUTS', 'VINYL', 'SEAFOOD', 'HOTEL SOL', 'GYM', 'LAUNDROMAT'];

export function districtAt(x, z) {
  if (x >= 235) return 'PALM SHORES';
  if (z <= -180) return 'NORTH BRIDGE';
  if (Math.abs(x) <= 120 && Math.abs(z) <= 120) return 'DOWNTOWN';
  if (x < -120 && z > 0) return 'OLD HARBOR';
  if (x < -120) return 'NORTHSIDE';
  return 'MARKET ROW';
}
export function streetAt(x, z) {
  let bx = ROADS[0], bz = ROADS[0], dx = 1e9, dz = 1e9;
  for (const r of [...ROADS, BEACH_X]) { if (Math.abs(x - r) < dx) { dx = Math.abs(x - r); bx = r; } }
  for (const r of ROADS) { if (Math.abs(z - r) < dz) { dz = Math.abs(z - r); bz = r; } }
  return (dx <= dz ? AVE_NAMES[String(bx)] : ST_NAMES[String(bz)]) || 'Ocean Blvd';
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(20261121);
    this.colliders = []; // {x0,z0,x1,z1}
    this.buildings = []; // {x,z,w,d,h,color}
    this.lamps = [];     // lamp head meshes (emissive toggle)
    this.signs = [];
    this.roadMeshes = [];
    this.time = 18.3;    // game hours; golden hour by default
    this.build();
    this.setupSky();
  }
  build() {
    const rng = this.rng, S = this.scene;
    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), new THREE.MeshLambertMaterial({ color: 0x8a7a5c }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(60, 0, 0); ground.receiveShadow = true; S.add(ground);
    // city slab
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), new THREE.MeshLambertMaterial({ color: 0x9a938a }));
    slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0.02, 0); slab.receiveShadow = true; S.add(slab);
    // sand + water
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 720), new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(330, 0.03, 0); sand.receiveShadow = true; S.add(sand);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(500, 1100), new THREE.MeshLambertMaterial({ color: 0x2a7f9e, transparent: true, opacity: 0.92 }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(640, 0.05, 0); S.add(this.water);
    // roads (dark asphalt strips with centre dashes)
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
    for (const r of [...ROADS, BEACH_X]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(14, 660), roadMat);
      a.rotation.x = -Math.PI / 2; a.position.set(r, 0.06, 0); a.receiveShadow = true; S.add(a);
      for (let z = -320; z < 320; z += 16) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), dashMat);
        d.rotation.x = -Math.PI / 2; d.position.set(r, 0.09, z); S.add(d);
      }
    }
    for (const r of ROADS) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(660, 14), roadMat);
      a.rotation.x = -Math.PI / 2; a.position.set(0, 0.06, r); a.receiveShadow = true; S.add(a);
      for (let x = -320; x < 320; x += 16) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
        d.rotation.x = -Math.PI / 2; d.position.set(x, 0.09, r); S.add(d);
      }
    }
    // sidewalks around blocks
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a2 });
    // buildings
    const grid = [-280, -200, -120, -40, 40, 120, 200]; // block centres
    for (const bx of grid) for (const bz of grid) {
      const downtown = Math.abs(bx) <= 120 && Math.abs(bz) <= 120;
      const n = downtown ? 1 : (rng() < 0.5 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const w = n === 2 ? rand(rng, 22, 30) : rand(rng, 34, 52);
        const d = n === 2 ? rand(rng, 22, 30) : rand(rng, 34, 52);
        const h = downtown ? rand(rng, 26, 72) : rand(rng, 10, 30);
        const ox = n === 2 ? (i === 0 ? -17 : 17) : 0;
        const oz = n === 2 ? (i === 0 ? -14 : 14) : 0;
        const x = bx + ox, z = bz + oz;
        if (Math.abs(x) > 315 || Math.abs(z) > 315) continue;
        const color = pick(rng, PALETTE);
        const tex = facadeTexture(rng, color, 0.55);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const roof = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roof, roof, mat, mat]);
        b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true; S.add(b);
        this.buildings.push({ x, z, w, d, h, color });
        this.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        // rooftop props
        if (rng() < 0.6) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), new THREE.MeshLambertMaterial({ color: 0x888888 }));
          ac.position.set(x + rand(rng, -w / 4, w / 4), h + 1, z + rand(rng, -d / 4, d / 4)); S.add(ac);
        }
        // shop sign + awning on street-facing side
        if (h < 34 && rng() < 0.75) {
          const sign = pick(rng, SHOPS);
          const sm = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5),
            new THREE.MeshBasicMaterial({ map: signTexture(sign, pick(rng, ['#20203a', '#3a1020', '#10283a', '#2a1a05']), pick(rng, ['#ffd75e', '#ff7ab8', '#7fe3ff', '#7dff9a'])) }));
          const face = Math.abs(x) > Math.abs(z) ? 'x' : 'z';
          if (face === 'x') { sm.position.set(x + (x > 0 ? -1 : 1) * (w / 2 + 0.2), 4.6, z); sm.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; }
          else { sm.position.set(x, 4.6, z + (z > 0 ? -1 : 1) * (d / 2 + 0.2)); sm.rotation.y = z > 0 ? Math.PI : 0; }
          S.add(sm); this.signs.push(sm);
          const awn = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 3.4), new THREE.MeshLambertMaterial({ color: pick(rng, [0xff6b6b, 0xffd166, 0x4ecdc4, 0xff8fab]) }));
          awn.position.copy(sm.position); awn.position.y = 3.2;
          awn.rotation.y = sm.rotation.y; awn.rotation.z = 0.12; S.add(awn);
        }
        // sidewalk slab under building
        const wk = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, d + 8), walkMat);
        wk.rotation.x = -Math.PI / 2; wk.position.set(x, 0.04, z); wk.receiveShadow = true; S.add(wk);
      }
    }
    // pier (south beach) + lighthouse (north beach)
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 1.5, 10), pierMat);
    pier.position.set(400, 1, 200); pier.castShadow = true; S.add(pier);
    for (let x = 350; x < 460; x += 12) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3, 6), pierMat);
      post.position.set(x, 0, 200); S.add(post);
    }
    const lh = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 26, 10), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
    tower.position.y = 13; tower.castShadow = true; lh.add(tower);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.9, 5, 10), new THREE.MeshLambertMaterial({ color: 0xd43a3a }));
    stripe.position.y = 16; lh.add(stripe);
    const lampTop = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lampTop.position.y = 27; lh.add(lampTop);
    lh.position.set(330, 0, -290); S.add(lh);
    this.lighthouseLamp = lampTop;
    // palms along Ocean Blvd
    for (let z = -300; z <= 300; z += 24) {
      if (this.rng() < 0.25) continue;
      this.palm(272, z); if (this.rng() < 0.5) this.palm(296, z + 8);
    }
    // beach umbrellas + towels
    const umColors = [0xff6b6b, 0xffd166, 0x4ecdc4, 0xff8fab, 0x7fd1ff];
    for (let i = 0; i < 26; i++) {
      const x = rand(rng, 312, 355), z = rand(rng, -300, 300);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 5), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.set(x, 1.7, z); S.add(pole);
      const um = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 8), new THREE.MeshLambertMaterial({ color: pick(rng, umColors) }));
      um.position.set(x, 3.8, z); um.castShadow = true; S.add(um);
      const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3), new THREE.MeshLambertMaterial({ color: pick(rng, umColors) }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = rand(rng, 0, 3); towel.position.set(x + rand(rng, -3, 3), 0.08, z + rand(rng, -3, 3)); S.add(towel);
    }
    // street lamps + hydrants along roads
    for (const r of ROADS) for (let t = -300; t <= 300; t += 60) {
      this.lamp(r + 9, t); this.lamp(r - 9, t + 30);
      if (rng() < 0.4) this.hydrant(r + 8, t + 15);
    }
    for (let t = -300; t <= 300; t += 60) this.lamp(BEACH_X + 9, t);
    // bridge (north, over a canal strip)
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(660, 26), new THREE.MeshLambertMaterial({ color: 0x2a7f9e }));
    canal.rotation.x = -Math.PI / 2; canal.position.set(0, 0.05, -268); S.add(canal);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 40), new THREE.MeshLambertMaterial({ color: 0x777777 }));
    bridge.position.set(0, 1.4, -268); bridge.castShadow = true; S.add(bridge);
    for (const sx of [-9, 9]) for (let z = -286; z <= -250; z += 9) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6), new THREE.MeshLambertMaterial({ color: 0xcc4444 }));
      p.position.set(sx, 4.5, z); S.add(p);
    }
  }
  palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    trunk.position.y = 3.5; trunk.rotation.z = 0.08; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5.5, 4), new THREE.MeshLambertMaterial({ color: 0x2f9e5f }));
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.8, 7.4, Math.sin(a) * 1.8);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
    g.position.set(x, 0, z); this.scene.add(g);
  }
  lamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7.5, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.y = 3.75; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    arm.position.set(-0.9, 7.4, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0x554d33 }));
    head.position.set(-1.9, 7.2, 0); g.add(head);
    g.position.set(x, 0, z); this.scene.add(g);
    this.lamps.push(head);
  }
  hydrant(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0xd43a3a }));
    body.position.y = 0.55; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd43a3a }));
    top.position.y = 1.2; g.add(top);
    g.position.set(x, 0, z); this.scene.add(g);
  }
  setupSky() {
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 800; this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.7);
    this.scene.add(this.hemi);
    // sun flare sprite
    const flareTex = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,.85)');
      gr.addColorStop(0.6, 'rgba(255,120,80,.28)'); gr.addColorStop(1, 'rgba(255,100,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false }));
    this.flare.scale.set(180, 180, 1);
    this.scene.add(this.flare);
    this.scene.fog = new THREE.Fog(0xffc890, 260, 900);
  }
  // Returns lighting state for the current time; call every frame (cheap).
  update(dt, focus) {
    this.time = (this.time + dt / 60) % 24; // 1 game minute per real second
    const t = this.time;
    // sun angle: rises 6:00 east (+x, over the water), sets 19:00 west (-x)
    const dayF = clamp((t - 6) / 13, 0, 1);
    const elev = Math.sin(dayF * Math.PI) * 62 + 2; // degrees
    const azim = lerp(115, -115, dayF); // degrees
    const el = elev * Math.PI / 180, az = azim * Math.PI / 180;
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
    // golden hour: 17:30–19:15
    const golden = clamp(1 - Math.abs(t - 18.4) / 1.1, 0, 1);
    const night = (t < 5.5 || t > 19.6) ? 1 : (t > 19.0 ? (t - 19.0) / 0.6 : (t < 6 ? (5.5 - t) / 0.5 + 1 : 0));
    const nightF = clamp(night, 0, 1);
    const skyDay = new THREE.Color(0x7ec8e8), skyGold = new THREE.Color(0xff9e64), skyNight = new THREE.Color(0x0d1026);
    const sky = skyDay.clone().lerp(skyGold, golden).lerp(skyNight, nightF);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const sunCol = new THREE.Color(0xfff2d0).lerp(new THREE.Color(0xff7a3d), golden).lerp(new THREE.Color(0x8fa8ff), nightF);
    this.sun.color.copy(sunCol);
    this.sun.intensity = lerp(1.35, 0.25, nightF) * (0.75 + 0.25 * golden);
    this.sun.position.copy(sunDir).multiplyScalar(420);
    if (focus) { this.sun.target.position.copy(focus); this.sun.position.add(focus); }
    this.hemi.intensity = lerp(0.75, 0.22, nightF);
    // flare visible near golden hour
    const flareOn = golden > 0.15 && nightF < 0.5;
    this.flare.visible = flareOn;
    if (flareOn) {
      this.flare.position.copy(sunDir).multiplyScalar(700);
      if (focus) this.flare.position.add(focus);
      this.flare.material.opacity = 0.55 + golden * 0.45;
    }
    // lamps + lighthouse at dusk/night
    const lampsOn = t > 18.0 || t < 6.2;
    const lampCol = lampsOn ? 0xffe9a0 : 0x554d33;
    for (const h of this.lamps) h.material.color.setHex(lampCol);
    this.lighthouseLamp.material.color.setHex(lampsOn ? 0xfff2b0 : 0x8a8578);
    this.water.material.color.setHex(nightF > 0.5 ? 0x123a55 : (golden > 0.5 ? 0xc96a4a : 0x2a7f9e));
    return { golden, night: nightF, lampsOn };
  }
  collide(x, z, r) {
    // push a circle out of building AABBs; returns corrected [x,z]
    for (const c of this.colliders) {
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
        else { // centre inside: push out along smallest penetration
          const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r; else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    x = clamp(x, -CITY, 400); z = clamp(z, -CITY, CITY);
    return [x, z];
  }
  onRoad(x, z) {
    for (const r of [...ROADS, BEACH_X]) if (Math.abs(x - r) < 8) return true;
    for (const r of ROADS) if (Math.abs(z - r) < 8) return true;
    return false;
  }
  nearestRoadPoint(x, z) {
    let bx = ROADS[0], bz = ROADS[0], dx = 1e9, dz = 1e9;
    for (const r of [...ROADS, BEACH_X]) if (Math.abs(x - r) < dx) { dx = Math.abs(x - r); bx = r; }
    for (const r of ROADS) if (Math.abs(z - r) < dz) { dz = Math.abs(z - r); bz = r; }
    return dx <= dz ? [bx, z] : [x, bz];
  }
}
