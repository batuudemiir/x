import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import { validateTweets } from "../validate.js";
import { updateMetrics, loadPostLog } from "../storage/post-log.js";
import { getGuideSection, listGuideSections, loadAlgorithmGuide } from "../knowledge/index.js";
import { textResult, errorResult } from "./helpers.js";

export function registerAnalyzeTools(server: McpServer): void {
  server.registerTool(
    "validate_tweet",
    {
      description:
        "Validate tweet text(s) offline (no API call): weighted length (URLs=23 chars), hashtag/link/mention checks, engagement-bait detection, algorithm-keyed warnings. Run before any post.",
      inputSchema: {
        text: z.string().optional().describe("Single tweet text"),
        tweets: z.array(z.string()).optional().describe("Thread tweets in order"),
      },
    },
    async ({ text, tweets }) => {
      const list = tweets ?? (text !== undefined ? [text] : []);
      if (list.length === 0) return errorResult("Provide `text` or `tweets`.");
      const results = validateTweets(list);
      return textResult({
        all_ok: results.every((r) => r.ok),
        results,
      });
    }
  );

  server.registerTool(
    "get_algorithm_guide",
    {
      description:
        "Get the distilled X algorithm guide (from the open-sourced twitter/the-algorithm). Optionally a single section. Use it to ground every tweet/reply suggestion.",
      inputSchema: {
        section: z
          .string()
          .optional()
          .describe(
            "Optional section slug, e.g. engagement-weights, replies, out-of-network, tweepcred, penalties, recency, media-and-format, practical-checklist"
          ),
      },
    },
    async ({ section }) => {
      if (!section) return textResult(loadAlgorithmGuide());
      const content = getGuideSection(section);
      if (!content) {
        return errorResult(
          `Unknown section "${section}". Available: ${listGuideSections().join(", ")}`
        );
      }
      return textResult(content);
    }
  );

  server.registerTool(
    "log_performance",
    {
      description:
        "Manually record metrics for a posted tweet (user copies numbers from the X app — costs no API reads). Feeds the review_performance prompt.",
      inputSchema: {
        tweet_id_or_url: z.string().describe("Tweet id or x.com URL"),
        impressions: z.number().optional(),
        likes: z.number().optional(),
        replies: z.number().optional(),
        reposts: z.number().optional(),
        bookmarks: z.number().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ tweet_id_or_url, notes, ...metrics }) => {
      const idMatch = tweet_id_or_url.match(/(\d{8,})/);
      const tweetId = idMatch ? idMatch[1] : tweet_id_or_url;
      const entry = updateMetrics(getDataDir(), tweetId, metrics, notes);
      return textResult({ logged: true, entry });
    }
  );

  server.registerTool(
    "get_post_log",
    {
      description: "Get the history of posts made through this server, with any logged metrics.",
      inputSchema: {},
    },
    async () => textResult(loadPostLog(getDataDir()))
  );
}
