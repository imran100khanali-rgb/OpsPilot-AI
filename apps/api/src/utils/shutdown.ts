import { Server } from 'http';
import { env } from '../config/env.js';
import { logger } from './safeLogger.js';
import { closePool } from '../db/pool.js';

let isShuttingDown = false;

export function registerGracefulShutdown(server: Server): void {
  async function handleShutdown(signal: string, exitCode = 0): Promise<void> {
    if (isShuttingDown) {
      logger.warn(`Shutdown already in progress. Ignoring repeated signal: ${signal}`);
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`, {
      timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    });

    // Force exit timer if tasks hang
    const forceExitTimer = setTimeout(() => {
      logger.fatal(`Shutdown timed out after ${env.SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);

    // Unref timer so it doesn't hold the event loop open if everything closes cleanly
    forceExitTimer.unref();

    try {
      // 1. Stop accepting new HTTP requests
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error('Error during HTTP server shutdown', { error: err.message });
            reject(err);
          } else {
            logger.info('HTTP server closed successfully. No longer accepting connections.');
            resolve();
          }
        });
      });

      // 2. Drain database connection pool
      await closePool();

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed successfully. Exiting process.');
      process.exit(exitCode);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.fatal('Error during graceful shutdown execution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  }

  // Handle termination signals
  process.on('SIGTERM', () => {
    void handleShutdown('SIGTERM', 0);
  });

  process.on('SIGINT', () => {
    void handleShutdown('SIGINT', 0);
  });

  // Handle fatal uncaught errors
  process.on('uncaughtException', (err: Error) => {
    logger.fatal(`Uncaught Exception: ${err.message}`, {
      stack: env.NODE_ENV === 'production' ? undefined : err.stack,
    });
    void handleShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal(`Unhandled Promise Rejection: ${reason}`, {
      reason: reason instanceof Error ? reason.stack : reason,
    });
    void handleShutdown('unhandledRejection', 1);
  });
}
