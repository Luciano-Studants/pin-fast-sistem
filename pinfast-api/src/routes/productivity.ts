import { FocusSessionStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  HttpError,
  idParamsSchema,
  pageArgs,
  paginationSchema,
  parse,
  toPage,
} from "../lib/http.js";
import { clientCreateFields } from "../lib/ids.js";

const routineSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  name: z.string().trim().min(1).max(240),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  position: z.number().int().min(0).optional(),
});

const quizChoiceSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string().trim().min(1).max(2_000),
  correct: z.boolean(),
});

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.enum(["multiple", "single", "subjective"]),
    prompt: z.string().trim().min(1).max(10_000),
    choices: z.array(quizChoiceSchema).max(20),
    correctAnswer: z.string().max(10_000).optional(),
    subjectiveAnswer: z.string().max(20_000).optional(),
  })
  .superRefine((question, context) => {
    if (question.type !== "subjective" && question.choices.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Questões objetivas precisam de ao menos duas alternativas",
      });
    }
    if (
      question.type === "single" &&
      question.choices.filter((choice) => choice.correct).length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Questões de resposta única precisam de uma alternativa correta",
      });
    }
    if (question.type === "multiple" && !question.choices.some((choice) => choice.correct)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Marque ao menos uma alternativa correta",
      });
    }
  });

const quizSchema = z.object({
  title: z.string().trim().min(1).max(240),
  questions: z.array(quizQuestionSchema).min(1).max(200),
  timeLimitMinutes: z.number().int().min(1).max(600).nullable(),
});

const attemptAnswerSchema = z.object({
  questionId: z.string().min(1).max(128),
  selectedChoiceIds: z.array(z.string().min(1).max(128)).optional(),
  textAnswer: z.string().max(20_000).optional(),
  selfScore: z.boolean().optional(),
});

const attemptSchema = z.object({
  answers: z.array(attemptAnswerSchema).max(200),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().optional(),
  // Aceitos do cliente para preservar a nota já exibida; se ausentes, o servidor calcula.
  score: z.number().min(0).max(1000).optional(),
  total: z.number().min(0).max(1000).optional(),
});

const whiteboardSchema = z.object({
  background: z.enum(["white", "dark", "grid", "dots", "lines"]),
  strokes: z.array(z.record(z.string(), z.unknown())).max(50_000),
});

const pomodoroSchema = z.object({
  preset: z.enum(["classic", "focus", "deep", "custom"]),
  studyMinutes: z.number().int().min(5).max(180),
  shortBreakMinutes: z.number().int().min(1).max(30),
  longBreakMinutes: z.number().int().min(5).max(60),
  sessionsPerCycle: z.number().int().min(1).max(10),
});

const focusSessionSchema = pomodoroSchema
  .pick({
    preset: true,
    studyMinutes: true,
    shortBreakMinutes: true,
    longBreakMinutes: true,
    sessionsPerCycle: true,
  })
  .extend({
    startedAt: z.coerce.date().optional(),
  });

const preferencesSchema = z.object({
  darkMode: z.boolean(),
  pageZoom: z.number().min(0.6).max(1.5),
});

type QuizQuestion = z.infer<typeof quizQuestionSchema>;
type AttemptAnswer = z.infer<typeof attemptAnswerSchema>;

function scoreAttempt(questions: QuizQuestion[], answers: AttemptAnswer[]) {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  let score = 0;
  for (const question of questions) {
    const answer = answerMap.get(question.id);
    if (!answer) continue;
    if (question.type === "subjective") {
      if (answer.selfScore) score += 1;
      continue;
    }
    const expected = question.choices
      .filter((choice) => choice.correct)
      .map((choice) => choice.id)
      .sort();
    const selected = [...(answer.selectedChoiceIds ?? [])].sort();
    if (
      expected.length === selected.length &&
      expected.every((id, index) => id === selected[index])
    )
      score += 1;
  }
  return { score, total: questions.length };
}

export async function productivityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/routine-tasks", async (request) => {
    return app.prisma.routineTask.findMany({
      where: { userId: request.user.sub },
      orderBy: [{ weekday: "asc" }, { position: "asc" }, { time: "asc" }],
    });
  });

  app.post("/routine-tasks", async (request, reply) => {
    const body = parse(routineSchema.extend(clientCreateFields), request.body);
    const item = await app.prisma.routineTask.create({
      data: { ...body, userId: request.user.sub },
    });
    return reply.status(201).send(item);
  });

  app.patch("/routine-tasks/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      routineSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    const result = await app.prisma.routineTask.updateMany({
      where: { id, userId: request.user.sub },
      data: body,
    });
    if (!result.count) throw new HttpError(404, "Tarefa de rotina não encontrada", "NOT_FOUND");
    return app.prisma.routineTask.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/routine-tasks/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.routineTask.deleteMany({
      where: { id, userId: request.user.sub },
    });
    if (!result.count) throw new HttpError(404, "Tarefa de rotina não encontrada", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/quizzes", async (request) => {
    const query = parse(paginationSchema, request.query);
    const items = await app.prisma.quiz.findMany({
      where: { userId: request.user.sub },
      include: { _count: { select: { attempts: true } } },
      orderBy: { updatedAt: "desc" },
      ...pageArgs(query),
    });
    return toPage(items, query.limit);
  });

  app.get("/quizzes/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const quiz = await app.prisma.quiz.findFirst({ where: { id, userId: request.user.sub } });
    if (!quiz) throw new HttpError(404, "Questionário não encontrado", "NOT_FOUND");
    return quiz;
  });

  app.post("/quizzes", async (request, reply) => {
    const body = parse(quizSchema.extend(clientCreateFields), request.body);
    const quiz = await app.prisma.quiz.create({
      data: {
        ...body,
        questions: body.questions as Prisma.InputJsonValue,
        userId: request.user.sub,
      },
    });
    return reply.status(201).send(quiz);
  });

  app.patch("/quizzes/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(
      quizSchema.partial().refine((value) => Object.keys(value).length > 0),
      request.body,
    );
    const data: Prisma.QuizUncheckedUpdateInput = { ...body };
    if (body.questions) data.questions = body.questions as Prisma.InputJsonValue;
    const result = await app.prisma.quiz.updateMany({
      where: { id, userId: request.user.sub },
      data,
    });
    if (!result.count) throw new HttpError(404, "Questionário não encontrado", "NOT_FOUND");
    return app.prisma.quiz.findUniqueOrThrow({ where: { id } });
  });

  app.delete("/quizzes/:id", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const result = await app.prisma.quiz.deleteMany({ where: { id, userId: request.user.sub } });
    if (!result.count) throw new HttpError(404, "Questionário não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });

  app.get("/quizzes/:id/attempts", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const query = parse(paginationSchema, request.query);
    const quizExists = await app.prisma.quiz.count({ where: { id, userId: request.user.sub } });
    if (!quizExists) throw new HttpError(404, "Questionário não encontrado", "NOT_FOUND");
    const items = await app.prisma.quizAttempt.findMany({
      where: { quizId: id, userId: request.user.sub },
      orderBy: { startedAt: "desc" },
      ...pageArgs(query),
    });
    return toPage(items, query.limit);
  });

  app.post("/quizzes/:id/attempts", async (request, reply) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(attemptSchema.extend(clientCreateFields), request.body);
    const quiz = await app.prisma.quiz.findFirst({ where: { id, userId: request.user.sub } });
    if (!quiz) throw new HttpError(404, "Questionário não encontrado", "NOT_FOUND");
    const questions = parse(z.array(quizQuestionSchema), quiz.questions);
    const result = scoreAttempt(questions, body.answers);
    const attempt = await app.prisma.quizAttempt.create({
      data: {
        id: body.id,
        createdAt: body.createdAt,
        userId: request.user.sub,
        quizId: id,
        answers: body.answers as Prisma.InputJsonValue,
        startedAt: body.startedAt,
        finishedAt: body.finishedAt ?? new Date(),
        score: body.score ?? result.score,
        total: body.total ?? result.total,
      },
    });
    return reply.status(201).send(attempt);
  });

  app.get("/whiteboard", async (request) => {
    return app.prisma.whiteboard.upsert({
      where: { userId: request.user.sub },
      create: { userId: request.user.sub, background: "white", strokes: [] },
      update: {},
    });
  });

  app.put("/whiteboard", async (request) => {
    const body = parse(whiteboardSchema, request.body);
    return app.prisma.whiteboard.upsert({
      where: { userId: request.user.sub },
      create: {
        userId: request.user.sub,
        background: body.background,
        strokes: body.strokes as Prisma.InputJsonValue,
      },
      update: { background: body.background, strokes: body.strokes as Prisma.InputJsonValue },
    });
  });

  app.get("/pomodoro/settings", async (request) => {
    return app.prisma.pomodoroSettings.upsert({
      where: { userId: request.user.sub },
      create: { userId: request.user.sub },
      update: {},
    });
  });

  app.put("/pomodoro/settings", async (request) => {
    const body = parse(pomodoroSchema, request.body);
    return app.prisma.pomodoroSettings.upsert({
      where: { userId: request.user.sub },
      create: { ...body, userId: request.user.sub },
      update: body,
    });
  });

  app.get("/pomodoro/sessions", async (request) => {
    const query = parse(paginationSchema, request.query);
    const items = await app.prisma.focusSession.findMany({
      where: { userId: request.user.sub },
      orderBy: { startedAt: "desc" },
      ...pageArgs(query),
    });
    return toPage(items, query.limit);
  });

  app.post("/pomodoro/sessions", async (request, reply) => {
    const body = parse(focusSessionSchema, request.body);
    const session = await app.prisma.focusSession.create({
      data: { ...body, userId: request.user.sub },
    });
    return reply.status(201).send(session);
  });

  app.patch("/pomodoro/sessions/:id", async (request) => {
    const { id } = parse(idParamsSchema, request.params);
    const body = parse(z.object({ status: z.nativeEnum(FocusSessionStatus) }), request.body);
    const result = await app.prisma.focusSession.updateMany({
      where: { id, userId: request.user.sub },
      data: {
        status: body.status,
        completedAt: body.status === FocusSessionStatus.COMPLETED ? new Date() : null,
      },
    });
    if (!result.count) throw new HttpError(404, "Sessão não encontrada", "NOT_FOUND");
    return app.prisma.focusSession.findUniqueOrThrow({ where: { id } });
  });

  app.get("/preferences", async (request) => {
    return app.prisma.userPreferences.upsert({
      where: { userId: request.user.sub },
      create: { userId: request.user.sub },
      update: {},
    });
  });

  app.put("/preferences", async (request) => {
    const body = parse(preferencesSchema, request.body);
    return app.prisma.userPreferences.upsert({
      where: { userId: request.user.sub },
      create: { ...body, userId: request.user.sub },
      update: body,
    });
  });
}
