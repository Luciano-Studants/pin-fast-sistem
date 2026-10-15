import { z } from "zod";

/** ID opcional gerado pelo cliente (UUID, cuid, nanoid...). Evita IDs curtos que colidiriam entre usuários. */
export const clientIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/)
  .optional();

/** Campos opcionais aceitos na criação para preservar identidade e ordem vindas do cliente. */
export const clientCreateFields = {
  id: clientIdSchema,
  createdAt: z.coerce.date().optional(),
};
