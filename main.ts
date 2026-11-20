// Crimson Harbor v2 — entry program (Node 22, standard library only).
//
// The game lives in this directory as plain static files under game/ (an
// index.html plus its scripts, with three.js vendored under game/vendor/),
// and the screenshots live under screenshots/. This program hands both in:
// it copies them to the output directory and writes dossier.json with the
// kit's buildDossier, which is the summary the judge reads.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output. Inside the
// grader the program runs twice and both runs must write the same bytes,
// so nothing here depends on the clock, the network, or chance.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps (reference/gate.json): the dossier text is capped at
// 160 KiB; the other caps refuse an entry the sealed scorer would refuse
// (more than 4 screenshots or one over 256 KiB; game/ over 993 files and
// directories or 48 MiB in all; a path under game/ over 1000 bytes).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
