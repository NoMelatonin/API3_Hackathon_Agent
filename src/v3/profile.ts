export const profile = process.env.DISASTERDAO_PROFILE ?? 'demo';
if (profile !== 'demo' && profile !== 'testnet')
  throw new Error('DISASTERDAO_PROFILE must be demo or testnet');
export const testnet = profile === 'testnet';
export const chainId = testnet ? 84532 : 31337;
export const oracleMode =
  testnet || process.env.V3_ORACLE_MODE === 'live' ? 'live' : 'synthetic';
export const apiPort = Number(process.env.DISASTERDAO_API_PORT ?? 3008);
export const uiPort = Number(process.env.DISASTERDAO_UI_PORT ?? 5173);
