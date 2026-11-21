// Crimson Harbor — a gta6-01 entry program (Node 22, standard library only).
//
// The game lives in game/ as plain static files: game/index.html opens in desktop Chrome
// and plays offline, three.js vendored under game/vendor/, no network request anywhere.
// This program hands the entry in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json with the kit's buildDossier library, so the
// judge reads the same dossier the sealed scorer rebuilds.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The sealed gate's caps (reference/gate.json): the dossier text cap is the one that shapes
// bytes; the rest refuse an entry the scorer would refuse anyway.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
