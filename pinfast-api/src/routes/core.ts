import { randomUUID } from "node:crypto";
import { CollaborationRole } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { HttpError, idParamsSchema, parse } from "../lib/http.js";
import { clientCreateFields } from "../lib/ids.js";

const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32),
  icon: z.string().trim().min(1).max(64),
  description: z.string().trim().max(500).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

const collabSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(32),
  description: z.string().trim().max(500).nullable().optional(),
});

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  role: z
    .enum([CollaborationRole.EDITOR, CollaborationRole.VIEWER])
    .default(CollaborationRole.EDITOR),
});

async function ownedCollaboration(app: FastifyInstance, id: string, ownerId: string) {
  const item = await app.prisma.collaborationSpace.findFirst({ where: { id, ownerId } });
  if (!item) throw new HttpError(404, "Espaço colaborativo não encontrado", "NOT_FOUND");
  return item;
}

export async function coreRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/workspaces", async (request) => {
    return app.prisma.workspace.findMany({
      where: { ownerId: request.user.sub },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  });

  app.post("/workspaces", async (request, reply) => {
    const body = parse(workspaceSchema.extend(clientCreateFields), request.body);
    const item = await app.prisma.workspace.create({
      data: { ...body, ownerId: request.user.sub },
    });
    return reply.status(201).send(item);
  });

  app.patch("/workspaces/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      workspaceSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    const result = await app.prisma.workspace.updateMany({
      where: { id, ownerId: request.user.sub },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Área de trabalho não encontrada", "NOT_FOUND");
    return app.prisma.workspace.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/workspaces/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const count = await app.prisma.workspace.count({ where: { ownerId: request.user.sub } });
    if (count <= 1)
      throw new HttpError(409, "Mantenha ao menos uma área de trabalho", "LAST_WORKSPACE");
    const result = await app.prisma.workspace.deleteMany({
      where: { id, ownerId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Área de trabalho não encontrada", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/collaboration-spaces", async (request) => {
    return app.prisma.collaborationSpace.findMany({
      where: {
        OR: [{ ownerId: request.user.sub }, { members: { some: { userId: request.user.sub } } }],
      },
      include: { members: true },
      orderBy: { createdAt: "asc" },
    });
  });

  app.post("/collaboration-spaces", async (request, reply) => {
    const body = parse(collabSchema.extend(clientCreateFields), request.body);
    const item = await app.prisma.collaborationSpace.create({
      data: { ...body, ownerId: request.user.sub },
      include: { members: true },
    });
    return reply.status(201).send(item);
  });

  app.patch("/collaboration-spaces/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    await ownedCollaboration(app, id, request.user.sub);
    const body = parse(
      collabSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    return app.prisma.collaborationSpace.update({
      where: { id },
      data: body,
      include: { members: true },
    });
  });

  app.delete("/collaboration-spaces/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.collaborationSpace.deleteMany({
      where: { id, ownerId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Espaço colaborativo não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.post("/collaboration-spaces/:id/members", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    await ownedCollaboration(app, id, request.user.sub);
    const body = parse(memberSchema, request.body);
    const linkedUser = await app.prisma.user.findUnique({ where: { email: body.email } });
    const member = await app.prisma.collaborationMember.create({
      data: {
        collaborationSpaceId: id,
        email: body.email,
        name: body.name,
        role: body.role,
        userId: linkedUser?.id,
      },
    });
    return reply.status(201).send(member);
  });

  // O frontend trata membros como uma lista de nomes. Esta rota substitui apenas os membros
  // "locais" (e-mail placeholder), preservando membros reais convidados por e-mail.
  app.put("/collaboration-spaces/:id/member-names", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    await ownedCollaboration(app, id, request.user.sub);
    const { names } = parse(
      z.object({ names: z.array(z.string().trim().min(1).max(120)).max(100) }),
      request.body,
    );
    await app.prisma.$transaction([
      app.prisma.collaborationMember.deleteMany({
        where: {
          collaborationSpaceId: id,
          OR: [
            { email: { endsWith: "@members.invalid" } },
            { email: { endsWith: "@migration.invalid" } },
          ],
        },
      }),
      ...names.map((name) =>
        app.prisma.collaborationMember.create({
          data: {
            collaborationSpaceId: id,
            email: `local-${randomUUID()}@members.invalid`,
            name,
          },
        }),
      ),
    ]);
    return app.prisma.collaborationSpace.findUniqueOrThrow({
      where: { id },
      include: { members: true },
    });
  });

  app.patch("/collaboration-spaces/:id/members/:memberId", async (request) => {
    const params = parse(z.object({ id: z.string(), memberId: z.string() }), request.params);
    await ownedCollaboration(app, params.id, request.user.sub);
    const body = parse(
      z.object({ role: z.enum([CollaborationRole.EDITOR, CollaborationRole.VIEWER]) }),
      request.body,
    );
    const result = await app.prisma.collaborationMember.updateMany({
      where: { id: params.memberId, collaborationSpaceId: params.id },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Membro não encontrado", "NOT_FOUND");
    return app.prisma.collaborationMember.findUniqueOrThrow({ where: { id: params.memberId } });
  });

  app.delete("/collaboration-spaces/:id/members/:memberId", async (request, reply) => {
    const params = parse(z.object({ id: z.string(), memberId: z.string() }), request.params);
    await ownedCollaboration(app, params.id, request.user.sub);
    const result = await app.prisma.collaborationMember.deleteMany({
      where: { id: params.memberId, collaborationSpaceId: params.id },
    });
    if (!result.count) throw new HttpError(404, "Membro não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });
}
