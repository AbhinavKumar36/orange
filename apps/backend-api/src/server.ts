import { loadConfig } from './config/env.js';
import { buildApp } from './app.js';

async function startServer() {
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
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
}

// Only start when executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  startServer();
} else {
  // Fallback direct execution check for tsx/node
  startServer();
}

