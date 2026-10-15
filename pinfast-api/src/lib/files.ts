import { extname } from "node:path";

export const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

/** Confere se o conteúdo do arquivo é compatível com o tipo MIME declarado pelo cliente. */
export function contentMatchesMime(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return startsWith(buffer, [0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return (
        startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "application/pdf":
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case "application/msword":
    case "application/vnd.ms-excel":
      return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "text/plain":
    case "text/csv":
      return !buffer.subarray(0, 8192).includes(0);
    default:
      return false;
  }
}

const extensionsByMime: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

/** A extensão da chave no storage vem do tipo MIME validado, nunca do nome enviado pelo cliente. */
export function extensionFor(mimeType: string, filename: string): string {
  const allowed = extensionsByMime[mimeType] ?? [];
  const fromName = extname(filename).toLowerCase();
  return allowed.includes(fromName) ? fromName : (allowed[0] ?? "");
}

export function safeFilename(filename: string) {
  return (
    filename
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "arquivo"
  );
}

/** Aceita somente URLs http(s). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
