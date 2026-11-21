// District lookup and standing: each district tracks a trust score that rises when the
// player finishes work there and falls when they cause chaos there.
import { DISTRICTS } from './config.js';
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[1];
}
export function trustOf(G, district) {
  return G.trust[district.name] ?? district.trust;
}
export function adjustTrust(G, district, delta) {
  const cur = trustOf(G, district);
  G.trust[district.name] = Math.max(0, Math.min(100, cur + delta));
}
