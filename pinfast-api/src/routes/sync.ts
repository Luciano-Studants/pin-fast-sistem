import type { FastifyInstance } from "fastify";

export async function syncRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/sync/snapshot", async (request) => {
    const userId = request.user.sub;
    const [
      user,
      workspaces,
      collaborationSpaces,
      postIts,
      notes,
      quickLinks,
      documents,
      spreadsheets,
      routineTasks,
      quizzes,
      quizAttempts,
      whiteboard,
      pomodoroSettings,
      focusSessions,
      preferences,
    ] = await app.prisma.$transaction([
      app.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      app.prisma.workspace.findMany({ where: { ownerId: userId }, orderBy: { position: "asc" } }),
      app.prisma.collaborationSpace.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        include: { members: true },
      }),
      app.prisma.postIt.findMany({ where: { userId }, include: { attachments: true } }),
      app.prisma.note.findMany({ where: { userId } }),
      app.prisma.quickLink.findMany({ where: { userId }, orderBy: { position: "asc" } }),
      app.prisma.textDocument.findMany({ where: { userId } }),
      app.prisma.spreadsheet.findMany({ where: { userId } }),
      app.prisma.routineTask.findMany({
        where: { userId },
        orderBy: [{ weekday: "asc" }, { position: "asc" }],
      }),
      app.prisma.quiz.findMany({ where: { userId } }),
      app.prisma.quizAttempt.findMany({ where: { userId } }),
      app.prisma.whiteboard.findUnique({ where: { userId } }),
      app.prisma.pomodoroSettings.findUnique({ where: { userId } }),
      app.prisma.focusSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
      app.prisma.userPreferences.findUnique({ where: { userId } }),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      user,
      workspaces,
      collaborationSpaces,
      postIts,
      notes,
      quickLinks,
      documents,
      spreadsheets,
      routineTasks,
      quizzes,
      quizAttempts,
      whiteboard,
      pomodoroSettings,
      focusSessions,
      preferences,
    };
  });
}
