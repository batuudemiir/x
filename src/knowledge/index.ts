import { readFileSync } from "node:fs";

export function loadAlgorithmGuide(): string {
  return readFileSync(new URL("./algorithm.md", import.meta.url), "utf8");
}

/** Extract a single `## section` by its heading slug (e.g. "engagement-weights"). */
export function getGuideSection(section: string): string | null {
  const guide = loadAlgorithmGuide();
  const lines = guide.split("\n");
  const start = lines.findIndex(
    (l) => l.toLowerCase().trim() === `## ${section.toLowerCase().trim()}`
  );
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function listGuideSections(): string[] {
  return loadAlgorithmGuide()
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());
}
