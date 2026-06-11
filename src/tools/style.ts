import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDataDir } from "../config.js";
import { loadProfile, updateProfile, isProfileEmpty } from "../storage/style-profile.js";
import { textResult } from "./helpers.js";

export function registerStyleTools(server: McpServer): void {
  server.registerTool(
    "get_style_profile",
    {
      description:
        "Get the user's writing style profile (voice, topics, audience, examples). Used by all compose prompts. If empty, offer to interview the user and fill it via update_style_profile.",
      inputSchema: {},
    },
    async () => {
      const profile = loadProfile(getDataDir());
      return textResult({
        empty: isProfileEmpty(profile),
        hint: isProfileEmpty(profile)
          ? "Profile is empty. Interview the user (tone, topics, audience, good/bad example tweets, language) and save with update_style_profile."
          : undefined,
        profile,
      });
    }
  );

  server.registerTool(
    "update_style_profile",
    {
      description:
        "Update the user's style profile. Partial updates are deep-merged into the existing profile.",
      inputSchema: {
        voice: z
          .object({
            tone: z.string().optional(),
            sentence_style: z.string().optional(),
            emoji_policy: z.string().optional(),
            formatting: z.string().optional(),
          })
          .optional(),
        topics: z
          .object({
            primary: z.array(z.string()).optional(),
            secondary: z.array(z.string()).optional(),
            avoid: z.array(z.string()).optional(),
          })
          .optional(),
        audience: z
          .object({
            who: z.string().optional(),
            pain_points: z.array(z.string()).optional(),
            what_they_follow_for: z.string().optional(),
          })
          .optional(),
        examples: z
          .object({
            do: z.array(z.string()).optional(),
            dont: z.array(z.string()).optional(),
          })
          .optional(),
        banned_words: z.array(z.string()).optional(),
        cta_style: z.string().optional(),
        language: z.string().optional().describe("e.g. 'Turkish', 'English'"),
      },
    },
    async (patch) => {
      const profile = updateProfile(getDataDir(), patch);
      return textResult({ updated: true, profile });
    }
  );
}
