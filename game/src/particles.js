// One pooled THREE.Points particle system: skid smoke, crash sparks, fire, muzzle flashes,
// splashes and confetti bursts. Cheap, no per-particle meshes.
import * as THREE from 'three';
import { canvasTexture } from './util.js';
const MAX = 420;
export function createParticles(G) {
  const tex = canvasTexture(THREE, 32, 32, (x) => {
    const g = x.createRadialGradient(16, 16, 2, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  });
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.PointsMaterial({ size: 1.6, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  G.scene.add(points);
  const P = {
    n: 0, vel: new Float32Array(MAX * 3), life: new Float32Array(MAX), maxLife: new Float32Array(MAX),
    grav: new Float32Array(MAX), grow: new Float32Array(MAX),
    spawn(x, y, z, vx, vy, vz, life, r, g, b, s, grav) {
      if (P.n >= MAX) return;
      const i = P.n++;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      size[i] = s; P.life[i] = life; P.maxLife[i] = life; P.grav[i] = grav || 0; P.grow[i] = 0;
    },
    burst(x, y, z, n, color, speed, life, s) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * speed;
        P.spawn(x, y, z, Math.cos(a) * speed * Math.random(), Math.random() * speed * 0.7, Math.sin(a) * speed * Math.random(), life * (0.5 + Math.random()), color[0], color[1], color[2], s, -e * 0.1);
      }
    },
    smoke(x, y, z) { P.spawn(x, y, z, (Math.random() - 0.5) * 1.5, 1.2 + Math.random(), (Math.random() - 0.5) * 1.5, 1.4, 0.55, 0.55, 0.55, 2.2, 0.4); },
    fire(x, y, z) { P.spawn(x, y, z, (Math.random() - 0.5) * 1, 2 + Math.random() * 2, (Math.random() - 0.5) * 1, 0.6, 1, 0.45 + Math.random() * 0.3, 0.1, 1.8, 0); },
    update(dt) {
      let i = 0;
      while (i < P.n) {
        P.life[i] -= dt;
        if (P.life[i] <= 0) {
          const l = --P.n;
          for (let k = 0; k < 3; k++) { pos[i * 3 + k] = pos[l * 3 + k]; col[i * 3 + k] = col[l * 3 + k]; P.vel[i * 3 + k] = P.vel[l * 3 + k]; }
          size[i] = size[l]; P.life[i] = P.life[l]; P.maxLife[i] = P.maxLife[l]; P.grav[i] = P.grav[l];
          continue;
        }
        P.vel[i * 3 + 1] += P.grav[i] * dt;
        pos[i * 3] += P.vel[i * 3] * dt; pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
        const f = P.life[i] / P.maxLife[i];
        size[i] = Math.max(0.1, size[i] * (1 - dt * 0.4));
        col[i * 3] *= 1; col[i * 3 + 1] *= 1; col[i * 3 + 2] *= 1;
        if (f < 0.3) { col[i * 3] *= 0.96; col[i * 3 + 1] *= 0.96; col[i * 3 + 2] *= 0.96; }
        i++;
      }
      geo.setDrawRange(0, P.n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    },
  };
  return P;
}
