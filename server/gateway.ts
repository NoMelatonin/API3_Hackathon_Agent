import { profile } from '../src/v3/profile.ts';
import Fastify from 'fastify';
import { buildApp } from './app.ts';
import { Database, Documents, localSecret } from './store.ts';
import { seed, type State } from './state.ts';
import { organizationIds, organizationScope } from '../src/v3/chain.ts';
import { tick } from './worker.ts';

export async function buildGateway() {
  const backends = new Map<string, Awaited<ReturnType<typeof buildApp>>>();
  const databases = new Map<string, Database<State>>();
  for (const id of organizationIds)
    await organizationScope.run(id, async () => {
      const db = new Database<State>();
      await db.init(seed());
      const docs = new Documents(
        await localSecret('integrated-' + profile + '-documents-' + id),
      );
      await docs.init();
      databases.set(id, db);
      backends.set(
        id,
        await buildApp(
          db,
          docs,
          await localSecret('integrated-' + profile + '-sessions-' + id),
        ),
      );
    });
  const gateway = Fastify({ bodyLimit: 3 * 1024 * 1024 });
  // Preserve exact uploaded bytes; child app performs format and ticket validation.
  gateway.addContentTypeParser(
    [
      'application/octet-stream',
      'text/plain',
      'application/pdf',
      'image/png',
      'image/jpeg',
    ],
    { parseAs: 'buffer' },
    (_r, b, done) => done(null, b),
  );
  gateway.all('/api/v3/*', async (req, reply) => {
    const path = req.url.split('?')[0];
    const headers = { ...req.headers };
    delete headers['content-length'];
    const invoke = (id: string) =>
      organizationScope.run(id, () =>
        backends.get(id)!.inject({
          method: req.method as 'GET',
          url: req.url,
          headers,
          ...(req.body === undefined ? {} : { payload: req.body as string }),
        }),
      );
    if (
      req.method === 'GET' &&
      ['/api/v3/organizations', '/api/v3/roles'].includes(path!)
    ) {
      const key = path!.endsWith('/roles') ? 'roles' : 'organizations';
      const responses = await Promise.all(organizationIds.map(invoke));
      const failure = responses.find((r) => r.statusCode !== 200);
      if (failure) return reply.code(failure.statusCode).send(failure.json());
      return {
        [key]: responses.flatMap((r) => r.json()[key]),
        simulation: true,
      };
    }
    const detail = path?.match(/^\/api\/v3\/organizations\/([^/]+)/)?.[1];
    const role = (req.body as { role?: string })?.role;
    const cookie = String(req.headers.cookie ?? '').match(
      /v3_org=([^;]+)/,
    )?.[1];
    const id =
      detail ??
      (role
        ? role.startsWith('community-')
          ? 'community-alliance'
          : 'local-alliance'
        : (req.headers['x-v3-organization'] ?? cookie ?? 'local-alliance'));
    if (typeof id !== 'string' || !backends.has(id))
      return reply.code(404).send({ error: 'Organization not found' });
    const response = await invoke(id);
    for (const [key, value] of Object.entries(response.headers))
      if (
        value !== undefined &&
        !['content-length', 'transfer-encoding', 'connection'].includes(key)
      )
        reply.header(key, value);
    if (
      path === '/api/v3/session' &&
      req.method === 'POST' &&
      response.statusCode === 200
    ) {
      reply.header('set-cookie', [
        String(response.headers['set-cookie']),
        `v3_org=${id}; HttpOnly; SameSite=Strict; Path=/api/v3; Max-Age=28800`,
      ]);
    }
    return reply.code(response.statusCode).send(response.rawPayload);
  });
  let running = false;
  async function work() {
    if (running) return;
    running = true;
    try {
      for (const id of organizationIds)
        await organizationScope
          .run(id, () => tick(databases.get(id)!))
          .catch((e) => console.error(`Worker ${id}: ${e.message}`));
    } finally {
      running = false;
    }
  }
  gateway.addHook('onClose', async () => {
    for (const app of backends.values()) await app.close();
    for (const db of databases.values()) await db.pool.end();
  });
  return { app: gateway, work };
}
