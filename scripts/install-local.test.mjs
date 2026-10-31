import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureDependencies } from './install-local.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'disasterdao-install-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'project');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"test","version":"1.0.0"}');
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  let installs = 0;
  const options = { root, cacheRoot: path.join(directory, 'cache'), installPackages: async (target) => {
    installs++;
    await fs.mkdir(path.join(target, 'node_modules'));
    await fs.writeFile(path.join(target, 'node_modules/.package-lock.json'), '{}');
  } };
  return { root, options, installs: () => installs };
}

test('quarantines old dependencies without traversing them and reuses a matching install', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.root, 'node_modules'));
  await fs.writeFile(path.join(f.root, 'node_modules/keep.txt'), 'preserved');
  await ensureDependencies(f.options);
  assert.equal((await fs.lstat(path.join(f.root, 'node_modules'))).isSymbolicLink(), true);
  const [backup] = await fs.readdir(path.join(f.root, '.dependency-backups.noindex'));
  assert.equal(await fs.readFile(path.join(f.root, '.dependency-backups.noindex', backup, 'keep.txt'), 'utf8'), 'preserved');
  await ensureDependencies(f.options);
  assert.equal(f.installs(), 1);
});

test('lockfile changes and explicit clean install select new external dependencies', async (t) => {
  const f = await fixture(t);
  await ensureDependencies(f.options);
  const original = await fs.readlink(path.join(f.root, 'node_modules'));
  await fs.writeFile(path.join(f.root, 'package-lock.json'), '{"changed":true}');
  await ensureDependencies(f.options);
  assert.notEqual(await fs.readlink(path.join(f.root, 'node_modules')), original);
  await ensureDependencies({ ...f.options, clean: true });
  assert.equal(f.installs(), 3);
});

test('failed install preserves the working dependency link and releases the lock for retry', async (t) => {
  const f = await fixture(t);
  await ensureDependencies(f.options);
  const original = await fs.readlink(path.join(f.root, 'node_modules'));
  await assert.rejects(ensureDependencies({ ...f.options, clean: true, installPackages: async () => {
    throw new Error('offline');
  } }), /offline/);
  assert.equal(await fs.readlink(path.join(f.root, 'node_modules')), original);
  await ensureDependencies(f.options);
  assert.equal(f.installs(), 1);
});

test('repairs a dependency directory recreated by plain npm ci; rejects an in-project cache', async (t) => {
  const f = await fixture(t);
  await ensureDependencies(f.options);
  await fs.unlink(path.join(f.root, 'node_modules'));
  await fs.mkdir(path.join(f.root, 'node_modules'));
  await ensureDependencies(f.options);
  assert.equal(f.installs(), 1);
  assert.equal((await fs.lstat(path.join(f.root, 'node_modules'))).isSymbolicLink(), true);
  await assert.rejects(ensureDependencies({ ...f.options, cacheRoot: path.join(f.root, 'cache') }), /outside the project/);
});

test('rejects concurrent setup and recovers a stale installer lock', async (t) => {
  const f = await fixture(t);
  await ensureDependencies(f.options);
  const [project] = await fs.readdir(f.options.cacheRoot);
  const mutex = path.join(f.options.cacheRoot, project, 'install.lock');
  await fs.writeFile(mutex, String(process.pid));
  await assert.rejects(ensureDependencies(f.options), /Another dependency setup is active/);
  // PID exceeds the host PID range, representing an installer that no longer exists.
  await fs.writeFile(mutex, '2147483647');
  await ensureDependencies(f.options);
  assert.equal(f.installs(), 1);
});
