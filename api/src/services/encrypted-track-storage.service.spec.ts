import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createEncryptedTrackFileName } from "./encrypted-track-storage.service.js";

describe("createEncryptedTrackFileName", () => {
  it("encrypts the identifier into a randomized URL-safe filename", () => {
    const identifier = "3ea0921e-2d80-4a25-a850-dadfac884bab";
    const key = randomBytes(32);
    const first = createEncryptedTrackFileName(identifier, key);
    const second = createEncryptedTrackFileName(identifier, key);

    expect(first).toMatch(/^enc-[A-Za-z0-9_-]+\.track$/u);
    expect(first).not.toContain(identifier);
    expect(second).not.toBe(first);
  });
});