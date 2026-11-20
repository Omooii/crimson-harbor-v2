# Crimson Harbor — a 3D open-world crime game (make.fun gta6-01)

An original open-world crime game in the spirit of GTA 6, built with
three.js (vendored under `game/vendor/`) and plain static files. Everything
in it is original: the city, the characters, the vehicles, the story, the
art and the synthesized sound. Nothing from Rockstar Games or any other
commercial game.

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
| Shift | Run |
| E | Enter / exit a car |
| F or left mouse | Punch / shoot |
| Q | (on foot) draw / holster the pistol |
| Space | Handbrake |
| P or Esc | Pause |
| M | Mute |

## The game

You are a driver new to Crimson Harbor, a sun-soaked coastal city. Mara,
who runs the Harbor Garage, needs a driver she can trust. Four story
missions take you from a first fare to the big score at the harbor, with
cash rewards, a wanted system, police chases, traffic, pedestrians, car
theft, combat and a save that persists in the browser.

## Layout

- `game/index.html` — the page: canvas, HUD, start screen, script tags.
- `game/src/` — one job per file: `util.js` (seeded random + math),
  `config.js` (world constants + mission definitions), `input.js`,
  `audio.js` (synthesized WebAudio), `save.js`, `city.js` (procedural
  city, ground texture, palms, beach, harbor), `vehicles.js` (car meshes
  + arcade driving), `traffic.js`, `pedestrians.js`, `player.js` (on-foot
  movement + combat), `police.js` (wanted level + pursuit), `missions.js`
  (story + objectives), `hud.js`, `minimap.js`, `camera.js` (chase cam),
  `shots.js` (scripted screenshot staging), `main.js` (boot + loop).
- `game/vendor/three.min.js` — three.js 0.160.0, vendored.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's `buildDossier`.
- `screenshots/` — four real renders of the game (see `shots.json` for
  the staging query of each).

## Screenshots

Each screenshot is staged by a URL query and captured from the running
game, never edited: `?shot=drive`, `?shot=foot`, `?shot=chase`,
`?shot=mission` (with `&seed=7`).

## License

MIT. See `LICENSE`.
