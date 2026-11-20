import { readFile, readdir, mkdir, copyFile, mkdtemp, writeFile, utimes, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist'); await mkdir(dist, { recursive: true });
const version = JSON.parse(await readFile(path.join(root, 'manifest.json'))).version;
const runtime = ['manifest.json', 'bootstrap.js', 'prefs.js', 'content/annotex.js', 'content/research.js', 'content/provider.js', 'icons/annotex.svg', 'locale/en-US/annotex-open.ftl', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
const source = [...runtime, 'README.md', 'CHANGELOG.md', '.gitignore', 'package.json', ...['build','validate','research-test','provider-test','smoke'].map(s => 'scripts/'+s+'.mjs'), 'test-fixtures/make_test_pdf.py', 'test-fixtures/reading-workflow.pdf', ...['index.html','original-passage.pdf','original-passage.png','references.bib','reading-notes.html','source-map.json'].map(s => 'demo/'+s)];
const buildTime = new Date('2026-11-20T00:00:00Z');
async function copy(relative, target) {
  const destination = path.join(target, relative); const origin = path.join(root, relative);
  for (let p = origin; p !== path.resolve(root); p = path.dirname(p)) if ((await lstat(p)).isSymbolicLink()) throw Error('Release path must not be a symbolic link: '+relative);
  if (!(await lstat(origin)).isFile()) throw Error('Expected a release file: '+relative);
  await mkdir(path.dirname(destination), { recursive: true }); await copyFile(origin, destination);
  await utimes(destination, buildTime, buildTime);
}
async function files(directory, prefix = '') { const output = []; for (const entry of (await readdir(path.join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const relative = path.join(prefix, entry.name); if (entry.isDirectory()) output.push(...await files(directory, relative)); else output.push(relative); } return output; }
const stage = await mkdtemp(path.join(tmpdir(), 'annotex-package-'));
const xpiStage = path.join(stage, 'runtime'); const sourceStage = path.join(stage, 'annotex-zotero');
for (const relative of runtime) await copy(relative, xpiStage);
for (const relative of source) await copy(relative, sourceStage);
const xpi = `annotex-open-${version}.xpi`, zip = `annotex-open-${version}-source.zip`;
// Fresh staging avoids accidentally retaining files from an older ZIP build.
execFileSync('/usr/bin/zip', ['-qX', path.join(stage, xpi), ...await files(xpiStage)], { cwd: xpiStage, env: { ...process.env, TZ: 'UTC' } });
execFileSync('/usr/bin/zip', ['-qX', path.join(stage, zip), ...(await files(sourceStage)).map(name => path.join('annotex-zotero', name))], { cwd: stage, env: { ...process.env, TZ: 'UTC' } });
let checksums = '';
for (const name of [xpi, zip]) { await copyFile(path.join(stage, name), path.join(dist, name)); checksums += `${createHash('sha256').update(await readFile(path.join(dist, name))).digest('hex')}  ${name}\n`; }
await writeFile(path.join(dist, 'SHA256SUMS'), checksums);
console.log(`Built ${xpi} and ${zip} from explicit file allowlists.`);
