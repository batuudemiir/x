import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPostTools } from "./tools/post.js";
import { registerDraftTools } from "./tools/drafts.js";
import { registerStyleTools } from "./tools/style.js";
import { registerQuotaTools } from "./tools/quota.js";
import { registerAnalyzeTools } from "./tools/analyze.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "x-growth-mcp",
    version: "0.1.0",
  });

  registerPostTools(server);
  registerDraftTools(server);
  registerStyleTools(server);
  registerQuotaTools(server);
  registerAnalyzeTools(server);
  registerPrompts(server);
  registerResources(server);

  return server;
}
