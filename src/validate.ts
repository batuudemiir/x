const URL_RE = /https?:\/\/\S+/g;
const TCO_LENGTH = 23;

/**
 * Weighted tweet length: every URL counts as 23 chars (t.co wrapping).
 * Approximation of X's weighted counting — CJK/emoji weighting is not
 * modeled; use the twitter-text library if exact parity is ever needed.
 */
export function weightedLength(text: string): number {
  let length = 0;
  let rest = text;
  for (const match of text.match(URL_RE) ?? []) {
    length += TCO_LENGTH;
    rest = rest.replace(match, "");
  }
  return length + [...rest].length;
}

export interface ValidationResult {
  index: number;
  text: string;
  weighted_length: number;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const ENGAGEMENT_BAIT_RE =
  /\b(like if|rt if|retweet if|follow me|follow for|like and (rt|retweet|share)|tag a friend|comment below if)\b/i;

export function validateTweets(tweets: string[]): ValidationResult[] {
  return tweets.map((text, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const len = weightedLength(text);

    if (len === 0) errors.push("Tweet is empty.");
    if (len > 280) errors.push(`Too long: ${len}/280 weighted characters (URLs count as 23).`);

    const hashtags = text.match(/#\w+/g) ?? [];
    if (hashtags.length > 2) {
      warnings.push(`${hashtags.length} hashtags — more than 1-2 reads as a spam signal.`);
    } else if (hashtags.length > 0) {
      warnings.push("Hashtags are rarely needed on modern X; consider removing.");
    }

    const urls = text.match(URL_RE) ?? [];
    if (urls.length > 0 && index === 0) {
      warnings.push(
        "Link in the first/main tweet — link-only tweets are downranked. Put the link in a reply or the last thread tweet."
      );
    }

    if (ENGAGEMENT_BAIT_RE.test(text)) {
      warnings.push("Possible engagement bait phrasing — explicitly penalized by the algorithm.");
    }

    const firstLine = text.split("\n")[0] ?? "";
    if (index === 0 && firstLine.split(/\s+/).filter(Boolean).length > 0 && len > 100) {
      const hookWords = firstLine.split(/\s+/).filter(Boolean);
      if (hookWords.length > 0 && firstLine.length > 0 && /^(i think|so |well |hi |hello )/i.test(firstLine)) {
        warnings.push("Weak opener — the first 8 words are the hook; lead with the payoff.");
      }
    }

    const mentions = text.match(/@\w+/g) ?? [];
    if (mentions.length > 3) {
      warnings.push(`${mentions.length} mentions — heavy mentioning can read as spam.`);
    }

    return { index, text, weighted_length: len, ok: errors.length === 0, errors, warnings };
  });
}
