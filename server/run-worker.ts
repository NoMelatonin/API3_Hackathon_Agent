import { buildGateway } from './gateway.ts';
const { app, work } = await buildGateway();
try {
  await work();
} finally {
  await app.close();
}
