// hud.js — the DOM heads-up display. Dense on purpose: the mission
// tracker (name, stage, objective, reward), the driver card (rank and
// XP), cash and wanted stars, health and armour, the clock, the current
// district and its standing, the police response list, the three
// ability cards, the speedometer with a condition meter, Mara's
// dialogue, banners and toasts. Text updates are throttled so the DOM
// is not rewritten every frame.
(function () {
  'use strict';

  var el = {};
  var bannerTimer = null;
  var dialogueTimer = null;
  var last = {};

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    el.cash = $('hud-cash');
    el.stars = $('hud-stars');
    el.speed = $('hud-speed');
    el.speedUnit = $('hud-speed-unit');
    el.mission = $('hud-mission');
    el.stage = $('hud-stage');
    el.objective = $('hud-objective');
    el.timer = $('hud-timer');
    el.rankName = $('hud-rank-name');
    el.xpFill = $('hud-xp-fill');
    el.healthFill = $('hud-health-fill');
    el.armourFill = $('hud-armour-fill');
    el.clock = $('hud-clock');
    el.district = $('hud-district');
    el.response = $('hud-response');
    el.responseList = $('hud-response-list');
    el.nitroFill = $('hud-nitro-fill');
    el.repairState = $('hud-repair-state');
    el.repairCard = $('hud-card-repair');
    el.bribeState = $('hud-bribe-state');
    el.bribeCard = $('hud-card-bribe');
    el.condRow = $('hud-cond-row');
    el.condFill = $('hud-cond-fill');
    el.dialogue = $('hud-dialogue');
    el.dialogueName = $('hud-dialogue-name');
    el.dialogueText = $('hud-dialogue-text');
    el.banner = $('hud-banner');
    el.bannerTitle = $('hud-banner-title');
    el.bannerSub = $('hud-banner-sub');
    el.toasts = $('hud-toasts');
    el.muted = $('hud-muted');
    el.hint = $('hud-hint');
    el.statsScreen = $('stats-screen');
    el.statsBody = $('stats-body');
  }

  function setText(node, value, key) {
    if (!node || last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }

  function setWidth(node, frac, key) {
    if (!node) return;
    var v = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    if (last[key] === v) return;
    last[key] = v;
    node.style.width = v + '%';
  }

  function fmtCash(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function setCash(n) {
    setText(el.cash, fmtCash(n), 'cash');
  }

  function setWanted(n) {
    if (n === last.stars || !el.stars) return;
    last.stars = n;
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606';
    el.stars.textContent = s;
    el.stars.className = n > 0 ? 'stars hot' : 'stars';
  }

  function setSpeed(mph) {
    setText(el.speed, String(Math.round(mph)), 'speed');
  }

  function setMissionName(name) {
    setText(el.mission, name || '', 'mission');
  }

  function setStage(text) {
    setText(el.stage, text || '', 'stage');
  }

  function setObjective(text) {
    setText(el.objective, text || '', 'objective');
  }

  function setTimer(seconds) {
    var v = seconds === null || seconds === undefined ? -1 : Math.ceil(seconds);
    if (v === last.timer || !el.timer) return;
    last.timer = v;
    if (v < 0) {
      el.timer.textContent = '';
      el.timer.className = 'timer';
    } else {
      var m = Math.floor(v / 60);
      var s = v % 60;
      el.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      el.timer.className = v <= 20 ? 'timer urgent' : 'timer';
    }
  }

  function setRank(name, frac) {
    setText(el.rankName, name || '', 'rank');
    setWidth(el.xpFill, frac || 0, 'xp');
  }

  function setHealth(v) {
    var pct = Math.max(0, Math.min(100, Math.round(v)));
    setWidth(el.healthFill, pct / 100, 'health');
    if (el.healthFill) {
      el.healthFill.style.background = pct <= 25 ? '#ff5a4a' : '#7ee787';
    }
  }

  function setArmour(v) {
    setWidth(el.armourFill, Math.max(0, Math.min(100, v)) / 100, 'armour');
  }

  function setClock(text) {
    setText(el.clock, text || '', 'clock');
  }

  function setDistrict(text) {
    setText(el.district, text || '', 'district');
  }

  function setResponse(units) {
    if (!el.response) return;
    if (!units || units.length === 0) {
      if (last.response !== 'off') {
        last.response = 'off';
        el.response.style.display = 'none';
      }
      return;
    }
    var key = units.map(function (u) { return u.label + u.dist; }).join('|');
    if (last.response === key) return;
    last.response = key;
    el.response.style.display = 'block';
    var html = '';
    for (var i = 0; i < units.length; i++) {
      html += '<div class="resp-row"><span>' + units[i].label +
        '</span><span>' + units[i].dist + 'm</span></div>';
    }
    el.responseList.innerHTML = html;
  }

  // abilities: {nitro 0..100, repairCd seconds left, canBribe bool}
  function setAbilities(a) {
    setWidth(el.nitroFill, (a.nitro || 0) / 100, 'nitro');
    var repair = a.repairCd > 0 ? Math.ceil(a.repairCd) + 's' : 'READY';
    setText(el.repairState, repair, 'repair');
    if (el.repairCard) {
      el.repairCard.className = 'ability-card' + (a.repairCd > 0 ? ' cooling' : '');
    }
    setText(el.bribeState, a.canBribe ? '$150 · READY' : '$150', 'bribe');
    if (el.bribeCard) {
      el.bribeCard.className = 'ability-card' + (a.canBribe ? '' : ' cooling');
    }
  }

  // Car condition, 0..100; null when on foot hides the meter.
  function setCondition(v) {
    if (!el.condRow) return;
    if (v === null || v === undefined) {
      if (last.cond !== 'off') {
        last.cond = 'off';
        el.condRow.style.display = 'none';
      }
      return;
    }
    if (last.cond === 'off') el.condRow.style.display = 'block';
    var pct = Math.max(0, Math.min(100, Math.round(v)));
    if (last.cond !== pct) {
      last.cond = pct;
      setWidth(el.condFill, pct / 100, 'condFill');
      el.condFill.style.background = pct <= 30 ? '#ff5a4a' : pct <= 60 ? '#ffd76a' : '#7ee787';
    }
  }

  function setMuted(m) {
    if (el.muted) el.muted.style.display = m ? 'block' : 'none';
  }

  function showBanner(title, sub, ms) {
    if (!el.banner) return;
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      el.banner.classList.remove('show');
    }, ms || 4000);
  }

  function showDialogue(name, text, ms) {
    if (!el.dialogue) return;
    el.dialogueName.textContent = name;
    el.dialogueText.textContent = text;
    el.dialogue.classList.add('show');
    if (dialogueTimer) clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(hideDialogue, ms || 6000);
  }

  function hideDialogue() {
    if (dialogueTimer) clearTimeout(dialogueTimer);
    dialogueTimer = null;
    if (el.dialogue) el.dialogue.classList.remove('show');
  }

  function toast(msg) {
    if (!el.toasts) return;
    var div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    el.toasts.appendChild(div);
    while (el.toasts.children.length > 4) {
      el.toasts.removeChild(el.toasts.firstChild);
    }
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4500);
  }

  function setHint(text) {
    if (el.hint) el.hint.textContent = text || '';
  }

  function showStats(html) {
    if (!el.statsScreen) return;
    el.statsBody.innerHTML = html;
    el.statsScreen.classList.add('show');
  }

  function hideStats() {
    if (el.statsScreen) el.statsScreen.classList.remove('show');
  }

  window.CH = window.CH || {};
  window.CH.hud = {
    init: init,
    setCash: setCash,
    setWanted: setWanted,
    setSpeed: setSpeed,
    setMissionName: setMissionName,
    setStage: setStage,
    setObjective: setObjective,
    setTimer: setTimer,
    setRank: setRank,
    setHealth: setHealth,
    setArmour: setArmour,
    setClock: setClock,
    setDistrict: setDistrict,
    setResponse: setResponse,
    setAbilities: setAbilities,
    setCondition: setCondition,
    setMuted: setMuted,
    showBanner: showBanner,
    showDialogue: showDialogue,
    hideDialogue: hideDialogue,
    toast: toast,
    setHint: setHint,
    showStats: showStats,
    hideStats: hideStats
  };
})();
