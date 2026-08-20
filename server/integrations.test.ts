import { describe, expect, it } from "vitest";
import { maskIntegrationSecret } from "./db";

describe("integration settings", () => {
  it("masks tokens before returning them to the UI", () => {
    const masked = maskIntegrationSecret("abcdefghijklmnop");
    expect(masked).toBe("abcd••••mnop");
    expect(masked).not.toContain("efghijkl");
    expect(maskIntegrationSecret(null)).toBeNull();
  });
});
