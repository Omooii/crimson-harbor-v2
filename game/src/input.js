// Keyboard and mouse state. The loop reads held keys every frame and
// edge-triggered presses (enter, shoot, pause) once, through consume().
// Also tracks the mouse for the camera orbit and the crosshair.
(function () {
  var CH = window.CH;

  function createInput() {
    var held = {};
    var pressed = {};
    var mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false };
    var anyKey = false;

    function keyOf(e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ') k = 'space';
      return k;
    }

    function onKeyDown(e) {
      var k = keyOf(e);
      if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) !== -1) e.preventDefault();
      if (!held[k]) pressed[k] = true;
      held[k] = true;
      anyKey = true;
    }
    function onKeyUp(e) { held[keyOf(e)] = false; }
    function onMouseMove(e) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onMouseDown(e) {
      if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    }
    function onMouseUp(e) { if (e.button === 0) mouse.down = false; }
    function onBlur() {
      held = {};
      mouse.down = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);

    return {
      // Driving / walking axes, -1..1.
      drive: function () {
        return (held.w || held.arrowup ? 1 : 0) - (held.s || held.arrowdown ? 1 : 0);
      },
      steer: function () {
        return (held.a || held.arrowleft ? 1 : 0) - (held.d || held.arrowright ? 1 : 0);
      },
      run: function () { return !!held.shift; },
      handbrake: function () { return !!held.space; },
      mouse: mouse,
      // True once per physical press; the loop consumes it.
      consume: function (key) {
        if (pressed[key]) { pressed[key] = false; return true; }
        return false;
      },
      consumeClick: function () {
        var c = mouse.clicked;
        mouse.clicked = false;
        return c;
      },
      anyKeyPressed: function () {
        var k = anyKey;
        anyKey = false;
        return k;
      },
      // Called after each frame so mouse deltas do not accumulate forever.
      endFrame: function () { mouse.dx = 0; mouse.dy = 0; },
    };
  }

  CH.createInput = createInput;
})();
