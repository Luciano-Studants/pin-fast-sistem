import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);
const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .default("false");

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:8443"),
  COOKIE_SECURE: booleanString,
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  R2_ACCOUNT_ID: optionalString,
  R2_ENDPOINT: optionalUrl,
  R2_FORCE_PATH_STYLE: booleanString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: z.string().default("pinfast"),
  R2_PUBLIC_URL: optionalUrl,
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  USER_STORAGE_QUOTA_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(200 * 1024 * 1024),
  ENABLE_DOCS: booleanString,
  REGISTRATION_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default("true"),
  // Recuperação de senha por e-mail (Resend). Sem isso, a rota responde 503.
  RESEND_API_KEY: optionalString,
  MAIL_FROM: optionalString,
  APP_URL: optionalUrl,
});

const PLACEHOLDER = /replace-with|change-me|changeme|cole_|your[-_ ]secret/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Origens CORS devem ser URLs exatas (sem "*", sem caminho); http só para localhost. */
export function invalidCorsOrigins(list: string): string[] {
  return list
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => {
      try {
        const url = new URL(origin);
        const exact = url.origin === origin;
        const secure = url.protocol === "https:" || LOCAL_HOSTS.has(url.hostname);
        return !(exact && secure);
      } catch {
        return true;
      }
    });
}

const envSchema = baseEnvSchema.superRefine((value, ctx) => {
  if (value.COOKIE_SAME_SITE === "none" && !value.COOKIE_SECURE) {
    ctx.addIssue({
      code: "custom",
      path: ["COOKIE_SECURE"],
      message: "COOKIE_SAME_SITE=none exige COOKIE_SECURE=true",
    });
  }
  const badOrigins = invalidCorsOrigins(value.CORS_ORIGINS);
  if (badOrigins.length) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message: `Origens inválidas (use https://dominio, sem "*" nem caminho): ${badOrigins.join(", ")}`,
    });
  }
  if (value.NODE_ENV === "production" && PLACEHOLDER.test(value.JWT_ACCESS_SECRET)) {
    ctx.addIssue({
      code: "custom",
      path: ["JWT_ACCESS_SECRET"],
      message: "Defina um segredo JWT real em produção (openssl rand -base64 48)",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
