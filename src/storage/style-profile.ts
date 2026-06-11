import { join } from "node:path";
import { readJson, writeJson } from "./json-file.js";
import { StyleProfile } from "../types.js";

function profilePath(dataDir: string): string {
  return join(dataDir, "style-profile.json");
}

export const DEFAULT_PROFILE: StyleProfile = {
  voice: {
    tone: "",
    sentence_style: "",
    emoji_policy: "",
    formatting: "",
  },
  topics: {
    primary: [],
    secondary: [],
    avoid: [],
  },
  audience: {
    who: "",
    pain_points: [],
    what_they_follow_for: "",
  },
  examples: {
    do: [],
    dont: [],
  },
  banned_words: [],
  cta_style: "",
  language: "",
};

export function loadProfile(dataDir: string): StyleProfile {
  return readJson<StyleProfile>(profilePath(dataDir), structuredClone(DEFAULT_PROFILE));
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge<T extends Record<string, unknown>>(base: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function updateProfile(dataDir: string, patch: DeepPartial<StyleProfile>): StyleProfile {
  const merged = deepMerge(
    loadProfile(dataDir) as unknown as Record<string, unknown>,
    patch as Record<string, unknown>
  ) as unknown as StyleProfile;
  writeJson(profilePath(dataDir), merged);
  return merged;
}

export function isProfileEmpty(profile: StyleProfile): boolean {
  return (
    profile.voice.tone === "" &&
    profile.topics.primary.length === 0 &&
    profile.audience.who === ""
  );
}
