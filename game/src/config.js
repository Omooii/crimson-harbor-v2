// World constants, the palette, the controls, and the four story missions.
// Every system reads its numbers from here, so tuning the game means
// editing this file, not hunting through the systems.
(function () {
  var CH = window.CH;

  var CONFIG = {
    // City layout: roads run along these centre lines on both axes.
    roads: [-150, -90, -30, 30, 90, 150],
    roadHalf: 7,
    bounds: 214,
    blockInset: 9,
    // Sun-soaked palette: warm walls, teal sea, coral accents.
    palette: {
      sky: 0xffb36b,
      fog: 0xf7a56e,
      sun: 0xffd9a0,
      sea: 0x2e8fa3,
      sand: 0xe8cf9a,
      asphalt: 0x3a3a40,
      sidewalk: 0x9a938a,
      walls: [0xf2e3c9, 0xf7c9a0, 0xe89a7a, 0x9fc8c0, 0xd9e2e8, 0xf2d492, 0xc9b8a3, 0x8fb8d8],
      glass: 0x2a4a66,
      roof: 0x5a5148,
    },
    player: {
      walkSpeed: 6,
      runSpeed: 10,
      turnRate: 9,
      maxHealth: 100,
      punchDamage: 25,
      punchRange: 2.4,
      shotDamage: 34,
      shotCooldown: 0.28,
    },
    car: {
      accel: 22,
      brake: 34,
      reverseAccel: 12,
      maxSpeed: 42,
      maxReverse: 12,
      steerRate: 2.1,
      grip: 6.5,
      handbrakeGrip: 1.6,
      maxDamage: 100,
    },
    traffic: { count: 14, parked: 10, cruise: 11 },
    peds: { count: 22 },
    police: {
      // How many pursuit cars each wanted level fields.
      carsByStars: [0, 2, 3, 4, 5, 6],
      chaseSpeed: 46,
      ramDamage: 6,
      bustSeconds: 2.5,
      loseSeconds: 22,
    },
    wanted: {
      stealCar: 1,
      hitPed: 1,
      killPed: 2,
      hitCop: 2,
      shoot: 1,
      max: 5,
    },
    cash: { start: 500, bustFine: 150, wastedFine: 100 },
    autosaveSeconds: 20,
  };

  // Landmarks the missions and the minimap share. All sit on open ground
  // (the city generator keeps buildings clear of them).
  var LANDMARKS = {
    garage: { x: -63, z: 117, name: 'Harbor Garage' },
    office: { x: 45, z: -45, name: "Mara's Office" },
    marina: { x: 176, z: 60, name: 'Marina Lot' },
    docks: { x: -120, z: -186, name: 'Harbor Docks' },
    warehouse: { x: -60, z: -186, name: 'Harbor Warehouse' },
    safehouse: { x: 120, z: 150, name: 'Safehouse' },
    hospital: { x: 150, z: -120, name: 'St. Coral Hospital' },
    precinct: { x: -150, z: -30, name: 'Harbor Precinct' },
  };

  var MISSIONS = [
    {
      id: 1,
      title: 'First Fare',
      brief: 'Mara needs a driver she can trust. Get in a car and bring it to the Harbor Garage.',
      reward: 500,
      steps: [
        { kind: 'goto', target: 'garage', text: 'Drive to the Harbor Garage' },
      ],
    },
    {
      id: 2,
      title: 'Hot Wheels',
      brief: 'A red Comet is sitting in the Marina Lot with the keys in it. Steal it — quietly, if you can.',
      reward: 750,
      steps: [
        { kind: 'goto', target: 'marina', text: 'Go to the Marina Lot' },
        { kind: 'steal', target: 'marina', text: 'Steal the red Comet' },
        { kind: 'deliverCar', target: 'garage', text: 'Bring the Comet to the Harbor Garage' },
      ],
    },
    {
      id: 3,
      title: 'Harbor Run',
      brief: 'A package is waiting at the docks. Mara wants it at her office fast — the clock is running.',
      reward: 1000,
      steps: [
        { kind: 'goto', target: 'docks', text: 'Pick up the package at the Harbor Docks' },
        { kind: 'timed', target: 'office', seconds: 150, text: "Deliver the package to Mara's Office" },
      ],
    },
    {
      id: 4,
      title: 'The Big Score',
      brief: 'One last job at the warehouse — then shake the heat and get home. Make it count.',
      reward: 2000,
      steps: [
        { kind: 'goto', target: 'warehouse', text: 'Reach the Harbor Warehouse' },
        { kind: 'heat', target: 'warehouse', text: 'Lose the cops — break line of sight' },
        { kind: 'goto', target: 'safehouse', text: 'Get to the Safehouse' },
      ],
    },
  ];

  CH.CONFIG = CONFIG;
  CH.LANDMARKS = LANDMARKS;
  CH.MISSIONS = MISSIONS;
})();
