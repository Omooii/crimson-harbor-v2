// main.ts — Crimson Harbor's entry program (Node 22, standard library
// only). It copies game/ and screenshots/ into the output directory and
// writes dossier.json with the kit's buildDossier, exactly as the bounty
// asks. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
// The program is deterministic: two runs write the same bytes.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) throw new Error('main.ts: game/ is missing from the repository');
if (!existsSync(shotsDir)) throw new Error('main.ts: screenshots/ is missing from the repository');

mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
rmSync(join(outDir, 'dossier.json'), { force: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json written: ${dossier.length} bytes`);
