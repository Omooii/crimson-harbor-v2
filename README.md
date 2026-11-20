# Crimson Harbor — a 3D open-world crime game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Omooii/crimson-harbor-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Omooii/crimson-harbor-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entered in [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

An original open-world crime game in the spirit of GTA 6, built with
three.js (vendored under `game/vendor/`) and plain static files. Everything
in it is original: the city, the characters, the vehicles, the story, the
art and the synthesized sound. Nothing from Rockstar Games or any other
commercial game.

You are a driver new to Crimson Harbor, a sun-soaked coastal city at
sunset. Mara, who runs the Harbor Garage, needs a driver she can trust.
Four story missions take you from a first fare to the big score at the
harbor, with cash rewards, a wanted system, police chases, traffic,
pedestrians, car theft, combat and a save that persists in the browser.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network request is
made while playing; the game runs fully offline from `game/`.

### Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run / Nitro (in car) |
| E | Enter / exit a car |
| F | Punch / shoot |
| Q | (on foot) draw / holster the pistol |
| Space | Handbrake |
| R | Quick Repair (car + driver) |
| B | Bribe ($150, drops one wanted star) |
| Tab | Driver record (stats + district standing) |
| Mouse drag | Look around |
| P or Esc | Pause |
| M | Mute |

## The game

- **The city:** a procedural 6×6-block grid with ~90 buildings and lit
  windows, shop signs on the street fronts, a harbour with piers, boats
  and a crane to the east, and a beach with palms to the south — all
  under a sunset sky that turns to night for the final job.
- **Districts:** five quarters — Northgate, Old Town, West End,
  Harborfront, Southside — each with a standing that rises when you
  finish work there and falls when you get busted.
- **Driving:** arcade physics with five car kinds (sedan, taxi, truck,
  sports, police) in varied paint, traffic that follows the roads, and
  parked cars to steal. Cars take damage and slow down as the bodywork
  wears; Nitro buys the speed back.
- **Wanted:** five stars. Steal cars, hit pedestrians or shoot, and the
  Harbor PD sends cruisers and foot cops after you — the HUD lists the
  responding units with distances. Lie low and the heat cools off, bribe
  a star away, or get busted and pay the fine.
- **Missions:** four jobs from Mara — First Fare ($500), Hot Wheels ($750),
  Harbor Run ($1,000, timed) and The Big Score ($2,000, at night) — with
  waypoint beams, minimap markers, spoken dialogue from Mara, and payout
  fanfares. Steps and jobs pay XP toward four driver ranks.
- **HUD:** mission tracker with stage and reward, driver rank and XP,
  cash, wanted stars, health and armour, the in-game clock, district
  standing, the police response list, ability cards (Nitro, Quick
  Repair, Bribe), a speedometer with a condition meter, a circular
  minimap with cars, police and the mission marker, and toast messages.
- **Driver record:** Tab opens your record — cash earned, jobs done,
  cars stolen, busts, and every district's standing.
- **Sound:** everything synthesized in WebAudio — engine hum, sirens,
  gunshots, cash. No audio files.
- **Save:** localStorage autosave every 10 seconds and on every payout,
  with Continue / New Game / Settings on the title screen.

## Layout

- `game/index.html` — the page: canvas, HUD, start/pause/busted screens, script tags.
- `game/src/` — one job per file: `util.js` (seeded random + math),
  `config.js` (world constants, vehicles, missions, ranks, abilities),
  `districts.js` (five quarters + standing), `input.js`,
  `audio.js` (synthesized WebAudio), `save.js`, `city.js` (procedural
  city, harbour, beach, sky, day/night, shop signs, collision),
  `vehicles.js` (car meshes + arcade physics + damage + nitro),
  `traffic.js`, `pedestrians.js`, `player.js` (on-foot
  movement + combat + enter/exit), `police.js` (wanted level + pursuit +
  busts), `missions.js` (story + objectives), `hud.js`, `minimap.js`,
  `camera.js` (chase cam), `particles.js` (one pooled points cloud),
  `shots.js` (scripted screenshot staging), `main.js` (boot + loop).
- `game/vendor/three.min.js` — three.js 0.160.0, vendored.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's `buildDossier`.
- `screenshots/` — four real renders of the game (see `shots.json` for
  the staging query of each).

## Screenshots

Each screenshot is staged by a URL query and captured from the running
game, never edited: `?shot=drive` (west into the sunset),
`?shot=foot&night=1` (a night street on foot), `?shot=chase` (the Hot
Wheels getaway), `?shot=mission` (the Harbor Run climax) — all with
`&seed=7`.

## License

MIT. See `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=pmqap4j3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
