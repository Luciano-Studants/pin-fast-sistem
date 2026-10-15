import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { allowedMimeTypes, contentMatchesMime, extensionFor, safeFilename } from "../lib/files.js";
import { HttpError, parse } from "../lib/http.js";
import { assertWithinQuota } from "../lib/storage-quota.js";

const paramsSchema = z.object({
  postItId: z.string().min(1).max(128),
  attachmentId: z.string().min(1).max(128).optional(),
});

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/post-its/:postItId/attachments", async (request, reply) => {
    if (!app.objectStorage.configured) {
      throw new HttpError(
        503,
        "Armazenamento de arquivos não configurado",
        "STORAGE_NOT_CONFIGURED",
      );
    }
    const { postItId } = parse(paramsSchema, request.params);
    const postIt = await app.prisma.postIt.findFirst({
      where: { id: postItId, userId: request.user.sub, deletedAt: null },
    });
    if (!postIt) throw new HttpError(404, "Post-it não encontrado", "NOT_FOUND");

    const file = await request.file();
    if (!file) throw new HttpError(400, "Envie um arquivo no campo file", "FILE_REQUIRED");
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new HttpError(415, "Tipo de arquivo não permitido", "UNSUPPORTED_FILE_TYPE");
    }

    const buffer = await file.toBuffer();
    if (!buffer.length) throw new HttpError(400, "O arquivo está vazio", "EMPTY_FILE");
    if (!contentMatchesMime(buffer, file.mimetype)) {
      throw new HttpError(415, "O conteúdo não corresponde ao tipo do arquivo", "CONTENT_MISMATCH");
    }
    await assertWithinQuota(app, request.user.sub, buffer.length);
    const filename = safeFilename(file.filename);
    const extension = extensionFor(file.mimetype, filename);
    const objectKey = `users/${request.user.sub}/post-its/${postItId}/${randomUUID()}${extension}`;
    const url = await app.objectStorage.put(objectKey, buffer, file.mimetype);

    try {
      const attachment = await app.prisma.postItAttachment.create({
        data: {
          postItId,
          name: filename,
          mimeType: file.mimetype,
          size: buffer.length,
          objectKey,
          url,
        },
      });
      return reply.status(201).send(attachment);
    } catch (error) {
      await app.objectStorage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  });

  app.delete("/post-its/:postItId/attachments/:attachmentId", async (request, reply) => {
    const { postItId, attachmentId } = parse(
      paramsSchema.required({ attachmentId: true }),
      request.params,
    );
    const attachment = await app.prisma.postItAttachment.findFirst({
      where: {
        id: attachmentId,
        postItId,
        postIt: { userId: request.user.sub },
      },
    });
    if (!attachment) throw new HttpError(404, "Anexo não encontrado", "NOT_FOUND");

    if (app.objectStorage.configured) {
      await app.objectStorage.delete(attachment.objectKey);
    }
    await app.prisma.postItAttachment.delete({ where: { id: attachment.id } });
    return reply.status(204).send();
  });
}
