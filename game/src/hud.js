// HUD: tracker, stars, money, district, police list, vitals, minimap,
// speed cluster, weapon slots, dialogue, stats screen.
import { fmtMoney, fmtTime, clamp } from './util.js';
import { CREW, MISSIONS } from './missions.js';

const $ = id => document.getElementById(id);

export const WEAPONS = [
  { name: 'FISTS', icon: '👊', ammo: Infinity, range: 3, dmg: 20 },
  { name: 'BAT', icon: '🏏', ammo: Infinity, range: 4, dmg: 35 },
  { name: 'PISTOL', icon: '🔫', ammo: 120, range: 60, dmg: 25 },
  { name: 'SMG', icon: '🔫', ammo: 240, range: 55, dmg: 16 },
  { name: 'RIFLE', icon: '🎯', ammo: 90, range: 90, dmg: 45 },
  { name: 'MINIGUN', icon: '🔒', ammo: 0, range: 0, dmg: 0, locked: true, unlock: 'RANK 5' },
];
export const RANKS = ['STREET ROOKIE', 'HUSTLER', 'WHEELMAN', 'HARBOR LEGEND', 'KINGPIN'];
export function rankFor(rp) { return RANKS[Math.min(4, Math.floor(rp / 1000))]; }
export function standingFor(rp) {
  if (rp >= 3000) return 'FEARED';
  if (rp >= 1500) return 'RESPECTED';
  if (rp >= 600) return 'KNOWN';
  return 'NOBODY';
}

export class HUD {
  constructor() {
    this.dlgTimer = 0;
    this.centerTimer = 0;
    this.mm = $('minimap').getContext('2d');
    this.buildWeaponSlots();
  }
  buildWeaponSlots() {
    const wrap = $('weapons');
    wrap.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot' + (w.locked ? ' locked' : '');
      d.id = 'wslot-' + i;
      d.innerHTML = `<div class="ic">${w.icon}</div><div class="nm">${w.name}</div>` +
        (w.locked ? `<div class="lk">LOCKED · ${w.unlock}</div>` : `<div class="am">${w.ammo === Infinity ? '∞' : w.ammo}</div>`);
      wrap.appendChild(d);
    });
  }
  setWeapon(i, ammo) {
    WEAPONS.forEach((w, j) => {
      const el = $('wslot-' + j);
      if (el) el.classList.toggle('sel', j === i);
    });
    const w = WEAPONS[i];
    if (w && !w.locked && ammo !== undefined) {
      const el = $('wslot-' + i);
      const am = el && el.querySelector('.am');
      if (am) am.textContent = ammo === Infinity ? '∞' : ammo;
    }
  }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < n ? '' : 'off'}">★</span>`;
    $('stars').innerHTML = s;
  }
  setWantedBanner(on) { $('wanted').classList.toggle('on', on); }
  setMoney(n) { $('money').textContent = fmtMoney(n); }
  setRank(rp) { $('rank').innerHTML = `RANK <b>${rankFor(rp)}</b> · <b>${rp.toLocaleString('en-US')} RP</b>`; }
  setRadio(name, line) { $('radio').innerHTML = `<span class="st">${name}</span> ♫ ${line}`; }
  setClock(hours) {
    const h = Math.floor(hours) % 24, m = Math.floor((hours % 1) * 60);
    $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' · CRIMSON HARBOR';
  }
  setTracker(m, stageIdx, timeLeft, dist) {
    if (!m) {
      $('m-name').innerHTML = 'FREE ROAM';
      $('m-stage').textContent = 'NO ACTIVE JOB';
      $('m-obj').textContent = 'Press M to start the next mission, or explore the harbor.';
      $('m-dist').textContent = '';
      $('m-time').textContent = '';
      $('m-pay').textContent = '';
      return;
    }
    const s = m.stages[stageIdx];
    const mi = MISSIONS.indexOf(m);
    $('m-name').innerHTML = `MISSION ${mi + 1}/4 · <b>${m.name.toUpperCase()}</b>`;
    $('m-stage').textContent = `STAGE ${stageIdx + 1}/${m.stages.length}`;
    $('m-obj').textContent = s.text;
    $('m-dist').textContent = s.type === 'escape' ? '🚨 EVADE' : '📍 ' + Math.round(dist) + ' m';
    $('m-time').textContent = '⏱ ' + fmtTime(timeLeft);
    $('m-pay').textContent = 'PAY ' + fmtMoney(m.pay);
  }
  setDistrict(name, street, rp) {
    $('d-name').textContent = name;
    $('d-street').textContent = street + ' · Crimson Harbor';
    $('d-stand').textContent = `STANDING: ${standingFor(rp)} · ${rp.toLocaleString('en-US')} RP`;
    $('d-bar').style.width = clamp(rp / 30, 4, 100) + '%';
  }
  setPolice(units, wanted) {
    const el = $('police');
    el.style.display = wanted > 0 ? 'block' : 'none';
    if (wanted === 0) return;
    $('police-units').innerHTML = units.slice(0, 6).map(u =>
      `<div class="unit"><span class="cs">${u.callsign}</span><span class="role">${u.role}</span><span class="dist">${u.dist} m</span></div>`).join('');
  }
  setVitals(hp, armour) {
    $('hpnum').textContent = Math.round(hp);
    $('arnum').textContent = Math.round(armour);
    $('hpbar').querySelector('i').style.width = clamp(hp, 0, 100) + '%';
    $('arbar').querySelector('i').style.width = clamp(armour, 0, 100) + '%';
  }
  setSpeed(kmh, carName, cond, inCar) {
    $('kph').textContent = Math.round(kmh);
    $('carname').textContent = inCar ? carName : 'ON FOOT';
    $('condnum').textContent = inCar ? Math.round(cond) + '%' : '—';
    $('condbar').querySelector('i').style.width = (inCar ? cond : 0) + '%';
  }
  showDialogue(who, line, portrait, secs) {
    $('dlg-who').textContent = who.toUpperCase();
    $('dlg-line').textContent = line;
    $('dlg-img').src = portrait;
    $('dialogue').classList.add('on');
    this.dlgTimer = secs || 5;
  }
  hideDialogue() { $('dialogue').classList.remove('on'); }
  centerMessage(big, sub, secs) {
    $('center-big').textContent = big;
    $('center-sub').textContent = sub || '';
    $('center').classList.add('on');
    this.centerTimer = secs || 3;
  }
  hideCenter() { $('center').classList.remove('on'); }
  setHint(on) { $('hint').style.display = on ? 'block' : 'none'; }
  showCrewStrip(on) {
    const el = $('crewstrip');
    if (on && !el.dataset.built) {
      el.dataset.built = '1';
      el.innerHTML = CREW.map(c =>
        `<div class="crewcard panel"><img src="${c.portrait}" alt=""><div><div class="cn">${c.name}</div><div class="cr">${c.role} · [${c.key}]</div><div class="ca">${c.ability} — ${c.desc}</div></div></div>`).join('');
    }
    el.classList.toggle('on', on);
  }
  update(dt) {
    if (this.dlgTimer > 0) { this.dlgTimer -= dt; if (this.dlgTimer <= 0) this.hideDialogue(); }
    if (this.centerTimer > 0) { this.centerTimer -= dt; if (this.centerTimer <= 0) this.hideCenter(); }
  }
  drawMinimap(world, px, pz, heading, inCar, policeUnits, traffic, target, peds) {
    const g = this.mm, W = 252, H = 188;
    const sc = 0.30, ox = 118, oy = 100; // world->map
    const mx = x => ox + x * sc, mz = z => oy + z * sc;
    g.fillStyle = '#181828'; g.fillRect(0, 0, W, H);
    // water + sand
    g.fillStyle = '#1e6a8a'; g.fillRect(mx(360), 0, W - mx(360), H);
    g.fillStyle = '#c9b078'; g.fillRect(mx(300), 0, mx(360) - mx(300), H);
    // blocks
    g.fillStyle = '#4a4460';
    for (const b of world.buildings) g.fillRect(mx(b.x - b.w / 2), mz(b.z - b.d / 2), b.w * sc, b.d * sc);
    // roads
    g.strokeStyle = '#9a9ab0'; g.lineWidth = 4;
    for (const r of [-240, -160, -80, 0, 80, 160, 240, 280]) {
      g.beginPath(); g.moveTo(mx(r), 0); g.lineTo(mx(r), H); g.stroke();
    }
    for (const r of [-240, -160, -80, 0, 80, 160, 240]) {
      g.beginPath(); g.moveTo(0, mz(r)); g.lineTo(W, mz(r)); g.stroke();
    }
    // mission target
    if (target) {
      g.fillStyle = '#ffd75e';
      const tx = mx(target[0]), ty = mz(target[1]);
      g.save(); g.translate(tx, ty); g.rotate(Math.PI / 4);
      const s = 5 + Math.sin(performance.now() / 200) * 1.5;
      g.fillRect(-s / 2, -s / 2, s, s); g.restore();
    }
    // traffic
    g.fillStyle = '#ffffff';
    for (const c of traffic) { g.fillRect(mx(c.x) - 1.5, mz(c.z) - 1.5, 3, 3); }
    // peds
    g.fillStyle = '#ff9ecb';
    for (const p of peds) { if (!p.dead) g.fillRect(mx(p.x) - 1, mz(p.z) - 1, 2, 2); }
    // police
    for (const u of policeUnits) {
      g.fillStyle = u.callsign === 'AIR-1' ? '#ff5252' : '#4da3ff';
      g.beginPath(); g.arc(mx(u.x), mz(u.z), 4, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    }
    // player arrow (map is x-right, z-down; heading 0 = +z = down)
    g.save(); g.translate(mx(px), mz(pz)); g.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(-5.5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke();
    g.restore();
    // north + border
    g.fillStyle = '#ffd75e'; g.font = '900 11px Arial';
    g.fillText('N ↑', 6, 13);
  }
  showStats(S) {
    const rows = [
      ['Cash', fmtMoney(S.money)], ['Reputation', S.rp.toLocaleString('en-US') + ' RP'],
      ['Rank', rankFor(S.rp)], ['Missions completed', S.missions.completed.filter(Boolean).length + ' / 4'],
      ['Cars stolen', S.stats.carsStolen], ['Cops evaded', S.stats.copsEvaded],
      ['Distance driven', (S.stats.distDriven / 1000).toFixed(1) + ' km'], ['On-foot distance', (S.stats.distWalked / 1000).toFixed(1) + ' km'],
      ['Shots fired', S.stats.shotsFired], ['Time played', fmtTime(S.stats.playTime)],
      ['Top speed', Math.round(S.stats.topSpeed) + ' km/h'], ['Wanted stars (max)', S.stats.maxStars],
    ];
    $('statgrid').innerHTML = rows.map(r => `<div>${r[0]}<span class="v">${r[1]}</span></div>`).join('');
    $('crewrow').innerHTML = CREW.map(c =>
      `<div class="crewbig panel"><img src="${c.portrait}" alt=""><div class="cn">${c.name}</div><div class="cr">${c.role}</div><div class="ca"><b>${c.ability}</b><br>${c.desc}</div><div class="key">Press [${c.key}] to use</div></div>`).join('');
    $('mstat').innerHTML = MISSIONS.map((m, i) => {
      const st = S.missions.completed[i] ? '<span class="done">✔ COMPLETE</span>' : (S.missions.index === i ? '<span class="nxt">▶ IN PROGRESS</span>' : '— LOCKED');
      return `<div><b>${i + 1}. ${m.name}</b> — pay ${fmtMoney(m.pay)} · ${st}</div>`;
    }).join('');
    $('stats').classList.add('on');
  }
  hideStats() { $('stats').classList.remove('on'); }
}
