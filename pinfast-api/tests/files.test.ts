import { describe, expect, it } from "vitest";
import { contentMatchesMime, extensionFor, isHttpUrl } from "../src/lib/files.js";
import { invalidCorsOrigins, loadEnv } from "../src/config/env.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("contentMatchesMime", () => {
  it("accepts matching content", () => {
    expect(contentMatchesMime(png, "image/png")).toBe(true);
    expect(contentMatchesMime(Buffer.from("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(contentMatchesMime(Buffer.from("a,b\n1,2"), "text/csv")).toBe(true);
  });

  it("rejects content that does not match the declared type", () => {
    expect(contentMatchesMime(Buffer.from("<script>alert(1)</script>"), "image/png")).toBe(false);
    expect(contentMatchesMime(png, "application/pdf")).toBe(false);
    expect(contentMatchesMime(Buffer.from([1, 0, 2]), "text/plain")).toBe(false);
    expect(contentMatchesMime(png, "image/svg+xml")).toBe(false);
  });
});

describe("extensionFor", () => {
  it("never trusts an extension that disagrees with the MIME type", () => {
    expect(extensionFor("image/png", "x.html")).toBe(".png");
    expect(extensionFor("image/jpeg", "foto.JPEG")).toBe(".jpeg");
  });
});

describe("isHttpUrl", () => {
  it("allows only http(s)", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,x")).toBe(false);
  });
});

describe("loadEnv", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@h/d",
    DIRECT_URL: "postgresql://u:p@h/d",
    JWT_ACCESS_SECRET: "x".repeat(32),
  };

  it("refuses SameSite=None without Secure cookies", () => {
    expect(() => loadEnv({ ...base, COOKIE_SAME_SITE: "none", COOKIE_SECURE: "false" })).toThrow();
    expect(() =>
      loadEnv({ ...base, COOKIE_SAME_SITE: "none", COOKIE_SECURE: "true" }),
    ).not.toThrow();
  });
});

describe("production env rules", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@h/d",
    DIRECT_URL: "postgresql://u:p@h/d",
  };

  it("rejects wildcard, path and plain-http (non-local) CORS origins", () => {
    expect(invalidCorsOrigins("https://app.example.com")).toEqual([]);
    expect(invalidCorsOrigins("http://localhost:8443,https://a.com")).toEqual([]);
    expect(invalidCorsOrigins("*")).toEqual(["*"]);
    expect(invalidCorsOrigins("http://app.example.com")).toHaveLength(1);
    expect(invalidCorsOrigins("https://a.com/path")).toHaveLength(1);
  });

  it("refuses placeholder JWT secrets in production only", () => {
    const secret = "replace-with-at-least-32-characters";
    expect(() => loadEnv({ ...base, NODE_ENV: "production", JWT_ACCESS_SECRET: secret })).toThrow();
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "development", JWT_ACCESS_SECRET: secret }),
    ).not.toThrow();
  });
});
