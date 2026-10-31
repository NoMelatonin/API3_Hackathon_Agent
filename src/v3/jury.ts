process.on('uncaughtException', (error: Error & { shortMessage?: string }) => {
  console.error(error.shortMessage ?? error.message);
  process.exit(1);
});
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { decodeEventLog, parseAbi, type Hex } from 'viem';
import { chain, client, organizationScope } from './chain.ts';
import { juryConfig, jurySimulate, juryTamper } from '../../server/jury.ts';
import { automaticSubmit, automaticReserve } from '../../server/automatic.ts';
import { Database } from '../../server/store.ts';
import { seed, type State } from '../../server/state.ts';
import { writeNewOutput } from '../new-output.ts';
import { readPrivateKey } from '../private-key.ts';
import { campaigns } from '../campaigns.ts';
import { OTHER_REQUEST } from '../usgs.ts';
import { createPayingFetch } from '../vendor/x402.ts';
import {
  fetchSignedResponse,
  verifySignedResponse,
  deriveRequestHash,
  type SignedResponse,
} from '../vendor/airnode-v2.ts';
const [command, ...args] = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`--${name} requires a value`);
  return v;
};
const required = (name: string) => {
  const v = option(name);
  if (!v) throw new Error(`--${name} required`);
  return v;
};
const read = (file: string) =>
  readFile(file, 'utf8').then((x) => JSON.parse(x) as SignedResponse);
const stringify = (x: unknown) =>
  JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 2) +
  '\n';
const ngo = Number(option('ngo', '1')) - 1,
  slot = Number(option('slot', '0'));
if (
  !Number.isInteger(ngo) ||
  ngo < 0 ||
  ngo > 2 ||
  !Number.isInteger(slot) ||
  slot < 0 ||
  slot > 3
)
  throw new Error('NGO 1–3 and slot 0–3 required');
await organizationScope.run(
  option('organization', 'local-alliance')!,
  async () => {
    let output: unknown;
    if (command === 'fetch') {
      const c = campaigns[slot];
      if (!c || slot > 1)
        throw new Error('No enabled real Airnode source for this slot');
      const request = args.includes('--other') ? OTHER_REQUEST : c.request;
      if (args.includes('--other') && slot !== 0)
        throw new Error('--other is defined for the USGS jury scenario');
      await writeNewOutput(required('out'), async () => {
        const paid = createPayingFetch(
          readPrivateKey(process.env.PAYER_PRIVATE_KEY),
        );
        const proof = await fetchSignedResponse(c.url, request, (url, init) =>
          paid(url, { ...init, signal: AbortSignal.timeout(60000) }),
        );
        await verifySignedResponse(proof, c.signer, deriveRequestHash(request));
        return stringify(proof);
      });
      output = { saved: required('out'), kind: 'genuine-airnode-original' };
    } else if (command === 'config') output = await juryConfig();
    else if (command === 'simulate')
      output = await jurySimulate(await read(required('file')), slot, ngo);
    else if (command === 'tamper')
      output = await juryTamper(
        await read(required('file')),
        await read(required('old')),
        await read(required('other')),
        slot,
        ngo,
      );
    else {
      const db = new Database<State>();
      try {
        await db.init(seed());
        const s = await db.read(),
          role = s.roles.filter((r) => r.kind === 'ngo')[ngo]!;
        const c = await chain();
        if (command === 'submit')
          output = await db.transaction(async (s) =>
            automaticSubmit(s, role, {
              incident: s.incidents[slot]!.id,
              requested: option('amount', '500000000')!,
              capacity: option('capacity', '500000000')!,
              external: option('external', '0')!,
              explanation: option(
                'purpose',
                'Jury test: essential relief supplies for the registered historical test incident.',
              )!,
              requestId: option('request-id', randomUUID())!,
              proof: option('file') ? await read(required('file')) : undefined,
            }),
          );
        else if (command === 'reserve') {
          const proof = option('file')
            ? await read(required('file'))
            : undefined;
          output = await db.transaction((s) =>
            automaticReserve(s, role, required('application'), proof),
          );
        } else if (command === 'claim') {
          const rid = BigInt(required('reservation'));
          const r = (await c.read('reservations', [rid])) as unknown[];
          const a = (await c.read('applications', [r[0]])) as unknown[];
          if (String(a[2]).toLowerCase() !== role.ngo!.toLowerCase())
            throw new Error('Reservation belongs to another NGO');
          output = { tx: await c.send('claim', [rid], role.index) };
        } else if (command === 'prove') {
          // Reserve output before any external effect, retaining original signed bytes separately.
          await writeNewOutput(required('out'), async () => {
            const proof = await read(required('file')),
              old = await read(required('old')),
              other = await read(required('other'));
            const tamper = await juryTamper(proof, old, other, slot, ngo);
            if (!tamper.passed)
              throw new Error(
                'Four exact on-chain rejection checks did not pass',
              );
            const before = (await c.read('totalPaid')) as bigint;
            const tokenABI = parseAbi([
              'function balanceOf(address) view returns(uint256)',
            ]);
            const balanceBefore = await client.readContract({
              address: c.config.token,
              abi: tokenABI,
              functionName: 'balanceOf',
              args: [role.ngo as Hex],
            });
            const a = await db.transaction(async (s) =>
              automaticSubmit(s, role, {
                incident: s.incidents[slot]!.id,
                requested: '500000000',
                capacity: '500000000',
                external: '0',
                explanation:
                  'Jury test: essential relief supplies for the registered historical test incident.',
                requestId: option('request-id', randomUUID())!,
                proof,
              }),
            );
            const reservation = await db.transaction((s) =>
              automaticReserve(s, role, a.application, proof),
            );
            const rid = Number(reservation.reservation);
            const claim = await c.send('claim', [BigInt(rid)], role.index);
            const receipt = await client.getTransactionReceipt({ hash: claim });
            const paid = receipt.logs.flatMap((log) => {
              try {
                const e = decodeEventLog({
                  abi: c.fundAbi,
                  data: log.data,
                  topics: log.topics,
                });
                return e.eventName === 'Paid'
                  ? [e.args as unknown as Record<string, unknown>]
                  : [];
              } catch {
                return [];
              }
            })[0];
            if (
              receipt.status !== 'success' ||
              !paid ||
              BigInt(String(paid.amount)) <= 0n ||
              String(paid.ngo).toLowerCase() !== role.ngo!.toLowerCase() ||
              ((await c.read('totalPaid')) as bigint) !==
                before + BigInt(String(paid.amount))
            )
              throw new Error('Payout receipt/state mismatch');
            const balanceAfter = await client.readContract({
              address: c.config.token,
              abi: tokenABI,
              functionName: 'balanceOf',
              args: [role.ngo as Hex],
              blockNumber: receipt.blockNumber,
            });
            if (balanceAfter - balanceBefore !== BigInt(String(paid.amount)))
              throw new Error(
                'Fixed recipient did not receive the exact payout',
              );
            const report = {
              recipientBalanceBefore: String(balanceBefore),
              recipientBalanceAfter: String(balanceAfter),
              transferVerified: true,
              checkedAt: new Date().toISOString(),
              kind: 'genuine-airnode-integrated-payout',
              historicalEvent: true,
              simulatedNGO: true,
              chainId: c.config.chainId,
              network: c.config.network,
              fund: c.config.fund,
              token: c.config.token,
              oracleVerifier: c.config.oracleVerifier,
              activatedAt: c.config.activatedAt,
              original: required('file'),
              applicationOriginal: option('application-file', required('file')),
              oldOriginal: required('old'),
              otherOriginal: required('other'),
              signedAt: proof.timestamp,
              ngo: role.ngo,
              amount: String(paid.amount),
              application: a.application,
              reservation: rid,
              transactions: {
                application: a.tx,
                reservation: reservation.tx,
                payout: claim,
              },
              block: String(receipt.blockNumber),
              receiptStatus: receipt.status,
              tamper,
            };
            output = report;
            return stringify(report);
          });
        } else
          throw new Error(
            'Commands: config, fetch, simulate, submit, reserve, claim, tamper, prove',
          );
      } finally {
        await db.pool.end();
      }
    }
    if (option('out') && !['fetch', 'prove'].includes(command!))
      await writeNewOutput(required('out'), async () => stringify(output));
    console.log(stringify(output));
  },
);
