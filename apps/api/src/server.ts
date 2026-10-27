import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/safeLogger.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

async function bootstrap(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`OpsPilot AI Backend Service started`, {
      port: env.PORT,
      env: env.NODE_ENV,
      healthUrl: `http://localhost:${env.PORT}/api/health`,
      systemsUrl: `http://localhost:${env.PORT}/api/v1/systems`,
    });
  });

  registerGracefulShutdown(server);
}

void bootstrap();
