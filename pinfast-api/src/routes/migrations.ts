import { createHash, randomUUID } from "node:crypto";
import { MigrationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  allowedMimeTypes,
  contentMatchesMime,
  extensionFor,
  isHttpUrl,
  safeFilename as safeFileName,
} from "../lib/files.js";
import { HttpError, parse } from "../lib/http.js";
import { assertWithinQuota } from "../lib/storage-quota.js";
import { quizQuestionSchema } from "./productivity.js";

const SOURCE = "local-storage";
const VERSION = 1;

const baseItem = z.object({ id: z.string().min(1).max(128) });
const attachmentSchema = baseItem.extend({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
});
const workspaceSchema = baseItem.extend({
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  icon: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
});
const collabSchema = baseItem.extend({
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(32),
  members: z.array(z.string().max(120)).default([]),
});
const postItSchema = baseItem.extend({
  title: z.string().min(1).max(240),
  description: z.string().max(20_000).optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  color: z.string().min(1).max(32),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  completed: z.boolean().default(false),
  completedAt: z.string().optional(),
  deleted: z.boolean().default(false),
  createdAt: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
});
const noteSchema = baseItem.extend({
  title: z.string().max(240).optional(),
  content: z.string().max(100_000),
  color: z.string().min(1).max(32),
  createdAt: z.string().optional(),
});
const linkSchema = baseItem.extend({
  name: z.string().min(1).max(120),
  url: z.string().max(2048),
  icon: z.string().max(64).optional(),
  color: z.string().max(32).optional(),
});
const documentSchema = baseItem.extend({
  title: z.string().min(1).max(240),
  content: z.string().max(2_000_000),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
const spreadsheetSchema = baseItem.extend({
  title: z.string().min(1).max(240),
  cells: z.record(z.string(), z.unknown()),
  colWidths: z.record(z.string(), z.number()),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
const routineTaskSchema = baseItem.extend({
  name: z.string().min(1).max(240),
  time: z.string().optional(),
});
const routineSchema = z.object({
  seg: z.array(routineTaskSchema).default([]),
  ter: z.array(routineTaskSchema).default([]),
  qua: z.array(routineTaskSchema).default([]),
  qui: z.array(routineTaskSchema).default([]),
  sex: z.array(routineTaskSchema).default([]),
  sab: z.array(routineTaskSchema).default([]),
  dom: z.array(routineTaskSchema).default([]),
});
const quizSchema = baseItem.extend({
  title: z.string().min(1).max(240),
  questions: z.array(z.unknown()).max(200),
  timeLimitMinutes: z.number().int().positive().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
const attemptSchema = baseItem.extend({
  quizId: z.string().min(1).max(128),
  answers: z.array(z.unknown()).max(200),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  score: z.number().optional(),
  total: z.number().optional(),
});

const snapshotSchema = z.object({
  workspaces: z.array(workspaceSchema).max(500).default([]),
  collabSpaces: z.array(collabSchema).max(500).default([]),
  postIts: z.array(postItSchema).max(10_000).default([]),
  notes: z.array(noteSchema).max(10_000).default([]),
  links: z.array(linkSchema).max(5_000).default([]),
  documents: z.array(documentSchema).max(5_000).default([]),
  sheets: z.array(spreadsheetSchema).max(2_000).default([]),
  routine: routineSchema.default({
    seg: [],
    ter: [],
    qua: [],
    qui: [],
    sex: [],
    sab: [],
    dom: [],
  }),
  quizzes: z.array(quizSchema).max(2_000).default([]),
  quizAttempts: z.array(attemptSchema).max(20_000).default([]),
  whiteboard: z
    .object({
      background: z.enum(["white", "dark", "grid", "dots", "lines"]).default("white"),
      strokes: z.array(z.unknown()).max(50_000).default([]),
    })
    .optional(),
  pomodoro: z
    .object({
      preset: z.enum(["classic", "focus", "deep", "custom"]).default("classic"),
      custom: z
        .object({
          study: z.number().int().min(5).max(180).default(25),
          shortBreak: z.number().int().min(1).max(30).default(5),
          longBreak: z.number().int().min(5).max(60).default(15),
          sessions: z.number().int().min(1).max(10).default(4),
        })
        .default({ study: 25, shortBreak: 5, longBreak: 15, sessions: 4 }),
    })
    .optional(),
  preferences: z
    .object({
      darkMode: z.boolean().default(false),
      pageZoom: z.number().min(0.6).max(1.5).default(1),
    })
    .optional(),
});

const uploadParamsSchema = z.object({
  migrationId: z.string().min(1),
  legacyPostItId: z.string().min(1).max(128),
  legacyAttachmentId: z.string().min(1).max(128),
});

const weekdayMap = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 } as const;
function stableId(userId: string, entity: string, legacyId: string) {
  return createHash("sha256").update(`${userId}:${entity}:${legacyId}`).digest("hex").slice(0, 32);
}

function safeDate(value?: string, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function migrationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/migrations/local-storage/status", async (request) => {
    const migration = await app.prisma.dataMigration.findUnique({
      where: {
        userId_source_version: { userId: request.user.sub, source: SOURCE, version: VERSION },
      },
    });
    return { version: VERSION, migration };
  });

  app.post(
    "/migrations/local-storage/import",
    { bodyLimit: 25 * 1024 * 1024 },
    async (request, reply) => {
      const parsed = parse(snapshotSchema, request.body);
      const userId = request.user.sub;
      // Itens fora do padrão não derrubam a importação inteira: são descartados e contabilizados.
      const validQuizzes = parsed.quizzes.filter(
        (quiz) => z.array(quizQuestionSchema).safeParse(quiz.questions).success,
      );
      const validQuizIds = new Set(validQuizzes.map((quiz) => quiz.id));
      const validLinks = parsed.links.filter((link) => isHttpUrl(link.url));
      const skipped = {
        quizzes: parsed.quizzes.length - validQuizzes.length,
        links: parsed.links.length - validLinks.length,
      };
      const snapshot = {
        ...parsed,
        quizzes: validQuizzes,
        links: validLinks,
        quizAttempts: parsed.quizAttempts.filter((attempt) => validQuizIds.has(attempt.quizId)),
      };
      const existing = await app.prisma.dataMigration.findUnique({
        where: { userId_source_version: { userId, source: SOURCE, version: VERSION } },
      });
      if (existing?.status === MigrationStatus.COMPLETED) {
        return { migration: existing, alreadyCompleted: true };
      }

      const expectedAttachments = snapshot.postIts.reduce(
        (total, postIt) => total + postIt.attachments.length,
        0,
      );

      try {
        const migration = await app.prisma.$transaction(
          async (tx) => {
            const record = await tx.dataMigration.upsert({
              where: { userId_source_version: { userId, source: SOURCE, version: VERSION } },
              create: {
                userId,
                source: SOURCE,
                version: VERSION,
                status: MigrationStatus.STARTED,
                expectedAttachments,
              },
              update: {
                status: MigrationStatus.STARTED,
                expectedAttachments,
                errorMessage: null,
              },
            });

            if (snapshot.workspaces.length) {
              await tx.workspace.deleteMany({
                where: {
                  ownerId: userId,
                  name: "Faculdade",
                  postIts: { none: {} },
                  notes: { none: {} },
                  quickLinks: { none: {} },
                  documents: { none: {} },
                  spreadsheets: { none: {} },
                },
              });
            }

            for (const [position, item] of snapshot.workspaces.entries()) {
              await tx.workspace.upsert({
                where: { id: stableId(userId, "workspace", item.id) },
                create: {
                  id: stableId(userId, "workspace", item.id),
                  ownerId: userId,
                  name: item.name,
                  color: item.color,
                  icon: item.icon,
                  description: item.description,
                  position,
                },
                update: {
                  name: item.name,
                  color: item.color,
                  icon: item.icon,
                  description: item.description,
                  position,
                },
              });
            }

            const firstWorkspaceId = snapshot.workspaces[0]
              ? stableId(userId, "workspace", snapshot.workspaces[0].id)
              : (
                  await tx.workspace.findFirst({
                    where: { ownerId: userId },
                    orderBy: { createdAt: "asc" },
                  })
                )?.id;

            for (const item of snapshot.collabSpaces) {
              const id = stableId(userId, "collaboration", item.id);
              await tx.collaborationSpace.upsert({
                where: { id },
                create: { id, ownerId: userId, name: item.name, color: item.color },
                update: { name: item.name, color: item.color },
              });
              for (const [index, name] of item.members.entries()) {
                const email = `legacy-${stableId(userId, "member", `${item.id}-${index}`)}@migration.invalid`;
                await tx.collaborationMember.upsert({
                  where: { collaborationSpaceId_email: { collaborationSpaceId: id, email } },
                  create: { collaborationSpaceId: id, email, name },
                  update: { name },
                });
              }
            }

            for (const item of snapshot.postIts) {
              const id = stableId(userId, "post-it", item.id);
              await tx.postIt.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  workspaceId: firstWorkspaceId,
                  title: item.title,
                  description: item.description,
                  dueDate: item.dueDate ? safeDate(`${item.dueDate}T00:00:00.000Z`) : null,
                  dueTime: item.dueTime,
                  color: item.color,
                  positionX: item.x,
                  positionY: item.y,
                  completed: item.completed,
                  completedAt: item.completed ? safeDate(item.completedAt) : null,
                  deletedAt: item.deleted ? new Date() : null,
                  createdAt: safeDate(item.createdAt),
                },
                update: {
                  workspaceId: firstWorkspaceId,
                  title: item.title,
                  description: item.description,
                  dueDate: item.dueDate ? safeDate(`${item.dueDate}T00:00:00.000Z`) : null,
                  dueTime: item.dueTime,
                  color: item.color,
                  positionX: item.x,
                  positionY: item.y,
                  completed: item.completed,
                  completedAt: item.completed ? safeDate(item.completedAt) : null,
                  deletedAt: item.deleted ? new Date() : null,
                },
              });
            }

            for (const item of snapshot.notes) {
              const id = stableId(userId, "note", item.id);
              await tx.note.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  workspaceId: firstWorkspaceId,
                  title: item.title,
                  content: item.content,
                  color: item.color,
                  createdAt: safeDate(item.createdAt),
                },
                update: { title: item.title, content: item.content, color: item.color },
              });
            }

            for (const [position, item] of snapshot.links.entries()) {
              const id = stableId(userId, "quick-link", item.id);
              await tx.quickLink.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  workspaceId: firstWorkspaceId,
                  name: item.name,
                  url: item.url,
                  icon: item.icon,
                  color: item.color,
                  position,
                },
                update: {
                  name: item.name,
                  url: item.url,
                  icon: item.icon,
                  color: item.color,
                  position,
                },
              });
            }

            for (const item of snapshot.documents) {
              const id = stableId(userId, "document", item.id);
              await tx.textDocument.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  workspaceId: firstWorkspaceId,
                  title: item.title,
                  content: item.content,
                  createdAt: safeDate(item.createdAt),
                  updatedAt: safeDate(item.updatedAt),
                },
                update: { title: item.title, content: item.content },
              });
            }

            for (const item of snapshot.sheets) {
              const id = stableId(userId, "spreadsheet", item.id);
              await tx.spreadsheet.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  workspaceId: firstWorkspaceId,
                  title: item.title,
                  cells: item.cells as Prisma.InputJsonValue,
                  columnWidths: item.colWidths,
                  createdAt: safeDate(item.createdAt),
                  updatedAt: safeDate(item.updatedAt),
                },
                update: {
                  title: item.title,
                  cells: item.cells as Prisma.InputJsonValue,
                  columnWidths: item.colWidths,
                },
              });
            }

            for (const [day, weekday] of Object.entries(weekdayMap)) {
              for (const [position, item] of snapshot.routine[
                day as keyof typeof weekdayMap
              ].entries()) {
                const id = stableId(userId, "routine-task", `${day}-${item.id}`);
                await tx.routineTask.upsert({
                  where: { id },
                  create: { id, userId, weekday, name: item.name, time: item.time, position },
                  update: { weekday, name: item.name, time: item.time, position },
                });
              }
            }

            for (const item of snapshot.quizzes) {
              const id = stableId(userId, "quiz", item.id);
              await tx.quiz.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  title: item.title,
                  questions: item.questions as Prisma.InputJsonValue,
                  timeLimitMinutes: item.timeLimitMinutes,
                  createdAt: safeDate(item.createdAt),
                  updatedAt: safeDate(item.updatedAt),
                },
                update: {
                  title: item.title,
                  questions: item.questions as Prisma.InputJsonValue,
                  timeLimitMinutes: item.timeLimitMinutes,
                },
              });
            }

            for (const item of snapshot.quizAttempts) {
              const quizId = stableId(userId, "quiz", item.quizId);
              const quizExists = await tx.quiz.count({ where: { id: quizId, userId } });
              if (!quizExists) continue;
              const id = stableId(userId, "quiz-attempt", item.id);
              await tx.quizAttempt.upsert({
                where: { id },
                create: {
                  id,
                  userId,
                  quizId,
                  answers: item.answers as Prisma.InputJsonValue,
                  startedAt: safeDate(item.startedAt),
                  finishedAt: item.finishedAt ? safeDate(item.finishedAt) : null,
                  score: item.score,
                  total: item.total,
                },
                update: {
                  answers: item.answers as Prisma.InputJsonValue,
                  finishedAt: item.finishedAt ? safeDate(item.finishedAt) : null,
                  score: item.score,
                  total: item.total,
                },
              });
            }

            if (snapshot.whiteboard) {
              await tx.whiteboard.upsert({
                where: { userId },
                create: {
                  userId,
                  background: snapshot.whiteboard.background,
                  strokes: snapshot.whiteboard.strokes as Prisma.InputJsonValue,
                },
                update: {
                  background: snapshot.whiteboard.background,
                  strokes: snapshot.whiteboard.strokes as Prisma.InputJsonValue,
                },
              });
            }

            if (snapshot.pomodoro) {
              await tx.pomodoroSettings.upsert({
                where: { userId },
                create: {
                  userId,
                  preset: snapshot.pomodoro.preset,
                  studyMinutes: snapshot.pomodoro.custom.study,
                  shortBreakMinutes: snapshot.pomodoro.custom.shortBreak,
                  longBreakMinutes: snapshot.pomodoro.custom.longBreak,
                  sessionsPerCycle: snapshot.pomodoro.custom.sessions,
                },
                update: {
                  preset: snapshot.pomodoro.preset,
                  studyMinutes: snapshot.pomodoro.custom.study,
                  shortBreakMinutes: snapshot.pomodoro.custom.shortBreak,
                  longBreakMinutes: snapshot.pomodoro.custom.longBreak,
                  sessionsPerCycle: snapshot.pomodoro.custom.sessions,
                },
              });
            }

            if (snapshot.preferences) {
              await tx.userPreferences.upsert({
                where: { userId },
                create: { userId, ...snapshot.preferences },
                update: snapshot.preferences,
              });
            }

            const routineCount = Object.values(snapshot.routine).reduce(
              (total, tasks) => total + tasks.length,
              0,
            );
            const summary = {
              workspaces: snapshot.workspaces.length,
              collaborationSpaces: snapshot.collabSpaces.length,
              postIts: snapshot.postIts.length,
              notes: snapshot.notes.length,
              quickLinks: snapshot.links.length,
              documents: snapshot.documents.length,
              spreadsheets: snapshot.sheets.length,
              routineTasks: routineCount,
              quizzes: snapshot.quizzes.length,
              quizAttempts: snapshot.quizAttempts.length,
              attachments: expectedAttachments,
              skippedQuizzes: skipped.quizzes,
              skippedLinks: skipped.links,
            };

            return tx.dataMigration.update({
              where: { id: record.id },
              data: { status: MigrationStatus.DATA_IMPORTED, summary },
            });
          },
          { timeout: 60_000 },
        );

        return reply.status(201).send({ migration });
      } catch (error) {
        request.log.error({ error }, "Local storage migration failed");
        await app.prisma.dataMigration.upsert({
          where: { userId_source_version: { userId, source: SOURCE, version: VERSION } },
          create: {
            userId,
            source: SOURCE,
            version: VERSION,
            status: MigrationStatus.FAILED,
            expectedAttachments,
            errorMessage: "Falha ao importar os dados locais",
          },
          update: {
            status: MigrationStatus.FAILED,
            errorMessage: "Falha ao importar os dados locais",
          },
        });
        throw error;
      }
    },
  );

  app.post(
    "/migrations/local-storage/:migrationId/attachments/:legacyPostItId/:legacyAttachmentId",
    async (request, reply) => {
      if (!app.objectStorage.configured) {
        throw new HttpError(
          503,
          "Armazenamento de arquivos não configurado",
          "STORAGE_NOT_CONFIGURED",
        );
      }
      const params = parse(uploadParamsSchema, request.params);
      const migration = await app.prisma.dataMigration.findFirst({
        where: {
          id: params.migrationId,
          userId: request.user.sub,
          source: SOURCE,
          version: VERSION,
          status: { in: [MigrationStatus.DATA_IMPORTED, MigrationStatus.FAILED] },
        },
      });
      if (!migration) throw new HttpError(404, "Migração não encontrada", "NOT_FOUND");

      const postItId = stableId(request.user.sub, "post-it", params.legacyPostItId);
      const attachmentId = stableId(
        request.user.sub,
        "post-it-attachment",
        `${params.legacyPostItId}:${params.legacyAttachmentId}`,
      );
      const existing = await app.prisma.postItAttachment.findFirst({
        where: { id: attachmentId, postItId, postIt: { userId: request.user.sub } },
      });
      if (existing) return { attachment: existing, alreadyUploaded: true };

      const postItExists = await app.prisma.postIt.count({
        where: { id: postItId, userId: request.user.sub },
      });
      if (!postItExists)
        throw new HttpError(404, "Post-it da migração não encontrado", "NOT_FOUND");

      const file = await request.file();
      if (!file) throw new HttpError(400, "Arquivo não enviado", "FILE_REQUIRED");
      if (!allowedMimeTypes.has(file.mimetype)) {
        throw new HttpError(415, "Tipo de arquivo não permitido", "UNSUPPORTED_FILE_TYPE");
      }
      const buffer = await file.toBuffer();
      if (!buffer.length) throw new HttpError(400, "O arquivo está vazio", "EMPTY_FILE");
      if (!contentMatchesMime(buffer, file.mimetype)) {
        throw new HttpError(
          415,
          "O conteúdo não corresponde ao tipo do arquivo",
          "CONTENT_MISMATCH",
        );
      }
      await assertWithinQuota(app, request.user.sub, buffer.length);
      const filename = safeFileName(file.filename);
      const objectKey = `users/${request.user.sub}/migrations/${migration.id}/${randomUUID()}${extensionFor(file.mimetype, filename)}`;
      const url = await app.objectStorage.put(objectKey, buffer, file.mimetype);

      try {
        const attachment = await app.prisma.$transaction(async (tx) => {
          const created = await tx.postItAttachment.create({
            data: {
              id: attachmentId,
              postItId,
              name: filename,
              mimeType: file.mimetype,
              size: buffer.length,
              objectKey,
              url,
            },
          });
          await tx.dataMigration.update({
            where: { id: migration.id },
            data: { uploadedAttachments: { increment: 1 }, status: MigrationStatus.DATA_IMPORTED },
          });
          return created;
        });
        return reply.status(201).send({ attachment });
      } catch (error) {
        await app.objectStorage.delete(objectKey).catch(() => undefined);
        throw error;
      }
    },
  );

  app.post("/migrations/local-storage/:migrationId/finalize", async (request) => {
    const { migrationId } = parse(z.object({ migrationId: z.string().min(1) }), request.params);
    const { allowMissingAttachments } = parse(
      z.object({ allowMissingAttachments: z.boolean().default(false) }),
      request.body ?? {},
    );
    const migration = await app.prisma.dataMigration.findFirst({
      where: { id: migrationId, userId: request.user.sub, source: SOURCE, version: VERSION },
    });
    if (!migration) throw new HttpError(404, "Migração não encontrada", "NOT_FOUND");
    const missing = Math.max(0, migration.expectedAttachments - migration.uploadedAttachments);
    if (missing > 0 && !allowMissingAttachments) {
      throw new HttpError(
        409,
        `Ainda existem ${missing} anexo(s) pendentes`,
        "ATTACHMENTS_PENDING",
      );
    }
    return app.prisma.dataMigration.update({
      where: { id: migration.id },
      data: { status: MigrationStatus.COMPLETED, completedAt: new Date(), errorMessage: null },
    });
  });
}
