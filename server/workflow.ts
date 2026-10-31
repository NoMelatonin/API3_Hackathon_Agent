import { logPages } from '../src/log-pages.ts';
import { decodeEventLog } from 'viem';
import { chain, client } from '../src/v3/chain.ts';
import type { WorkflowCase } from '../src/v3/ui-types.ts';
import type { State, Role } from './state.ts';
import { reservations, chainEvidence, now, assessment } from './service.ts';

export async function workflowCases(
  s: State,
  role: Role,
): Promise<WorkflowCase[]> {
  const c = await chain(),
    time = await now();
  const tip = await client.getBlockNumber({ cacheTime: 0 });
  const [rs, es, logs] = await Promise.all([
    reservations(),
    chainEvidence(),
    logPages(BigInt(c.config.deployedBlock), tip, (fromBlock, toBlock) =>
      client.getLogs({ address: c.config.fund, fromBlock, toBlock }),
    ),
  ]);
  const events = logs.flatMap((log) => {
    try {
      return [
        {
          log,
          event: decodeEventLog({
            abi: c.fundAbi,
            data: log.data,
            topics: log.topics,
          }) as unknown as { eventName: string; args: Record<string, unknown> },
        },
      ];
    } catch {
      return [];
    }
  });
  return Promise.all(
    s.apps
      .filter((a) => a.ngo === role.ngo)
      .map(async (a) => {
        const app = a.chainId
          ? ((await c.read('applications', [BigInt(a.chainId)])) as unknown[])
          : undefined;
        const exists =
          !!app &&
          String(app[2]).toLowerCase() === role.ngo?.toLowerCase() &&
          String(app[1]) ===
            String(await c.read('assessmentHash', [assessment(a)]));
        const r = exists
          ? rs.find((x) => x.application === a.chainId)
          : undefined;
        const paid = exists
          ? events.find(
              (x) =>
                x.event.eventName === 'Paid' &&
                Number(x.event.args.applicationId) === a.chainId,
            )
          : undefined;
        const e = paid
          ? es.find((x) => x.id === Number(paid.event.args.evidenceId))
          : undefined;
        let latest = events.findLast(
          (x) =>
            Number(
              x.event.args.application ??
                x.event.args.applicationId ??
                x.event.args.id,
            ) === a.chainId &&
            ['ApplicationOpened', 'Reserved', 'Paid'].includes(
              x.event.eventName,
            ),
        );
        if (e)
          latest =
            events.findLast(
              (x) =>
                (x.event.eventName === 'EvidenceChanged' &&
                  Number(x.event.args.id) === e.id) ||
                x === paid,
            ) ?? latest;
        if (r?.settled && !paid)
          latest =
            events.findLast(
              (x) =>
                x.event.eventName === 'Released' &&
                Number(x.event.args.reservation) === r.id,
            ) ?? latest;
        const reasonCodes: string[] = [];
        const blocked = await c.read('isBlocked', [role.ngo]);
        const blockingEvidence = es
          .filter(
            (x) =>
              x.ngo === role.ngo &&
              (x.status === 4 ||
                x.status === 5 ||
                (x.status === 0 && time > x.due) ||
                (x.status === 3 && time > x.responseDue)),
          )
          .map((x) => x.id);
        if (blocked) reasonCodes.push('evidence_block');
        let step: WorkflowCase['step'] = 3,
          actor: WorkflowCase['actor'] = 'ngo',
          action = 'reserve';
        if (!exists) {
          action = a.automatic ? 'resubmit' : 'export_application';
          actor = a.automatic ? 'ngo' : 'data_reviewers';
        } else if (e) {
          step = 5;
          if ([2, 6].includes(e.status)) action = 'new_application';
          else if (e.status === 4) {
            action = 'appeal';
            reasonCodes.push('rejected');
          } else if (e.status === 5) {
            action = 'await_appeal';
            actor = 'appeal_reviewers';
          } else if (e.status === 1) {
            action = 'await_review';
            actor = 'evidence_reviewers';
          } else if (e.status === 3) action = 'provide_more_evidence';
          else if (
            s.reviews.some(
              (x) =>
                x.evidenceId === e.id &&
                x.kind === 'receipt' &&
                x.external &&
                !x.superseded &&
                !x.tx &&
                time - x.receivedAt <= 3600,
            )
          ) {
            action = 'await_receipt';
            actor = 'evidence_reviewers';
          } else action = 'upload_evidence';
        } else if (r) {
          step = 4;
          if (r.settled || time > r.expires) {
            reasonCodes.push('reservation_expired');
            action = r.settled ? 'new_application' : 'release';
          } else action = 'claim';
        } else if (Boolean(app![11])) {
          action = 'new_application';
        } else if (time > Number(app![6]) + 72 * 3600) {
          reasonCodes.push('application_expired');
          action = 'expire';
        } else if (!a.automatic) {
          action = 'await_round';
          actor = 'operator_and_data_reviewers';
        }
        const roundAt = Number(((await c.read('sharedQuote')) as unknown[])[1]);
        if (step === 3 && exists && a.automatic && roundAt > time)
          reasonCodes.push('round_wait');
        return {
          id: a.id,
          incident: a.incident,
          explanation: a.explanation,
          automatic: !!a.automatic,
          step,
          actor,
          action,
          reasonCodes,
          blockingEvidence,
          requested: a.requested,
          reserved: r && !r.settled && time <= r.expires ? r.amount : '0',
          paid: e?.amount ?? '0',
          reservationId: r?.id,
          evidenceId: e?.id,
          deadline: e ? (e.status === 3 ? e.responseDue : e.due) : r?.expires,
          nextRound: roundAt,
          votes: exists ? Number(app![8]) : 0,
          requiredVotes: 2,
          confirmed:
            !!latest &&
            latest.log.blockNumber !== null &&
            tip >= latest.log.blockNumber + 2n,
          tx: latest?.log.transactionHash ?? undefined,
        };
      }),
  );
}
