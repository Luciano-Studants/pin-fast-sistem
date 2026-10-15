import { buildApp } from "./app.js";

const app = await buildApp();

const close = async (signal: string) => {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void close("SIGINT"));
process.on("SIGTERM", () => void close("SIGTERM"));

try {
  await app.listen({ host: app.config.HOST, port: app.config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
