import "@fastify/jwt";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";
import type { ObjectStorage } from "../lib/r2.js";
import type { Mailer } from "../lib/mailer.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
    prisma: PrismaClient;
    objectStorage: ObjectStorage;
    mailer: Mailer;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; type: "access" };
    user: { sub: string; type: "access" };
  }
}
