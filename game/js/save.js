// Save / continue: one localStorage slot holding the run's progress.
import { G, player } from './state.js';

export const SAVE_KEY = 'crimson-harbor-save-v6';

export function saveGame() {
  const data = {
    v: 6, money: G.money, missionIndex: G.missionIndex, missionsDone: G.missionsDone,
    rp: G.rp, day: G.day, health: G.health, armour: G.armour, weapon: G.weapon,
    clock: G.clock, x: player.x, z: player.z, stats: G.stats,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 6) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function applySave(d) {
  G.money = d.money; G.missionIndex = d.missionIndex; G.missionsDone = d.missionsDone;
  G.rp = d.rp; G.day = d.day; G.health = d.health; G.armour = d.armour;
  G.weapon = d.weapon; G.clock = d.clock;
  if (d.stats) G.stats = { ...G.stats, ...d.stats };
  player.x = d.x; player.z = d.z;
  G.wanted = 0; G.wantedHeat = 0; G.over = false;
}
