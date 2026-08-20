export function sanitizeStorageFileName(fileName: string) {
  const original = fileName.trim().split(/[\\/]/).pop() ?? "upload";
  const extensionMatch = original.match(/(\.[A-Za-z0-9]{1,12})$/);
  const extension = extensionMatch?.[1].toLowerCase() ?? ".bin";
  const base = original.slice(
    0,
    original.length - (extensionMatch?.[1].length ?? 0)
  );
  const ascii = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${ascii || "upload"}${extension}`;
}
