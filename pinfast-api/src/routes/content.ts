import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { isHttpUrl } from "../lib/files.js";
import { clientCreateFields } from "../lib/ids.js";
import {
  HttpError,
  idParamsSchema,
  pageArgs,
  paginationSchema,
  parse,
  toPage,
} from "../lib/http.js";

const colorSchema = z.string().trim().min(1).max(32);
const workspaceIdSchema = z.string().min(1).nullable().optional();

const postItCreateSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().min(1).max(240),
  description: z.string().max(20_000).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  color: colorSchema,
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  completed: z.boolean().default(false),
});

const postItUpdateSchema = postItCreateSchema.partial().extend({
  deleted: z.boolean().optional(),
});

const noteSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().max(240).nullable().optional(),
  content: z.string().max(100_000),
  color: colorSchema,
});

const quickLinkSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().trim().min(1).max(120),
  url: z.string().url().max(2048).refine(isHttpUrl, "A URL deve usar http ou https"),
  icon: z.string().max(64).nullable().optional(),
  color: colorSchema.nullable().optional(),
  position: z.number().int().min(0).optional(),
});

const documentSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().min(1).max(240),
  content: z.string().max(2_000_000),
});

const spreadsheetSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().min(1).max(240),
  cells: z.record(z.string(), z.unknown()),
  colWidths: z.record(z.string(), z.number().positive().max(2000)),
});

async function validateWorkspace(
  app: FastifyInstance,
  userId: string,
  workspaceId?: string | null,
) {
  if (!workspaceId) return;
  const exists = await app.prisma.workspace.count({ where: { id: workspaceId, ownerId: userId } });
  if (!exists) throw new HttpError(400, "Área de trabalho inválida", "INVALID_WORKSPACE");
}

function postItData(body: z.infer<typeof postItUpdateSchema>) {
  const data: Prisma.PostItUncheckedUpdateInput = {};
  if (body.workspaceId !== undefined) data.workspaceId = body.workspaceId;
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.dueDate !== undefined)
    data.dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00.000Z`) : null;
  if (body.dueTime !== undefined) data.dueTime = body.dueTime;
  if (body.color !== undefined) data.color = body.color;
  if (body.x !== undefined) data.positionX = body.x;
  if (body.y !== undefined) data.positionY = body.y;
  if (body.completed !== undefined) {
    data.completed = body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }
  if (body.deleted !== undefined) data.deletedAt = body.deleted ? new Date() : null;
  return data;
}

function serializePostIt<
  T extends {
    positionX: number;
    positionY: number;
    deletedAt: Date | null;
    dueDate: Date | null;
  },
>(item: T) {
  const { positionX, positionY, deletedAt, dueDate, ...rest } = item;
  return {
    ...rest,
    x: positionX,
    y: positionY,
    deleted: Boolean(deletedAt),
    dueDate: dueDate?.toISOString().slice(0, 10) ?? null,
  };
}

export async function contentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/post-its", async (request) => {
    const query = parse(
      paginationSchema.extend({
        workspaceId: z.string().optional(),
        includeDeleted: z
          .enum(["true", "false"])
          .default("false")
          .transform((value) => value === "true"),
      }),
      request.query,
    );
    const items = await app.prisma.postIt.findMany({
      where: {
        userId: request.user.sub,
        ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
        ...(!query.includeDeleted ? { deletedAt: null } : {}),
      },
      include: { attachments: true },
      orderBy: { createdAt: "desc" },
      ...pageArgs(query),
    });
    const page = toPage(items, query.limit);
    return { ...page, data: page.data.map(serializePostIt) };
  });

  app.get("/post-its/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const item = await app.prisma.postIt.findFirst({
      where: { id, userId: request.user.sub },
      include: { attachments: true },
    });
    if (!item) throw new HttpError(404, "Post-it não encontrado", "NOT_FOUND");
    return serializePostIt(item);
  });

  app.post("/post-its", async (request, reply) => {
    const body = parse(postItCreateSchema.extend(clientCreateFields), request.body);
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const item = await app.prisma.postIt.create({
      data: {
        id: body.id,
        createdAt: body.createdAt,
        userId: request.user.sub,
        workspaceId: body.workspaceId,
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(`${body.dueDate}T00:00:00.000Z`) : null,
        dueTime: body.dueTime,
        color: body.color,
        positionX: body.x,
        positionY: body.y,
        completed: body.completed,
        completedAt: body.completed ? new Date() : null,
      },
      include: { attachments: true },
    });
    return reply.status(201).send(serializePostIt(item));
  });

  app.patch("/post-its/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      postItUpdateSchema.refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const result = await app.prisma.postIt.updateMany({
      where: { id, userId: request.user.sub },
      data: postItData(body),
    });
    if (!result.count) throw new HttpError(404, "Post-it não encontrado", "NOT_FOUND");
    const item = await app.prisma.postIt.findUniqueOrThrow({
      where: { id },
      include: { attachments: true },
    });
    return serializePostIt(item);
  });

  app.delete("/post-its/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.postIt.updateMany({
      where: { id, userId: request.user.sub },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new HttpError(404, "Post-it não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/notes", async (request) => {
    const query = parse(
      paginationSchema.extend({ workspaceId: z.string().optional() }),
      request.query,
    );
    const items = await app.prisma.note.findMany({
      where: {
        userId: request.user.sub,
        ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...pageArgs(query),
    });
    return toPage(items, query.limit);
  });

  app.post("/notes", async (request, reply) => {
    const body = parse(noteSchema.extend(clientCreateFields), request.body);
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const item = await app.prisma.note.create({ data: { ...body, userId: request.user.sub } });
    return reply.status(201).send(item);
  });

  app.patch("/notes/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      noteSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const result = await app.prisma.note.updateMany({
      where: { id, userId: request.user.sub },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Nota não encontrada", "NOT_FOUND");
    return app.prisma.note.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/notes/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.note.deleteMany({ where: { id, userId: request.user.sub } });
    if (!result.count) throw new HttpError(404, "Nota não encontrada", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/quick-links", async (request) => {
    return app.prisma.quickLink.findMany({
      where: { userId: request.user.sub },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  });

  app.post("/quick-links", async (request, reply) => {
    const body = parse(quickLinkSchema.extend(clientCreateFields), request.body);
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const item = await app.prisma.quickLink.create({ data: { ...body, userId: request.user.sub } });
    return reply.status(201).send(item);
  });

  app.patch("/quick-links/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      quickLinkSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const result = await app.prisma.quickLink.updateMany({
      where: { id, userId: request.user.sub },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Link não encontrado", "NOT_FOUND");
    return app.prisma.quickLink.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/quick-links/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.quickLink.deleteMany({
      where: { id, userId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Link não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/documents", async (request) => {
    const query = parse(paginationSchema, request.query);
    const items = await app.prisma.textDocument.findMany({
      where: { userId: request.user.sub },
      orderBy: { updatedAt: "desc" },
      ...pageArgs(query),
    });
    return toPage(items, query.limit);
  });

  app.post("/documents", async (request, reply) => {
    const body = parse(documentSchema.extend(clientCreateFields), request.body);
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const item = await app.prisma.textDocument.create({
      data: { ...body, userId: request.user.sub },
    });
    return reply.status(201).send(item);
  });

  app.patch("/documents/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      documentSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const result = await app.prisma.textDocument.updateMany({
      where: { id, userId: request.user.sub },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Documento não encontrado", "NOT_FOUND");
    return app.prisma.textDocument.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/documents/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.textDocument.deleteMany({
      where: { id, userId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Documento não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/spreadsheets", async (request) => {
    const query = parse(paginationSchema, request.query);
    const items = await app.prisma.spreadsheet.findMany({
      where: { userId: request.user.sub },
      orderBy: { updatedAt: "desc" },
      ...pageArgs(query),
    });
    const page = toPage(items, query.limit);
    return {
      ...page,
      data: page.data.map(({ columnWidths, ...item }) => ({
        ...item,
        colWidths: columnWidths,
      })),
    };
  });

  app.post("/spreadsheets", async (request, reply) => {
    const body = parse(spreadsheetSchema.extend(clientCreateFields), request.body);
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const item = await app.prisma.spreadsheet.create({
      data: {
        id: body.id,
        createdAt: body.createdAt,
        userId: request.user.sub,
        workspaceId: body.workspaceId,
        title: body.title,
        cells: body.cells as Prisma.InputJsonValue,
        columnWidths: body.colWidths,
      },
    });
    const { columnWidths, ...rest } = item;
    return reply.status(201).send({ ...rest, colWidths: columnWidths });
  });

  app.patch("/spreadsheets/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      spreadsheetSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    await validateWorkspace(app, request.user.sub, body.workspaceId);
    const data: Prisma.SpreadsheetUncheckedUpdateInput = {};
    if (body.workspaceId !== undefined) data.workspaceId = body.workspaceId;
    if (body.title !== undefined) data.title = body.title;
    if (body.cells !== undefined) data.cells = body.cells as Prisma.InputJsonValue;
    if (body.colWidths !== undefined) data.columnWidths = body.colWidths;
    const result = await app.prisma.spreadsheet.updateMany({
      where: { id, userId: request.user.sub },
      data,
    });
    if (!result.count) throw new HttpError(404, "Planilha não encontrada", "NOT_FOUND");
    const item = await app.prisma.spreadsheet.findUniqueOrThrow({ where: { id } });
    const { columnWidths, ...rest } = item;
    return { ...rest, colWidths: columnWidths };
  });

  app.delete("/spreadsheets/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.spreadsheet.deleteMany({
      where: { id, userId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Planilha não encontrada", "NOT_FOUND");
    return reply.status(204).send();
  });
}
