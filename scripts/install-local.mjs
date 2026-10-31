import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const exists = async (file) => fs.lstat(file).catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

async function install(directory) {
  console.log('Installing locked dependencies outside the synced project…');
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'ci', '--no-audit', '--no-fund', '--foreground-scripts',
      '--fetch-retries=1', '--fetch-timeout=30000',
    ], { cwd: directory, stdio: 'inherit' });
    // A visible error replaces an indefinitely silent installation.
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Dependency installation exceeded 5 minutes. Check network access and retry npm run install:local.'));
    }, 300_000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error(`npm ci failed (${code}); existing dependencies were preserved.`));
    });
  });
}

export async function ensureDependencies({
  root = projectRoot,
  cacheRoot = process.env.DISASTERDAO_DEPS_CACHE ?? path.join(
    os.homedir(), process.platform === 'darwin' ? 'Library/Caches' : '.cache', 'disasterdao-deps',
  ),
  installPackages = install,
  clean = false,
} = {}) {
  root = await fs.realpath(root);
  const manifest = await fs.readFile(path.join(root, 'package.json'));
  const lock = await fs.readFile(path.join(root, 'package-lock.json'));
  const npmrc = await fs.readFile(path.join(root, '.npmrc')).catch((error) => {
    if (error.code === 'ENOENT') return Buffer.alloc(0);
    throw error;
  });
  const fingerprint = createHash('sha256').update(manifest).update(lock).update(npmrc)
    .update(`${process.versions.node.split('.')[0]}:${process.platform}:${process.arch}`).digest('hex');
  const project = createHash('sha256').update(root).digest('hex').slice(0, 16);
  await fs.mkdir(cacheRoot, { recursive: true });
  const cache = path.join(await fs.realpath(cacheRoot), project);
  if (cache === root || cache.startsWith(root + path.sep)) {
    throw new Error('DISASTERDAO_DEPS_CACHE must be outside the project and outside cloud-synced folders.');
  }
  await fs.mkdir(cache, { recursive: true });
  const mutex = path.join(cache, 'install.lock');
  try {
    await fs.writeFile(mutex, String(process.pid), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await fs.readFile(mutex, 'utf8'));
    let running = true;
    try { process.kill(pid, 0); } catch (check) {
      if (check.code === 'ESRCH') running = false;
    }
    if (running || !Number.isInteger(pid) || pid <= 0) {
      throw new Error(`Another dependency setup is active (PID ${pid}); wait for it to finish.`);
    }
    await fs.unlink(mutex);
    return ensureDependencies({ root, cacheRoot, installPackages, clean });
  }
  try {
    const pointer = path.join(cache, 'ready.json');
    let ready = JSON.parse(await fs.readFile(pointer, 'utf8').catch(() => 'null'));
    if (clean || ready?.fingerprint !== fingerprint ||
        !await exists(path.join(ready?.directory ?? cache, 'node_modules/.package-lock.json'))) {
      const directory = path.join(cache, `install-${randomUUID()}`);
      await fs.mkdir(directory);
      await fs.writeFile(path.join(directory, 'package.json'), manifest);
      await fs.writeFile(path.join(directory, 'package-lock.json'), lock);
      // Preserve project registry/settings when present; never print their contents.
      if (npmrc.length) await fs.writeFile(path.join(directory, '.npmrc'), npmrc, { mode: 0o600 });
      await installPackages(directory);
      ready = { fingerprint, directory };
      const temporary = `${pointer}.${process.pid}`;
      await fs.writeFile(temporary, JSON.stringify(ready));
      await fs.rename(temporary, pointer);
    }
    const modules = path.join(root, 'node_modules');
    const target = path.join(ready.directory, 'node_modules');
    const current = await exists(modules);
    if (current?.isSymbolicLink()) {
      if (path.resolve(root, await fs.readlink(modules)) === target) {
        console.log('Local dependencies are up to date.');
        return;
      }
      await fs.unlink(modules);
    } else if (current) {
      // Rename only: never traverse/delete old cloud-offloaded dependency trees.
      const backups = path.join(root, '.dependency-backups.noindex');
      await fs.mkdir(backups, { recursive: true });
      await fs.rename(modules, path.join(backups, `node_modules-${randomUUID()}`));
      console.log('Previous dependencies preserved in .dependency-backups.noindex/.');
    }
    await fs.symlink(target, modules, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`Dependencies linked from ${target}`);
  } finally {
    await fs.unlink(mutex);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureDependencies({ clean: process.argv.includes('--clean') }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
