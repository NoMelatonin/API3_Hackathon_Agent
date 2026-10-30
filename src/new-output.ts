import { mkdir, open, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Reserve the output before any paid work. Concurrent calls cannot both pay for the same file. */
export async function writeNewOutput(filename: string, produce: () => Promise<string>) {
  await mkdir(dirname(filename), { recursive: true });
  const file = await open(filename, 'wx');
  try {
    let result: string;
    try { result = await produce(); }
    catch (error) { await unlink(filename); throw error; }
    await file.writeFile(result);
  } finally { await file.close(); }
}
