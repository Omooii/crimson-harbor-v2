// city.js — the procedural city of Crimson Harbor: road grid, sidewalk
// blocks, ~90 buildings with lit windows, the harbour and docks to the
// east, the beach and sea to the south, palms, streetlights, and the
// sunset sky. It also owns the collision boxes every mover pushes against.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var colliders = []; // {minX, maxX, minZ, maxZ} per building
  var group = null;
  var sceneRef = null;
  var night = false;
  var skyMesh = null;
  var skyDayTex = null;
  var skyNightTex = null;
  var sunMesh = null;
  var glowMesh = null;
  var moonMesh = null;
  var hemiLight = null;
  var sunLight = null;
  var fillLight = null;
  var lampHeadMat = null;
  var buildingMeshes = []; // {mesh, matIndex}
  var facadeDayMats = [];
  var facadeNightMats = [];

  // --- canvas textures -------------------------------------------------

  function windowTexture(base, lit, rng, litRatio) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    // Subtle vertical shading so facades are not flat.
    var grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.25)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    // Window grid: warm lit panes, some dark.
    var ratio = litRatio === undefined ? 0.55 : litRatio;
    for (var y = 12; y < 248; y += 22) {
      for (var x = 10; x < 120; x += 20) {
        var on = rng() < ratio;
        g.fillStyle = on ? lit : 'rgba(20,24,34,0.9)';
        g.fillRect(x, y, 12, 14);
        if (on && rng() < 0.3) {
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(x, y, 12, 4);
        }
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // A shop sign: one word in bold letters on a dark board. Neon-bright,
  // so the streets feel inhabited after dark too.
  var SIGN_WORDS = ['CAFE', 'BAR', 'SHOP', '24H'];
  var signTextures = null;

  function signTexture(word, color) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    var g = c.getContext('2d');
    g.fillStyle = '#14101c';
    g.fillRect(0, 0, 128, 48);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(3, 3, 122, 42);
    g.fillStyle = color;
    g.font = 'bold 26px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(word, 64, 26);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function roadTexture() {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#2e2c33';
    g.fillRect(0, 0, 64, 64);
    // Asphalt speckle.
    for (var i = 0; i < 160; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)';
      g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    // Dashed centre line along the texture's vertical axis.
    g.fillStyle = '#e8d98a';
    g.fillRect(30, 4, 4, 24);
    g.fillRect(30, 36, 4, 24);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function skyTexture(nightSky) {
    var c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    if (nightSky) {
      grad.addColorStop(0, '#04040e');
      grad.addColorStop(0.45, '#0d1030');
      grad.addColorStop(0.72, '#1a1440');
      grad.addColorStop(0.92, '#2a1a4a');
      grad.addColorStop(1, '#3a2440');
    } else {
      grad.addColorStop(0, '#2e1a52');
      grad.addColorStop(0.45, '#7a3b6e');
      grad.addColorStop(0.72, '#ff7e5f');
      grad.addColorStop(0.92, '#ffc98a');
      grad.addColorStop(1, '#ffe3ae');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // --- builders ----------------------------------------------------------

  function buildSky(scene) {
    sceneRef = scene;
    skyDayTex = skyTexture(false);
    skyNightTex = skyTexture(true);
    skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyDayTex, side: THREE.BackSide, fog: false })
    );
    scene.add(skyMesh);

    // The setting sun: a glowing disc low in the west, dead ahead when
    // driving west down the main street.
    sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: cfg.sunColor, fog: false, transparent: true, opacity: 0.95 })
    );
    sunMesh.position.set(-520, 70, -10);
    sunMesh.lookAt(0, 40, 0);
    scene.add(sunMesh);
    glowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a5c, fog: false, transparent: true, opacity: 0.28 })
    );
    glowMesh.position.set(-522, 70, -10);
    glowMesh.lookAt(0, 40, 0);
    scene.add(glowMesh);
    // The moon, kept hidden until night falls.
    moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(17, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf2, fog: false, transparent: true, opacity: 0.95 })
    );
    moonMesh.position.set(420, 260, -300);
    moonMesh.lookAt(0, 40, 0);
    moonMesh.visible = false;
    scene.add(moonMesh);

    hemiLight = new THREE.HemisphereLight(0xffb37a, 0x4a3a5e, 0.75);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xffc27a, 1.6);
    sunLight.position.set(-160, 140, -60);
    scene.add(sunLight);
    fillLight = new THREE.DirectionalLight(0x8a7bd8, 0.35);
    fillLight.position.set(120, 80, 120);
    scene.add(fillLight);
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
  }

  // Night falls: the sky darkens, the moon comes out, the streetlights
  // take over, and more windows light up. Sunset returns with setNight(false).
  function setNight(on) {
    night = !!on;
    if (!skyMesh) return;
    skyMesh.material.map = night ? skyNightTex : skyDayTex;
    skyMesh.material.needsUpdate = true;
    sunMesh.visible = !night;
    glowMesh.visible = !night;
    moonMesh.visible = night;
    hemiLight.intensity = night ? 0.45 : 0.75;
    sunLight.intensity = night ? 0.7 : 1.6;
    sunLight.color.setHex(night ? 0x8a8ad8 : 0xffc27a);
    fillLight.intensity = night ? 0.12 : 0.35;
    if (sceneRef && sceneRef.fog) sceneRef.fog.color.setHex(night ? 0x14102a : cfg.fogColor);
    if (lampHeadMat) lampHeadMat.emissiveIntensity = night ? 2.4 : 0.9;
    for (var i = 0; i < buildingMeshes.length; i++) {
      var b = buildingMeshes[i];
      b.mesh.material = night ? facadeNightMats[b.matIndex] : facadeDayMats[b.matIndex];
    }
  }

  function isNight() {
    return night;
  }

  function buildGround(scene, rng) {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: cfg.groundColor })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(60, 0, 20);
    scene.add(ground);

    // Roads: dark strips with a dashed centre line.
    var tex = roadTexture();
    var roadLen = cfg.HALF * 2 + cfg.ROAD;
    var roadMat = new THREE.MeshLambertMaterial({ map: tex });
    cfg.avenues.forEach(function (x) {
      var t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(1, Math.round(roadLen / 16));
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.ROAD, roadLen),
        new THREE.MeshLambertMaterial({ map: t })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, 0);
      scene.add(m);
    });
    cfg.streets.forEach(function (z) {
      var t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(1, Math.round(roadLen / 16));
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLen, cfg.ROAD),
        new THREE.MeshLambertMaterial({ map: t })
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI / 2;
      m.position.set(0, 0.02, z);
      scene.add(m);
    });

    // Sidewalk slabs: one per block, slightly raised.
    var slabGeo = new THREE.BoxGeometry(cfg.BLOCK + 2, 0.3, cfg.BLOCK + 2);
    var slabMat = new THREE.MeshLambertMaterial({ color: cfg.sidewalkColor });
    cfg.blockCenters.forEach(function (bx) {
      cfg.blockCenters.forEach(function (bz) {
        var slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(bx, 0.15, bz);
        scene.add(slab);
      });
    });
  }

  function buildBuildings(scene, rng) {
    var facades = [
      windowTexture('#6b5a72', '#ffd76a', rng),
      windowTexture('#5a6b72', '#ffca7a', rng),
      windowTexture('#7a5a4a', '#ffe9a8', rng),
      windowTexture('#4a5a6b', '#ffd76a', rng)
    ];
    facadeDayMats = facades.map(function (t) {
      return new THREE.MeshLambertMaterial({ map: t });
    });
    // Night facades: more windows lit. A separate stream, so the city
    // layout itself is byte-identical to the sunset build.
    var nightRng = util.makeRng(977);
    var nightFacades = [
      windowTexture('#6b5a72', '#ffd76a', nightRng, 0.8),
      windowTexture('#5a6b72', '#ffca7a', nightRng, 0.8),
      windowTexture('#7a5a4a', '#ffe9a8', nightRng, 0.8),
      windowTexture('#4a5a6b', '#ffd76a', nightRng, 0.8)
    ];
    facadeNightMats = nightFacades.map(function (t) {
      return new THREE.MeshLambertMaterial({ map: t });
    });
    var mats = facadeDayMats;
    var roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    buildingMeshes = [];
    // Shop signs: one word per sign, on a fifth of the buildings.
    if (!signTextures) {
      var signColors = ['#ffd76a', '#7ae8c8', '#ff8ab0', '#9ac8ff'];
      signTextures = SIGN_WORDS.map(function (w, i) {
        return signTexture(w, signColors[i % signColors.length]);
      });
    }
    var signRng = util.makeRng(4242);
    var signBackMat = new THREE.MeshLambertMaterial({ color: 0x14101c });
    var signGeo = new THREE.BoxGeometry(0.18, 1.1, 3.4);

    cfg.blockCenters.forEach(function (bx, ix) {
      cfg.blockCenters.forEach(function (bz, iz) {
        // The garage block stays open: Mara's lot, not towers.
        if (bx === cfg.garage.x && bz === cfg.garage.z) {
          buildGarageLot(scene, bx, bz);
          return;
        }
        var n = util.intRange(rng, 2, 3);
        var slots = [
          { dx: -11, dz: -11 }, { dx: 11, dz: -11 },
          { dx: -11, dz: 11 }, { dx: 11, dz: 11 }
        ];
        // Shuffle the slots so buildings land in different corners.
        for (var s = slots.length - 1; s > 0; s--) {
          var k = Math.floor(rng() * (s + 1));
          var tmp = slots[s];
          slots[s] = slots[k];
          slots[k] = tmp;
        }
        for (var b = 0; b < n; b++) {
          var slot = slots[b];
          var w = util.range(rng, 13, 19);
          var d = util.range(rng, 13, 19);
          // Taller towards the centre of town, shorter near the edges.
          var centre = 1 - (Math.abs(bx) + Math.abs(bz)) / 400;
          var h = util.range(rng, 10, 16) + centre * util.range(rng, 8, 34);
          var mesh = new THREE.Mesh(boxGeo, mats[Math.floor(rng() * mats.length)]);
          mesh.scale.set(w, h, d);
          mesh.position.set(bx + slot.dx, 0.3, bz + slot.dz);
          scene.add(mesh);
          buildingMeshes.push({ mesh: mesh, matIndex: mats.indexOf(mesh.material) });
          var roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w + 0.6, 0.8, d + 0.6);
          roof.position.set(bx + slot.dx, 0.3 + h, bz + slot.dz);
          scene.add(roof);
          // A shop sign on the road-facing side, on some buildings.
          if (signRng() < 0.2) {
            var faceMat = new THREE.MeshBasicMaterial({
              map: signTextures[Math.floor(signRng() * signTextures.length)]
            });
            var signMats = [signBackMat, signBackMat, signBackMat, signBackMat, signBackMat, signBackMat];
            var east = slot.dx > 0;
            signMats[east ? 0 : 1] = faceMat;
            var sign = new THREE.Mesh(signGeo, signMats);
            sign.position.set(
              bx + slot.dx + (east ? w / 2 + 0.12 : -w / 2 - 0.12),
              4.2, bz + slot.dz
            );
            scene.add(sign);
          }
          colliders.push({
            minX: bx + slot.dx - w / 2,
            maxX: bx + slot.dx + w / 2,
            minZ: bz + slot.dz - d / 2,
            maxZ: bz + slot.dz + d / 2
          });
        }
      });
    });
  }

  // Mara's garage lot: a low workshop, a fence line and an open yard.
  function buildGarageLot(scene, bx, bz) {
    var wallMat = new THREE.MeshLambertMaterial({ color: 0xb0703c });
    var roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3a3a });
    var shop = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 12), wallMat);
    shop.position.set(bx, 3.8, bz - 12);
    scene.add(shop);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.7, 13), roofMat);
    roof.position.set(bx, 7.6, bz - 12);
    scene.add(roof);
    // Door panels.
    var doorMat = new THREE.MeshLambertMaterial({ color: 0x2e2c33 });
    [-7, 0, 7].forEach(function (dx) {
      var door = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 0.4), doorMat);
      door.position.set(bx + dx, 2.8, bz - 5.8);
      scene.add(door);
    });
    // A sign board over the doors.
    var sign = new THREE.Mesh(
      new THREE.BoxGeometry(20, 2.4, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2b705, emissive: 0x7a5a00 })
    );
    sign.position.set(bx, 8.6, bz - 5.8);
    scene.add(sign);
    colliders.push({ minX: bx - 13, maxX: bx + 13, minZ: bz - 18, maxZ: bz - 6 });
  }

  function buildHarbor(scene, rng) {
    var waterMat = new THREE.MeshLambertMaterial({
      color: cfg.waterColor, transparent: true, opacity: 0.92
    });
    // Harbour water to the east.
    var east = new THREE.Mesh(new THREE.PlaneGeometry(260, 700), waterMat);
    east.rotation.x = -Math.PI / 2;
    east.position.set(cfg.harborX + 130, 0.05, 0);
    scene.add(east);
    // Open sea to the south.
    var south = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), waterMat);
    south.rotation.x = -Math.PI / 2;
    south.position.set(60, 0.05, cfg.seaZ + 130);
    scene.add(south);
    // Sand along the south shore.
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(900, cfg.seaZ - cfg.HALF),
      new THREE.MeshLambertMaterial({ color: cfg.sandColor })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(60, 0.03, (cfg.HALF + cfg.seaZ) / 2);
    scene.add(sand);

    // Wooden piers reaching into the harbour.
    var woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    [60, 143, -20].forEach(function (z) {
      var pier = new THREE.Mesh(new THREE.BoxGeometry(34, 1.2, 7), woodMat);
      pier.position.set(cfg.harborX + 12, 0.8, z);
      scene.add(pier);
      colliders.push({
        minX: cfg.harborX - 5, maxX: cfg.harborX + 29,
        minZ: z - 3.5, maxZ: z + 3.5
      });
    });

    // Boats bobbing by the piers.
    var hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
    var cabinMat = new THREE.MeshLambertMaterial({ color: 0x3a6b8a });
    [[cfg.harborX + 26, 78], [cfg.harborX + 40, 128], [cfg.harborX + 30, -38]].forEach(function (p) {
      var hull = new THREE.Mesh(new THREE.BoxGeometry(12, 2.4, 4), hullMat);
      hull.position.set(p[0], 0.9, p[1]);
      hull.rotation.y = util.range(rng, -0.2, 0.2);
      scene.add(hull);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 3), cabinMat);
      cabin.position.set(p[0], 3, p[1]);
      cabin.rotation.y = hull.rotation.y;
      scene.add(cabin);
    });

    // A harbour crane silhouette.
    var craneMat = new THREE.MeshLambertMaterial({ color: 0xc75b39 });
    var mast = new THREE.Mesh(new THREE.BoxGeometry(2.5, 34, 2.5), craneMat);
    mast.position.set(cfg.harborX - 6, 17, 100);
    scene.add(mast);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2), craneMat);
    arm.position.set(cfg.harborX + 6, 33, 100);
    scene.add(arm);

    // Crates and containers waiting on the dockside. All on land, and
    // kept clear of the line a driver takes from the warehouse to the dock.
    var crateMat = new THREE.MeshLambertMaterial({ color: 0xa08050 });
    var crateMat2 = new THREE.MeshLambertMaterial({ color: 0x7a6a9a });
    [[195, 115, 2.2], [190, 130, 1.8], [194, 100, 2.0], [185, 145, 1.6],
     [196, 118, 2.4], [195, 85, 1.8]].forEach(function (c, i) {
      var crate = new THREE.Mesh(
        new THREE.BoxGeometry(c[2], c[2], c[2]),
        i % 2 ? crateMat2 : crateMat
      );
      crate.position.set(c[0], c[2] / 2, c[1]);
      crate.rotation.y = util.range(rng, -0.4, 0.4);
      scene.add(crate);
      colliders.push({
        minX: c[0] - c[2] / 2, maxX: c[0] + c[2] / 2,
        minZ: c[1] - c[2] / 2, maxZ: c[1] + c[2] / 2
      });
    });
    var contMat = new THREE.MeshLambertMaterial({ color: 0x3a7a5a });
    [[190, 58, 0.3], [192, -22, -0.2]].forEach(function (c) {
      var cont = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 2.6), contMat);
      cont.position.set(c[0], 1.3, c[1]);
      cont.rotation.y = c[2];
      scene.add(cont);
      colliders.push({
        minX: c[0] - 4, maxX: c[0] + 4,
        minZ: c[1] - 1.3, maxZ: c[1] + 1.3
      });
    });
  }

  function buildGreenery(scene, rng) {
    // Palms: one instanced trunk mesh + one instanced crown mesh.
    var spots = [];
    // Along the beach.
    for (var i = 0; i < 26; i++) {
      spots.push({ x: -180 + i * 15 + util.range(rng, -4, 4), z: util.range(rng, 198, 222) });
    }
    // Scattered on sidewalk corners.
    for (var j = 0; j < 22; j++) {
      var bx = util.pick(rng, cfg.blockCenters);
      var bz = util.pick(rng, cfg.blockCenters);
      spots.push({
        x: bx + util.pick(rng, [-21, 21]),
        z: bz + util.pick(rng, [-21, 21])
      });
    }
    var trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
    trunkGeo.translate(0, 3.5, 0);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    var crownGeo = new THREE.ConeGeometry(3.4, 3.2, 7);
    crownGeo.translate(0, 8.2, 0);
    var crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
    var crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var e = new THREE.Euler();
    var v = new THREE.Vector3();
    var sc = new THREE.Vector3();
    spots.forEach(function (p, idx) {
      var lean = util.range(rng, -0.12, 0.12);
      e.set(lean, util.range(rng, 0, Math.PI * 2), lean * 0.6);
      q.setFromEuler(e);
      v.set(p.x, 0, p.z);
      var s = util.range(rng, 0.85, 1.3);
      sc.set(s, s, s);
      m.compose(v, q, sc);
      trunks.setMatrixAt(idx, m);
      crowns.setMatrixAt(idx, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    scene.add(trunks);
    scene.add(crowns);
  }

  function buildStreetlights(scene) {
    var spots = [];
    cfg.avenues.forEach(function (x) {
      cfg.streets.forEach(function (z) {
        spots.push({ x: x + cfg.ROAD / 2 + 1.5, z: z + cfg.ROAD / 2 + 1.5 });
      });
    });
    var poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 8, 6);
    poleGeo.translate(0, 4, 0);
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
    var poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    var headGeo = new THREE.SphereGeometry(0.7, 8, 6);
    headGeo.translate(0, 8.2, 0);
    lampHeadMat = new THREE.MeshLambertMaterial({
      color: 0xffe9a8, emissive: 0xffca5a, emissiveIntensity: 0.9
    });
    var heads = new THREE.InstancedMesh(headGeo, lampHeadMat, spots.length);
    var m = new THREE.Matrix4();
    spots.forEach(function (p, idx) {
      m.makeTranslation(p.x, 0, p.z);
      poles.setMatrixAt(idx, m);
      heads.setMatrixAt(idx, m);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    scene.add(poles);
    scene.add(heads);
  }

  // --- collision ---------------------------------------------------------

  // Push a circle (x, z, radius) out of every building box it overlaps.
  // Returns {x, z, hit} with the corrected position.
  function collideCircle(x, z, r) {
    var hit = false;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var nx = util.clamp(x, c.minX, c.maxX);
      var nz = util.clamp(z, c.minZ, c.maxZ);
      var dx = x - nx;
      var dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 0.0001) {
        var d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        var pl = x - c.minX + r;
        var pr = c.maxX - x + r;
        var pt = z - c.minZ + r;
        var pb = c.maxZ - z + r;
        var m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r;
        else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r;
        else z = c.maxZ + r;
      }
    }
    // World bounds.
    var b = cfg.bounds;
    x = util.clamp(x, b.minX, b.maxX);
    z = util.clamp(z, b.minZ, b.maxZ);
    return { x: x, z: z, hit: hit };
  }

  function isWater(x, z) {
    return x > cfg.harborX + 4 || z > cfg.seaZ;
  }

  function build(scene, seed) {
    var rng = util.makeRng(seed);
    colliders = [];
    group = new THREE.Group();
    scene.add(group);
    buildSky(scene);
    buildGround(scene, rng);
    buildBuildings(scene, rng);
    buildHarbor(scene, rng);
    buildGreenery(scene, rng);
    buildStreetlights(scene);
    return { colliders: colliders, buildingCount: colliders.length };
  }

  window.CH = window.CH || {};
  window.CH.city = {
    build: build,
    collideCircle: collideCircle,
    isWater: isWater,
    setNight: setNight,
    isNight: isNight,
    colliders: function () { return colliders; }
  };
})();
