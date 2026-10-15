/**
 * Testes de integração: exigem um PostgreSQL com as migrações aplicadas.
 * Rodam no CI (veja .github/workflows/ci.yml) ou localmente com:
 *   TEST_DATABASE_URL=postgresql://... DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL \
 *   pnpm prisma:deploy && pnpm test:integration
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { Env } from "../../src/config/env.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  LOG_LEVEL: "silent",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
  DIRECT_URL: process.env.TEST_DATABASE_URL ?? "",
  JWT_ACCESS_SECRET: "integration-test-secret-with-32-chars!",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  CORS_ORIGINS: "http://localhost:8443",
  COOKIE_SECURE: false,
  COOKIE_SAME_SITE: "lax",
  R2_FORCE_PATH_STYLE: false,
  R2_BUCKET: "test",
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  USER_STORAGE_QUOTA_BYTES: 200 * 1024,
  ENABLE_DOCS: false,
  REGISTRATION_ENABLED: true,
};

interface Session {
  ip: string;
  token: string;
  refresh: string;
  email: string;
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

function multipart(filename: string, mimetype: string, content: Buffer) {
  const boundary = `----pinfast${randomUUID()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe.skipIf(!enabled)("API (PostgreSQL)", () => {
  let app: FastifyInstance;
  const deleted: string[] = [];
  const sentMails: Array<{ to: string; text: string }> = [];
  let ipCounter = 10;

  beforeAll(async () => {
    app = await buildApp({ env, logger: false });
    // Armazenamento falso: nenhum acesso real ao R2.
    app.mailer = {
      configured: true,
      send: async (mail) => {
        sentMails.push(mail);
      },
    };
    app.objectStorage = {
      configured: true,
      put: async (key) => `https://files.test/${key}`,
      delete: async (key) => {
        deleted.push(key);
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  const nextIp = () => `10.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}.7`;

  async function signup(): Promise<Session> {
    const ip = nextIp();
    const email = `u-${randomUUID()}@example.com`;
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      remoteAddress: ip,
      payload: { name: "Teste Usuário", email, password: "senha-segura-1" },
    });
    expect(response.statusCode).toBe(201);
    const refresh = response.cookies.find((c) => c.name === "pinfast_refresh")?.value ?? "";
    return { ip, token: response.json().accessToken, refresh, email };
  }

  const call = (
    s: Session,
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      remoteAddress: s.ip,
      headers: { authorization: `Bearer ${s.token}` },
      payload: payload as object | undefined,
    });

  it("registra, autentica e recusa senha errada", async () => {
    const s = await signup();
    const me = await call(s, "GET", "/auth/me");
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(s.email);
    expect(me.headers["cache-control"]).toBe("no-store");

    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      remoteAddress: s.ip,
      payload: { identifier: s.email, password: "senha-segura-1" },
    });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      remoteAddress: s.ip,
      payload: { identifier: s.email, password: "errada-errada" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("rotaciona o refresh token e recusa reuso", async () => {
    const s = await signup();
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      remoteAddress: s.ip,
      cookies: { pinfast_refresh: s.refresh },
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      remoteAddress: s.ip,
      cookies: { pinfast_refresh: s.refresh },
      payload: {},
    });
    expect(reused.statusCode).toBe(401);
  });

  it("isola os dados entre usuários", async () => {
    const a = await signup();
    const b = await signup();
    const created = await call(a, "POST", "/notes", { content: "segredo", color: "#fff" });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    expect((await call(b, "GET", "/notes")).json().data).toHaveLength(0);
    expect((await call(b, "PATCH", `/notes/${id}`, { content: "hack" })).statusCode).toBe(404);
    expect((await call(b, "DELETE", `/notes/${id}`)).statusCode).toBe(404);
    expect((await call(a, "GET", "/notes")).json().data[0].content).toBe("segredo");
  });

  it("aceita id do cliente e impede colisão entre usuários", async () => {
    const a = await signup();
    const b = await signup();
    const id = `client-${randomUUID()}`;
    const first = await call(a, "POST", "/notes", { id, content: "a", color: "#fff" });
    expect(first.statusCode).toBe(201);
    expect(first.json().id).toBe(id);
    const clash = await call(b, "POST", "/notes", { id, content: "b", color: "#fff" });
    expect(clash.statusCode).toBe(409);
    const short = await call(a, "POST", "/notes", { id: "a1", content: "x", color: "#fff" });
    expect(short.statusCode).toBe(400);
  });

  it("post-its: preserva createdAt, filtra excluídos e exporta no snapshot", async () => {
    const s = await signup();
    const id = randomUUID();
    const created = await call(s, "POST", "/post-its", {
      id,
      title: "Prova",
      color: "#fef9c3",
      x: 10,
      y: 20,
      dueDate: "2026-12-01",
      createdAt: "2026-01-02T03:04:05.000Z",
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().createdAt).toBe("2026-01-02T03:04:05.000Z");

    await call(s, "PATCH", `/post-its/${id}`, { deleted: true });
    expect((await call(s, "GET", "/post-its?includeDeleted=false")).json().data).toHaveLength(0);
    expect((await call(s, "GET", "/post-its?includeDeleted=true")).json().data).toHaveLength(1);

    const snapshot = (await call(s, "GET", "/sync/snapshot")).json();
    expect(snapshot.postIts).toHaveLength(1);
    expect(snapshot.workspaces.length).toBeGreaterThan(0);
  });

  it("anexos: valida conteúdo, cota e remove do storage ao excluir a conta", async () => {
    const s = await signup();
    const postId = randomUUID();
    await call(s, "POST", "/post-its", { id: postId, title: "Com anexo", color: "#fff" });

    const fake = multipart("x.png", "image/png", Buffer.from("<script>alert(1)</script>"));
    const mismatch = await app.inject({
      method: "POST",
      url: `/api/v1/post-its/${postId}/attachments`,
      remoteAddress: s.ip,
      headers: { authorization: `Bearer ${s.token}`, ...fake.headers },
      payload: fake.payload,
    });
    expect(mismatch.statusCode).toBe(415);

    const good = multipart("foto.png", "image/png", PNG);
    const ok = await app.inject({
      method: "POST",
      url: `/api/v1/post-its/${postId}/attachments`,
      remoteAddress: s.ip,
      headers: { authorization: `Bearer ${s.token}`, ...good.headers },
      payload: good.payload,
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().url).toMatch(/^https:\/\/files\.test\/users\//);

    const big = multipart(
      "grande.png",
      "image/png",
      Buffer.concat([PNG, Buffer.alloc(220 * 1024, 2)]),
    );
    const quota = await app.inject({
      method: "POST",
      url: `/api/v1/post-its/${postId}/attachments`,
      remoteAddress: s.ip,
      headers: { authorization: `Bearer ${s.token}`, ...big.headers },
      payload: big.payload,
    });
    expect(quota.statusCode).toBe(413);

    const del = await call(s, "DELETE", "/users/me", { password: "senha-segura-1" });
    expect(del.statusCode).toBe(204);
    expect(deleted.some((key) => key.includes("/post-its/"))).toBe(true);
  });

  it("espaços colaborativos: substitui só os membros locais", async () => {
    const s = await signup();
    const id = randomUUID();
    await call(s, "POST", "/collaboration-spaces", { id, name: "TCC", color: "#6366f1" });
    await call(s, "POST", `/collaboration-spaces/${id}/members`, { email: "real@example.com" });
    const first = await call(s, "PUT", `/collaboration-spaces/${id}/member-names`, {
      names: ["Ana", "Beto"],
    });
    expect(first.statusCode).toBe(200);
    const second = await call(s, "PUT", `/collaboration-spaces/${id}/member-names`, {
      names: ["Carla"],
    });
    const names = second
      .json()
      .members.map((m: { name: string | null; email: string }) => m.name ?? m.email);
    expect(names.sort()).toEqual(["Carla", "real@example.com"].sort());
  });

  it("quizzes e tentativas com id e nota do cliente", async () => {
    const s = await signup();
    const quizId = randomUUID();
    const quiz = await call(s, "POST", "/quizzes", {
      id: quizId,
      title: "Q",
      timeLimitMinutes: null,
      questions: [
        {
          id: "q1",
          type: "single",
          prompt: "2+2?",
          choices: [
            { id: "a", text: "3", correct: false },
            { id: "b", text: "4", correct: true },
          ],
        },
      ],
    });
    expect(quiz.statusCode).toBe(201);
    const attemptId = randomUUID();
    const attempt = await call(s, "POST", `/quizzes/${quizId}/attempts`, {
      id: attemptId,
      answers: [{ questionId: "q1", selectedChoiceIds: ["b"] }],
      startedAt: "2026-01-01T00:00:00.000Z",
      score: 1,
      total: 1,
    });
    expect(attempt.statusCode).toBe(201);
    expect(attempt.json()).toMatchObject({ id: attemptId, score: 1, total: 1 });
  });

  it("migração do localStorage é idempotente e descarta itens inválidos", async () => {
    const s = await signup();
    const snapshot = {
      workspaces: [{ id: "1", name: "Faculdade", color: "#3b82f6", icon: "🎓" }],
      notes: [{ id: "n1", content: "oi", color: "#fff" }],
      links: [
        { id: "l1", name: "Ok", url: "https://example.com" },
        { id: "l2", name: "Ruim", url: "javascript:alert(1)" },
      ],
      quizzes: [
        { id: "bad", title: "Quebrado", questions: [{ nope: true }], timeLimitMinutes: null },
      ],
    };
    const first = await call(s, "POST", "/migrations/local-storage/import", snapshot);
    expect(first.statusCode).toBe(201);
    expect(first.json().migration.summary).toMatchObject({
      quickLinks: 1,
      skippedLinks: 1,
      skippedQuizzes: 1,
    });
    const again = await call(s, "POST", "/migrations/local-storage/import", snapshot);
    expect(again.statusCode).toBe(201);
    expect((await call(s, "GET", "/notes")).json().data).toHaveLength(1);
  });

  it("recuperação de senha: envia link, troca a senha e invalida o link e as sessões", async () => {
    const s = await signup();
    const forgot = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      remoteAddress: s.ip,
      payload: { email: s.email },
    });
    expect(forgot.statusCode).toBe(204);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const mail = sentMails.find((m) => m.to === s.email);
    expect(mail).toBeDefined();
    const token = /\?reset=([A-Za-z0-9_-]+)/.exec(mail!.text)?.[1] ?? "";
    expect(token.length).toBeGreaterThan(30);

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      remoteAddress: s.ip,
      payload: { token, newPassword: "nova-senha-123" },
    });
    expect(reset.statusCode).toBe(204);

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      remoteAddress: s.ip,
      payload: { token, newPassword: "outra-senha-123" },
    });
    expect(reuse.statusCode).toBe(400);

    const oldSession = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      remoteAddress: s.ip,
      cookies: { pinfast_refresh: s.refresh },
      payload: {},
    });
    expect(oldSession.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      remoteAddress: s.ip,
      payload: { identifier: s.email, password: "nova-senha-123" },
    });
    expect(login.statusCode).toBe(200);
  });

  it("recuperação de senha não revela se o e-mail existe e respeita e-mail não configurado", async () => {
    const ip = nextIp();
    const before = sentMails.length;
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      remoteAddress: ip,
      payload: { email: `nao-existe-${randomUUID()}@example.com` },
    });
    expect(unknown.statusCode).toBe(204);
    expect(sentMails.length).toBe(before);

    const original = app.mailer;
    app.mailer = { configured: false, send: original.send };
    const off = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      remoteAddress: ip,
      payload: { email: "alguem@example.com" },
    });
    app.mailer = original;
    expect(off.statusCode).toBe(503);
  });

  it("permite fechar novos cadastros", async () => {
    (app.config as { REGISTRATION_ENABLED: boolean }).REGISTRATION_ENABLED = false;
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      remoteAddress: nextIp(),
      payload: {
        name: "Fechado",
        email: `f-${randomUUID()}@example.com`,
        password: "senha-segura-1",
      },
    });
    (app.config as { REGISTRATION_ENABLED: boolean }).REGISTRATION_ENABLED = true;
    expect(response.statusCode).toBe(403);
  });
});
