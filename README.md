# Crimson Harbor

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. You are Rook, a wheelman in a bright coastal harbor city:
drive the streets, run 8 story jobs with your crew, dodge Harbor PD, and
build your reputation from street rookie to Harbor Legend.

## Play

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Open the page in desktop Chrome. No build step, no network requests: every
script, library and sound is a file under `game/` (three.js is vendored at
`game/vendor/three.min.js`, sounds are procedural Web Audio).

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse | Look around |
| Shift | Sprint |
| E | Enter / exit car |
| Space | Handbrake |
| F | Punch |
| Click | Shoot |
| 1–7 | Weapons |
| Q / R / T | Crew abilities: Sable boost, Ivo hack, Tess armour |
| H | Horn |
| M | Mute |
| Esc | Pause |

## What's in the game

- A living harbor city: Marina Pier with a ferris wheel, a beach, palm
  trees, traffic, pedestrians, a day/night cycle and a bridge over the bay.
- 8 multi-stage jobs with timers, pay, objective markers and a gold beam.
- A 0–5 star wanted system: police cruisers with pursuit states and a
  helicopter with a spotlight at 3+ stars.
- A crew of three with working abilities, car condition, weapon slots,
  money, rank, reputation, districts, save/continue and a stats screen.

## Layout

- `game/index.html` + `game/css/style.css` — page and HUD.
- `game/js/` — one module per system: state, audio, world, vehicles,
  pedestrians, player, police, missions, hud, save, shots, main.
- `screenshots/` — four shots of the game itself, staged by `game/js/shots.js`
  (see `shots.json` for the query each shot uses).
- `main.ts` — the entry program; copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.

## License

MIT — see `LICENSE`.
