import { describe, expect, it } from "vitest";
import { sanitizeStorageFileName } from "../shared/storage";

describe("storage filename sanitization", () => {
  it("converts Portuguese accents and spaces to ASCII hyphens", () => {
    expect(sanitizeStorageFileName("entrevista João – versão final.mp4")).toBe(
      "entrevista-Joao-versao-final.mp4"
    );
  });

  it("removes path traversal separators and preserves a safe extension", () => {
    expect(sanitizeStorageFileName("../vídeos\u002fmeu corte.MOV")).toBe(
      "meu-corte.mov"
    );
  });

  it("uses a safe fallback when the filename has no usable base", () => {
    expect(sanitizeStorageFileName("   .mp4")).toBe("upload.mp4");
    expect(sanitizeStorageFileName("arquivo com emoji 🎬")).toBe(
      "arquivo-com-emoji.bin"
    );
  });
});
