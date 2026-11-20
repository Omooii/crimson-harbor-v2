// The city of Crimson Harbor: a seeded grid of blocks with procedural
// buildings (canvas-drawn windows), a painted ground texture (roads,
// sidewalks, beach, harbor apron), palms, lamps, the harbor with piers and
// boats, sunset lighting and fog. Also owns the collision boxes and the
// road helpers the traffic, pedestrians and missions use.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;
  var LANDMARKS = CH.LANDMARKS;

  var WORLD_HALF = 230;
  var TEX = 4096;
  // Pixel sizes in paintGround are written for a 2048 canvas and scaled
  // by PX, so the markings keep their world size at any resolution.
  var PX = TEX / 2048;

  function worldToTex(v) { return ((v + WORLD_HALF) / (WORLD_HALF * 2)) * TEX; }

  function makeWindowTexture(baseColor, litRatio, rng) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = baseColor;
    g.fillRect(0, 0, 128, 256);
    // Subtle vertical shading so flat walls read as concrete.
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    for (var row = 0; row < 10; row++) {
      for (var col = 0; col < 4; col++) {
        var lit = rng.next() < litRatio;
        g.fillStyle = lit ? '#ffd27a' : '#2c4258';
        g.fillRect(10 + col * 28, 14 + row * 24, 18, 14);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(10 + col * 28, 14 + row * 24, 18, 3);
      }
    }
    // Dark base stripe so the building meets the ground.
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 240, 128, 16);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function makePalmTexture() {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#2f7a3d';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var x2 = 64 + Math.cos(a) * 56;
      var y2 = 64 + Math.sin(a) * 40 + 18;
      g.beginPath();
      g.moveTo(64, 64);
      g.quadraticCurveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 22 - 12, x2, y2);
      g.stroke();
    }
    g.fillStyle = '#7a4a22';
    g.beginPath();
    g.arc(64, 64, 7, 0, Math.PI * 2);
    g.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function paintGround(rng) {
    var c = document.createElement('canvas');
    c.width = TEX;
    c.height = TEX;
    var g = c.getContext('2d');
    var roads = CONFIG.roads;
    var roadPx = (CONFIG.roadHalf * 2 / (WORLD_HALF * 2)) * TEX;

    // Dry ground base.
    g.fillStyle = '#8a8172';
    g.fillRect(0, 0, TEX, TEX);

    // Beach: sand east of x = 157, water east of x = 205.
    var sandGrad = g.createLinearGradient(worldToTex(157), 0, worldToTex(205), 0);
    sandGrad.addColorStop(0, '#e3cd96');
    sandGrad.addColorStop(1, '#f4e4b4');
    g.fillStyle = sandGrad;
    g.fillRect(worldToTex(157), 0, worldToTex(205) - worldToTex(157), TEX);
    var seaGrad = g.createLinearGradient(worldToTex(205), 0, TEX, 0);
    seaGrad.addColorStop(0, '#3a9db1');
    seaGrad.addColorStop(1, '#1b6b82');
    g.fillStyle = seaGrad;
    g.fillRect(worldToTex(205), 0, TEX - worldToTex(205), TEX);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3 * PX;
    for (var w = 0; w < 40; w++) {
      var wy = rng.range(0, TEX);
      var wx = worldToTex(205) + rng.range(0, TEX - worldToTex(205) - 60 * PX);
      g.beginPath();
      g.arc(wx, wy, rng.range(8 * PX, 26 * PX), 0.2, Math.PI - 0.2);
      g.stroke();
    }

    // Harbor apron: concrete north of z = -157.
    g.fillStyle = '#8f8a80';
    g.fillRect(0, 0, worldToTex(157), worldToTex(-157));
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2 * PX;
    for (var s = 0; s < 8; s++) {
      g.strokeRect(worldToTex(-200) + s * 90 * PX, worldToTex(-210), 70 * PX, 34 * PX);
    }

    // Blocks: sidewalk slabs with a darker inner court. Blocks sit between
    // consecutive roads; two of them are parks.
    for (var i = 0; i < roads.length - 1; i++) {
      for (var j = 0; j < roads.length - 1; j++) {
        var x0 = roads[i] + CONFIG.roadHalf + 1;
        var x1 = roads[i + 1] - CONFIG.roadHalf - 1;
        var z0 = roads[j] + CONFIG.roadHalf + 1;
        var z1 = roads[j + 1] - CONFIG.roadHalf - 1;
        var park = (i === 1 && j === 1) || (i === 3 && j === 3);
        g.fillStyle = park ? '#5d8a4a' : '#a39a88';
        g.fillRect(worldToTex(x0), worldToTex(z0), worldToTex(x1) - worldToTex(x0), worldToTex(z1) - worldToTex(z0));
        if (park) {
          g.fillStyle = '#4c7a3c';
          for (var p = 0; p < 14; p++) {
            g.beginPath();
            g.arc(rng.range(worldToTex(x0 + 4), worldToTex(x1 - 4)), rng.range(worldToTex(z0 + 4), worldToTex(z1 - 4)), rng.range(6 * PX, 14 * PX), 0, Math.PI * 2);
            g.fill();
          }
        } else {
          g.fillStyle = '#938a78';
          g.fillRect(worldToTex(x0 + 3), worldToTex(z0 + 3), worldToTex(x1 - 3) - worldToTex(x0 + 3), worldToTex(z1 - 3) - worldToTex(z0 + 3));
        }
      }
    }

    // Roads: asphalt bands on both axes.
    g.fillStyle = '#34343a';
    roads.forEach(function (r) {
      g.fillRect(0, worldToTex(r - CONFIG.roadHalf), worldToTex(157), roadPx);
      g.fillRect(worldToTex(r - CONFIG.roadHalf), worldToTex(-157), roadPx, TEX - worldToTex(-157));
    });
    // Centre dashes and edge lines.
    g.fillStyle = '#e8c33c';
    roads.forEach(function (r) {
      for (var d = -220; d < 220; d += 12) {
        g.fillRect(worldToTex(d), worldToTex(r) - 1 * PX, 14 * PX, 2 * PX);
        g.fillRect(worldToTex(r) - 1 * PX, worldToTex(d), 2 * PX, 14 * PX);
      }
    });
    g.fillStyle = 'rgba(255,255,255,0.5)';
    roads.forEach(function (r) {
      g.fillRect(0, worldToTex(r - CONFIG.roadHalf) + 2 * PX, worldToTex(157), 2 * PX);
      g.fillRect(0, worldToTex(r + CONFIG.roadHalf) - 4 * PX, worldToTex(157), 2 * PX);
      g.fillRect(worldToTex(r - CONFIG.roadHalf) + 2 * PX, worldToTex(-157), 2 * PX, TEX - worldToTex(-157));
      g.fillRect(worldToTex(r + CONFIG.roadHalf) - 4 * PX, worldToTex(-157), 2 * PX, TEX - worldToTex(-157));
    });
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(255,255,255,0.75)';
    roads.forEach(function (rx) {
      roads.forEach(function (rz) {
        for (var k = -3; k <= 3; k++) {
          g.fillRect(worldToTex(rx + k * 3.4) - 1 * PX, worldToTex(rz - CONFIG.roadHalf) + 2 * PX, 3 * PX, 12 * PX);
          g.fillRect(worldToTex(rx + k * 3.4) - 1 * PX, worldToTex(rz + CONFIG.roadHalf) - 14 * PX, 3 * PX, 12 * PX);
          g.fillRect(worldToTex(rx - CONFIG.roadHalf) + 2 * PX, worldToTex(rz + k * 3.4) - 1 * PX, 12 * PX, 3 * PX);
          g.fillRect(worldToTex(rx + CONFIG.roadHalf) - 14 * PX, worldToTex(rz + k * 3.4) - 1 * PX, 12 * PX, 3 * PX);
        }
      });
    });
    // Speckle for texture.
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (var n = 0; n < 4000 * PX * PX; n++) {
      g.fillRect(rng.range(0, TEX), rng.range(0, TEX), 2 * PX, 2 * PX);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function createCity(scene, rng) {
    var palette = CONFIG.palette;
    var solids = [];
    var group = new THREE.Group();
    group.name = 'city';
    scene.add(group);

    // Sky, fog and sunset light.
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.fog, 70, 360);
    var hemi = new THREE.HemisphereLight(0xffd9b0, 0x8a6a55, 1.15);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(palette.sun, 1.9);
    sun.position.set(-120, 95, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);
    var ambient = new THREE.AmbientLight(0xffe0b8, 0.45);
    scene.add(ambient);

    // Sun disc + glow low in the west.
    var sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
    );
    sunDisc.position.set(-320, 45, -30);
    sunDisc.lookAt(0, 35, -30);
    scene.add(sunDisc);

    // Ground.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
      new THREE.MeshStandardMaterial({ map: paintGround(rng), roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // Water sheen over the sea strip.
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(30, WORLD_HALF * 2),
      new THREE.MeshStandardMaterial({ color: palette.sea, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.25 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(215, 0.12, 0);
    group.add(water);

    // Building materials: six tinted window walls, one roof, one base.
    var wallHex = ['#f2e3c9', '#f7c9a0', '#e89a7a', '#9fc8c0', '#d9e2e8', '#f2d492'];
    var sideMats = wallHex.map(function (hex) {
      return new THREE.MeshStandardMaterial({ map: makeWindowTexture(hex, 0.35, rng), roughness: 0.85 });
    });
    var roofMat = new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.95 });
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 });
    var glassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a9e, roughness: 0.3, metalness: 0.1 });
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);

    function addBuilding(cx, cz, w, d, h, matIndex, glass) {
      var mats = glass
        ? [glassMat, glassMat, roofMat, baseMat, glassMat, glassMat]
        : [sideMats[matIndex], sideMats[matIndex], roofMat, baseMat, sideMats[matIndex], sideMats[matIndex]];
      var mesh = new THREE.Mesh(boxGeo, mats);
      mesh.scale.set(w, h, d);
      mesh.position.set(cx, h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      solids.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      return mesh;
    }

    function nearLandmark(x, z, pad) {
      return Object.keys(LANDMARKS).some(function (key) {
        var l = LANDMARKS[key];
        return CH.dist(x, z, l.x, l.z) < pad;
      });
    }

    // Downtown blocks: 1-4 buildings each, taller near the centre.
    var roads = CONFIG.roads;
    var towers = [[-8, -8], [24, 40], [-52, 30]];
    for (var i = 0; i < roads.length - 1; i++) {
      for (var j = 0; j < roads.length - 1; j++) {
        var x0 = roads[i] + CONFIG.roadHalf + 2;
        var x1 = roads[i + 1] - CONFIG.roadHalf - 2;
        var z0 = roads[j] + CONFIG.roadHalf + 2;
        var z1 = roads[j + 1] - CONFIG.roadHalf - 2;
        if ((i === 1 && j === 1) || (i === 3 && j === 3)) continue; // parks
        var cx = (x0 + x1) / 2;
        var cz = (z0 + z1) / 2;
        var centreDist = CH.dist(cx, cz, 0, 0);
        var lots = rng.pick([1, 2, 2, 3, 4]);
        for (var lot = 0; lot < lots; lot++) {
          var w = rng.range(12, 20);
          var d = rng.range(12, 20);
          var bx = rng.range(x0 + w / 2 + 1, x1 - w / 2 - 1);
          var bz = rng.range(z0 + d / 2 + 1, z1 - d / 2 - 1);
          if (nearLandmark(bx, bz, 16)) continue;
          var nearTower = towers.some(function (t) { return CH.dist(bx, bz, t[0], t[1]) < 19; });
          if (nearTower) continue;
          var tall = centreDist < 90 ? rng.range(18, 42) : rng.range(8, 22);
          addBuilding(bx, bz, w, d, tall, rng.int(0, 5), rng.chance(0.12));
        }
      }
    }
    // Three glass towers near the centre.
    addBuilding(-8, -8, 22, 22, 62, 0, true);
    addBuilding(24, 40, 18, 18, 54, 0, true);
    addBuilding(-52, 30, 16, 20, 48, 0, true);

    // Harbor: warehouses, containers, cranes, piers, boats.
    addBuilding(-60, -186, 40, 18, 12, 2, false);
    addBuilding(-130, -186, 30, 16, 10, 4, false);
    var containerColors = [0xc94f3d, 0x3d7ac9, 0x53a05a, 0xd8a03c, 0x7a5ac9];
    var contGeo = new THREE.BoxGeometry(12, 2.6, 2.6);
    for (var k = 0; k < 14; k++) {
      var cont = new THREE.Mesh(contGeo, new THREE.MeshStandardMaterial({ color: containerColors[k % 5], roughness: 0.8 }));
      cont.position.set(-190 + (k % 7) * 15, 1.3 + (k > 6 ? 2.7 : 0), -172 + Math.floor(k / 7) * 8);
      cont.castShadow = true;
      group.add(cont);
      solids.push({ minX: cont.position.x - 6, maxX: cont.position.x + 6, minZ: cont.position.z - 1.3, maxZ: cont.position.z + 1.3 });
    }
    function addCrane(x, z) {
      var mat = new THREE.MeshStandardMaterial({ color: 0xd8a03c, roughness: 0.7 });
      var leg = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), mat);
      leg.position.set(x, 13, z);
      leg.castShadow = true;
      var arm = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), mat);
      arm.position.set(x + 8, 26, z);
      arm.castShadow = true;
      group.add(leg);
      group.add(arm);
    }
    addCrane(-100, -200);
    addCrane(-160, -200);
    var woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
    [-60, 40].forEach(function (pz) {
      var pier = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 6), woodMat);
      pier.position.set(215, 0.6, pz);
      pier.castShadow = true;
      group.add(pier);
    });
    function addBoat(x, z, hue) {
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3.4), new THREE.MeshStandardMaterial({ color: hue, roughness: 0.6 }));
      hull.position.y = 0.8;
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 2.6), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.7 }));
      cabin.position.set(-0.5, 2.6, 0);
      boat.add(hull);
      boat.add(cabin);
      boat.position.set(x, 0, z);
      boat.rotation.y = rng.range(0, Math.PI);
      group.add(boat);
    }
    addBoat(222, -70, 0xd8e8f0);
    addBoat(224, 30, 0xc94f3d);
    addBoat(220, 110, 0x3d7ac9);

    // Palms: trunk + two crossed alpha frond planes.
    var palmTex = makePalmTexture();
    var trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    var frondMat = new THREE.MeshStandardMaterial({ map: palmTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
    var frondGeo = new THREE.PlaneGeometry(9, 9);
    function addPalm(x, z, scale) {
      var palm = new THREE.Group();
      var trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5;
      trunk.castShadow = true;
      trunk.rotation.z = rng.range(-0.08, 0.08);
      var f1 = new THREE.Mesh(frondGeo, frondMat);
      f1.position.y = 7.6;
      var f2 = new THREE.Mesh(frondGeo, frondMat);
      f2.position.y = 7.6;
      f2.rotation.y = Math.PI / 2;
      palm.add(trunk);
      palm.add(f1);
      palm.add(f2);
      palm.position.set(x, 0, z);
      palm.scale.setScalar(scale || 1);
      palm.rotation.y = rng.range(0, Math.PI);
      group.add(palm);
    }
    for (var pb = 0; pb < 26; pb++) addPalm(rng.range(160, 200), rng.range(-200, 200), rng.range(0.9, 1.3));
    for (var pp = 0; pp < 24; pp++) {
      var park = pp % 2 === 0 ? { x: -60, z: -60 } : { x: 60, z: 60 };
      addPalm(park.x + rng.range(-18, 18), park.z + rng.range(-18, 18), rng.range(0.8, 1.2));
    }
    roads.forEach(function (r, idx) {
      if (idx % 2 !== 0) return;
      for (var t = -180; t <= 180; t += 45) {
        addPalm(r + 9.5, t + rng.range(-4, 4), rng.range(0.8, 1.1));
      }
    });

    // Street lamps along the two central avenues.
    var lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.18, 5.5, 6);
    var lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2f2f33, roughness: 0.6, metalness: 0.4 });
    var lampHeadGeo = new THREE.SphereGeometry(0.38, 8, 8);
    var lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 1.6 });
    function addLamp(x, z) {
      var pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
      pole.position.set(x, 2.75, z);
      var head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      head.position.set(x, 5.7, z);
      group.add(pole);
      group.add(head);
    }
    for (var lx = -180; lx <= 180; lx += 30) {
      addLamp(lx, -30 + 8.5);
      addLamp(lx, 30 - 8.5);
    }

    // Clouds: soft white blobs high up.
    var cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 128;
    var cg = cloudCanvas.getContext('2d');
    cg.fillStyle = 'rgba(255,240,220,0.85)';
    for (var cb = 0; cb < 9; cb++) {
      cg.beginPath();
      cg.ellipse(40 + cb * 22, 64 + rng.range(-16, 16), rng.range(24, 44), rng.range(14, 24), 0, 0, Math.PI * 2);
      cg.fill();
    }
    var cloudTex = new THREE.CanvasTexture(cloudCanvas);
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    var cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false });
    for (var ci = 0; ci < 7; ci++) {
      var cloud = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(60, 110), rng.range(26, 44)), cloudMat);
      cloud.position.set(rng.range(-260, 260), rng.range(95, 140), rng.range(-260, 60));
      cloud.lookAt(0, 60, 0);
      scene.add(cloud);
    }

    function resolveCircle(pos, radius) {
      var b = CONFIG.bounds;
      pos.x = CH.clamp(pos.x, -b, b);
      pos.z = CH.clamp(pos.z, -b, b);
      for (var i = 0; i < solids.length; i++) {
        var s = solids[i];
        var nx = CH.clamp(pos.x, s.minX, s.maxX);
        var nz = CH.clamp(pos.z, s.minZ, s.maxZ);
        var dx = pos.x - nx;
        var dz = pos.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            var d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            // Inside the box: push out along the smallest penetration.
            var pl = pos.x - s.minX + radius;
            var pr = s.maxX - pos.x + radius;
            var pt = pos.z - s.minZ + radius;
            var pb2 = s.maxZ - pos.z + radius;
            var m = Math.min(pl, pr, pt, pb2);
            if (m === pl) pos.x = s.minX - radius;
            else if (m === pr) pos.x = s.maxX + radius;
            else if (m === pt) pos.z = s.minZ - radius;
            else pos.z = s.maxZ + radius;
          }
        }
      }
    }

    function isRoad(x, z) {
      return roads.some(function (r) { return Math.abs(x - r) < CONFIG.roadHalf || Math.abs(z - r) < CONFIG.roadHalf; });
    }

    function randomRoadPoint(out) {
      var r = roads[Math.floor(rng.next() * roads.length)];
      if (rng.next() < 0.5) { out.x = r + rng.range(-3, 3); out.z = rng.range(-200, 200); }
      else { out.x = rng.range(-200, 200); out.z = r + rng.range(-3, 3); }
      return out;
    }

    return {
      group: group,
      solids: solids,
      sun: sun,
      resolveCircle: resolveCircle,
      isRoad: isRoad,
      randomRoadPoint: randomRoadPoint,
      // Keep the shadow frustum centred on the player.
      followShadows: function (x, z) {
        sun.position.set(x - 120, 95, z + 55);
        sun.target.position.set(x, 0, z);
      },
    };
  }

  CH.createCity = createCity;
})();
