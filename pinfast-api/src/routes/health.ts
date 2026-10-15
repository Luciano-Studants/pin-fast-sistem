import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "pinfast-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "not_ready" });
    }
  });
}
