import pg from 'pg';
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
export const json = (value: unknown) =>
  JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
export class Database<T> {
  pool: pg.Pool;
  constructor(
    url = process.env.V3_DATABASE_URL ??
      'postgres://localdemo:localdemo-only@127.0.0.1:5437/disasterdao',
  ) {
    if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
      throw new Error('Local database only');
    this.pool = new pg.Pool({ connectionString: url });
  }
  async init(seed: T) {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS v3_state(id integer PRIMARY KEY CHECK(id=1), body jsonb NOT NULL); CREATE TABLE IF NOT EXISTS v3_audit(id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor text NOT NULL, action text NOT NULL, target text NOT NULL); CREATE TABLE IF NOT EXISTS v3_chain_checkpoint(id integer PRIMARY KEY CHECK(id=1), block_number bigint NOT NULL, block_hash text NOT NULL); CREATE TABLE IF NOT EXISTS v3_chain_log(block_number bigint NOT NULL, block_hash text NOT NULL, tx text NOT NULL, log_index integer NOT NULL, body jsonb NOT NULL, PRIMARY KEY(tx,log_index));`,
    );
    await this.pool.query(
      'INSERT INTO v3_state VALUES(1,$1) ON CONFLICT DO NOTHING',
      [json(seed)],
    );
    await this.pool.query(
      'UPDATE v3_state SET body=$1::jsonb || body WHERE id=1',
      [json(seed)],
    );
  }
  async transaction<R>(
    fn: (
      state: T,
      audit: (actor: string, action: string, target: string) => Promise<void>,
    ) => Promise<R> | R,
  ): Promise<R> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const { rows } = await c.query(
        'SELECT body FROM v3_state WHERE id=1 FOR UPDATE',
      );
      const state = rows[0].body as T;
      const result = await fn(state, async (actor, action, target) => {
        await c.query(
          'INSERT INTO v3_audit(actor,action,target) VALUES($1,$2,$3)',
          [actor, action, target],
        );
      });
      await c.query('UPDATE v3_state SET body=$1 WHERE id=1', [json(state)]);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async read(): Promise<T> {
    const { rows } = await this.pool.query(
      'SELECT body FROM v3_state WHERE id=1',
    );
    return rows[0].body;
  }
}
export async function localSecret(name: string) {
  await mkdir('.runtime', { recursive: true, mode: 0o700 });
  const p = `.runtime/${name}.key`;
  try {
    return Buffer.from((await readFile(p, 'utf8')).trim(), 'hex');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    const key = randomBytes(32);
    try {
      await writeFile(p, key.toString('hex'), { flag: 'wx', mode: 0o600 });
      return key;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST')
        return Buffer.from((await readFile(p, 'utf8')).trim(), 'hex');
      throw err;
    }
  }
}
export class Documents {
  client: S3Client;
  key: Buffer;
  bucket = 'synthetic-private-v3';
  constructor(key: Buffer) {
    this.key = key;
    if (
      !['127.0.0.1', 'localhost'].includes(
        new URL(process.env.V3_S3_ENDPOINT ?? 'http://127.0.0.1:9007').hostname,
      )
    )
      throw new Error('Local documents only');
    this.client = new S3Client({
      endpoint: process.env.V3_S3_ENDPOINT ?? 'http://127.0.0.1:9007',
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'localdemo',
        secretAccessKey: 'localdemo-synthetic-only',
      },
    });
  }
  async init() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (e) {
      if (
        (e as { $metadata?: { httpStatusCode: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw e;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
  async put(id: string, plain: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: id,
        Body: Buffer.concat([iv, cipher.getAuthTag(), body]),
        ContentType: 'application/octet-stream',
      }),
    );
    return createHash('sha256').update(plain).digest('hex');
  }
  async get(id: string) {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: id }),
    );
    const bytes = Buffer.from(await out.Body!.transformToByteArray());
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]);
  }
}
