import type { Server } from 'node:http';
import { createApp } from './app.js';
import { appOptionsFromEnv, describeAuthProviders } from './config/appOptions.js';
import { loadEnvFromProcess } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';

async function main(): Promise<void> {
  const env = loadEnvFromProcess();

  await connectDatabase(env.MONGODB_URI);

  const app = createApp(appOptionsFromEnv(env));

  const server: Server = app.listen(env.PORT, () => {
    console.info(
      `[api] Credit Follow API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
    );
    console.info(`[api] Sign-in providers: ${describeAuthProviders(env)}`);
  });

  const shutdown = (signal: string) => {
    console.info(`[api] Received ${signal}, shutting down...`);
    server.close(() => {
      disconnectDatabase()
        .catch((error: unknown) => console.error('[db] Error while disconnecting:', error))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[api] Failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
