// config.js — every tunable number of Crimson Harbor in one place: the
// city grid, the sunset palette, the vehicles, the story missions and the
// key bindings. Nothing here touches the DOM or the renderer.
(function () {
  'use strict';

  // City layout: 6 x 6 blocks separated by roads. Roads run north-south
  // (avenues, constant x) and east-west (streets, constant z).
  var BLOCK = 46; // block side, in world units
  var ROAD = 14; // road width
  var GRID = 6; // blocks per side
  var PITCH = BLOCK + ROAD;
  var HALF = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 187

  // Road centre lines, from west to east / north to south.
  var avenues = [];
  var streets = [];
  for (var i = 0; i <= GRID; i++) {
    avenues.push(-HALF + i * PITCH);
    streets.push(-HALF + i * PITCH);
  }
  // Block centres: each block sits between two roads, so its centre is
  // half a road plus half a block past the road before it.
  var blockCenters = [];
  for (var j = 0; j < GRID; j++) {
    blockCenters.push(-HALF + ROAD / 2 + BLOCK / 2 + j * PITCH);
  }

  var cfg = {
    BLOCK: BLOCK,
    ROAD: ROAD,
    GRID: GRID,
    HALF: HALF,
    avenues: avenues,
    streets: streets,
    blockCenters: blockCenters,
    // Playable bounds (the harbour water and the south beach lie beyond).
    bounds: { minX: -205, maxX: 225, minZ: -205, maxZ: 245 },
    // Water lines: harbour to the east, open sea to the south.
    harborX: 198,
    seaZ: 232,

    // Landmarks the story and the missions point at. Block centres are
    // -157, -97, -37, 23, 83, 143; roads sit at -187, -127, -67, -7, 53,
    // 113, 173. Every mission leg runs along a road, so a driver can
    // reach each marker without cutting across a block.
    garage: { x: -37, z: 83, name: 'Harbor Garage' },
    spawn: { x: -16, z: 88, heading: 2.2 },
    taxiSpot: { x: -3.5, z: 78, heading: Math.PI },
    sportsSpot: { x: -89, z: -63.5, heading: Math.PI / 2 },
    hotel: { x: -7, z: -37, name: 'Sunset Hotel' },
    beach: { x: -7, z: 205, name: 'South Beach' },
    dealership: { x: -97, z: -37, name: 'Bayview Motors' },
    warehouse: { x: 143, z: 53, name: 'Pier 9 Warehouse' },
    dock: { x: 205, z: 143, name: 'Harbor Dock' },
    bank: { x: 53, z: -97, name: 'First Harbor Bank' },

    // Sunset palette.
    skyTop: 0x2e1a52,
    skyMid: 0xff7e5f,
    skyLow: 0xffc98a,
    sunColor: 0xffd76a,
    fogColor: 0xf2a06b,
    fogNear: 120,
    fogFar: 420,
    groundColor: 0x3d3a44,
    sidewalkColor: 0x8d8794,
    roadColor: 0x2e2c33,
    sandColor: 0xe8c98f,
    waterColor: 0x2e6f8e,

    // Vehicles: accel (units/s^2), top speed (units/s), turn (rad/s at speed).
    cars: {
      sedan: { accel: 14, topSpeed: 26, turn: 2.1, body: 0x7a8ba0, label: 'Sedan' },
      taxi: { accel: 15, topSpeed: 27, turn: 2.2, body: 0xf2b705, label: 'Taxi' },
      truck: { accel: 9, topSpeed: 19, turn: 1.6, body: 0x9a6b4f, label: 'Truck' },
      sports: { accel: 22, topSpeed: 38, turn: 2.6, body: 0xc0392b, label: 'Sports' },
      police: { accel: 19, topSpeed: 34, turn: 2.5, body: 0x1c2733, label: 'Police' }
    },

    // The story: four jobs from Mara, who runs the Harbor Garage.
    // Each job also carries Mara's own words: one line when the job
    // starts, one when each step opens, one when the job is done.
    missions: [
      {
        id: 'fare',
        name: 'First Fare',
        reward: 500,
        giver: 'Mara',
        intro: 'Mara needs a driver she can trust. Take her taxi, pick up the client at the Sunset Hotel, drop them at South Beach.',
        lines: {
          start: 'Taxi\u2019s gassed up. Don\u2019t scratch her — she\u2019s my favorite.',
          done: 'Clean run. You\u2019re hired, kid.'
        },
        steps: [
          { type: 'enter', car: 'taxi', text: 'Get in Mara\u2019s taxi' },
          { type: 'goto', at: 'hotel', radius: 20, text: 'Pick up the client at the Sunset Hotel', line: 'Client\u2019s waiting at the hotel. Look sharp.' },
          { type: 'goto', at: 'beach', radius: 20, text: 'Drop the client at South Beach', line: 'They\u2019re in. South Beach, avenue all the way.' }
        ]
      },
      {
        id: 'wheels',
        name: 'Hot Wheels',
        reward: 750,
        giver: 'Mara',
        intro: 'A buyer wants the red Comet GT at Bayview Motors. Borrow it. Bring it to the garage, no questions.',
        lines: {
          start: 'Red Comet GT at Bayview Motors. Bring it home quiet.',
          done: 'The buyer will love this one. Nice work.'
        },
        steps: [
          { type: 'enter', car: 'sports', at: 'dealership', text: 'Take the Comet GT from Bayview Motors' },
          { type: 'goto', at: 'garage', radius: 18, text: 'Bring the Comet GT to the Harbor Garage', line: 'You got her. Now bring her in — easy does it.' }
        ]
      },
      {
        id: 'harbor',
        name: 'Harbor Run',
        reward: 1000,
        giver: 'Mara',
        intro: 'A crate at Pier 9 has to reach the Harbor Dock before the tide turns. 150 seconds. Don\u2019t be late.',
        timeLimit: 150,
        lines: {
          start: 'Crate\u2019s at Pier 9. The dock closes with the tide — 150 seconds.',
          done: 'Right on time. The tide can wait.'
        },
        steps: [
          { type: 'goto', at: 'warehouse', radius: 16, text: 'Pick up the crate at Pier 9 Warehouse' },
          { type: 'goto', at: 'dock', radius: 16, text: 'Deliver the crate to the Harbor Dock', line: 'Crate\u2019s loaded. Harbor Dock, and don\u2019t stop for anyone.' }
        ]
      },
      {
        id: 'score',
        name: 'The Big Score',
        reward: 2000,
        giver: 'Mara',
        intro: 'One briefcase at First Harbor Bank. Take it, and the whole city will be looking for you. Lose them, bring it home.',
        lines: {
          start: 'One briefcase. In, out, gone. The whole city will be looking.',
          done: 'We\u2019re rich. Don\u2019t spend it all in one place.'
        },
        steps: [
          { type: 'goto', at: 'bank', radius: 14, text: 'Grab the briefcase at First Harbor Bank', wanted: 3 },
          { type: 'goto', at: 'garage', radius: 18, text: 'Lose the heat and bring the briefcase to the garage', line: 'You have it. Lose the heat, then come home.' }
        ]
      }
    ],

    // Districts: five named quarters. Standing rises when you finish
    // work in a quarter and falls when you get busted there.
    districts: ['Northgate', 'Old Town', 'West End', 'Harborfront', 'Southside'],

    // Driver ranks, by experience. Steps pay 25 XP, a finished job 100.
    ranks: [
      { xp: 0, name: 'Rookie' },
      { xp: 100, name: 'Wheelman' },
      { xp: 250, name: 'Getaway Ace' },
      { xp: 500, name: 'Harbor Legend' }
    ],

    // Driver abilities: Nitro burns a meter while held; Quick Repair
    // and Bribe run on cooldowns.
    abilities: {
      nitro: { name: 'Nitro', key: 'SHIFT', drain: 22, regen: 12 },
      repair: { name: 'Quick Repair', key: 'R', cooldown: 30 },
      bribe: { name: 'Bribe', key: 'B', cost: 150, cooldown: 5 }
    },

    keys: {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      run: ['ShiftLeft', 'ShiftRight'],
      nitro: ['ShiftLeft', 'ShiftRight'],
      enter: ['KeyE'],
      action: ['KeyF'],
      weapon: ['KeyQ'],
      brake: ['Space'],
      repair: ['KeyR'],
      bribe: ['KeyB'],
      stats: ['Tab'],
      pause: ['KeyP', 'Escape'],
      mute: ['KeyM']
    },

    saveKey: 'crimson-harbor-save-v3'
  };

  window.CH = window.CH || {};
  window.CH.config = cfg;
})();
