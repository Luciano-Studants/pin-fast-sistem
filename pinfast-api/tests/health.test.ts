import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { Env } from "../src/config/env.js";

const testEnv: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:password@localhost:5432/pinfast",
  DIRECT_URL: "postgresql://user:password@localhost:5432/pinfast",
  JWT_ACCESS_SECRET: "test-secret-with-at-least-32-characters",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  CORS_ORIGINS: "http://localhost:8443",
  COOKIE_SECURE: false,
  COOKIE_SAME_SITE: "lax",
  R2_FORCE_PATH_STYLE: false,
  R2_BUCKET: "pinfast-test",
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  USER_STORAGE_QUOTA_BYTES: 200 * 1024 * 1024,
  ENABLE_DOCS: false,
  REGISTRATION_ENABLED: true,
};

describe("health endpoint", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv, logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the service status without database access", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "pinfast-api" });
  });

  it("protects private resources", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/workspaces" });
    expect(response.statusCode).toBe(401);
  });

  it("rejects cookie operations from an untrusted browser origin", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { origin: "https://malicious.example" },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "UNTRUSTED_ORIGIN" });
  });

  it("clears the refresh cookie with the same restricted path", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { origin: "http://localhost:8443" },
      payload: {},
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("pinfast_refresh=");
    expect(response.headers["set-cookie"]).toContain("Path=/api/v1/auth");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
  });
});
