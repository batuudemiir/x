import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export interface XCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export function getDataDir(): string {
  const dir =
    process.env.X_MCP_DATA_DIR && process.env.X_MCP_DATA_DIR.trim() !== ""
      ? process.env.X_MCP_DATA_DIR
      : join(homedir(), ".x-growth-mcp");
  mkdirSync(join(dir, "drafts"), { recursive: true });
  return dir;
}

export function isDryRun(): boolean {
  return (process.env.X_MCP_DRY_RUN ?? "").toLowerCase() === "true";
}

/**
 * Returns X credentials or null when not configured. Credentials are read
 * lazily so drafts/style/prompt features work without any X API setup.
 */
export function getXCredentials(): XCredentials | null {
  const appKey = process.env.X_API_KEY;
  const appSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  if (!appKey || !appSecret || !accessToken || !accessSecret) return null;
  return { appKey, appSecret, accessToken, accessSecret };
}

export function log(...args: unknown[]): void {
  // stdout is the MCP stdio transport channel; all logging goes to stderr.
  console.error("[x-growth-mcp]", ...args);
}
