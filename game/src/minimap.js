// Rectangular minimap (308x196): streets, water, sand, and live dots for the player,
// traffic, police, the helicopter and the mission marker. Follows the player.
import { ROADS, WORLD } from './config.js';
const W = 308, H = 180, SCALE = 0.9; // pixels per world unit: ~340 x 200 units visible
export function createMinimap() {
  const cv = document.getElementById('minimap');
  const x = cv.getContext('2d');
  return {
    draw(G) {
      const px = G.player.pos.x, pz = G.player.pos.z;
      const ox = W / 2 - px * SCALE, oz = H / 2 - pz * SCALE;
      const X = (v) => v * SCALE + ox, Z = (v) => v * SCALE + oz;
      // Base: city ground.
      x.fillStyle = '#22262e'; x.fillRect(0, 0, W, H);
      // Water east + south.
      x.fillStyle = '#1e6f8e';
      x.fillRect(X(WORLD.waterX), 0, W, H);
      x.fillRect(0, Z(WORLD.waterZ), W, H);
      // Sand strip.
      x.fillStyle = '#c9b078';
      x.fillRect(X(WORLD.beachX), 0, X(WORLD.waterX) - X(WORLD.beachX), H);
      // Blocks.
      x.fillStyle = '#3a3f47';
      for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
        const ax = X(ROADS[i] + 7), az = Z(ROADS[j] + 7);
        x.fillRect(ax, az, (ROADS[i + 1] - ROADS[i] - 14) * SCALE, (ROADS[j + 1] - ROADS[j] - 14) * SCALE);
      }
      // Roads.
      x.strokeStyle = '#565d68'; x.lineWidth = WORLD.roadWidth * SCALE;
      for (const r of ROADS) {
        x.beginPath(); x.moveTo(X(r), 0); x.lineTo(X(r), H); x.stroke();
        x.beginPath(); x.moveTo(0, Z(r)); x.lineTo(W, Z(r)); x.stroke();
      }
      x.strokeStyle = 'rgba(232,230,218,.5)'; x.lineWidth = 1;
      for (const r of ROADS) {
        x.setLineDash([6, 6]);
        x.beginPath(); x.moveTo(X(r), 0); x.lineTo(X(r), H); x.stroke();
        x.beginPath(); x.moveTo(0, Z(r)); x.lineTo(W, Z(r)); x.stroke();
      }
      x.setLineDash([]);
      // Beach road highlight.
      x.strokeStyle = 'rgba(255,209,102,.55)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(X(210), 0); x.lineTo(X(210), H); x.stroke();
      const dot = (wx, wz, r, color) => { x.fillStyle = color; x.beginPath(); x.arc(X(wx), Z(wz), r, 0, Math.PI * 2); x.fill(); };
      // Peds (tiny), traffic (white), police (flashing blue/red), helicopter (red ring).
      for (const p of G.peds) dot(p.x, p.z, 1, 'rgba(200,200,200,.7)');
      for (const c of G.traffic) dot(c.x, c.z, 2.4, '#e8e6da');
      const flash = Math.sin(performance.now() * 0.012) > 0;
      for (const c of G.police.cars) dot(c.x, c.z, 3.4, flash ? '#ff2e2e' : '#2e6bff');
      for (const f of G.police.foot) if (f.down <= 0) dot(f.x, f.z, 2.6, '#2e6bff');
      if (G.police.heli) {
        dot(G.police.heli.x, G.police.heli.z, 5, '#ff2e2e');
        x.strokeStyle = '#ff2e2e'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(X(G.police.heli.x), Z(G.police.heli.z), 8, 0, Math.PI * 2); x.stroke();
      }
      // Mission marker: pulsing yellow diamond.
      const m = G.mission;
      if (m) {
        const s = m.def.stages[m.stage];
        const r = 6 + Math.sin(performance.now() * 0.006) * 1.5;
        x.fillStyle = '#ffd166';
        x.beginPath();
        x.moveTo(X(s.x), Z(s.z) - r); x.lineTo(X(s.x) + r, Z(s.z)); x.lineTo(X(s.x), Z(s.z) + r); x.lineTo(X(s.x) - r, Z(s.z));
        x.closePath(); x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke();
      } else if (G.missions && G.missions.marker && G.missions.marker.visible) {
        const mx = G.missions.marker.position.x, mz = G.missions.marker.position.z;
        x.fillStyle = '#ffd166';
        x.beginPath(); x.arc(X(mx), Z(mz), 5, 0, Math.PI * 2); x.fill();
      }
      // Player arrow (white, heading-rotated).
      const a = Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading));
      x.save();
      x.translate(X(px), Z(pz)); x.rotate(-a + Math.PI);
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(0, -8); x.lineTo(5.5, 6); x.lineTo(-5.5, 6); x.closePath(); x.fill();
      x.strokeStyle = '#111'; x.lineWidth = 1; x.stroke();
      x.restore();
      // Frame label.
      x.fillStyle = 'rgba(255,255,255,.75)';
      x.font = 'bold 10px system-ui, sans-serif';
      x.fillText('N', 8, 14);
      x.fillText('CRIMSON HARBOR', W - 108, H - 7);
    },
  };
}
