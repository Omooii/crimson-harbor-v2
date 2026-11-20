// minimap.js — the circular street map in the corner of the HUD: roads
// and blocks around the player, the player's arrow, nearby cars, police
// and the gold mission marker. North is up; the map never rotates.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var canvas = null;
  var ctx = null;
  var SIZE = 190;
  var SCALE = 1.05; // pixels per world unit
  var clock = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx = canvas.getContext('2d');
  }

  function toMap(wx, wz, px, pz) {
    return {
      x: SIZE / 2 + (wx - px) * SCALE,
      y: SIZE / 2 + (wz - pz) * SCALE
    };
  }

  function update(dt, state) {
    if (!ctx) return;
    clock += dt;
    var px = state.player.x;
    var pz = state.player.z;
    var g = ctx;
    g.clearRect(0, 0, SIZE, SIZE);

    // Clip to the circle.
    g.save();
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    g.clip();

    // Land.
    g.fillStyle = '#23202a';
    g.fillRect(0, 0, SIZE, SIZE);
    // Water: harbour east, sea south.
    g.fillStyle = '#2e6f8e';
    var hx = toMap(cfg.harborX, 0, px, pz).x;
    g.fillRect(hx, 0, SIZE - hx, SIZE);
    var sz = toMap(0, cfg.seaZ, px, pz).y;
    g.fillRect(0, sz, SIZE, SIZE - sz);
    // Sand strip.
    g.fillStyle = '#b09a68';
    var sandTop = toMap(0, cfg.HALF, px, pz).y;
    g.fillRect(0, sandTop, SIZE, Math.max(0, sz - sandTop));

    // Blocks.
    g.fillStyle = '#4a4552';
    cfg.blockCenters.forEach(function (bx) {
      cfg.blockCenters.forEach(function (bz) {
        var p = toMap(bx - cfg.BLOCK / 2, bz - cfg.BLOCK / 2, px, pz);
        g.fillRect(p.x, p.y, cfg.BLOCK * SCALE, cfg.BLOCK * SCALE);
      });
    });
    // Roads.
    g.strokeStyle = '#6b6575';
    g.lineWidth = cfg.ROAD * SCALE;
    cfg.avenues.forEach(function (x) {
      var p = toMap(x, 0, px, pz);
      g.beginPath();
      g.moveTo(p.x, -10);
      g.lineTo(p.x, SIZE + 10);
      g.stroke();
    });
    cfg.streets.forEach(function (z) {
      var p = toMap(0, z, px, pz);
      g.beginPath();
      g.moveTo(-10, p.y);
      g.lineTo(SIZE + 10, p.y);
      g.stroke();
    });
    // Road centre dashes.
    g.strokeStyle = '#8a8494';
    g.lineWidth = 1;
    g.setLineDash([4, 6]);
    cfg.avenues.forEach(function (x) {
      var p = toMap(x, 0, px, pz);
      g.beginPath();
      g.moveTo(p.x, -10);
      g.lineTo(p.x, SIZE + 10);
      g.stroke();
    });
    cfg.streets.forEach(function (z) {
      var p = toMap(0, z, px, pz);
      g.beginPath();
      g.moveTo(-10, p.y);
      g.lineTo(SIZE + 10, p.y);
      g.stroke();
    });
    g.setLineDash([]);

    // Garage: a green square.
    var gp = toMap(cfg.garage.x, cfg.garage.z, px, pz);
    g.fillStyle = '#4ade80';
    g.fillRect(gp.x - 4, gp.y - 4, 8, 8);

    // Mission marker: a pulsing gold diamond, clamped to the edge.
    if (state.marker) {
      var mp = toMap(state.marker.x, state.marker.z, px, pz);
      var dx = mp.x - SIZE / 2;
      var dy = mp.y - SIZE / 2;
      var d = Math.sqrt(dx * dx + dy * dy);
      var maxR = SIZE / 2 - 12;
      if (d > maxR) {
        mp.x = SIZE / 2 + (dx / d) * maxR;
        mp.y = SIZE / 2 + (dy / d) * maxR;
      }
      var pulse = 6 + Math.sin(clock * 5) * 1.5;
      g.fillStyle = '#ffd76a';
      g.beginPath();
      g.moveTo(mp.x, mp.y - pulse);
      g.lineTo(mp.x + pulse, mp.y);
      g.lineTo(mp.x, mp.y + pulse);
      g.lineTo(mp.x - pulse, mp.y);
      g.closePath();
      g.fill();
    }

    // Other cars: white dots.
    g.fillStyle = '#e8e8f0';
    (state.cars || []).forEach(function (c) {
      var p = toMap(c.x, c.z, px, pz);
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    // Police: flashing red/blue dots.
    var flash = Math.floor(clock * 4) % 2 === 0;
    g.fillStyle = flash ? '#ff4040' : '#4080ff';
    (state.police || []).forEach(function (c) {
      var p = toMap(c.x, c.z, px, pz);
      g.beginPath();
      g.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      g.fill();
    });

    // The player: a white arrow pointing along the heading.
    var cx = SIZE / 2;
    var cy = SIZE / 2;
    var h = state.player.heading;
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.PI - h);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#222';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();

    g.restore();
    // Rim.
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    g.stroke();
  }

  window.CH = window.CH || {};
  window.CH.minimap = {
    init: init,
    update: update
  };
})();
