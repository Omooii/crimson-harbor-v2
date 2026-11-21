# crimson-harbor-v2

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Omooii/crimson-harbor-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Omooii/crimson-harbor-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Crimson Harbor** — a complete open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Kai Mercer just got out, and
the sun-soaked coastal city of Crimson Harbor owes him a living. Steal cars, outrun Harbor PD,
and work four story missions for Gus Harlow and Nadia Cross — on foot and behind the wheel.

## What is in the game

- **A living city**: ~90 procedural buildings across six districts, a road grid, a beach with
  boardwalk and palms, a working harbor with docks and boats, day/night cycle, traffic, and
  pedestrians who flee from gunfire and speeding cars.
- **Driving**: five vehicle kinds (sedan, sports coupe, van, taxi, scooter) with arcade physics,
  nitro, handbrake drifts, damage and wrecks — any parked or traffic car can be stolen.
- **Wanted system**: five stars, pursuing cruisers that ram, foot cops who can bust you, and a
  police helicopter with a spotlight at high wanted levels.
- **Missions and story**: four jobs in four stages each, with a mission tracker, timers, stage
  dialogue with character portraits, pay and RP.
- **Combat**: fists, pistol and SMG with ammo and reloads, hitscan shooting, and a crew with
  usable abilities (field repair, bribes, helicopter jamming).
- **HUD and polish**: rectangular minimap with live dots, numeric health/armour, weapon slots,
  rank/RP bar, district trust, police response list, car damage, radio stations with
  synthesized music, synthesized engine/siren/gunfire audio, title menu, pause, stats screen,
  and localStorage autosave.

Everything is original: the city, characters, vehicles, names, story, art and sound are all
made for this game. It plays offline in a desktop browser from static files — no network
request, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Controls: **WASD** drive / move · **E** enter or exit a car · **F** punch · **Click** shoot ·
**1–3** weapons · **R** reload · **Space** handbrake / jump · **Shift** nitro / sprint ·
**Q** radio station · **Tab** stats · **Esc** pause.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged through its own
`?shot=drive|foot|chase|mission&seed=7` scenes (see `shots.json` and `game/src/shots.js`).

## Layout

- `game/index.html` — the page and the HUD
- `game/src/` — one-job modules: `city`, `vehicles`, `traffic`, `pedestrians`, `player`,
  `police`, `missions`, `hud`, `minimap`, `camera`, `audio`, `particles`, `shots`, and more
- `game/vendor/three.min.js` — three.js 0.160.0, vendored
- `main.ts` — the entry program: copies `game/` and `screenshots/` and writes `dossier.json`
- `serve.ts` — the local static server

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=pmqap4j3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
