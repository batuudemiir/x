import { TwitterApi, ApiResponseError } from "twitter-api-v2";
import { getXCredentials, isDryRun, log } from "./config.js";

let client: TwitterApi | null = null;

export class XClientError extends Error {}

function getClient(): TwitterApi {
  if (client) return client;
  const creds = getXCredentials();
  if (!creds) {
    throw new XClientError(
      "X API credentials are not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_SECRET (see .env.example). Drafting and composing still work without them."
    );
  }
  client = new TwitterApi(creds);
  return client;
}

function friendlyError(err: unknown): XClientError {
  if (err instanceof ApiResponseError) {
    if (err.code === 401) {
      return new XClientError(
        "X API rejected the credentials (401). Check the 4 keys and make sure the app permission is 'Read and write' (regenerate tokens after changing it)."
      );
    }
    if (err.code === 403) {
      return new XClientError(
        `X API refused the request (403): ${err.message}. Common causes: app lacks write permission, duplicate tweet, or the free tier does not allow this endpoint.`
      );
    }
    if (err.code === 429) {
      const reset = err.rateLimit?.reset
        ? new Date(err.rateLimit.reset * 1000).toISOString()
        : "unknown";
      return new XClientError(
        `Rate limited by X (429). Limit resets at ${reset}. The free tier has very low per-15-min and monthly caps.`
      );
    }
    return new XClientError(`X API error (${err.code}): ${err.message}`);
  }
  return new XClientError(`X API request failed: ${(err as Error).message ?? String(err)}`);
}

export interface PostedTweet {
  id: string;
  text: string;
  url: string;
  dry_run: boolean;
}

let dryRunCounter = 0;

export async function postTweet(text: string, inReplyTo?: string): Promise<PostedTweet> {
  if (isDryRun()) {
    dryRunCounter += 1;
    const id = `dry-run-${Date.now()}-${dryRunCounter}`;
    log(`DRY RUN: would post${inReplyTo ? ` (reply to ${inReplyTo})` : ""}: ${text}`);
    return { id, text, url: `https://x.com/i/web/status/${id}`, dry_run: true };
  }
  try {
    const payload = inReplyTo
      ? { text, reply: { in_reply_to_tweet_id: inReplyTo } }
      : { text };
    const res = await getClient().v2.tweet(payload);
    return {
      id: res.data.id,
      text: res.data.text,
      url: `https://x.com/i/web/status/${res.data.id}`,
      dry_run: false,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}
