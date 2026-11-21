// Central game state: the G object the whole game reads and writes, the
// player object, and the static tables (weapons, crew, radio, districts).
import { mulberry32 } from './utils.js';

const params = new URLSearchParams(location.search);
export const SEED = Number(params.get('seed')) || 7;
export const rng = mulberry32(SEED);
export const SHOT = params.get('shot') || '';

export const WEAPONS = [
  { name: 'Fists', key: '1', dmg: 0, rate: 0.4, price: 0, owned: true, auto: false },
  { name: 'Crowbar', key: '2', dmg: 25, rate: 0.5, price: 0, owned: true, auto: false },
  { name: 'Pistol', key: '3', dmg: 34, rate: 0.28, price: 0, owned: true, auto: false },
  { name: 'SMG', key: '4', dmg: 22, rate: 0.09, price: 0, owned: true, auto: true },
  { name: 'Shotgun', key: '5', dmg: 20, rate: 0.8, price: 0, owned: true, auto: false, pellets: 5 },
  { name: 'Rifle', key: '6', dmg: 55, rate: 0.15, price: 4500, owned: false, auto: true },
  { name: 'Launcher', key: '7', dmg: 120, rate: 1.1, price: 9000, owned: false, auto: false },
];

export const CREW_DEFS = [
  { name: 'Sable', role: 'Driver', key: 'Q', cdMax: 20, desc: 'Speed boost' },
  { name: 'Ivo', role: 'Hacker', key: 'R', cdMax: 30, desc: 'Scrub a star' },
  { name: 'Tess', role: 'Muscle', key: 'T', cdMax: 25, desc: '+50 armour' },
];

export const SONGS = [
  ["Sunset Over the Pier", 'The Harbor Lights'],
  ['Neon Low Tide', 'Velvet Static'],
  ['Crimson Getaway', 'Rook & the Sirens'],
  ['Boardwalk Summer', 'The Gulls'],
  ['Night Shift on Ocean Drive', 'Marina Blue'],
];

export const DISTRICTS = [
  { name: 'Marina Pier', test: (x, z) => x < -40 },
  { name: 'Northside', test: (x, z) => z < 20 && x >= -40 },
  { name: 'Harborview', test: (x, z) => x < 50 && z >= 20 },
  { name: 'Eastside', test: () => true },
];

export const STREETS = [
  { name: 'Ocean Drive', at: (x, z) => Math.abs(x + 50) < 9 },
  { name: 'Bridge Road', at: (x, z) => Math.abs(x + 20) < 9 && z < -60 },
  { name: 'Harbor Blvd', at: (x, z) => Math.abs(x - 20) < 9 },
  { name: 'Pier Avenue', at: (x, z) => Math.abs(x - 80) < 9 },
  { name: 'Northside Ave', at: (x, z) => Math.abs(x - 140) < 9 },
  { name: 'Marina Way', at: (x, z) => Math.abs(z - 100) < 9 && x < -40 },
  { name: 'Bayfront St', at: (x, z) => Math.abs(z + 100) < 9 },
  { name: 'Coral St', at: (x, z) => Math.abs(z + 40) < 9 },
  { name: 'Palm Row', at: (x, z) => Math.abs(z - 20) < 9 },
  { name: 'Anchor St', at: (x, z) => Math.abs(z - 80) < 9 },
  { name: 'Seagull St', at: (x, z) => Math.abs(z - 140) < 9 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Harborview';
}
export function streetAt(x, z) {
  for (const s of STREETS) if (s.at(x, z)) return s.name;
  return 'Side street';
}
export function repTitle(rp) {
  if (rp >= 3000) return 'Harbor Legend';
  if (rp >= 1500) return 'Harbor Regular';
  if (rp >= 500) return 'Rising Wheelman';
  return 'Harbor Newcomer';
}

// The live game state. The playtest harness reads window.__game.G.
export const G = {
  time: 0, started: false, paused: false, over: false,
  missionIndex: 0, mission: null, missionsDone: 0,
  money: 1250, rp: 3200, day: 3, tune: 4,
  health: 100, armour: 50, wanted: 0, wantedHeat: 0,
  weapon: 2, fireT: 0, boostT: 0, hornT: 0,
  clock: 12, night: false, muted: false,
  camYaw: 1.1, camPitch: 0.35,
  crew: CREW_DEFS.map((c) => ({ ...c, cd: 0 })),
  cars: [], peds: [], parked: [], police: [], heli: null,
  carSpeed: 0, playerSpeed: 0, inSight: false, unseenT: 0, bustT: 0,
  radioIdx: 0, radioT: 0, dialogue: null, dialogueT: 0,
  banner: null, bannerT: 0, shotCam: null, hurtT: 0,
  stats: { shots: 0, hits: 0, punches: 0, driven: 0, pedsDown: 0, earned: 0, kills: 0 },
};

export const player = {
  x: 10, z: 100, y: 0, heading: 1.1, inCar: false, car: null,
  speedKmh: 0, carSpeed: 0, walkPhase: 0, punchT: 0, group: null,
};

export function resetRun() {
  G.time = 0; G.missionIndex = 0; G.missionsDone = 0;
  G.money = 1250; G.rp = 3200; G.day = 3;
  G.health = 100; G.armour = 50; G.wanted = 0; G.wantedHeat = 0;
  G.weapon = 2; G.boostT = 0; G.clock = 12; G.night = false;
  G.crew.forEach((c) => { c.cd = 0; });
  G.stats = { shots: 0, hits: 0, punches: 0, driven: 0, pedsDown: 0, earned: 0, kills: 0 };
  G.over = false; G.paused = false;
  player.x = 10; player.z = 100; player.y = 0; player.heading = 1.1;
  player.inCar = false; player.car = null; player.speedKmh = 0; player.carSpeed = 0;
  G.camYaw = 1.1; G.camPitch = 0.35;
}
