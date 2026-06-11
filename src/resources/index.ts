import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import { loadAlgorithmGuide } from "../knowledge/index.js";
import { loadProfile } from "../storage/style-profile.js";
import { listDrafts } from "../storage/drafts.js";
import { loadUsage, nextResetUtc } from "../storage/usage.js";
import { WRITE_LIMIT, READ_LIMIT } from "../types.js";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "algorithm-guide",
    "x-growth://algorithm-guide",
    {
      description: "Distilled X (Twitter) algorithm guide from the open-sourced twitter/the-algorithm",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: loadAlgorithmGuide() }],
    })
  );

  server.registerResource(
    "style-profile",
    "x-growth://style-profile",
    {
      description: "The user's writing style profile used by all compose prompts",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(loadProfile(getDataDir()), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "usage",
    "x-growth://usage",
    {
      description: "This month's X API free-tier usage as tracked locally",
      mimeType: "application/json",
    },
    async (uri) => {
      const usage = loadUsage(getDataDir());
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                ...usage,
                writes_limit: WRITE_LIMIT,
                reads_limit: READ_LIMIT,
                resets_at: nextResetUtc(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerResource(
    "drafts",
    "x-growth://drafts",
    {
      description: "Index of saved drafts",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(listDrafts(getDataDir()), null, 2),
        },
      ],
    })
  );
}
