// Copies the version from package.json into the website (www/index.html). The website has no build
// step, so this runs from the `version` script whenever `npm version` changes it.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const file = path.join(root, 'www/index.html');

const html = readFileSync(file, 'utf8').replace(/(<span data-version>)[^<]*/, `$1${version}`);

writeFileSync(file, html);
console.log(`www/index.html now shows version ${version}`);
