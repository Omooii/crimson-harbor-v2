// The HUD: job panel, rank + radio, money + stars, district + crew, police
// list, dialogue, vitals, weapon slots, speed cluster, and the minimap.
import { G, player, WEAPONS, SONGS, districtAt, streetAt, repTitle } from './state.js';
import { $, fmtMoney, fmtTime, clamp, wrapAngle } from './utils.js';
import { MISSIONS, objectiveInfo } from './missions.js';
import { V_ROADS, H_ROADS } from './world.js';

let mm = null, mctx = null, hudT = 0, mmT = 0;
const MM = 176, SX = 0.4, SZ = 0.4;
const mx = (x) => (x + 160) * SX;
const mz = (z) => (z + 210) * SZ;

export function initHUD() {
  mm = $('minimap');
  mctx = mm.getContext('2d');
  const crewEl = $('crew-list');
  crewEl.innerHTML = '';
  G.crew.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'crew-card'; d.id = 'crew-' + i;
    d.innerHTML = '<div class="crew-face">' + c.name[0] + '</div><div class="crew-info"><b>' + c.name + '</b><span>' + c.role + ' · ' + c.desc + '</span></div><div class="crew-key">' + c.key + '</div><div class="crew-cd">READY</div>';
    crewEl.appendChild(d);
  });
  const wEl = $('weapon-slots');
  wEl.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'weapon-slot' + (w.owned ? '' : ' locked'); d.id = 'weapon-' + i;
    d.innerHTML = '<span class="w-num">' + (i + 1) + '</span><span class="w-name">' + w.name + '</span>' + (w.owned ? '' : '<span class="w-price">' + fmtMoney(w.price) + '</span>');
    wEl.appendChild(d);
  });
}

function drawMinimap() {
  const c = mctx;
  c.clearRect(0, 0, MM, MM);
  c.fillStyle = '#1b6fb5'; c.fillRect(0, 0, MM, MM); // water
  c.fillStyle = '#5cb85c'; c.fillRect(mx(-70), 0, MM - mx(-70), MM); // land
  c.fillStyle = '#5cb85c'; c.fillRect(mx(60), 0, MM - mx(60), mz(-140)); // north land
  c.fillStyle = '#e8d189'; c.fillRect(mx(-70), mz(-20), mx(-58) - mx(-70), mz(200) - mz(-20)); // beach
  c.strokeStyle = '#2a7a33'; c.lineWidth = 5;
  for (const r of V_ROADS) { c.beginPath(); c.moveTo(mx(r.x), mz(r.z0)); c.lineTo(mx(r.x), mz(r.z1)); c.stroke(); }
  for (const r of H_ROADS) { c.beginPath(); c.moveTo(mx(r.x0), mz(r.z)); c.lineTo(mx(r.x1), mz(r.z)); c.stroke(); }
  c.strokeStyle = '#8a6a48'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(mx(-140), mz(100)); c.lineTo(mx(-58), mz(100)); c.stroke(); // pier
  c.strokeStyle = '#d35400'; c.beginPath(); c.moveTo(mx(-20), mz(-200)); c.lineTo(mx(-20), mz(-132)); c.stroke(); // bridge
  c.fillStyle = '#e74c3c'; c.beginPath(); c.arc(mx(-105), mz(100), 4, 0, 7); c.fill(); // wheel
  const obj = objectiveInfo();
  if (obj) {
    c.fillStyle = '#ffd54a';
    c.beginPath(); c.arc(mx(obj.x), mz(obj.z), 4.5, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  }
  for (const p of G.police) {
    c.fillStyle = p.hp <= 0 ? '#888' : '#ff4040';
    c.beginPath(); c.arc(mx(p.x), mz(p.z), 3, 0, 7); c.fill();
  }
  if (G.wanted > 0) {
    c.strokeStyle = 'rgba(255,40,40,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.arc(mx(player.x), mz(player.z), 26, 0, 7); c.stroke();
  }
  // Player arrow.
  c.save();
  c.translate(mx(player.x), mz(player.z));
  c.rotate(Math.atan2(Math.sin(player.heading), -Math.cos(player.heading)) + Math.PI);
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
  c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke();
  c.restore();
}

export function updateHUD(dt) {
  hudT += dt;
  mmT += dt;
  if (mmT > 0.12) { mmT = 0; drawMinimap(); }
  const def = MISSIONS[G.missionIndex];
  $('mission-title').textContent = 'JOB ' + (G.missionIndex + 1) + '/8 — ' + def.name.toUpperCase();
  const st = G.mission && !G.mission.done ? def.stages[G.mission.stage] : null;
  $('mission-stage').textContent = st ? 'Stage ' + (G.mission.stage + 1) + '/' + def.stages.length + ' · ' + st.text : 'Job complete';
  const tl = G.mission ? G.mission.timeLeft : 0;
  const timerEl = $('mission-timer');
  timerEl.textContent = fmtTime(tl);
  timerEl.classList.toggle('urgent', tl < 60 && G.mission && !G.mission.done);
  $('mission-pay').textContent = 'PAY ' + fmtMoney(def.pay);
  const obj = objectiveInfo();
  if (obj) {
    $('mission-dist').textContent = Math.round(obj.d) + ' m';
    const ang = wrapAngle(Math.atan2(obj.x - player.x, obj.z - player.z) - G.camYaw);
    $('mission-arrow').style.transform = 'rotate(' + (ang * 180 / Math.PI) + 'deg)';
    $('mission-arrow').style.opacity = '1';
  } else {
    $('mission-dist').textContent = '—';
    $('mission-arrow').style.opacity = '0';
  }
  const rank = 1 + Math.floor(G.rp / 500);
  $('rank-text').textContent = 'RANK ' + rank + ' · ROOK';
  $('rank-bar').style.width = ((G.rp % 500) / 5) + '%';
  const song = SONGS[G.radioIdx];
  $('radio-line').textContent = 'Harbor FM 101.2 — \'' + song[0] + '\' by ' + song[1];
  $('money').textContent = fmtMoney(G.money);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  $('stars').textContent = stars;
  $('stars').classList.toggle('hot', G.wanted > 0);
  $('wanted-banner').style.display = G.wanted > 0 ? 'block' : 'none';
  $('wanted-banner').textContent = 'WANTED — ' + G.wanted + (G.wanted === 1 ? ' STAR' : ' STARS');
  const sight = $('sight-banner');
  if (G.wanted > 0) {
    sight.style.display = 'block';
    sight.textContent = G.inSight ? '◉ IN SIGHT' : '○ UNSEEN';
    sight.classList.toggle('seen', G.inSight);
  } else sight.style.display = 'none';
  $('day-badge').textContent = 'DAY ' + G.day;
  $('tune-badge').textContent = 'TUNE LV ' + G.tune;
  $('district-name').textContent = districtAt(player.x, player.z);
  $('street-name').textContent = streetAt(player.x, player.z);
  $('district-title').textContent = repTitle(G.rp);
  $('rp-text').textContent = G.rp.toLocaleString('en-US') + ' RP';
  $('rp-bar').style.width = clamp((G.rp % 1000) / 10, 4, 100) + '%';
  G.crew.forEach((c, i) => {
    const cd = $('crew-' + i).querySelector('.crew-cd');
    cd.textContent = c.cd > 0 ? Math.ceil(c.cd) + 's' : 'READY';
    cd.classList.toggle('cooling', c.cd > 0);
    $('crew-' + i).classList.toggle('ready', c.cd <= 0);
  });
  if (hudT > 0.25) {
    hudT = 0;
    const list = $('police-list');
    if (G.police.length === 0) {
      list.innerHTML = '<div class="police-none">No units in pursuit</div>';
    } else {
      list.innerHTML = G.police.slice(0, 6).map((c) => {
        const d = Math.round(Math.hypot(c.x - player.x, c.z - player.z));
        return '<div class="police-row"><span class="police-id">UNIT ' + (G.police.indexOf(c) + 1) + '</span><span class="police-role">' + c.role.toUpperCase() + '</span><span class="police-dist">' + d + ' m</span></div>';
      }).join('');
    }
    $('police-title').textContent = 'HARBOR PD — ' + (G.police.length > 0 ? 'PURSUIT' : 'PATROL');
  }
  const dlg = $('dialogue-bar');
  if (G.dialogue && G.dialogueT > 0) {
    dlg.style.display = 'flex';
    $('dialogue-who').textContent = G.dialogue.who[0] || 'R';
    $('dialogue-line').innerHTML = '<b>' + G.dialogue.who + ':</b> ' + G.dialogue.line;
  } else dlg.style.display = 'none';
  $('health-bar').style.width = G.health + '%';
  $('health-text').textContent = 'HEALTH ' + Math.ceil(G.health);
  $('armour-bar').style.width = G.armour + '%';
  $('armour-text').textContent = 'ARMOUR ' + Math.ceil(G.armour);
  WEAPONS.forEach((w, i) => {
    $('weapon-' + i).classList.toggle('selected', G.weapon === i);
  });
  if (player.inCar && player.car) {
    $('speed-num').textContent = Math.round(player.speedKmh);
    $('car-name').textContent = player.car.model.name.toUpperCase();
    $('car-cond').textContent = 'CONDITION ' + Math.round(player.car.condition) + '%';
    $('car-cond').classList.toggle('bad', player.car.condition < 35);
  } else {
    $('speed-num').textContent = Math.round(G.playerSpeed * 3.6);
    $('car-name').textContent = 'ON FOOT';
    $('car-cond').textContent = 'CONDITION —';
    $('car-cond').classList.remove('bad');
  }
  const banner = $('banner');
  if (G.banner && G.bannerT > 0) {
    banner.style.display = 'block';
    $('banner-text').textContent = G.banner;
  } else banner.style.display = 'none';
  $('vignette').style.opacity = G.hurtT > 0 ? '0.55' : '0';
  $('clock-readout').textContent = String(Math.floor(G.clock)).padStart(2, '0') + ':' + String(Math.floor((G.clock % 1) * 60)).padStart(2, '0') + (G.night ? ' · NIGHT' : ' · DAY');
}
