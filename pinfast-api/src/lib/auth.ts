import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueTokens(
  app: FastifyInstance,
  database: PrismaClient,
  env: Env,
  userId: string,
) {
  const accessToken = app.jwt.sign(
    { sub: userId, type: "access" },
    { expiresIn: env.ACCESS_TOKEN_TTL },
  );
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await database.refreshToken.create({
    data: { tokenHash: hashToken(refreshToken), userId, expiresAt },
  });

  return { accessToken, refreshToken, expiresAt };
}

export function publicUser<
  T extends {
    id: string;
    email: string;
    username: string | null;
    name: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(user: T) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
