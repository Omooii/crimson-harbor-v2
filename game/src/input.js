// input.js — keyboard and mouse state. The game reads actions ("forward",
// "enter", ...) instead of raw keys, so bindings live in config.js and the
// playtest can drive with plain keyboard events.
(function () {
  'use strict';

  var pressed = {}; // code -> true while held
  var tapped = {}; // code -> true for one frame after keydown
  var mouse = { dx: 0, dy: 0, dragging: false, downX: 0, downY: 0 };

  function install() {
    window.addEventListener('keydown', function (ev) {
      if (ev.repeat) return;
      pressed[ev.code] = true;
      tapped[ev.code] = true;
      // Keep the page from scrolling on game keys (Tab opens the record).
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(ev.code) !== -1) {
        ev.preventDefault();
      }
    });
    window.addEventListener('keyup', function (ev) {
      pressed[ev.code] = false;
    });
    window.addEventListener('blur', function () {
      pressed = {};
    });
    var el = document.getElementById('game');
    if (el) {
      el.addEventListener('mousedown', function (ev) {
        mouse.dragging = true;
        mouse.downX = ev.clientX;
        mouse.downY = ev.clientY;
      });
      window.addEventListener('mouseup', function () {
        mouse.dragging = false;
      });
      window.addEventListener('mousemove', function (ev) {
        if (!mouse.dragging) return;
        mouse.dx += ev.clientX - mouse.downX;
        mouse.dy += ev.clientY - mouse.downY;
        mouse.downX = ev.clientX;
        mouse.downY = ev.clientY;
      });
    }
  }

  function actionHeld(name) {
    var codes = window.CH.config.keys[name] || [];
    for (var i = 0; i < codes.length; i++) {
      if (pressed[codes[i]]) return true;
    }
    return false;
  }

  function actionTapped(name) {
    var codes = window.CH.config.keys[name] || [];
    for (var i = 0; i < codes.length; i++) {
      if (tapped[codes[i]]) return true;
    }
    return false;
  }

  function codeTapped(code) {
    return !!tapped[code];
  }

  // Call once per frame, after the game has read the taps.
  function endFrame() {
    tapped = {};
    mouse.dx = 0;
    mouse.dy = 0;
  }

  function consumeMouseDX() {
    var d = mouse.dx;
    mouse.dx = 0;
    return d;
  }

  window.CH = window.CH || {};
  window.CH.input = {
    install: install,
    held: actionHeld,
    tapped: actionTapped,
    codeTapped: codeTapped,
    endFrame: endFrame,
    consumeMouseDX: consumeMouseDX,
    mouse: mouse
  };
})();
