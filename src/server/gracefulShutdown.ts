import type { FastifyInstance } from "fastify";

export function registerGracefulShutdown(app: FastifyInstance): void {
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "graceful shutdown requested");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "graceful shutdown failed");
      process.exit(1);
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}
