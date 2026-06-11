import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import {
  createDraft,
  getDraft,
  listDrafts,
  updateDraft,
  deleteDraft,
} from "../storage/drafts.js";
import { textResult, errorResult } from "./helpers.js";

const kindSchema = z.enum(["tweet", "reply", "thread"]);

export function registerDraftTools(server: McpServer): void {
  server.registerTool(
    "save_draft",
    {
      description:
        "Save a tweet, reply or thread as a local draft (no API call, no quota cost).",
      inputSchema: {
        kind: kindSchema,
        text: z.string().optional().describe("Tweet/reply text (for kind tweet or reply)"),
        tweets: z.array(z.string()).optional().describe("Tweet texts in order (for kind thread)"),
        tags: z.array(z.string()).optional(),
        reply_to_context: z
          .string()
          .optional()
          .describe("Pasted text of the tweet this draft replies to"),
        in_reply_to_tweet_id: z.string().optional(),
      },
    },
    async ({ kind, text, tweets, tags, reply_to_context, in_reply_to_tweet_id }) => {
      if (kind === "thread" && (!tweets || tweets.length < 2)) {
        return errorResult("A thread draft needs a `tweets` array with at least 2 tweets.");
      }
      if (kind !== "thread" && !text) {
        return errorResult("A tweet/reply draft needs `text`.");
      }
      const draft = createDraft(getDataDir(), {
        kind,
        text,
        tweets,
        tags,
        reply_to_context,
        in_reply_to_tweet_id,
      });
      return textResult({ saved: true, draft });
    }
  );

  server.registerTool(
    "list_drafts",
    {
      description: "List saved drafts with previews, optionally filtered by kind, tag or status.",
      inputSchema: {
        kind: kindSchema.optional(),
        tag: z.string().optional(),
        status: z.enum(["draft", "posted"]).optional(),
      },
    },
    async ({ kind, tag, status }) => {
      const drafts = listDrafts(getDataDir(), { kind, tag, status });
      return textResult(
        drafts.map((d) => ({
          id: d.id,
          kind: d.kind,
          status: d.status,
          preview: (d.text ?? d.tweets?.[0] ?? "").split("\n")[0].slice(0, 80),
          tags: d.tags,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }))
      );
    }
  );

  server.registerTool(
    "get_draft",
    {
      description: "Get a draft's full content by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const draft = getDraft(getDataDir(), id);
      return draft ? textResult(draft) : errorResult(`Draft not found: ${id}`);
    }
  );

  server.registerTool(
    "update_draft",
    {
      description: "Update a draft's text, tweets, tags or reply target.",
      inputSchema: {
        id: z.string(),
        text: z.string().optional(),
        tweets: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        reply_to_context: z.string().optional(),
        in_reply_to_tweet_id: z.string().optional(),
      },
    },
    async ({ id, ...patch }) => {
      const updated = updateDraft(getDataDir(), id, patch);
      return updated ? textResult({ updated: true, draft: updated }) : errorResult(`Draft not found: ${id}`);
    }
  );

  server.registerTool(
    "delete_draft",
    {
      description: "Delete a draft by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      return deleteDraft(getDataDir(), id)
        ? textResult({ deleted: true, id })
        : errorResult(`Draft not found: ${id}`);
    }
  );
}
