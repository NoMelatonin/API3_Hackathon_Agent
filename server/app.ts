import { organizationData, paginate } from './organizations.ts';
import { previewApplication } from './preview.ts';
import {
  authorizeApproval,
  exportApproval,
  importApproval,
} from './external.ts';
import type { ApprovalBundle } from '../src/v3/ui-types.ts';
import Fastify from 'fastify';
import { situation } from '../src/v3/domain.ts';
import { reviewTarget } from '../src/v3/deadlines.ts';
import {
  randomBytes,
  randomUUID,
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { Database, Documents, json } from './store.ts';
import { seed, type State, type Role } from './state.ts';
import { chain, client } from '../src/v3/chain.ts';
import { SOURCE_REGISTRY } from '../src/v3/sources.ts';
import { backtest, syntheticCases } from '../src/v3/model.ts';
import {
  Rejected,
  must,
  own,
  requireRole,
  submit,
  approveApplication,
  prepareRound,
  approveRound,
  chainEvidence,
  reservations,
  noConflict,
  proposeReview,
  approveReview,
  model,
  now,
} from './service.ts';
export async function buildApp(
  db: Database<State>,
  documents: Documents,
  secret: Buffer,
) {
  const app = Fastify({
    logger: false,
    bodyLimit: 3 * 1024 * 1024,
    requestTimeout: 20000,
  });
  const sessions = new Map<string, { role: Role; expires: number }>();
  const tickets = new Map<
    string,
    {
      docId: string;
      subject: string;
      method: string;
      expires: number;
      used: boolean;
    }
  >();
  const digest = (x: string) => createHash('sha256').update(x).digest('hex');
  const auth = (req: { headers: Record<string, unknown> }) => {
    const cookie = String(req.headers.cookie ?? '');
    const token = cookie
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('v3_session='))
      ?.slice(11);
    const s = token ? sessions.get(digest(token)) : undefined;
    if (!s || s.expires < Date.now())
      throw new Rejected('Choose a simulated local role', 401);
    return s.role;
  };
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer');
    const host = String(req.headers.host ?? '');
    must(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host), 'Loopback only', 403);
    const origin = req.headers.origin;
    if (origin)
      must(
        /^http:\/\/(127\.0\.0\.1|localhost):(5173|4173|3007)$/.test(origin),
        'Origin denied',
        403,
      );
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      must(
        req.headers['x-v3-request'] === 'local-prototype',
        'Missing request header',
        403,
      );
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { statusCode?: number; validation?: unknown };
    reply.code(e.statusCode ?? 400).send({
      error: e.validation
        ? 'Invalid request'
        : e instanceof Rejected
          ? e.message
          : 'Operation failed; check role, chain state, deadlines and current review version',
    });
  });
  const schema = (
    properties: Record<string, unknown>,
    required = Object.keys(properties),
  ) => ({
    body: { type: 'object', additionalProperties: false, required, properties },
  });
  const str = (maxLength = 2000) => ({
    type: 'string',
    minLength: 1,
    maxLength,
  });
  const int = { type: 'integer', minimum: 0, maximum: 1_000_000 };

  app.get('/api/v3/organizations', async () => ({
    organizations: [(await organizationData(db)).organization],
  }));
  app.get<{ Params: { id: string } }>(
    '/api/v3/organizations/:id',
    async (req) => (await organizationData(db, req.params.id)).organization,
  );
  for (const kind of ['activity', 'test-support'] as const) {
    app.get<{ Params: { id: string }; Querystring: { offset?: string } }>(
      '/api/v3/organizations/:id/' + kind,
      async (req) => {
        const offset = Number(req.query.offset ?? 0);
        must(Number.isSafeInteger(offset) && offset >= 0, 'Invalid offset');
        const { organization: o, items } = await organizationData(
          db,
          req.params.id,
        );
        const filtered =
          kind === 'test-support'
            ? items.filter(
                (x) =>
                  x.kind === 'Deposited' &&
                  x.actor?.toLowerCase() === o.support.donor.toLowerCase(),
              )
            : items;
        return {
          snapshot: o.snapshot,
          ...paginate(filtered, offset),
          ...(kind === 'test-support' ? o.support : {}),
        };
      },
    );
  }
  app.post<{
    Body: {
      incident: string;
      requested: string;
      capacity: string;
      external: string;
    };
  }>(
    '/api/v3/applications/preview',
    {
      schema: schema({
        incident: str(60),
        requested: str(12),
        capacity: str(12),
        external: str(12),
      }),
    },
    async (req) => previewApplication(await db.read(), auth(req), req.body),
  );
  app.post<{ Body: { purpose: string; target: string } }>(
    '/api/v3/approvals/export',
    {
      schema: schema({ purpose: str(20), target: str(100) }),
    },
    async (req) => {
      const s = await db.read();
      await authorizeApproval(s, req.body.purpose, req.body.target, auth(req));
      return exportApproval(s, req.body.purpose, req.body.target);
    },
  );
  app.post<{ Body: ApprovalBundle }>(
    '/api/v3/approvals/import',
    {
      schema: schema(
        {
          schema: { const: 1 },
          purpose: str(20),
          target: str(100),
          chainId: { const: 31337 },
          fund: str(42),
          payload: str(66),
          signatures: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: str(132),
          },
          context: { type: 'object' },
        },
        [
          'schema',
          'purpose',
          'target',
          'chainId',
          'fund',
          'payload',
          'signatures',
        ],
      ),
    },
    async (req) =>
      db.transaction(async (s, audit) => {
        const role = auth(req);
        const result = await importApproval(s, req.body, role);
        await audit(role.id, 'external-approval-import', req.body.target);
        return result;
      }),
  );

  app.get('/api/v3/health', async () => ({
    local: true,
    simulation: true,
    chainId: await client.getChainId(),
  }));
  app.get('/api/v3/roles', async () => ({
    simulation: true,
    roles: (await db.read()).roles
      .filter((r) => r.kind === 'ngo')
      .map(({ id, kind, name }) => ({
        id,
        kind,
        name,
      })),
  }));
  app.post<{ Body: { role: string } }>(
    '/api/v3/session',
    { schema: schema({ role: str(40) }) },
    async (req, reply) => {
      const role = (await db.read()).roles.find((x) => x.id === req.body.role);
      must(role, 'Unknown role');
      requireRole(role, 'ngo');
      const token = randomBytes(32).toString('hex');
      sessions.set(digest(token), { role, expires: Date.now() + 8 * 3600000 });
      reply.header(
        'Set-Cookie',
        `v3_session=${token}; HttpOnly; SameSite=Strict; Path=/api/v3; Max-Age=28800`,
      );
      return {
        id: role.id,
        kind: role.kind,
        name: role.name,
        ngo: role.ngo,
        simulation: true,
      };
    },
  );
  app.delete('/api/v3/session', async (req, reply) => {
    const token = String(req.headers.cookie ?? '').match(
      /v3_session=([^;]+)/,
    )?.[1];
    if (token) sessions.delete(digest(token));
    reply.header(
      'Set-Cookie',
      'v3_session=; HttpOnly; SameSite=Strict; Path=/api/v3; Max-Age=0',
    );
    return { ok: true };
  });
  app.get('/api/v3/public', async () => {
    const s = await db.read(),
      c = await chain();
    const balance = await c.balance(),
      reserved = (await c.read('totalReserved')) as bigint;
    const time = await now();
    return {
      simulation: true,
      alliance: s.alliance,
      registryVersion: s.registryVersion,
      organizations: s.roles
        .filter((x) => x.kind === 'ngo')
        .map(({ id, name, ngo }) => ({ id, name, wallet: ngo })),
      areaStates: s.areas.map((a) => ({
        id: a.id,
        state: situation(a, s.coverage, time),
      })),
      areas: s.areas,
      packages: s.packages,
      incidents: s.incidents,
      balance: String(balance),
      reserved: String(reserved),
      free: String(balance - reserved),
      paid: String(await c.read('totalPaid')),
      chainTime: await now(),
      reports: s.reports
        .filter((r) => r.published)
        .map(({ id, title, text, ngo, evidenceId, provenance }) => ({
          id,
          title,
          text,
          ngo,
          evidenceId,
          provenance,
          impact:
            'NGO-reported synthetic outcome; no independently proven humanitarian impact',
        })),
      worker: s.worker,
      indexer: s.indexer,
      coverage: s.coverage.map(
        ({ source, areaId, status, checkedAt, complete, pages, error }) => ({
          source,
          areaId,
          status,
          checkedAt,
          complete,
          pages,
          error,
        }),
      ),
      sources: SOURCE_REGISTRY,
      history: (
        await db.pool.query(
          'SELECT block_number,tx,body FROM v3_chain_log ORDER BY block_number DESC,log_index DESC LIMIT 100',
        )
      ).rows,
    };
  });
  app.get('/api/v3/portal', async (req) => {
    const role = auth(req),
      s = await db.read(),
      c = await chain(),
      time = await now();
    const isOwn = (ngo: string) => role.kind !== 'ngo' || ngo === role.ngo;
    const tip = await client.getBlockNumber({ cacheTime: 0 });
    const finalized = tip > 2n ? tip - 2n : 0n;
    const confirmedEvidence =
      finalized >= BigInt(c.config.deployedBlock)
        ? await chainEvidence(finalized)
        : [];
    return {
      role,
      simulation: true,
      chainTime: time,
      incidents: s.incidents,
      areas: s.areas,
      models: s.incidents.map((i) => ({
        incident: i.id,
        ...model(s, i.id, time, role.ngo),
      })),
      interim: s.interim.filter((x) => isOwn(x.ngo)),
      conflicts: role.kind === 'ngo' ? [] : s.conflicts,
      coverageDecisions: role.kind === 'data' ? s.coverageDecisions : [],
      apps: s.apps.filter((x) => isOwn(x.ngo)),
      evidence: (await chainEvidence())
        .filter((x) => isOwn(x.ngo))
        .map((e) => ({
          ...e,
          confirmed: confirmedEvidence.some(
            (x) =>
              x.id === e.id &&
              x.status === e.status &&
              x.manifest === e.manifest &&
              x.due === e.due &&
              x.responseDue === e.responseDue,
          ),
          reviewTarget: s.reviews.findLast(
            (r) => r.kind === 'receipt' && r.evidenceId === e.id && r.tx,
          )?.receivedAt
            ? reviewTarget(
                s.reviews.findLast(
                  (r) => r.kind === 'receipt' && r.evidenceId === e.id && r.tx,
                )!.receivedAt,
              )
            : null,
        })),
      reservations: (await reservations()).filter((x) => isOwn(x.ngo)),
      rounds: role.kind === 'data' ? s.rounds : [],
      reviews:
        role.kind === 'ngo'
          ? s.reviews.filter(
              (r) =>
                r.external &&
                !r.superseded &&
                (s.apps.some((a) => a.id === r.applicationId && isOwn(a.ngo)) ||
                  s.documents.some(
                    (d) => d.evidenceId === r.evidenceId && isOwn(d.ngo),
                  )),
            )
          : s.reviews,
      documents: s.documents
        .filter((d) => isOwn(d.ngo) && role.kind !== 'data')
        .map(({ id, evidenceId, name, mime, size, uploaded, category }) => ({
          category: category ?? 'expenditure-evidence',
          id,
          evidenceId,
          name,
          mime,
          size,
          uploaded,
        })),
      reports: s.reports.filter((r) => isOwn(r.ngo)),
      blocked: role.ngo ? await c.read('isBlocked', [role.ngo]) : false,
      governance: s.apps
        .filter(
          (a) => a.chainId && a.status === 'reviewed' && a.ngo !== role.ngo,
        )
        .map(({ id, chainId, incident, ngo, version, change, expires }) => ({
          id,
          chainId,
          incident,
          ngo,
          version,
          change,
          expires,
        })),
      backtest: role.kind === 'data' ? backtest(syntheticCases) : undefined,
    };
  });
  app.post<{ Body: { target: string; reason: string } }>(
    '/api/v3/conflicts',
    { schema: schema({ target: str(100), reason: str() }) },
    async (req) => {
      const role = auth(req);
      must(req.body.reason.length >= 20, 'Document the conflict');
      return db.transaction(async (s, audit) => {
        must(
          !s.conflicts.some(
            (c) => c.roleId === role.id && c.target === req.body.target,
          ),
          'Already recused',
        );
        const application = s.apps.find((a) => a.id === req.body.target);
        const round = s.rounds.find((r) => r.id === req.body.target);
        const review = s.reviews.find((r) => r.id === req.body.target);
        const coverage = s.coverageDecisions.find(
          (r) => r.id === req.body.target,
        );
        const report = s.reports.find((r) => r.id === req.body.target);
        must(
          application || round || review || coverage || report,
          'Unknown review target',
        );
        must(
          (!application || application.status === 'submitted') &&
            (!round || !round.tx) &&
            (!review || !review.tx) &&
            (!coverage || coverage.votes.length < 2) &&
            (!report || !report.published),
          'Closed decisions require a new review version',
        );
        for (const target of [application, round, review, coverage])
          if (target)
            target.votes = target.votes.filter((id) => id !== role.id);
        if (report)
          report.approvedBy = report.approvedBy.filter((id) => id !== role.id);
        s.conflicts.push({ roleId: role.id, ...req.body });
        await audit(role.id, 'recuse', req.body.target);
        return { ok: true };
      });
    },
  );
  app.post<{ Params: { id: string }; Body: { text: string } }>(
    '/api/v3/evidence/:id/interim',
    { schema: schema({ text: str(5000) }) },
    async (req) => {
      const role = auth(req);
      requireRole(role, 'ngo');
      const e = (await chainEvidence()).find(
        (e) => e.id === Number(req.params.id),
      );
      must(e, 'Evidence missing');
      own(role, e.ngo);
      return db.transaction(async (s, audit) => {
        s.interim.push({
          evidenceId: e.id,
          ngo: e.ngo,
          text: req.body.text,
          at: await now(),
        });
        await audit(role.id, 'interim-report', String(e.id));
        return { ok: true };
      });
    },
  );
  app.post<{ Body: { areaId: string; reason: string } }>(
    '/api/v3/coverage-decisions',
    { schema: schema({ areaId: str(100), reason: str() }) },
    async (req) => {
      const role = auth(req);
      requireRole(role, 'data');
      must(
        req.body.reason.length >= 20,
        'Document source coverage and manual reserve release',
      );
      return db.transaction(async (s) => {
        must(
          s.areas.some((a) => a.id === req.body.areaId),
          'Area missing',
        );
        const d = {
          id: randomUUID(),
          ...req.body,
          time: await now(),
          votes: [],
        };
        s.coverageDecisions.push(d);
        return d;
      });
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/v3/coverage-decisions/:id/approve',
    async (req) => {
      const role = auth(req);
      requireRole(role, 'data');
      return db.transaction(async (s, audit) => {
        const d = s.coverageDecisions.find((d) => d.id === req.params.id);
        must(
          d && !d.votes.includes(role.id) && d.votes.length < 2,
          'Decision missing or closed',
        );
        noConflict(s, role, d.id);
        must((await now()) - d.time <= 3600, 'Decision expired');
        d.votes.push(role.id);
        if (d.votes.length === 2) {
          const a = s.areas.find((a) => a.id === d.areaId)!;
          s.coverage.push({
            source: 'SIMULATED documented 2/3 manual coverage decision ' + d.id,
            areaId: a.id,
            areaVersion: a.version,
            hazards: a.hazards,
            start: d.time - 86400,
            end: d.time,
            checkedAt: d.time,
            status: 'ok',
            pages: 1,
            complete: true,
            observations: [],
          });
        }
        await audit(role.id, 'manual-coverage-decision', d.id);
        return d;
      });
    },
  );
  app.post<{
    Body: {
      incident: string;
      requested: string;
      capacity: string;
      external: string;
      explanation: string;
      change: string;
      conflicts: number;
    };
  }>(
    '/api/v3/applications',
    {
      schema: schema({
        incident: str(60),
        requested: str(12),
        capacity: str(12),
        external: str(12),
        explanation: str(),
        change: { type: 'string', maxLength: 2000 },
        conflicts: { type: 'integer', minimum: 0, maximum: 7 },
      }),
    },
    async (req) => {
      const role = auth(req);
      return db.transaction(async (s, audit) => {
        const preview = await previewApplication(s, role, req.body);
        must(
          !preview.blocked && BigInt(preview.remaining) > 0n,
          'No remaining claim or NGO blocked',
        );
        const result = await submit(s, role, req.body);
        await audit(role.id, 'application-submit', result.id);
        return result;
      });
    },
  );
  app.post<{ Params: { id: string }; Body: { action: string } }>(
    '/api/v3/applications/:id',
    { schema: schema({ action: { enum: ['approve', 'vote', 'expire'] } }) },
    async (req) => {
      const role = auth(req);
      return db.transaction(async (s, audit) => {
        let out: unknown;
        if (req.body.action === 'approve')
          out = await approveApplication(s, role, req.params.id);
        else {
          const a = s.apps.find((x) => x.id === req.params.id);
          must(a?.chainId, 'Chain application missing');
          const c = await chain();
          if (req.body.action === 'vote') {
            requireRole(role, 'ngo');
            out = await c.send('vote', [BigInt(a.chainId)], role.index);
          } else {
            own(role, a.ngo);
            out = await c.send(
              'closeApplication',
              [BigInt(a.chainId)],
              role.index,
            );
            a.status = 'rejected';
          }
        }
        await audit(role.id, req.body.action, req.params.id);
        return out;
      });
    },
  );
  app.post('/api/v3/rounds', async (req) => {
    const role = auth(req);
    return db.transaction((s) => prepareRound(s, role));
  });
  app.post<{ Params: { id: string } }>(
    '/api/v3/rounds/:id/release',
    async (req) => {
      const role = auth(req);
      return db.transaction(async (s, audit) => {
        const r = s.rounds.find((r) => r.id === req.params.id);
        must(r?.tx, 'Round missing');
        const tx = await (
          await chain()
        ).send('releaseHold', [r.snapshot], role.index);
        await audit(role.id, 'provisional-release', r.id);
        return { tx };
      });
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/v3/rounds/:id/approve',
    async (req) => {
      const role = auth(req);
      return db.transaction(async (s, audit) => {
        const r = await approveRound(s, role, req.params.id);
        await audit(role.id, 'round-vote', r.id);
        return r;
      });
    },
  );
  app.post<{ Params: { id: string }; Body: { action: string } }>(
    '/api/v3/reservations/:id',
    { schema: schema({ action: { enum: ['claim', 'release'] } }) },
    async (req) => {
      const role = auth(req);
      requireRole(role, 'ngo');
      const r = (await reservations()).find(
        (x) => x.id === Number(req.params.id),
      );
      must(r, 'Reservation missing', 404);
      own(role, r.ngo);
      return db.transaction(async (s, audit) => {
        const c = await chain();
        const tx = await c.send(req.body.action, [BigInt(r.id)], role.index);
        const a = s.apps.find((a) => a.chainId === r.application);
        if (a) a.status = req.body.action === 'claim' ? 'paid' : 'expired';
        await audit(role.id, req.body.action, String(r.id));
        return { tx };
      });
    },
  );
  app.post<{
    Body: {
      evidenceId: number;
      name: string;
      mime: string;
      size: number;
      synthetic: boolean;
      category?: 'expenditure-evidence' | 'external-review';
    };
  }>(
    '/api/v3/uploads',
    {
      schema: schema(
        {
          evidenceId: int,
          name: str(100),
          mime: {
            enum: ['text/plain', 'application/pdf', 'image/png', 'image/jpeg'],
          },
          size: { type: 'integer', minimum: 1, maximum: 2 * 1024 * 1024 },
          synthetic: { const: true },
          category: { enum: ['expenditure-evidence', 'external-review'] },
        },
        ['evidenceId', 'name', 'mime', 'size', 'synthetic'],
      ),
    },
    async (req) => {
      const role = auth(req);
      requireRole(role, 'ngo');
      const e = (await chainEvidence()).find(
        (x) => x.id === req.body.evidenceId,
      );
      must(e, 'Evidence missing', 404);
      own(role, e.ngo);
      const doc = {
        id: randomUUID(),
        evidenceId: e.id,
        category: req.body.category ?? 'expenditure-evidence',
        ngo: e.ngo,
        name: req.body.name,
        mime: req.body.mime,
        size: req.body.size,
        uploaded: false,
        salt: randomBytes(32).toString('hex'),
        createdAt: await now(),
      };
      await db.transaction(async (s, audit) => {
        s.documents.push(doc);
        await audit(role.id, 'upload-ticket', doc.id);
      });
      const token = randomBytes(32).toString('hex');
      tickets.set(digest(token), {
        docId: doc.id,
        subject: role.id,
        method: 'PUT',
        expires: Date.now() + 60000,
        used: false,
      });
      return {
        id: doc.id,
        url: `/api/v3/objects/${doc.id}?ticket=${token}`,
        expiresIn: 60,
      };
    },
  );
  const checkTicket = (
    id: string,
    token: string,
    role: Role,
    method: string,
  ) => {
    const t = tickets.get(digest(token));
    must(
      t &&
        t.docId === id &&
        t.subject === role.id &&
        t.method === method &&
        !t.used &&
        t.expires >= Date.now(),
      'Expired or unauthorized object link',
      403,
    );
    return t;
  };
  app.post<{ Params: { id: string } }>(
    '/api/v3/documents/:id/access',
    async (req) => {
      const role = auth(req);
      const d = (await db.read()).documents.find((d) => d.id === req.params.id);
      must(d?.uploaded, 'Document missing', 404);
      own(role, d.ngo);
      must(
        role.kind === 'ngo' ||
          role.kind === 'evidence' ||
          role.kind === 'appeal',
        'Review assignment required',
        403,
      );
      const token = randomBytes(32).toString('hex');
      tickets.set(digest(token), {
        docId: d.id,
        subject: role.id,
        method: 'GET',
        expires: Date.now() + 60000,
        used: false,
      });
      return { url: `/api/v3/objects/${d.id}?ticket=${token}`, expiresIn: 60 };
    },
  );
  app.addContentTypeParser(
    [
      'application/octet-stream',
      'text/plain',
      'application/pdf',
      'image/png',
      'image/jpeg',
    ],
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );
  app.put<{
    Params: { id: string };
    Querystring: { ticket: string };
    Body: Buffer;
  }>('/api/v3/objects/:id', async (req) => {
    const role = auth(req),
      ticket = checkTicket(req.params.id, req.query.ticket, role, 'PUT');
    return db.transaction(async (s, audit) => {
      const d = s.documents.find((d) => d.id === req.params.id);
      must(d && !d.uploaded, 'Object already sealed');
      own(role, d.ngo);
      must(
        Buffer.isBuffer(req.body) && req.body.length === d.size,
        'Size mismatch',
      );
      const body = req.body;
      const valid =
        d.mime === 'text/plain'
          ? body.toString('utf8').startsWith('DISASTERDAO SYNTHETIC')
          : d.mime === 'application/pdf'
            ? body.subarray(0, 5).toString() === '%PDF-'
            : d.mime === 'image/png'
              ? body.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
              : body.subarray(0, 3).toString('hex') === 'ffd8ff';
      must(valid, 'Invalid synthetic document format');
      ticket.used = true;
      d.digest = await documents.put(d.id, body);
      d.uploaded = true;
      d.createdAt = await now();
      await audit(role.id, 'upload-sealed', d.id);
      return { id: d.id, uploaded: true };
    });
  });
  app.get<{ Params: { id: string }; Querystring: { ticket: string } }>(
    '/api/v3/objects/:id',
    async (req, reply) => {
      const role = auth(req),
        ticket = checkTicket(req.params.id, req.query.ticket, role, 'GET');
      const d = (await db.read()).documents.find((d) => d.id === req.params.id);
      must(d?.uploaded, 'Document missing', 404);
      own(role, d.ngo);
      ticket.used = true;
      await db.transaction(async (_s, audit) =>
        audit(role.id, 'document-download', d.id),
      );
      reply
        .header('Content-Type', 'application/octet-stream')
        .header(
          'Content-Disposition',
          'attachment; filename="synthetic-evidence.bin"',
        )
        .header('Content-Security-Policy', "sandbox; default-src 'none'");
      return documents.get(d.id);
    },
  );
  app.post<{
    Body: {
      kind: 'receipt' | 'review' | 'extend' | 'resolve' | 'followup';
      evidenceId: number;
      reason: string;
      decision: number;
      days: number;
      applicationId?: string;
    };
  }>(
    '/api/v3/reviews',
    {
      schema: schema(
        {
          kind: {
            enum: ['receipt', 'review', 'extend', 'resolve', 'followup'],
          },
          evidenceId: int,
          reason: str(),
          decision: { type: 'integer', minimum: 0, maximum: 4 },
          days: { type: 'integer', minimum: 0, maximum: 30 },
          applicationId: { type: 'string', maxLength: 50 },
        },
        ['kind', 'evidenceId', 'reason', 'decision', 'days'],
      ),
    },
    async (req) => {
      const role = auth(req);
      return db.transaction((s) => proposeReview(s, role, req.body));
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/v3/reviews/:id/approve',
    async (req) => {
      const role = auth(req);
      return db.transaction(async (s, audit) => {
        const r = await approveReview(s, role, req.params.id);
        await audit(role.id, 'review-vote', r.id);
        return r;
      });
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/v3/evidence/:id/appeal',
    async (req) => {
      const role = auth(req);
      requireRole(role, 'ngo');
      const e = (await chainEvidence()).find(
        (x) => x.id === Number(req.params.id),
      );
      must(e, 'Evidence missing');
      own(role, e.ngo);
      return {
        tx: await (await chain()).send('appeal', [BigInt(e.id)], role.index),
      };
    },
  );
  app.post<{
    Body: {
      evidenceId: number;
      title: string;
      text: string;
      provenance: string;
      rights: string;
      protection: string;
    };
  }>(
    '/api/v3/reports',
    {
      schema: schema({
        evidenceId: int,
        title: str(100),
        text: str(),
        provenance: str(),
        rights: str(),
        protection: str(),
      }),
    },
    async (req) => {
      const role = auth(req);
      requireRole(role, 'ngo');
      const e = (await chainEvidence()).find(
        (e) => e.id === req.body.evidenceId,
      );
      must(e, 'Evidence missing');
      own(role, e.ngo);
      must(e.status === 2 || e.status === 6, 'Accepted use required');
      return db.transaction((s) => {
        const r = {
          ...req.body,
          id: randomUUID(),
          ngo: role.ngo!,
          approvedBy: [],
          published: false,
        };
        s.reports.push(r);
        return r;
      });
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/v3/reports/:id/approve',
    async (req) => {
      const role = auth(req);
      requireRole(role, 'evidence');
      return db.transaction(async (s, audit) => {
        noConflict(s, role, req.params.id);
        const r = s.reports.find((r) => r.id === req.params.id);
        must(
          r && !r.published && !r.approvedBy.includes(role.id),
          'Report unavailable',
        );
        r.approvedBy.push(role.id);
        r.published = r.approvedBy.length >= 2;
        await audit(role.id, 'publication-protection-review', r.id);
        return r;
      });
    },
  );
  app.post<{ Body: { amount: string } }>(
    '/api/v3/donations',
    { schema: schema({ amount: str(12) }) },
    async (req) => {
      if (String(req.headers.cookie ?? '').includes('v3_session=')) {
        auth(req);
        throw new Rejected(
          'Leave the NGO session before using the test donor',
          403,
        );
      }
      must(
        /^\d+$/.test(req.body.amount) && BigInt(req.body.amount) > 0n,
        'Invalid amount',
      );
      must(
        BigInt(req.body.amount) <= 1_000_000_000n,
        'At most 1000 test dUSD per donation',
      );
      const c = await chain();
      const amount = BigInt(req.body.amount);
      const tokenAbi = [
        {
          type: 'function',
          name: 'approve',
          inputs: [
            { type: 'address', name: 'spender' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [{ type: 'bool' }],
          stateMutability: 'nonpayable',
        },
      ] as const;
      const { wallet } = await import('../src/v3/chain.ts');
      const tx = await wallet(0).writeContract({
        address: c.config.token,
        abi: tokenAbi,
        functionName: 'approve',
        args: [c.config.fund, amount],
      });
      await client.waitForTransactionReceipt({ hash: tx });
      return { tx: await c.send('deposit', [amount], 0) };
    },
  );
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-V3-Simulation', 'local-roles-synthetic-data');
    return payload;
  });
  return app;
}
