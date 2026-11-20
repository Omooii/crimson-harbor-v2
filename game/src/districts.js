// districts.js — the five quarters of Crimson Harbor and how each one
// regards the driver. Standing rises when work is finished in a
// quarter and falls when the driver is busted there. It is flavour with
// a memory: the HUD shows the current quarter and its standing, and the
// driver record lists all five.
(function () {
  'use strict';

  var standing = {};

  function reset() {
    standing = {};
    var names = window.CH.config.districts;
    for (var i = 0; i < names.length; i++) standing[names[i]] = 0;
  }

  // Which quarter a map position belongs to. East first (the harbour
  // edge), then south (the beach side), then north, then west; the
  // middle of the grid is Old Town.
  function districtAt(x, z) {
    if (x >= 113) return 'Harborfront';
    if (z >= 113) return 'Southside';
    if (z <= -67) return 'Northgate';
    if (x <= -127) return 'West End';
    return 'Old Town';
  }

  function labelFor(value) {
    if (value <= -10) return 'Hostile';
    if (value < 0) return 'Unfriendly';
    if (value < 10) return 'Neutral';
    if (value < 25) return 'Friendly';
    return 'Respected';
  }

  function get(name) {
    return standing[name] || 0;
  }

  function add(name, n) {
    if (standing[name] === undefined) standing[name] = 0;
    standing[name] = Math.max(-20, Math.min(40, standing[name] + n));
  }

  function all() {
    var names = window.CH.config.districts;
    var out = [];
    for (var i = 0; i < names.length; i++) {
      out.push({ name: names[i], value: get(names[i]), label: labelFor(get(names[i])) });
    }
    return out;
  }

  function serialize() {
    var out = {};
    var names = window.CH.config.districts;
    for (var i = 0; i < names.length; i++) out[names[i]] = get(names[i]);
    return out;
  }

  function load(obj) {
    reset();
    if (!obj) return;
    var names = window.CH.config.districts;
    for (var i = 0; i < names.length; i++) {
      if (typeof obj[names[i]] === 'number') standing[names[i]] = obj[names[i]];
    }
  }

  reset();

  window.CH = window.CH || {};
  window.CH.districts = {
    districtAt: districtAt,
    labelFor: labelFor,
    get: get,
    add: add,
    all: all,
    serialize: serialize,
    load: load,
    reset: reset
  };
})();
