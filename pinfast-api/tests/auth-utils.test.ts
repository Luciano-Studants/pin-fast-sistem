import { describe, expect, it } from "vitest";
import { hashToken, publicUser } from "../src/lib/auth.js";

describe("authentication utilities", () => {
  it("hashes refresh tokens deterministically without storing the raw token", () => {
    const token = "refresh-token-value";
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it("never exposes password fields in the public user", () => {
    const now = new Date();
    const result = publicUser({
      id: "user-1",
      email: "user@example.com",
      username: "user",
      name: "User",
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: "secret",
    });
    expect(result).not.toHaveProperty("passwordHash");
  });
});
