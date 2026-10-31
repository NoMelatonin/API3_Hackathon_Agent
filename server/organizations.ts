import { chain, client, account } from '../src/v3/chain.ts';
import type { State } from './state.ts';
import type { Database } from './store.ts';
import type { Activity, Organization, Snapshot } from '../src/v3/ui-types.ts';
import { must, chainEvidence } from './service.ts';

export function normalizeActivity(
  row: {
    tx: string;
    log_index: number;
    block_number: string;
    body: { eventName: string; args: Record<string, unknown> };
  },
  time: number,
): Activity {
  const a = row.body.args;
  return {
    kind: row.body.eventName,
    tx: row.tx,
    logIndex: row.log_index,
    block: String(row.block_number),
    time,
    ...(a.donor || a.ngo ? { actor: String(a.donor ?? a.ngo) } : {}),
    ...(a.amount !== undefined ? { amount: String(a.amount) } : {}),
    ...(a.evidenceId !== undefined ||
    (row.body.eventName === 'EvidenceChanged' && a.id !== undefined)
      ? { evidenceId: String(a.evidenceId ?? a.id) }
      : {}),
  };
}
export function supportSummary(items: Activity[], donor: string) {
  const deposits = items.filter(
    (x) =>
      x.kind === 'Deposited' && x.actor?.toLowerCase() === donor.toLowerCase(),
  );
  return {
    donor,
    total: String(deposits.reduce((s, x) => s + BigInt(x.amount!), 0n)),
    count: deposits.length,
  };
}
export function paginate<T>(items: T[], offset: number, limit = 25) {
  return {
    items: items.slice(offset, offset + limit),
    next: offset + limit < items.length ? offset + limit : null,
  };
}
export async function organizationData(db: Database<State>, id?: string) {
  const s = await db.read();
  must(!id || id === s.alliance.id, 'Organization not found', 404);
  const c = await chain();
  const connection = await db.pool.connect();
  let checkpoint: { block_number: string; block_hash: string } | undefined;
  let rows: Parameters<typeof normalizeActivity>[0][];
  try {
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    checkpoint = (
      await connection.query('SELECT * FROM v3_chain_checkpoint WHERE id=1')
    ).rows[0];
    rows = (
      await connection.query(
        'SELECT * FROM v3_chain_log ORDER BY block_number DESC, log_index DESC',
      )
    ).rows;
    await connection.query('COMMIT');
  } catch (e) {
    await connection.query('ROLLBACK');
    throw e;
  } finally {
    connection.release();
  }
  let snapshot: Snapshot = {
    chainId: c.config.chainId,
    fund: c.config.fund,
    block: null,
    hash: null,
    time: null,
    status: 'unavailable',
  };
  let funds: Organization['funds'] = null;
  let items: Activity[] = [];
  if (checkpoint) {
    const blockNumber = BigInt(checkpoint.block_number);
    const tip = await client.getBlockNumber({ cacheTime: 0 });
    const confirmed = tip > 2n ? tip - 2n : 0n;
    const block =
      blockNumber <= confirmed ? await client.getBlock({ blockNumber }) : null;
    if (
      block?.hash === checkpoint.block_hash &&
      blockNumber >= BigInt(c.config.deployedBlock)
    ) {
      snapshot = {
        ...snapshot,
        block: String(blockNumber),
        hash: block.hash,
        time: Number(block.timestamp),
        status: blockNumber === confirmed ? 'confirmed' : 'stale',
      };
      const [balance, reserved, paid] = (await Promise.all([
        c.balance(blockNumber),
        c.read('totalReserved', [], blockNumber),
        c.read('totalPaid', [], blockNumber),
      ])) as [bigint, bigint, bigint];
      funds = {
        balance: String(balance),
        reserved: String(reserved),
        free: String(balance - reserved),
        paid: String(paid),
      };
      const times = new Map<string, number>();
      for (const n of new Set(rows!.map((r) => String(r.block_number)))) {
        if (BigInt(n) <= blockNumber)
          times.set(
            n,
            Number(
              (await client.getBlock({ blockNumber: BigInt(n) })).timestamp,
            ),
          );
      }
      items = rows!
        .filter((r) => times.has(String(r.block_number)))
        .map((r) => normalizeActivity(r, times.get(String(r.block_number))!));
    }
  }
  const support = supportSummary(items, account(0).address);
  const accepted = snapshot.block
    ? (await chainEvidence(BigInt(snapshot.block)))
        .filter((e) => [2, 6].includes(e.status))
        .map((e) => e.id)
    : [];
  const organization: Organization = {
    ...s.alliance,
    description:
      'Ein lokales, synthetisches Bündnis: drei NGOs teilen einen Fonds für grundlegende Katastrophenhilfe.',
    members: s.roles
      .filter((r) => r.kind === 'ngo')
      .map((r) => ({ id: r.id, name: r.name, wallet: r.ngo! })),
    areas: s.areas.map(({ id, name, country }) => ({ id, name, country })),
    images: ['rescue', 'medical', 'shelter'].map((name, i) => ({
      src: `/v3/${name}.svg`,
      altEn: [
        'Illustration: rescue team delivering supplies',
        'Illustration: medical relief',
        'Illustration: building an emergency shelter',
      ][i]!,
      alt: [
        'Illustration: Rettungsteam bringt Hilfsgüter',
        'Illustration: medizinische Versorgung',
        'Illustration: Aufbau einer Notunterkunft',
      ][i]!,
    })),
    snapshot,
    funds,
    support: {
      ...support,
      supported: snapshot.status === 'confirmed' ? support.count > 0 : null,
    },
    reports: s.reports
      .filter((r) => r.published && accepted.includes(r.evidenceId))
      .map(({ id, title, text, ngo, provenance }) => ({
        id,
        title,
        text,
        ngo,
        provenance,
      })),
  };
  return { organization, items };
}
