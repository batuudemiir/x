import { join } from "node:path";
import { readJson, writeJson } from "./json-file.js";
import { UsageRecord, WRITE_LIMIT, READ_LIMIT } from "../types.js";

function usagePath(dataDir: string): string {
  return join(dataDir, "usage.json");
}

export function currentMonthUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function loadUsage(dataDir: string, now: Date = new Date()): UsageRecord {
  const month = currentMonthUtc(now);
  const stored = readJson<UsageRecord>(usagePath(dataDir), { month, writes: 0, reads: 0 });
  if (stored.month !== month) {
    return { month, writes: 0, reads: 0 };
  }
  return stored;
}

export function recordWrites(dataDir: string, count = 1, now: Date = new Date()): UsageRecord {
  const usage = loadUsage(dataDir, now);
  usage.writes += count;
  writeJson(usagePath(dataDir), usage);
  return usage;
}

export function recordReads(dataDir: string, count = 1, now: Date = new Date()): UsageRecord {
  const usage = loadUsage(dataDir, now);
  usage.reads += count;
  writeJson(usagePath(dataDir), usage);
  return usage;
}

export interface QuotaCheck {
  ok: boolean;
  message?: string;
  usage: UsageRecord;
  writes_remaining: number;
  reads_remaining: number;
  resets_at: string;
}

export function nextResetUtc(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export function checkWriteQuota(
  dataDir: string,
  pendingWrites = 1,
  now: Date = new Date()
): QuotaCheck {
  const usage = loadUsage(dataDir, now);
  const writes_remaining = WRITE_LIMIT - usage.writes;
  const reads_remaining = READ_LIMIT - usage.reads;
  const resets_at = nextResetUtc(now);
  if (usage.writes + pendingWrites > WRITE_LIMIT) {
    return {
      ok: false,
      message: `Monthly write quota would be exceeded: ${usage.writes}/${WRITE_LIMIT} used, ${pendingWrites} requested. Quota resets at ${resets_at}.`,
      usage,
      writes_remaining,
      reads_remaining,
      resets_at,
    };
  }
  let message: string | undefined;
  if (usage.writes + pendingWrites > WRITE_LIMIT * 0.8) {
    message = `Warning: over 80% of the monthly write quota will be used (${usage.writes + pendingWrites}/${WRITE_LIMIT}).`;
  }
  return { ok: true, message, usage, writes_remaining, reads_remaining, resets_at };
}
