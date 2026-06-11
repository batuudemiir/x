import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir, isDryRun } from "../config.js";
import { postTweet, XClientError } from "../x-client.js";
import { checkWriteQuota, recordWrites } from "../storage/usage.js";
import { appendPostLog } from "../storage/post-log.js";
import { getDraft, updateDraft } from "../storage/drafts.js";
import { validateTweets } from "../validate.js";
import { textResult, errorResult, ToolResult } from "./helpers.js";

interface PostPlan {
  tweets: string[];
  kind: "tweet" | "reply" | "thread";
  inReplyTo?: string;
}

function preview(plan: PostPlan, quotaMessage: string | undefined, remaining: number): ToolResult {
  return textResult({
    status: "awaiting_confirmation",
    message:
      "Preview only — nothing was posted. Show this to the user and call again with confirm: true once they approve.",
    kind: plan.kind,
    in_reply_to_tweet_id: plan.inReplyTo,
    tweets: plan.tweets.map((text, i) => ({ index: i, text })),
    writes_this_will_consume: plan.tweets.length,
    writes_remaining_after: remaining - plan.tweets.length,
    quota_warning: quotaMessage,
    dry_run: isDryRun(),
  });
}

async function executePost(plan: PostPlan): Promise<ToolResult> {
  const dataDir = getDataDir();
  const quota = checkWriteQuota(dataDir, plan.tweets.length);
  if (!quota.ok) return errorResult(quota.message!);

  const validations = validateTweets(plan.tweets);
  const invalid = validations.filter((v) => !v.ok);
  if (invalid.length > 0) {
    return errorResult(
      `Validation failed, nothing posted:\n${JSON.stringify(invalid, null, 2)}`
    );
  }

  const posted: { id: string; url: string; text: string }[] = [];
  let replyTo = plan.inReplyTo;
  try {
    for (const text of plan.tweets) {
      const result = await postTweet(text, replyTo);
      posted.push({ id: result.id, url: result.url, text });
      replyTo = result.id;
      if (!result.dry_run) {
        recordWrites(dataDir, 1);
        appendPostLog(dataDir, {
          tweet_id: result.id,
          url: result.url,
          kind: plan.kind,
          text,
          posted_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    const message = err instanceof XClientError ? err.message : String(err);
    return errorResult(
      `Posting failed after ${posted.length}/${plan.tweets.length} tweets: ${message}\n` +
        (posted.length > 0
          ? `Already posted (NOT rolled back): ${JSON.stringify(posted, null, 2)}`
          : "Nothing was posted.")
    );
  }

  return textResult({
    status: "posted",
    dry_run: isDryRun(),
    tweets: posted,
    writes_remaining: checkWriteQuota(dataDir, 0).writes_remaining,
  });
}

async function gatedPost(plan: PostPlan, confirm: boolean): Promise<ToolResult> {
  if (!confirm) {
    const quota = checkWriteQuota(getDataDir(), plan.tweets.length);
    if (!quota.ok) return errorResult(quota.message!);
    return preview(plan, quota.message, quota.writes_remaining);
  }
  return executePost(plan);
}

export function registerPostTools(server: McpServer): void {
  server.registerTool(
    "post_tweet",
    {
      description:
        "Post a single tweet to the user's X account. ALWAYS call first with confirm=false to show the user a preview, and only set confirm=true after the user explicitly approves.",
      inputSchema: {
        text: z.string().describe("Tweet text (max 280 weighted characters; URLs count as 23)"),
        confirm: z
          .boolean()
          .default(false)
          .describe("false = preview only; true = actually post (requires user approval)"),
      },
    },
    async ({ text, confirm }) => gatedPost({ tweets: [text], kind: "tweet" }, confirm)
  );

  server.registerTool(
    "post_reply",
    {
      description:
        "Post a reply to an existing tweet. ALWAYS preview with confirm=false first; set confirm=true only after explicit user approval.",
      inputSchema: {
        text: z.string().describe("Reply text (max 280 weighted characters)"),
        in_reply_to_tweet_id: z.string().describe("The id of the tweet being replied to"),
        confirm: z.boolean().default(false),
      },
    },
    async ({ text, in_reply_to_tweet_id, confirm }) =>
      gatedPost({ tweets: [text], kind: "reply", inReplyTo: in_reply_to_tweet_id }, confirm)
  );

  server.registerTool(
    "post_thread",
    {
      description:
        "Post a thread (2-25 tweets, chained as replies). Consumes one write per tweet from the 500/month free-tier quota. ALWAYS preview with confirm=false first.",
      inputSchema: {
        tweets: z.array(z.string()).min(2).max(25).describe("Tweet texts in order"),
        confirm: z.boolean().default(false),
      },
    },
    async ({ tweets, confirm }) => gatedPost({ tweets, kind: "thread" }, confirm)
  );

  server.registerTool(
    "post_draft",
    {
      description:
        "Post a saved draft by id. ALWAYS preview with confirm=false first. Marks the draft as posted on success.",
      inputSchema: {
        id: z.string().describe("Draft id"),
        confirm: z.boolean().default(false),
      },
    },
    async ({ id, confirm }) => {
      const dataDir = getDataDir();
      const draft = getDraft(dataDir, id);
      if (!draft) return errorResult(`Draft not found: ${id}`);
      if (draft.status === "posted") {
        return errorResult(`Draft ${id} was already posted (${draft.posted_tweet_ids?.join(", ")}).`);
      }
      const tweets = draft.kind === "thread" ? draft.tweets ?? [] : [draft.text ?? ""];
      if (tweets.length === 0 || tweets.every((t) => !t)) {
        return errorResult(`Draft ${id} has no content.`);
      }
      const result = await gatedPost(
        { tweets, kind: draft.kind, inReplyTo: draft.in_reply_to_tweet_id },
        confirm
      );
      if (confirm && !result.isError) {
        const parsed = JSON.parse(result.content[0].text) as {
          status: string;
          tweets: { id: string }[];
        };
        if (parsed.status === "posted") {
          updateDraft(dataDir, id, {
            status: "posted",
            posted_tweet_ids: parsed.tweets.map((t) => t.id),
          });
        }
      }
      return result;
    }
  );
}
