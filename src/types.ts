export type DraftKind = "tweet" | "reply" | "thread";

export interface Draft {
  id: string;
  kind: DraftKind;
  /** Single tweet text for kind tweet/reply; ignored for threads. */
  text?: string;
  /** Tweet texts in order for kind thread. */
  tweets?: string[];
  tags: string[];
  /** Pasted text of the tweet this draft replies to, for context. */
  reply_to_context?: string;
  /** Tweet id to reply to, if known. */
  in_reply_to_tweet_id?: string;
  status: "draft" | "posted";
  posted_tweet_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface StyleProfile {
  voice: {
    tone: string;
    sentence_style: string;
    emoji_policy: string;
    formatting: string;
  };
  topics: {
    primary: string[];
    secondary: string[];
    avoid: string[];
  };
  audience: {
    who: string;
    pain_points: string[];
    what_they_follow_for: string;
  };
  examples: {
    do: string[];
    dont: string[];
  };
  banned_words: string[];
  cta_style: string;
  language: string;
}

export interface UsageRecord {
  /** "YYYY-MM" in UTC */
  month: string;
  writes: number;
  reads: number;
}

export interface PostLogEntry {
  tweet_id: string;
  url?: string;
  kind: DraftKind;
  text: string;
  posted_at: string;
  metrics?: {
    impressions?: number;
    likes?: number;
    replies?: number;
    reposts?: number;
    bookmarks?: number;
    logged_at?: string;
  };
  notes?: string;
}

export const WRITE_LIMIT = 500;
export const READ_LIMIT = 100;
