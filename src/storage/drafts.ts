import { join } from "node:path";
import { readdirSync, existsSync, unlinkSync } from "node:fs";
import { nanoid } from "nanoid";
import { readJson, writeJson } from "./json-file.js";
import { Draft, DraftKind } from "../types.js";

function draftsDir(dataDir: string): string {
  return join(dataDir, "drafts");
}

function draftPath(dataDir: string, id: string): string {
  return join(draftsDir(dataDir), `${id}.json`);
}

export interface NewDraft {
  kind: DraftKind;
  text?: string;
  tweets?: string[];
  tags?: string[];
  reply_to_context?: string;
  in_reply_to_tweet_id?: string;
}

export function createDraft(dataDir: string, input: NewDraft): Draft {
  const now = new Date().toISOString();
  const draft: Draft = {
    id: nanoid(10),
    kind: input.kind,
    text: input.text,
    tweets: input.tweets,
    tags: input.tags ?? [],
    reply_to_context: input.reply_to_context,
    in_reply_to_tweet_id: input.in_reply_to_tweet_id,
    status: "draft",
    created_at: now,
    updated_at: now,
  };
  writeJson(draftPath(dataDir, draft.id), draft);
  return draft;
}

export function getDraft(dataDir: string, id: string): Draft | null {
  const path = draftPath(dataDir, id);
  if (!existsSync(path)) return null;
  return readJson<Draft | null>(path, null);
}

export function listDrafts(
  dataDir: string,
  filter?: { kind?: DraftKind; tag?: string; status?: Draft["status"] }
): Draft[] {
  const dir = draftsDir(dataDir);
  if (!existsSync(dir)) return [];
  const drafts: Draft[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const draft = readJson<Draft | null>(join(dir, file), null);
    if (!draft) continue;
    if (filter?.kind && draft.kind !== filter.kind) continue;
    if (filter?.tag && !draft.tags.includes(filter.tag)) continue;
    if (filter?.status && draft.status !== filter.status) continue;
    drafts.push(draft);
  }
  drafts.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return drafts;
}

export function updateDraft(
  dataDir: string,
  id: string,
  patch: Partial<Pick<Draft, "text" | "tweets" | "tags" | "reply_to_context" | "in_reply_to_tweet_id" | "status" | "posted_tweet_ids">>
): Draft | null {
  const draft = getDraft(dataDir, id);
  if (!draft) return null;
  const updated: Draft = { ...draft, ...patch, updated_at: new Date().toISOString() };
  writeJson(draftPath(dataDir, id), updated);
  return updated;
}

export function deleteDraft(dataDir: string, id: string): boolean {
  const path = draftPath(dataDir, id);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
