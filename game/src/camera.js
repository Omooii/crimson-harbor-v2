// Third-person chase camera: smooth follow behind the car or the player, speed-based
// distance, crash shake, and a slow orbit for the title screen.
import * as THREE from 'three';
import { lerp, clamp } from './util.js';
export function createCamera(G) {
  const cam = G.camera;
  const C = {
    yaw: 0, pitch: 0.32, dist: 10, look: new THREE.Vector3(),
    update(dt) {
      const p = G.player;
      if (G.screen === 'title') {
        // Attract mode: slow orbit over the city centre.
        const t = performance.now() * 0.00004;
        cam.position.set(Math.cos(t) * 120, 55, Math.sin(t) * 120);
        cam.lookAt(0, 8, 0);
        return;
      }
      const inCar = !!p.car;
      const speed = inCar ? Math.abs(p.car.speed) : 0;
      const wantDist = inCar ? 10.5 + speed * 0.14 : 7.5;
      const wantHeight = inCar ? 4.2 + speed * 0.03 : 3.4;
      // Yaw eases toward the heading of the car / the player's movement.
      let targetYaw = p.heading;
      if (!inCar && (G.input.down('KeyW') || G.input.down('KeyA') || G.input.down('KeyS') || G.input.down('KeyD'))) targetYaw = p.heading;
      let dy = targetYaw - C.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      C.yaw += dy * Math.min(1, dt * (inCar ? 3.2 : 5));
      G.camYaw = C.yaw;
      C.dist = lerp(C.dist, wantDist, Math.min(1, dt * 3));
      const shake = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
      const cx = p.pos.x - Math.sin(C.yaw) * C.dist + shake;
      const cz = p.pos.z - Math.cos(C.yaw) * C.dist + shake;
      const cy = wantHeight + (Math.random() - 0.5) * G.shake * 0.5;
      cam.position.set(cx, cy, cz);
      C.look.set(p.pos.x + Math.sin(C.yaw) * 4, 1.6, p.pos.z + Math.cos(C.yaw) * 4);
      cam.lookAt(C.look);
      G.shake = Math.max(0, G.shake - dt * 1.8);
    },
    snap() {
      const p = G.player;
      C.yaw = p.heading;
      G.camYaw = C.yaw;
      C.dist = p.car ? 10.5 : 7.5;
    },
  };
  return C;
}
