import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value) as z.infer<T>;
}

export const idParamsSchema = z.object({ id: z.string().min(1).max(128) });

export const paginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function pageArgs(query: { cursor?: string; limit: number }) {
  return {
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return {
    data,
    nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
  };
}
