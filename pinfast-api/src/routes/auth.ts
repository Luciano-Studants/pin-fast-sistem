import bcrypt from "bcryptjs";
import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { hashToken, issueTokens, publicUser } from "../lib/auth.js";
import { isHttpUrl } from "../lib/files.js";
import { HttpError, parse } from "../lib/http.js";
import { passwordResetMail } from "../lib/mailer.js";

// Hash fixo para igualar o tempo de resposta quando o usuário não existe (evita enumeração por timing).
const DUMMY_HASH = bcrypt.hashSync("pinfast-timing-equalizer", 12);
const REUSE_GRACE_MS = 10_000;

const credentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(6).max(128),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/)
    .optional(),
  password: z.string().min(8).max(128),
});

const AUTH_BODY_LIMIT = 16 * 1024;

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  newPassword: z.string().min(8).max(128),
});
const RESET_TTL_MS = 60 * 60 * 1000;

const refreshSchema = z.object({ refreshToken: z.string().min(32).optional() });

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(40)
      .regex(/^[a-z0-9._-]+$/)
      .nullable()
      .optional(),
    avatarUrl: z
      .string()
      .url()
      .max(2048)
      .refine(isHttpUrl, "A URL deve usar http ou https")
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo");

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(8).max(128),
});

function setRefreshCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string,
  expiresAt: Date,
) {
  reply.setCookie("pinfast_refresh", refreshToken, {
    path: "/api/v1/auth",
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: app.config.COOKIE_SAME_SITE,
    expires: expiresAt,
  });
}

function clearRefreshCookie(app: FastifyInstance, reply: FastifyReply) {
  reply.clearCookie("pinfast_refresh", {
    path: "/api/v1/auth",
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: app.config.COOKIE_SAME_SITE,
  });
}

function assertTrustedOrigin(app: FastifyInstance, origin?: string) {
  if (!origin) return;
  const trusted = app.config.CORS_ORIGINS.split(",").map((value) => value.trim());
  if (!trusted.includes(origin)) {
    throw new HttpError(403, "Origem não autorizada", "UNTRUSTED_ORIGIN");
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/register",
    {
      bodyLimit: AUTH_BODY_LIMIT,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!app.config.REGISTRATION_ENABLED) {
        throw new HttpError(
          403,
          "Novos cadastros estão temporariamente fechados",
          "REGISTRATION_CLOSED",
        );
      }
      const body = parse(registerSchema, request.body);
      const passwordHash = await bcrypt.hash(body.password, 12);

      const user = await app.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: body.name,
            email: body.email,
            username: body.username ?? null,
            passwordHash,
          },
        });
        await Promise.all([
          tx.workspace.create({
            data: { ownerId: created.id, name: "Faculdade", color: "#3b82f6", icon: "study" },
          }),
          tx.whiteboard.create({
            data: { userId: created.id, background: "white", strokes: [] },
          }),
          tx.pomodoroSettings.create({ data: { userId: created.id } }),
          tx.userPreferences.create({ data: { userId: created.id } }),
        ]);
        return created;
      });

      const tokens = await issueTokens(app, app.prisma, app.config, user.id);
      setRefreshCookie(app, reply, tokens.refreshToken, tokens.expiresAt);
      return reply.status(201).send({
        user: publicUser(user),
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      });
    },
  );

  app.post(
    "/auth/login",
    {
      bodyLimit: AUTH_BODY_LIMIT,
      // Por IP + conta: protege contra força bruta sem bloquear quem divide o mesmo IP
      // (rede de faculdade, por exemplo).
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (request: FastifyRequest) => {
            const identifier = (request.body as { identifier?: unknown } | undefined)?.identifier;
            return `${request.ip}|${typeof identifier === "string" ? identifier.toLowerCase().slice(0, 254) : ""}`;
          },
        },
      },
    },
    async (request, reply) => {
      const body = parse(credentialsSchema, request.body);
      const normalized = body.identifier.toLowerCase();
      const user = await app.prisma.user.findFirst({
        where: { OR: [{ email: normalized }, { username: normalized }] },
      });

      const passwordOk = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !passwordOk) {
        throw new HttpError(401, "E-mail, usuário ou senha incorretos", "INVALID_CREDENTIALS");
      }

      // Limpeza oportunista de tokens expirados ou revogados há muito tempo.
      await app.prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lte: new Date() } },
            { revokedAt: { lte: new Date(Date.now() - 7 * 86_400_000) } },
          ],
        },
      });

      const tokens = await issueTokens(app, app.prisma, app.config, user.id);
      setRefreshCookie(app, reply, tokens.refreshToken, tokens.expiresAt);
      return {
        user: publicUser(user),
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      };
    },
  );

  app.post(
    "/auth/refresh",
    {
      bodyLimit: AUTH_BODY_LIMIT,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      assertTrustedOrigin(app, request.headers.origin);
      const body = parse(refreshSchema, request.body ?? {});
      const refreshToken = request.cookies.pinfast_refresh ?? body.refreshToken;
      if (!refreshToken) {
        throw new HttpError(401, "Refresh token não informado", "INVALID_REFRESH_TOKEN");
      }
      const stored = await app.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });

      if (stored?.revokedAt) {
        // Reuso de um token já rotacionado indica possível roubo: encerra todas as sessões.
        // Uma janela curta tolera requisições concorrentes legítimas (várias abas).
        if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
          await app.prisma.refreshToken.updateMany({
            where: { userId: stored.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        throw new HttpError(401, "Refresh token inválido ou expirado", "INVALID_REFRESH_TOKEN");
      }
      if (!stored || stored.expiresAt <= new Date()) {
        throw new HttpError(401, "Refresh token inválido ou expirado", "INVALID_REFRESH_TOKEN");
      }

      const revoked = await app.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!revoked.count) {
        throw new HttpError(401, "Refresh token já utilizado", "INVALID_REFRESH_TOKEN");
      }
      const tokens = await issueTokens(app, app.prisma, app.config, stored.userId);
      setRefreshCookie(app, reply, tokens.refreshToken, tokens.expiresAt);
      return { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
    },
  );

  app.post(
    "/auth/forgot-password",
    {
      bodyLimit: AUTH_BODY_LIMIT,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          keyGenerator: (request: FastifyRequest) => {
            const email = (request.body as { email?: unknown } | undefined)?.email;
            return `${request.ip}|${typeof email === "string" ? email.toLowerCase().slice(0, 254) : ""}`;
          },
        },
      },
    },
    async (request, reply) => {
      assertTrustedOrigin(app, request.headers.origin);
      if (!app.mailer.configured) {
        throw new HttpError(
          503,
          "A recuperação de senha não está disponível no momento",
          "MAIL_NOT_CONFIGURED",
        );
      }
      const { email } = parse(forgotPasswordSchema, request.body);
      const user = await app.prisma.user.findUnique({ where: { email } });
      if (user) {
        const token = randomBytes(32).toString("base64url");
        await app.prisma.$transaction([
          app.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
          app.prisma.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + RESET_TTL_MS),
            },
          }),
        ]);
        const appUrl = app.config.APP_URL;
        if (!appUrl) {
          request.log.error("APP_URL não configurada: e-mail de redefinição não enviado");
        } else {
          const link = `${appUrl.replace(/\/$/, "")}/?reset=${token}`;
          // Sem await: o tempo de resposta não revela se o e-mail está cadastrado.
          void app.mailer
            .send({ to: user.email, ...passwordResetMail(user.name, link) })
            .catch((error) =>
              request.log.error({ error }, "Falha ao enviar e-mail de redefinição"),
            );
        }
      }
      return reply.status(204).send();
    },
  );

  app.post(
    "/auth/reset-password",
    {
      bodyLimit: AUTH_BODY_LIMIT,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      assertTrustedOrigin(app, request.headers.origin);
      const body = parse(resetPasswordSchema, request.body);
      const stored = await app.prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(body.token) },
      });
      if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
        throw new HttpError(400, "Link inválido ou expirado", "INVALID_RESET_TOKEN");
      }
      const passwordHash = await bcrypt.hash(body.newPassword, 12);
      const claimed = await app.prisma.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!claimed.count) {
        throw new HttpError(400, "Link inválido ou expirado", "INVALID_RESET_TOKEN");
      }
      await app.prisma.$transaction([
        app.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
        app.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      clearRefreshCookie(app, reply);
      return reply.status(204).send();
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    assertTrustedOrigin(app, request.headers.origin);
    const body = parse(refreshSchema, request.body ?? {});
    const refreshToken = request.cookies.pinfast_refresh ?? body.refreshToken;
    if (refreshToken) {
      await app.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshCookie(app, reply);
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request) => {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) throw new HttpError(404, "Usuário não encontrado", "USER_NOT_FOUND");
    return { user: publicUser(user) };
  });

  app.patch("/users/me", { preHandler: app.authenticate }, async (request) => {
    const body = parse(updateProfileSchema, request.body);
    const user = await app.prisma.user.update({
      where: { id: request.user.sub },
      data: body,
    });
    return { user: publicUser(user) };
  });

  app.put("/users/me/password", { preHandler: app.authenticate }, async (request, reply) => {
    const body = parse(changePasswordSchema, request.body);
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw new HttpError(401, "Senha atual incorreta", "INVALID_PASSWORD");
    }
    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(body.newPassword, 12) },
      }),
      app.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return reply.status(204).send();
  });

  app.delete("/users/me", { preHandler: app.authenticate }, async (request, reply) => {
    const body = parse(z.object({ password: z.string().min(6).max(128) }), request.body);
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, "Senha incorreta", "INVALID_PASSWORD");
    }
    const attachments = await app.prisma.postItAttachment.findMany({
      where: { postIt: { userId: user.id } },
      select: { objectKey: true },
    });
    await app.prisma.user.delete({ where: { id: user.id } });
    if (app.objectStorage.configured) {
      await Promise.all(
        attachments.map((item) =>
          app.objectStorage.delete(item.objectKey).catch((error) => {
            request.log.warn({ error, objectKey: item.objectKey }, "Falha ao remover anexo do R2");
          }),
        ),
      );
    }
    return reply.status(204).send();
  });
}
