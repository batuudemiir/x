import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import { loadProfile, isProfileEmpty } from "../storage/style-profile.js";
import { loadPostLog } from "../storage/post-log.js";
import { getGuideSection } from "../knowledge/index.js";
import { StyleProfile } from "../types.js";

function styleBlock(profile: StyleProfile): string {
  if (isProfileEmpty(profile)) {
    return [
      "## User style profile",
      "The style profile is EMPTY. Before composing, briefly interview the user",
      "(tone, main topics, audience, 1-2 example tweets they like, language) and",
      "save the answers with the `update_style_profile` tool. Then compose.",
    ].join("\n");
  }
  return `## User style profile\nWrite strictly in this user's voice:\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``;
}

function guide(...sections: string[]): string {
  return sections
    .map((s) => getGuideSection(s))
    .filter((s): s is string => s !== null)
    .join("\n\n");
}

const CLOSING = [
  "## Output",
  "1. Draft 3 distinct variants.",
  "2. For each, note in one line which algorithm signal it targets.",
  "3. Run `validate_tweet` on the best candidate.",
  "4. Offer to `save_draft` or (after explicit user approval) `post_tweet`.",
].join("\n");

function promptMessage(text: string) {
  return {
    messages: [
      { role: "user" as const, content: { type: "text" as const, text } },
    ],
  };
}

export function registerPrompts(server: McpServer): void {
  const dataDir = () => getDataDir();

  server.registerPrompt(
    "compose_tweet",
    {
      description: "Compose algorithm-optimized tweet variants on a topic, in the user's voice.",
      argsSchema: {
        topic: z.string().describe("What the tweet should be about"),
        goal: z
          .enum(["reach", "replies", "followers", "bookmarks"])
          .optional()
          .describe("Primary optimization goal"),
        format: z
          .enum(["insight", "story", "contrarian", "list", "question"])
          .optional(),
      },
    },
    ({ topic, goal, format }) => {
      const goalMap: Record<string, string> = {
        reach:
          "Goal: REACH. Optimize for out-of-network spread: strong hook, shareable insight, dwell-worthy density. Avoid links and hashtags entirely.",
        replies:
          "Goal: REPLIES. The reply→author-engagement loop is worth ~150x a like. End with something genuinely answerable; the user must reply to every response in the first hour.",
        followers:
          "Goal: FOLLOWERS. Optimize for profile clicks followed by engagement (~24x): demonstrate expertise that makes the reader want more, with a follow-worthy payoff.",
        bookmarks:
          "Goal: BOOKMARKS. Dense, save-worthy value (frameworks, numbers, steps) that rewards a slow read (dwell time signal).",
      };
      return promptMessage(
        [
          `Compose a tweet about: ${topic}`,
          goal ? goalMap[goal] : "Goal: balanced engagement.",
          format ? `Format: ${format}.` : "",
          "",
          "## X algorithm context (ground every choice in this)",
          guide("engagement-weights", "penalties", "practical-checklist"),
          "",
          styleBlock(loadProfile(dataDir())),
          "",
          CLOSING,
        ].join("\n")
      );
    }
  );

  server.registerPrompt(
    "compose_reply",
    {
      description:
        "Compose reply variants to a pasted tweet, optimized to earn the author's engagement (the strongest algorithm signal).",
      argsSchema: {
        target_tweet: z.string().describe("Paste the full text of the tweet to reply to"),
        author_context: z
          .string()
          .optional()
          .describe("Who the author is / their niche, if known"),
        angle: z.string().optional().describe("Optional angle to take"),
      },
    },
    ({ target_tweet, author_context, angle }) =>
      promptMessage(
        [
          "Compose a reply to this tweet:",
          `> ${target_tweet.split("\n").join("\n> ")}`,
          author_context ? `Author context: ${author_context}` : "",
          angle ? `Requested angle: ${angle}` : "",
          "",
          "## X algorithm context",
          guide("replies", "engagement-weights"),
          "",
          "A reply the AUTHOR then engages with is the single strongest positive signal",
          "(~150x a like). Add real value: a data point, counterexample, experience, or",
          "resource. Never 'Great post!'. Stay under 280 weighted characters.",
          "",
          styleBlock(loadProfile(dataDir())),
          "",
          CLOSING.replace("post_tweet", "post_reply (needs the tweet id/URL from the user)"),
        ].join("\n")
      )
  );

  server.registerPrompt(
    "plan_thread",
    {
      description: "Plan and draft a hook-first thread (3-5 tweets recommended).",
      argsSchema: {
        topic: z.string(),
        n_tweets: z.string().optional().describe("Desired length, default 4"),
        goal: z.enum(["reach", "replies", "followers", "bookmarks"]).optional(),
      },
    },
    ({ topic, n_tweets, goal }) =>
      promptMessage(
        [
          `Plan a thread about: ${topic}`,
          `Length: ${n_tweets ?? "4"} tweets. Goal: ${goal ?? "bookmarks"}.`,
          "",
          "## X algorithm context",
          guide("media-and-format", "engagement-weights", "penalties"),
          "",
          "Rules: the first tweet is pure hook (it competes alone in the feed);",
          "one idea per tweet; no links until the final tweet; the last tweet gives a",
          "follow-worthy payoff. Thread completion rate is a ranking signal — keep it tight.",
          `Note: posting consumes one write per tweet from the 500/month quota.`,
          "",
          styleBlock(loadProfile(dataDir())),
          "",
          "## Output",
          "1. Outline first, then the full thread.",
          "2. Run `validate_tweet` with the `tweets` array.",
          "3. Offer to `save_draft` (kind: thread) or, after explicit approval, `post_thread`.",
        ].join("\n")
      )
  );

  server.registerPrompt(
    "improve_tweet",
    {
      description: "Critique a draft against the algorithm guide and the user's style, then rewrite it.",
      argsSchema: {
        draft_text: z.string().describe("The draft tweet text to improve (or a draft id to fetch with get_draft)"),
      },
    },
    ({ draft_text }) =>
      promptMessage(
        [
          "Improve this draft tweet (if it looks like a draft id, fetch it with `get_draft` first):",
          `> ${draft_text.split("\n").join("\n> ")}`,
          "",
          "## X algorithm context",
          guide("engagement-weights", "penalties", "practical-checklist"),
          "",
          styleBlock(loadProfile(dataDir())),
          "",
          "## Output",
          "1. Score the draft against the practical checklist (what works, what hurts).",
          "2. Rewrite it 3 ways, each fixing the weaknesses differently.",
          "3. Run `validate_tweet` on the best rewrite; offer `save_draft`/`post_tweet`.",
        ].join("\n")
      )
  );

  server.registerPrompt(
    "analyze_pasted_tweet",
    {
      description:
        "Explain why a pasted tweet performed (or would perform) through the Heavy Ranker's weights, and extract reusable patterns.",
      argsSchema: {
        tweet_text: z.string().describe("Paste the tweet text"),
        metrics: z.string().optional().describe("Optional metrics, e.g. '120k impressions, 800 likes, 95 replies'"),
      },
    },
    ({ tweet_text, metrics }) =>
      promptMessage(
        [
          "Analyze this tweet through the X algorithm:",
          `> ${tweet_text.split("\n").join("\n> ")}`,
          metrics ? `Reported metrics: ${metrics}` : "",
          "",
          "## X algorithm context",
          guide("engagement-weights", "out-of-network", "recency", "penalties"),
          "",
          "## Output",
          "1. Which Heavy Ranker signals this tweet triggers (or fails to), and why.",
          "2. 3 reusable patterns the user can apply in their own niche/voice.",
          "3. Offer to compose an adaptation with `compose_tweet`.",
          "",
          styleBlock(loadProfile(dataDir())),
        ].join("\n")
      )
  );

  server.registerPrompt(
    "content_calendar",
    {
      description: "Plan a week of posts within the free-tier quota, mixing formats and goals.",
      argsSchema: {
        week_focus: z.string().optional().describe("Theme or focus for the week"),
        posts_per_day: z.string().optional().describe("Default 3 (well under the ~16/day quota ceiling)"),
      },
    },
    ({ week_focus, posts_per_day }) =>
      promptMessage(
        [
          `Plan a 7-day X content calendar.${week_focus ? ` Focus: ${week_focus}.` : ""}`,
          `Posts per day: ${posts_per_day ?? "3"} (the free tier allows ~16/day; 3-5 is the sweet spot).`,
          "",
          "## X algorithm context",
          guide("recency", "penalties", "practical-checklist"),
          "",
          "Check current quota with `get_usage_quota` first. Space posts 3-4h apart",
          "(author diversity heuristic). Mix goals: value/bookmark posts, conversation",
          "posts, 1-2 threads max, plus daily reply targets in the user's niche.",
          "",
          styleBlock(loadProfile(dataDir())),
          "",
          "## Output",
          "A day-by-day table (slot, goal, format, topic). Then draft day 1 fully and",
          "save each post with `save_draft` (tag: 'calendar').",
        ].join("\n")
      )
  );

  server.registerPrompt(
    "review_performance",
    {
      description: "Review logged post metrics, find patterns, and propose style-profile updates.",
      argsSchema: {},
    },
    () => {
      const log = loadPostLog(dataDir());
      const withMetrics = log.filter((e) => e.metrics);
      return promptMessage(
        [
          "Review my X posting performance.",
          "",
          "## Post log",
          log.length === 0
            ? "(empty — nothing posted through this server yet; metrics can be added with `log_performance`)"
            : `\`\`\`json\n${JSON.stringify(log.slice(-50), null, 2)}\n\`\`\``,
          withMetrics.length === 0 && log.length > 0
            ? "No metrics logged yet — ask the user to copy impressions/likes/replies from the X app and record them with `log_performance`."
            : "",
          "",
          "## X algorithm context",
          guide("engagement-weights", "practical-checklist"),
          "",
          "## Output",
          "1. Patterns: which formats/topics/goals over- and under-performed, mapped to algorithm signals.",
          "2. Concrete changes for next week.",
          "3. Propose `update_style_profile` edits (do/dont examples) based on the evidence, and apply them if the user agrees.",
        ].join("\n")
      );
    }
  );
}
