import type { FastifyInstance } from "fastify";
import { HttpError } from "./http.js";

/** Impede que um usuário ultrapasse a cota total de anexos. */
export async function assertWithinQuota(
  app: FastifyInstance,
  userId: string,
  incomingBytes: number,
) {
  const used = await app.prisma.postItAttachment.aggregate({
    where: { postIt: { userId } },
    _sum: { size: true },
  });
  if ((used._sum.size ?? 0) + incomingBytes > app.config.USER_STORAGE_QUOTA_BYTES) {
    throw new HttpError(413, "Cota de armazenamento excedida", "STORAGE_QUOTA_EXCEEDED");
  }
}
