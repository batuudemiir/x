import { join } from "node:path";
import { readJson, writeJson } from "./json-file.js";
import { PostLogEntry } from "../types.js";

function logPath(dataDir: string): string {
  return join(dataDir, "post-log.json");
}

export function loadPostLog(dataDir: string): PostLogEntry[] {
  return readJson<PostLogEntry[]>(logPath(dataDir), []);
}

export function appendPostLog(dataDir: string, entry: PostLogEntry): void {
  const entries = loadPostLog(dataDir);
  entries.push(entry);
  writeJson(logPath(dataDir), entries);
}

export function updateMetrics(
  dataDir: string,
  tweetId: string,
  metrics: NonNullable<PostLogEntry["metrics"]>,
  notes?: string
): PostLogEntry {
  const entries = loadPostLog(dataDir);
  let entry = entries.find((e) => e.tweet_id === tweetId);
  if (!entry) {
    entry = {
      tweet_id: tweetId,
      kind: "tweet",
      text: "(not posted via this server)",
      posted_at: new Date().toISOString(),
    };
    entries.push(entry);
  }
  entry.metrics = { ...entry.metrics, ...metrics, logged_at: new Date().toISOString() };
  if (notes) entry.notes = notes;
  writeJson(logPath(dataDir), entries);
  return entry;
}
