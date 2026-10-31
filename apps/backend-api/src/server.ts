import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from './config/env.js';
import { buildApp } from './app.js';

export function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentModulePath = path.resolve(fileURLToPath(import.meta.url));
    const executedScriptPath = path.resolve(process.argv[1]);
    return currentModulePath.toLowerCase() === executedScriptPath.toLowerCase();
  } catch {
    return false;
  }
}

export async function startServer(): Promise<FastifyInstance | undefined> {
  try {
    const config = loadConfig();
    const app = await buildApp({ config });

    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Starting graceful shutdown...`);
      try {
        await app.close();
        app.log.info('Server successfully closed.');
        process.exit(0);
      } catch (err) {
        app.log.error(err, 'Error occurred during server shutdown:');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    app.log.info(`Moody Orange Backend API running on http://${config.HOST}:${config.PORT}`);
    app.log.info(`Health check available at http://${config.HOST}:${config.PORT}/health`);
    return app;
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
}

// Only start the network listener when this module is directly executed
if (isDirectExecution()) {
  startServer();
}
