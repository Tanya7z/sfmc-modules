import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkIndex, loadModules, root } from './verify.mjs';

async function main() {
  const modules = await loadModules();
  const target = path.join(root, 'index.json');
  let previous;
  try {
    previous = JSON.parse(await readFile(target, 'utf8'));
    checkIndex(previous);
  } catch (error) {
    if (error.code && error.code !== 'ENOENT') throw error;
    previous = undefined;
  }
  const generatedAt = previous && JSON.stringify(previous.modules) === JSON.stringify(modules)
    ? previous.generatedAt : new Date().toISOString();
  const index = { version: 2, generatedAt, modules };
  checkIndex(index);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`✓ Built index.json with ${Object.keys(modules).length} modules`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
