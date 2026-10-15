import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import type { Env } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { createObjectStorage } from "./lib/r2.js";
import { createMailer } from "./lib/mailer.js";
import { HttpError } from "./lib/http.js";
import { registerRoutes } from "./routes/index.js";

interface BuildAppOptions {
  env?: Env;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.env ?? loadEnv();
  const app = Fastify({
    logger:
      (options.logger ?? config.NODE_ENV !== "test")
        ? {
            level: config.LOG_LEVEL,
            redact: ["req.headers.authorization", "body.password", "body.refreshToken"],
          }
        : false,
    trustProxy: true,
    bodyLimit: config.MAX_UPLOAD_BYTES + 1024 * 1024,
    requestTimeout: 60_000,
    keepAliveTimeout: 65_000, // maior que o do proxy do Fly.io (60 s), evita 502 intermitente
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // Respostas da API contêm dados pessoais e tokens: nunca devem ser guardadas em cache.
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/api/")) reply.header("cache-control", "no-store");
  });

  app.decorate("config", config);
  app.decorate("prisma", prisma);
  app.decorate("objectStorage", createObjectStorage(config));
  app.decorate("mailer", createMailer(config));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  await app.register(jwt, { secret: config.JWT_ACCESS_SECRET });
  await app.register(multipart, {
    limits: { files: 1, fileSize: config.MAX_UPLOAD_BYTES },
  });
  const docsEnabled = config.NODE_ENV !== "production" || config.ENABLE_DOCS;
  if (docsEnabled)
    await app.register(swagger, {
      openapi: {
        info: {
          title: "PINFAST API",
          description: "API REST do PINFAST",
          version: "1.0.0",
        },
        servers: [{ url: "/api/v1" }],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
    });
  if (docsEnabled) await app.register(swaggerUi, { routePrefix: "/docs" });

  app.decorate("authenticate", async (request) => {
    await request.jwtVerify();
    if (request.user.type !== "access") throw new HttpError(401, "Token inválido", "INVALID_TOKEN");
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: error.flatten(),
      });
    }
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.status(409).send({ error: "CONFLICT", message: "Registro duplicado" });
      }
      if (error.code === "P2025") {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Registro não encontrado" });
      }
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: statusCode === 401 ? "UNAUTHORIZED" : "REQUEST_ERROR",
        message:
          statusCode === 401
            ? "Autenticação necessária"
            : error instanceof Error
              ? error.message
              : "Requisição inválida",
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Erro interno do servidor" });
  });

  await registerRoutes(app);
  return app;
}
