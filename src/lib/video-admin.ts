import path from "node:path";

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

export function createVideoSearchText(input: {
  title?: string | null;
  categoryName?: string | null;
  tags?: string[];
}) {
  return [input.title ?? "", input.categoryName ?? "", ...(input.tags ?? [])]
    .join(" ")
    .trim()
    .toLowerCase();
}

export function getFileExtension(filename: string) {
  return path.extname(filename).replace(/^\./, "").toLowerCase();
}

export function getBaseFilename(filename: string) {
  return path.basename(filename, path.extname(filename));
}

export function buildVideoStorageKey(input: {
  originalFilename: string;
}) {
  const ext = getFileExtension(input.originalFilename) || "mp4";
  const base = slugify(getBaseFilename(input.originalFilename)) || "video";
  const suffix = Math.random().toString(36).slice(2, 10);
  return `videos/uploads/source/${base}-${suffix}.${ext}`;
}

export function splitTagsInput(value: string) {
  return normalizeTags(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}
