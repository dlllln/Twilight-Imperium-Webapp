import { compose } from './composition-root.ts';
import { readConfig } from './config.ts';
import { buildServer } from './http-server.ts';

const config = readConfig(process.env);
const services = await compose(config);
const server = await buildServer(config, services);
await server.app.listen({ port: config.port, host: config.host });
server.app.log.info(`Stellar Hegemony läuft auf Port ${String(config.port)} (${services.storage})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void server.close().then(() => process.exit(0)));
