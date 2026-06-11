import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import { loadUsage, nextResetUtc } from "../storage/usage.js";
import { WRITE_LIMIT, READ_LIMIT } from "../types.js";
import { textResult } from "./helpers.js";

export function registerQuotaTools(server: McpServer): void {
  server.registerTool(
    "get_usage_quota",
    {
      description:
        "Show this month's X API free-tier usage as tracked locally by this server (500 writes / 100 reads per month).",
      inputSchema: {},
    },
    async () => {
      const usage = loadUsage(getDataDir());
      const writePct = Math.round((usage.writes / WRITE_LIMIT) * 100);
      return textResult({
        month: usage.month,
        writes_used: usage.writes,
        writes_limit: WRITE_LIMIT,
        writes_remaining: WRITE_LIMIT - usage.writes,
        reads_used: usage.reads,
        reads_limit: READ_LIMIT,
        reads_remaining: READ_LIMIT - usage.reads,
        resets_at: nextResetUtc(),
        warning:
          writePct >= 80
            ? `Over ${writePct}% of the monthly write quota is used.`
            : undefined,
        note: "Counters track only posts made through this server; posts made elsewhere are not included.",
      });
    }
  );
}
