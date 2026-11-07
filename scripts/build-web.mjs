// Builds the browser companion in docs/: compiles the Lens's own session model
// (Assets/Scripts/PalaceModel.ts) to a browser module and records its hash, so
// the page provably runs the same rules as the SPECS Lens.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'Assets/Scripts/PalaceModel.ts'), 'utf8');
// The model uses only erasable TypeScript, so Node's own type stripper is enough.
const js = stripTypeScriptTypes(source, {mode: 'strip'});
fs.writeFileSync(path.join(root, 'docs/palace-model.js'), '// Generated from Assets/Scripts/PalaceModel.ts by scripts/build-web.mjs. Do not edit.\n' + js);
fs.copyFileSync(path.join(root, 'devpost/screenshots/00-devpost-cover.jpg'), path.join(root, 'docs/cover.jpg'));
const sha = crypto.createHash('sha256').update(source).digest('hex');
fs.writeFileSync(path.join(root, 'docs/build-info.json'), JSON.stringify({modelSource: 'Assets/Scripts/PalaceModel.ts', modelSha256: sha, frames: 'docs/frames: real Lens Studio preview frames of the SPECS Lens'}, null, 2) + '\n');
console.log('docs/palace-model.js built from PalaceModel.ts', sha.slice(0, 12));
