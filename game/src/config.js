// World constants, car and weapon definitions, crew, radio and mission scripts.
// All names, characters and story are original to Crimson Harbor.
export const WORLD = {
  size: 560,           // playable ground spans -280..280
  roadGap: 60,         // distance between parallel roads
  roadWidth: 13,
  beachX: 224,         // sand starts here (east of the boardwalk)
  waterX: 272,         // ocean starts here
  harborZ: 216,        // docks start here (south)
  waterZ: 272,
  blockInset: 8,       // buildings sit this far inside a block
};
export const ROADS = [-210, -150, -90, -30, 30, 90, 150, 210];
export const DISTRICTS = [
  { name: 'MARINA BAY', x0: 120, z0: -280, x1: 280, z1: -30, trust: 50 },
  { name: 'OLD TOWN', x0: -120, z0: -120, x1: 120, z1: 60, trust: 50 },
  { name: 'DOCKSIDE', x0: -280, z0: 120, x1: 120, z1: 280, trust: 50 },
  { name: 'PALM HEIGHTS', x0: -280, z0: -280, x1: -120, z1: -120, trust: 50 },
  { name: 'NORTHGATE', x0: -120, z0: -280, x1: 120, z1: -120, trust: 50 },
  { name: 'SUNCREST', x0: 120, z0: -30, x1: 280, z1: 280, trust: 50 },
];
export const CARS = {
  sedan:   { name: 'HARBOR SEDAN', top: 27, accel: 13, grip: 2.6, color: 0x8fa3b8, len: 4.4, wid: 2.0 },
  sports:  { name: 'VORTEX GT',    top: 40, accel: 19, grip: 3.1, color: 0xc1121f, len: 4.3, wid: 2.0 },
  van:     { name: 'MULE VAN',     top: 23, accel: 10, grip: 2.2, color: 0xd8d3c3, len: 5.0, wid: 2.1 },
  taxi:    { name: 'SUNSET TAXI',  top: 29, accel: 14, grip: 2.7, color: 0xf4a261, len: 4.4, wid: 2.0 },
  scooter: { name: 'WASP SCOOTER', top: 24, accel: 15, grip: 3.6, color: 0x2ec4b6, len: 2.2, wid: 0.9 },
  police:  { name: 'HPD CRUISER',  top: 34, accel: 17, grip: 3.0, color: 0x1d3557, len: 4.5, wid: 2.0 },
};
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 12, mag: Infinity, reserve: Infinity, rate: 0.45, range: 2.6, auto: false },
  { id: 'pistol', name: 'PISTOL', dmg: 26, mag: 12, reserve: 96, rate: 0.28, range: 60, auto: false },
  { id: 'smg', name: 'SMG', dmg: 16, mag: 30, reserve: 180, rate: 0.09, range: 55, auto: true },
];
export const CREW = [
  { id: 'gus', name: 'GUS HARLOW', role: 'MECHANIC · GARAGE', ability: 'FIELD REPAIR — $150', seed: 11, skin: '#c98d64', hair: '#8a8d91', shirt: '#3a5a40', style: 2, cost: 150, cd: 45 },
  { id: 'nadia', name: 'NADIA CROSS', role: 'FIXER · MARINA', ability: 'BRIBE — LOSE 1 STAR · $300', seed: 23, skin: '#8d5524', hair: '#1c1c1c', shirt: '#7b2cbf', style: 1, cost: 300, cd: 60 },
  { id: 'leo', name: 'LEO FINCH', role: 'HACKER · NORTHGATE', ability: 'JAM HELICOPTER · 20s', seed: 37, skin: '#f1c27d', hair: '#5b3a1e', shirt: '#0a9396', style: 0, cost: 0, cd: 90 },
];
export const RADIO = [
  { name: 'HARBOR FM 101.2', track: 'Midnight Cruise — The Velvets', scale: [0, 3, 5, 7, 10], tempo: 112, base: 220 },
  { name: 'WAVE RADIO 88.4', track: 'Salt Air — Marina Blue', scale: [0, 2, 4, 7, 9], tempo: 96, base: 196 },
  { name: 'STATIC FM 93.9', track: 'Night Shift — Copper Kings', scale: [0, 3, 6, 7, 10], tempo: 128, base: 233 },
];
// Mission scripts: 4 jobs, 4 stages each. Markers sit on roads so they are drivable.
export const MISSIONS = [
  { id: 1, name: 'FIRST GEAR', giver: 'GUS HARLOW', pay: 800, rp: 350, time: 420,
    intro: 'Kai. The coupe is tuned and waiting at my shop. Take the package to Nadia at the marina — no scratches, no cops.',
    stages: [
      { text: 'Go to Harlow Auto Works', x: -150, z: -90 },
      { text: 'Get in the Vortex GT', x: -150, z: -90, car: true },
      { text: 'Drive to the Marina drop', x: 150, z: 150 },
      { text: 'Deliver the package to Nadia', x: 150, z: 150, foot: true },
    ] },
  { id: 2, name: 'SMOKE SIGNAL', giver: 'NADIA CROSS', pay: 1500, rp: 600, time: 480,
    intro: 'A rival crew lifted my case. Take it back from the meet at Northgate — and if the law shows up, be somewhere else.',
    stages: [
      { text: 'Reach the meet in Northgate', x: -30, z: -210 },
      { text: 'Grab the case', x: -30, z: -210, foot: true },
      { text: 'Lose the tail — reach the safehouse', x: -210, z: 150, wanted: 2 },
      { text: 'Hand the case to Nadia', x: -210, z: 150, foot: true },
    ] },
  { id: 3, name: 'THE LONG WAY HOME', giver: 'GUS HARLOW', pay: 2500, rp: 900, time: 540,
    intro: 'That coupe is hotter than August. The whole Harbor PD wants it. Take the beach road south — and whatever you do, do not stop.',
    stages: [
      { text: 'Reach the beach road', x: 210, z: -150 },
      { text: 'Outrun the cordon — head south', x: 210, z: 30, wanted: 3 },
      { text: 'Lose the helicopter on the shore road', x: 210, z: 150, wanted: 4 },
      { text: 'Reach the chop shop', x: 210, z: 210, car: true },
    ] },
  { id: 4, name: 'NIGHT TIDE', giver: 'NADIA CROSS', pay: 5000, rp: 1500, time: 600,
    intro: 'Last job, Kai. The cargo is at the docks and the buyer leaves at midnight. Move it quiet, move it fast — then we are done.',
    stages: [
      { text: 'Reach the docks at night', x: 30, z: 210 },
      { text: 'Load the cargo', x: 30, z: 210, foot: true },
      { text: 'Escape the dock blockade', x: -150, z: 210, wanted: 3 },
      { text: 'Deliver to the airfield buyer', x: -210, z: -210, car: true },
    ] },
];
export const RANK_RP = [0, 500, 1200, 2200, 3500, 5200, 7500, 10500, 14000, 18000, 23000];
export const SAVE_KEY = 'crimson-harbor-save-v4';
