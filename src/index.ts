#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
import { getDataDir, isDryRun, getXCredentials, log } from "./config.js";

async function main(): Promise<void> {
  const server = buildServer();
  log(`data dir: ${getDataDir()}`);
  log(`x credentials: ${getXCredentials() ? "configured" : "NOT configured (posting disabled)"}`);
  if (isDryRun()) log("DRY RUN mode: posting is simulated");
  await server.connect(new StdioServerTransport());
  log("ready (stdio)");
}

main().catch((err) => {
  log("fatal:", err);
  process.exit(1);
});
