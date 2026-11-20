// The HUD: mission card, wanted stars, cash, health, speed, prompts and
// the centre message banner. All DOM, updated from the world each frame;
// the 3D view stays clean for the screenshots.
(function () {
  var CH = window.CH;

  function createHud() {
    var el = {};
    ['missionCard', 'missionTitle', 'missionText', 'stars', 'cash', 'healthFill',
     'healthWrap', 'speed', 'speedValue', 'banner', 'bannerTitle', 'bannerSub',
     'prompt', 'crosshair', 'hint', 'wantedFlash'].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
    var bannerTimer = 0;
    var lastStars = 0;

    function showBanner(title, sub, seconds) {
      el.bannerTitle.textContent = title;
      el.bannerSub.textContent = sub || '';
      el.banner.classList.add('show');
      bannerTimer = seconds || 3;
    }

    function hideBanner() {
      el.banner.classList.remove('show');
      bannerTimer = 0;
    }

    function update(dt, world) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.banner.classList.remove('show');
      }
      var obj = world.missions.objective(world);
      var missionNo = world.missionsDone + 1;
      el.missionTitle.textContent = world.missions.state.storyDone
        ? 'CRIMSON HARBOR'
        : 'MISSION ' + Math.min(missionNo, CH.MISSIONS.length) + ' / ' + CH.MISSIONS.length;
      el.missionText.textContent = obj.text;
      // Wanted stars.
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < world.wanted ? '★' : '☆';
      el.stars.textContent = stars;
      el.stars.className = world.wanted > 0 ? 'stars hot' : 'stars';
      if (world.wanted > lastStars) {
        el.wantedFlash.classList.remove('flash');
        void el.wantedFlash.offsetWidth;
        el.wantedFlash.classList.add('flash');
      }
      lastStars = world.wanted;
      el.cash.textContent = '$' + world.cash.toLocaleString('en-US');
      var hp = Math.max(0, world.player.health);
      el.healthFill.style.width = hp + '%';
      el.healthFill.className = 'health-fill' + (hp < 30 ? ' low' : '');
      // Speed, only while driving.
      if (world.player.mode === 'car' && world.player.car) {
        el.speed.style.display = 'flex';
        var mph = Math.round(Math.abs(world.player.car.speed) * 2.237);
        el.speedValue.textContent = mph;
      } else {
        el.speed.style.display = 'none';
      }
      // Context prompt: entering a car, or the mission start.
      var prompt = '';
      if (world.player.mode === 'foot' && !world.player.dead) {
        var near = CH.nearestCar(world.player, world.cars, 4.5);
        if (near) prompt = 'Press E to enter the ' + near.kind;
      }
      el.prompt.textContent = prompt;
      el.prompt.style.display = prompt ? 'block' : 'none';
      // Crosshair while armed on foot.
      el.crosshair.style.display = (world.player.mode === 'foot' && world.player.armed && !world.player.dead) ? 'block' : 'none';
    }

    return {
      update: update,
      showBanner: showBanner,
      hideBanner: hideBanner,
    };
  }

  CH.createHud = createHud;
})();
