// The minimap: a 2D canvas in the HUD's corner, drawn from the same road
// layout as the city, with blips for the player, the mission target, the
// police and nearby cars. North is up; the player arrow rotates.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  function createMinimap() {
    var canvas = document.getElementById('minimap');
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    var half = 230;

    function toMap(x, z) {
      return [
        ((x + half) / (half * 2)) * size,
        ((z + half) / (half * 2)) * size,
      ];
    }

    function draw(world) {
      // Water and ground.
      ctx.fillStyle = '#1b6b82';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#8a8172';
      ctx.fillRect(0, 0, toMap(205, 0)[0], size);
      ctx.fillStyle = '#e3cd96';
      ctx.fillRect(toMap(157, 0)[0], 0, toMap(205, 0)[0] - toMap(157, 0)[0], size);
      // Parks.
      ctx.fillStyle = '#5d8a4a';
      [[-60, -60], [60, 60]].forEach(function (p) {
        var a = toMap(p[0] - 21, p[1] - 21);
        var b = toMap(p[0] + 21, p[1] + 21);
        ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      });
      // Roads.
      ctx.fillStyle = '#34343a';
      CONFIG.roads.forEach(function (r) {
        var w = (CONFIG.roadHalf * 2 / (half * 2)) * size;
        ctx.fillRect(0, toMap(0, r)[1] - w / 2, toMap(157, 0)[0], w);
        ctx.fillRect(toMap(r, 0)[0] - w / 2, toMap(0, -157)[1], w, size - toMap(0, -157)[1]);
      });
      // Mission target blip.
      var obj = world.missions.objective(world);
      if (obj.target) {
        var t = toMap(obj.target.x, obj.target.z);
        ctx.fillStyle = obj.kind === 'start' ? '#ffd24d' : '#35d0ff';
        ctx.beginPath();
        ctx.arc(t[0], t[1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Police blips (red/blue flash by time).
      var flash = Math.floor(world.time * 3) % 2 === 0;
      world.police.copCars.forEach(function (car) {
        if (car.dead) return;
        var p = toMap(car.group.position.x, car.group.position.z);
        ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
      // Player arrow (car position while driving).
      var ppos = CH.playerPos(world);
      var pp = toMap(ppos.x, ppos.z);
      ctx.save();
      ctx.translate(pp[0], pp[1]);
      var arrowHeading = world.player.mode === 'car' && world.player.car
        ? world.player.car.heading
        : world.player.heading;
      ctx.rotate(Math.PI - arrowHeading);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // North marker.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('N', size - 14, 14);
    }

    return { draw: draw };
  }

  CH.createMinimap = createMinimap;
})();
