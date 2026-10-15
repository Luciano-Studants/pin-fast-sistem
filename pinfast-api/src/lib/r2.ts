import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Env } from "../config/env.js";

export interface ObjectStorage {
  configured: boolean;
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export function createObjectStorage(env: Env): ObjectStorage {
  const configured = Boolean(
    (env.R2_ENDPOINT || env.R2_ACCOUNT_ID) &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_PUBLIC_URL,
  );

  const client = configured
    ? new S3Client({
        region: "auto",
        endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        forcePathStyle: env.R2_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
        },
      })
    : null;

  return {
    configured,
    async put(key, body, contentType) {
      if (!client || !env.R2_PUBLIC_URL) throw new Error("R2 is not configured");
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    },
    async delete(key) {
      if (!client) throw new Error("R2 is not configured");
      await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    },
  };
}
