import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeNewOutput } from './new-output.ts';

test('existing or concurrent output is rejected before paying, preserving the original', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'disaster-output-'));
  const filename = join(dir, 'response.json');
  let calls = 0;
  const produce = async () => { calls++; return 'original signed response'; };
  try {
    const results = await Promise.allSettled([writeNewOutput(filename, produce), writeNewOutput(filename, produce)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await assert.rejects(writeNewOutput(filename, produce), { code: 'EEXIST' });
    assert.equal(calls, 1);
    assert.equal(await readFile(filename, 'utf8'), 'original signed response');
  } finally { await rm(dir, { recursive: true }); }
});

test('failed API work leaves no empty fixture that blocks a retry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'disaster-output-'));
  const filename = join(dir, 'response.json');
  try {
    await assert.rejects(writeNewOutput(filename, async () => { throw new Error('API unavailable'); }), /API unavailable/);
    await writeNewOutput(filename, async () => 'retried response');
    assert.equal(await readFile(filename, 'utf8'), 'retried response');
  } finally { await rm(dir, { recursive: true }); }
});
