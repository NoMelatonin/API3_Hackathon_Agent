// Operator-only local tooling. No reviewer keys or signing endpoints are sent to a browser.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Database, json } from '../../server/store.ts';
import { seed, type State } from '../../server/state.ts';
import {
  exportApproval,
  importApproval,
  prepareExternalReview,
} from '../../server/external.ts';
import { prepareRound, must, now, noConflict } from '../../server/service.ts';
import { commitment } from './domain.ts';
import { chain } from './chain.ts';
import type { ApprovalBundle } from './ui-types.ts';
const [command, ...args] = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? undefined : args[i + 1];
};
const required = (name: string) => {
  const v = option(name);
  must(v, `--${name} required`);
  return v;
};
const db = new Database<State>();
try {
  await db.init(seed());
  let output: unknown;
  if (command === 'prepare-round') {
    output = await db.transaction(async (s) => {
      const r = await prepareRound(
        s,
        s.roles.find((r) => r.kind === 'data')!,
      );
      return exportApproval(s, 'ROUND', r.id);
    });
  } else if (command === 'prepare-review') {
    const input = JSON.parse(await readFile(required('input'), 'utf8'));
    output = await db.transaction(async (s) => {
      const r = await prepareExternalReview(s, input);
      return exportApproval(s, r.kind.toUpperCase(), r.id);
    });
  } else if (command === 'prepare-coverage') {
    const input = JSON.parse(await readFile(required('input'), 'utf8'));
    output = await db.transaction(async (s) => {
      must(
        s.areas.some((a) => a.id === input.areaId) &&
          typeof input.reason === 'string' &&
          input.reason.length >= 20,
        'Area and documented rationale required',
      );
      const d = {
        id: randomUUID(),
        areaId: String(input.areaId),
        reason: String(input.reason),
        time: await now(),
        votes: [],
      };
      s.coverageDecisions.push(d);
      return exportApproval(s, 'COVERAGE', d.id);
    });
  } else if (command === 'export') {
    output = await exportApproval(
      await db.read(),
      required('purpose'),
      required('target'),
    );
  } else if (command === 'sign' || command === 'import') {
    const bundle = JSON.parse(
      await readFile(required('in'), 'utf8'),
    ) as ApprovalBundle;
    if (command === 'sign') {
      const s = await db.read(),
        fresh = await exportApproval(s, bundle.purpose, bundle.target);
      must(
        fresh.fund === bundle.fund &&
          fresh.chainId === bundle.chainId &&
          fresh.payload === bundle.payload,
        'Stale or wrong request',
      );
      must(
        !bundle.context ||
          commitment(bundle.context) === commitment(fresh.context),
        'Approval context changed',
      );
      const r = s.roles.find((r) => r.id === required('role'));
      must(r && r.kind !== 'ngo', 'Reviewer role required');
      noConflict(s, r, bundle.target);
      const group = ['APPLICATION', 'ROUND', 'COVERAGE'].includes(
        bundle.purpose,
      )
        ? 'data'
        : bundle.purpose === 'RESOLVE'
          ? 'appeal'
          : 'evidence';
      must(r.kind === group, 'Wrong reviewer group');
      const sig = (
        await (await chain()).sign(bundle.purpose, bundle.payload, [r.index])
      )[0]!;
      must(!bundle.signatures.includes(sig), 'Already signed');
      output = { ...bundle, signatures: [...bundle.signatures, sig] };
    } else
      output = await db.transaction(async (s, audit) => {
        const out = await importApproval(s, bundle);
        await audit('external-operator', 'approval-import', bundle.target);
        return out;
      });
  } else if (command === 'recuse') {
    output = await db.transaction((s) => {
      const role = s.roles.find((r) => r.id === required('role'));
      must(role && role.kind !== 'ngo', 'Reviewer required');
      const target = required('target'),
        reason = required('reason');
      must(reason.length >= 20, 'Document the conflict');
      const a = s.apps.find((a) => a.id === target),
        r = s.rounds.find((r) => r.id === target),
        review = s.reviews.find((r) => r.id === target),
        report = s.reports.find((r) => r.id === target),
        coverage = s.coverageDecisions.find((r) => r.id === target);
      must(a || r || review || report || coverage, 'Unknown target');
      must(
        (!a || a.status === 'submitted') &&
          (!r || !r.tx) &&
          (!review || !review.tx) &&
          (!report || !report.published) &&
          (!coverage || coverage.votes.length < 2),
        'Closed decisions require a new version',
      );
      must(
        !s.conflicts.some((c) => c.roleId === role.id && c.target === target),
        'Already recused',
      );
      s.conflicts.push({ roleId: role.id, target, reason });
      return { ok: true };
    });
  } else
    throw new Error(
      'Commands: export, prepare-round, prepare-review, prepare-coverage, sign, import, recuse',
    );
  const out = option('out');
  if (out)
    await writeFile(out, json(output) + '\n', { flag: 'wx', mode: 0o600 });
  else console.log(json(output));
} finally {
  await db.pool.end();
}
