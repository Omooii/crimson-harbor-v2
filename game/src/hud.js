// The DOM HUD: mission tracker, wanted stars, money, rank/RP, clock, district trust,
// health/armour numbers, weapon slots with ammo, crew ability cards with portraits,
// police response list, car + damage, radio line, dialogue box, toasts and banners.
import { WEAPONS, CREW, RADIO, RANK_RP } from './config.js';
import { fmtMoney, fmtTime, portraitURL, clamp } from './util.js';
import { districtAt, trustOf } from './districts.js';

const $ = (id) => document.getElementById(id);
const PORTRAITS = {};
for (const c of CREW) PORTRAITS[c.name] = portraitURL(c.seed, c.skin, c.hair, c.shirt, c.style);
PORTRAITS['KAI MERCER'] = portraitURL(5, '#e0ac69', '#1c1c1c', '#c1121f', 0);

export function createHud(G) {
  const H = {
    cooldowns: { gus: 0, nadia: 0, leo: 0 },
    dlgTimer: 0, bannerTimer: 0,
    init() {
      // Weapon slots.
      const wbox = $('weapons');
      WEAPONS.forEach((w, i) => {
        const d = document.createElement('div');
        d.className = 'slot'; d.id = 'slot' + i;
        d.innerHTML = '<div class="wn">' + (i + 1) + ' · ' + w.name + '</div><div class="wa" id="ammo' + i + '"></div>';
        wbox.appendChild(d);
      });
      // Crew ability cards.
      const crew = $('crew');
      for (const c of CREW) {
        const d = document.createElement('div');
        d.className = 'card'; d.id = 'card-' + c.id;
        d.innerHTML = '<img src="' + PORTRAITS[c.name] + '" alt=""><div><div class="cn2">' + c.name + '</div><div class="cr">' + c.role + '</div><div class="ca" id="abil-' + c.id + '">' + c.ability + '</div></div>';
        d.addEventListener('click', () => H.useAbility(c.id));
        crew.appendChild(d);
      }
    },
    useAbility(id) {
      const p = G.player;
      if (H.cooldowns[id] > 0) { G.notify('Ability recharging — ' + Math.ceil(H.cooldowns[id]) + 's'); return; }
      const c = CREW.find((x) => x.id === id);
      if (p.money < c.cost) { G.notify('Not enough cash — need ' + fmtMoney(c.cost)); return; }
      if (id === 'gus') {
        if (!p.car) { G.notify('Gus can only repair a car you are driving'); return; }
        p.money -= c.cost; p.car.damage = 0; p.car.dead = false;
        G.notify('GUS: patched up — good as new');
      } else if (id === 'nadia') {
        if (p.wanted === 0) { G.notify('No heat to lose right now'); return; }
        p.money -= c.cost; G.police.setWanted(p.wanted - 1);
        G.notify('NADIA: a few calls made — heat is off, for now');
      } else {
        if (!G.police.heli) { G.notify('No helicopter to jam'); return; }
        G.police.heliJam = 20;
        G.notify('LEO: helicopter feed jammed for 20s');
      }
      H.cooldowns[id] = c.cd;
      G.audio.pickup();
    },
    update(dt) {
      for (const k of Object.keys(H.cooldowns)) H.cooldowns[k] = Math.max(0, H.cooldowns[k] - dt);
      const p = G.player;
      // Wanted stars.
      const stars = $('wanted').children;
      for (let i = 0; i < 5; i++) stars[i].className = i < p.wanted ? 'lit' : '';
      $('money').textContent = fmtMoney(p.money);
      // Rank / RP.
      const rank = p.rank;
      const cur = RANK_RP[rank - 1] || 0, next = RANK_RP[rank] || (cur + 5000);
      $('rankline').textContent = 'RANK ' + rank + ' · ' + p.rp.toLocaleString('en-US') + ' / ' + next.toLocaleString('en-US') + ' RP';
      $('rpbar').firstElementChild.style.width = clamp((p.rp - cur) / (next - cur) * 100, 0, 100) + '%';
      // Clock + district.
      const hh = Math.floor(G.clockHour), mm = Math.floor((G.clockHour - hh) * 60);
      $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (G.isNight ? ' · NIGHT' : ' · DAY');
      const d = districtAt(p.pos.x, p.pos.z);
      G.districtName = d.name;
      $('district').firstElementChild.textContent = d.name;
      $('trust').textContent = trustOf(G, d);
      // Vitals.
      $('healthnum').textContent = Math.ceil(p.health) + '/100';
      $('armournum').textContent = Math.ceil(p.armour) + '/100';
      $('healthbar').style.width = p.health + '%';
      $('armourbar').style.width = p.armour + '%';
      // Weapons.
      WEAPONS.forEach((w, i) => {
        $('slot' + i).className = 'slot' + (i === p.weapon ? ' on' : '');
        const a = p.ammo[i];
        $('ammo' + i).textContent = w.mag === Infinity ? '∞' : a.mag + ' / ' + a.reserve;
      });
      // Mission tracker.
      const m = G.mission;
      if (m) {
        $('mname').textContent = m.def.name;
        $('mstage').textContent = 'STAGE ' + (m.stage + 1) + ' / ' + m.def.stages.length + ' · ' + m.def.giver;
        $('mobj').textContent = m.def.stages[m.stage].text;
        $('mtimer').textContent = 'TIME LEFT ' + fmtTime(m.timer) + ' · PAY ' + fmtMoney(m.def.pay);
        $('mbarfill').style.width = (m.stage / m.def.stages.length * 100) + '%';
      } else {
        const next = G.nextMissionName();
        $('mname').textContent = next ? 'NEXT JOB: ' + next : 'FREE ROAM';
        $('mstage').textContent = next ? 'GO TO HARLOW AUTO WORKS' : 'ALL JOBS DONE — THE HARBOR IS YOURS';
        $('mobj').textContent = next ? 'Drive to the garage to start the next job.' : 'Explore, earn, and stay out of the cuffs.';
        $('mtimer').textContent = '';
        $('mbarfill').style.width = '0%';
      }
      // Car + radio.
      if (p.car) {
        $('carname').textContent = p.car.def.name;
        $('cardmg').textContent = 'DAMAGE ' + Math.floor(p.car.damage) + '%';
      } else {
        $('carname').textContent = 'ON FOOT';
        $('cardmg').textContent = '';
      }
      const st = RADIO[G.radioStation];
      $('radioname').textContent = st.name;
      $('radiotrack').textContent = st.track;
      // Crew cooldowns.
      for (const c of CREW) {
        const cd = H.cooldowns[c.id];
        $('card-' + c.id).className = 'card' + (cd > 0 ? ' cd' : '');
        $('abil-' + c.id).textContent = cd > 0 ? 'RECHARGING ' + Math.ceil(cd) + 's' : c.ability;
      }
      // Police response list (rebuild the DOM only when the list changes).
      const rows = G.police.list();
      $('police').style.display = rows.length ? 'block' : 'none';
      const html = rows.map((r) => '<div class="prow"><span><b>' + r.name + '</b> · ' + r.role + '</span><span class="pd">' + r.dist + 'm</span></div>').join('');
      if (html !== H._lastPoliceHTML) { H._lastPoliceHTML = html; $('policelist').innerHTML = html; }
      // Dialogue timer.
      if (H.dlgTimer > 0) { H.dlgTimer -= dt; if (H.dlgTimer <= 0) $('dialogue').style.display = 'none'; }
      if (H.bannerTimer > 0) { H.bannerTimer -= dt; if (H.bannerTimer <= 0) $('banner').style.display = 'none'; }
      // Interact prompt.
      const inter = $('interact');
      if (G.interactText) { inter.innerHTML = G.interactText; inter.style.display = 'block'; }
      else inter.style.display = 'none';
      // Damage flash (write the style only when it changes).
      if (G.hudFlash > 0) {
        G.hudFlash -= dt;
        const v = 'inset 0 0 ' + Math.floor(G.hudFlash * 160) + 'px rgba(230,57,70,.55)';
        if (v !== H._lastFlash) { H._lastFlash = v; $('hud').style.boxShadow = v; }
      } else if (H._lastFlash !== 'none') { H._lastFlash = 'none'; $('hud').style.boxShadow = 'none'; }
    },
    notify(text) {
      const box = $('notify');
      const d = document.createElement('div');
      d.textContent = text;
      box.appendChild(d);
      setTimeout(() => d.remove(), 3600);
      while (box.children.length > 3) box.firstChild.remove();
    },
    banner(title, sub) {
      $('bannertitle').textContent = title;
      $('bannersub').textContent = sub || '';
      $('banner').style.display = 'block';
      H.bannerTimer = 2.6;
    },
    showDialogue(name, text, secs) {
      $('dlgimg').src = PORTRAITS[name] || PORTRAITS['KAI MERCER'];
      $('dlgname').textContent = name;
      $('dlgtext').textContent = text;
      $('dialogue').style.display = 'flex';
      H.dlgTimer = secs || 6;
    },
  };
  return H;
}
