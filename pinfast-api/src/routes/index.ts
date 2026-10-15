import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { contentRoutes } from "./content.js";
import { coreRoutes } from "./core.js";
import { healthRoutes } from "./health.js";
import { migrationRoutes } from "./migrations.js";
import { productivityRoutes } from "./productivity.js";
import { syncRoutes } from "./sync.js";
import { uploadRoutes } from "./uploads.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(coreRoutes);
      await api.register(contentRoutes);
      await api.register(productivityRoutes);
      await api.register(migrationRoutes);
      await api.register(uploadRoutes);
      await api.register(syncRoutes);
    },
    { prefix: "/api/v1" },
  );
}
