// save.js — autosave to localStorage: cash, mission progress, the
// player's position and the clock. Loads are defensive: a corrupt or
// foreign save is ignored, never fatal.
(function () {
  'use strict';

  var KEY = window.CH.config.saveKey;

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (typeof data.cash !== 'number') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    try {
      var data = {
        cash: Math.round(state.cash),
        missionIndex: state.missionIndex,
        completed: state.completed.slice(),
        px: Math.round(state.px * 100) / 100,
        pz: Math.round(state.pz * 100) / 100,
        playSeconds: Math.round(state.playSeconds),
        xp: Math.round(state.xp || 0),
        health: Math.round(state.health === undefined ? 100 : state.health),
        armour: Math.round(state.armour || 0),
        standing: state.standing || {},
        stats: state.stats || {},
        clockMinutes: Math.round(state.clockMinutes || 1050),
        savedAt: Date.now()
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function hasSave() {
    return load() !== null;
  }

  window.CH = window.CH || {};
  window.CH.save = {
    load: load,
    save: save,
    clear: clear,
    hasSave: hasSave
  };
})();
