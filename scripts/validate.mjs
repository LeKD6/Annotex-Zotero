import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
assert.equal(manifest.applications.zotero.id, 'annotex-open@annotex.app');
assert.equal(manifest.applications.zotero.strict_min_version, '10.0');
assert.equal(manifest.version, '0.4.0rc8');
assert.ok(!manifest.update_url);
assert.equal(manifest.applications.zotero.update_url, 'https://raw.githubusercontent.com/LeKD6/Annotex-Zotero/main/updates.json');
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'bootstrap.js', 'prefs.js', 'content/provider.js', 'content/annotex.js', 'content/research.js', 'icons/annotex.svg', 'locale/en-US/annotex-open.ftl']) await readFile(new URL(file, root));
async function walk(dir) {
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (['dist', 'node_modules', '.git'].includes(entry.name)) continue;
    const relative = path.posix.join(dir, entry.name);
    assert.ok(!/^\.env/.test(entry.name), 'Environment files must not enter source package');
    if (entry.isDirectory()) await walk(relative + '/');
    else if (/\.(js|mjs|json|md|txt|html)$/.test(entry.name)) {
      const source = await readFile(new URL(relative, root), 'utf8');
      assert.ok(!/sk-(?:proj-)?[A-Za-z0-9_-]{25,}/.test(source), `Possible credential: ${relative}`);
      assert.ok(!/https:\/\/annotex\.app\/(?:api|zotero\/connect)/.test(source), `Hosted dependency: ${relative}`);
    }
  }
}
await walk('');
console.log('Package validation passed: isolated identity, explicit compatibility, license, no hosted login or embedded credentials.');
