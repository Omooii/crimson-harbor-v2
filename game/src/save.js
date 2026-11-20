// Save and load: one JSON blob in localStorage holding cash, story
// progress and where the player stands. Loading never throws — a missing
// or corrupt save just means a fresh game.
(function () {
  var CH = window.CH;
  var KEY = 'crimson-harbor-save-v2';

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.cash !== 'number') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function storeSave(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSave() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  CH.loadSave = loadSave;
  CH.storeSave = storeSave;
  CH.clearSave = clearSave;
})();
