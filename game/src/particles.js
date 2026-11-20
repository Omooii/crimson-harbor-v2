// A tiny particle pool for smoke, sparks, muzzle flashes and explosions.
// One THREE.Points cloud, recycled; systems spawn bursts and the pool
// fades them out. Points use a soft round sprite so they read as puffs
// and sparks, not squares.
(function () {
  var CH = window.CH;
  var MAX = 600;

  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function createParticles(scene) {
    var positions = new Float32Array(MAX * 3);
    var colors = new Float32Array(MAX * 3);
    var items = [];
    for (var i = 0; i < MAX; i++) {
      items.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0, size: 1 });
      positions[i * 3 + 1] = -100;
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var material = new THREE.PointsMaterial({
      size: 0.6, vertexColors: true, transparent: true, opacity: 0.9,
      depthWrite: false, sizeAttenuation: true, map: makeSprite(), alphaTest: 0.05,
    });
    var points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    var cursor = 0;
    var color = new THREE.Color();

    function spawn(x, y, z, opts) {
      var p = items[cursor];
      cursor = (cursor + 1) % MAX;
      p.life = p.maxLife = opts.life || 0.7;
      p.vx = opts.vx || 0;
      p.vy = opts.vy || 0;
      p.vz = opts.vz || 0;
      p.grav = opts.grav === undefined ? -4 : opts.grav;
      var i3 = items.indexOf(p) * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      color.set(opts.color || 0xffffff);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    function burst(x, y, z, count, opts) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = (opts.speed || 4) * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, {
          vx: Math.cos(a) * sp,
          vy: (opts.up || 2) * Math.random() + 1,
          vz: Math.sin(a) * sp,
          life: (opts.life || 0.7) * (0.6 + Math.random() * 0.8),
          color: opts.color || 0xffcc66,
          grav: opts.grav,
        });
      }
    }

    function update(dt) {
      for (var i = 0; i < MAX; i++) {
        var p = items[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        var i3 = i * 3;
        if (p.life <= 0) {
          positions[i3 + 1] = -100;
          continue;
        }
        p.vy += p.grav * dt;
        positions[i3] += p.vx * dt;
        positions[i3 + 1] += p.vy * dt;
        positions[i3 + 2] += p.vz * dt;
        var fade = p.life / p.maxLife;
        colors[i3] *= 1;
        colors[i3 + 1] *= 1;
        colors[i3 + 2] *= 1;
        if (fade < 0.3) {
          colors[i3] *= 0.9;
          colors[i3 + 1] *= 0.9;
          colors[i3 + 2] *= 0.9;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }

    return { spawn: spawn, burst: burst, update: update };
  }

  CH.createParticles = createParticles;
})();
