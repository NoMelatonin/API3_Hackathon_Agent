import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  open,
  unlink,
} from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const directory = 'out/integrated';
const names = [
  'DisasterFundV3Auto',
  'DemoUSDV3',
  'V3OracleVerifier',
  'SharedAllocation',
];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const fingerprint = async (sources) => {
  const files = {};
  for (const name of [
    ...new Set([...sources, 'foundry.toml', 'scripts/build-contracts.mjs']),
  ].sort())
    files[name] = sha(await readFile(name));
  return files;
};
/** A full source graph fixes via-IR output; test/partial Forge artifacts must never replace app artifacts. */
export async function ensureContracts({ force = false } = {}) {
  try {
    const ready = JSON.parse(await readFile(directory + '/build.json', 'utf8'));
    if (
      !force &&
      JSON.stringify(
        await fingerprint(
          Object.keys(ready.sources).filter((x) => x !== 'foundry.toml'),
        ),
      ) === JSON.stringify(ready.sources)
    ) {
      for (const name of names)
        if (
          sha(await readFile(`${directory}/${name}.json`)) !==
          ready.artifacts[name]
        )
          throw new Error('Artifact changed');
      return ready;
    }
  } catch {}
  await mkdir('.runtime', { recursive: true, mode: 0o700 });
  const lockPath = '.runtime/integrated-build.lock';
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(lockPath, 'utf8'));
    let running = true;
    try {
      process.kill(pid, 0);
    } catch (e) {
      if (e.code === 'ESRCH') running = false;
    }
    if (running || !Number.isInteger(pid) || pid <= 0)
      throw new Error(
        'Another canonical build is active; retry after it completes.',
      );
    await unlink(lockPath);
    return ensureContracts({ force });
  }
  await lock.writeFile(String(process.pid));
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        'npm',
        [
          'run',
          'forge',
          '--',
          'build',
          '--force',
          '--skip',
          'test',
          '--skip',
          'script',
          '--quiet',
        ],
        { stdio: 'inherit' },
      );
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(new Error('Canonical contract build failed')),
      );
    });
    await mkdir(directory, { recursive: true });
    const sourceNames = new Set();
    const artifacts = {};
    let compiler, settings;
    for (const name of names) {
      const source = name === 'V3OracleVerifier' ? 'DisasterFundV3Auto' : name;
      const candidates = [
        `out/${source}.sol/${name}.via-ir.json`,
        `out/${source}.sol/${name}.json`,
      ];
      let selected;
      for (const file of candidates) {
        try {
          const item = JSON.parse(await readFile(file, 'utf8'));
          if (item.metadata.settings.viaIR === true) {
            selected = { file, item };
            break;
          }
        } catch {}
      }
      if (!selected) throw new Error('Missing via-IR artifact: ' + name);
      for (const file of Object.keys(selected.item.metadata.sources))
        sourceNames.add(file);
      compiler = selected.item.metadata.compiler.version;
      if (name === 'DisasterFundV3Auto')
        settings = selected.item.metadata.settings;
      await copyFile(selected.file, `${directory}/${name}.json`);
      artifacts[name] = sha(await readFile(`${directory}/${name}.json`));
    }
    const ready = {
      compiler,
      settings,
      sources: await fingerprint([...sourceNames]),
      artifacts,
    };
    await writeFile(
      directory + '/build.json',
      JSON.stringify(ready, null, 2) + '\n',
    );
    console.log(
      'Canonical DisasterDAO contract artifacts built separately from tests.',
    );
    return ready;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await ensureContracts({ force: process.argv.includes('--force') });
