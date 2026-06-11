# x-growth-mcp

An MCP (Model Context Protocol) server that turns Claude Code / Claude Desktop into
an X (Twitter) growth assistant — algorithm-aware tweet & reply composition, draft
management, a personal style profile, and posting via the X API.

Inspired by [xpatla.com](https://xpatla.com) and
[hrrcne/xpatla-mcp-server](https://github.com/hrrcne/xpatla-mcp-server). All
generation happens in the MCP client (Claude); this server provides the tools,
the algorithm knowledge base, and the X API access.

## What it does

- **Algorithm-aware prompts** — `compose_tweet`, `compose_reply`, `plan_thread`,
  `improve_tweet`, `analyze_pasted_tweet`, `content_calendar`, `review_performance`.
  Each prompt injects the distilled X Heavy-Ranker weights, penalty signals, and
  your style profile into Claude's context.
- **Algorithm knowledge base** — `src/knowledge/algorithm.md`, distilled from
  `twitter/the-algorithm`. Exposed as the `x-growth://algorithm-guide` resource and
  the `get_algorithm_guide` tool.
- **Posting** — `post_tweet`, `post_reply`, `post_thread`, `post_draft`. Every
  post tool has a two-step confirm gate (preview → user approval → post) and
  refuses to exceed the free-tier write quota.
- **Drafts** — local JSON files (no DB): `save_draft`, `list_drafts`, `get_draft`,
  `update_draft`, `delete_draft`, `post_draft`.
- **Style profile** — `get_style_profile`, `update_style_profile`. A single JSON
  describing your voice, topics, audience, do/dont examples, banned words.
- **Quota & analytics** — `get_usage_quota` tracks writes against the 500/month
  free-tier cap locally; `log_performance` records impressions/likes/replies you
  copy from the X app so `review_performance` can find patterns.
- **Validator** — `validate_tweet` checks weighted length, hashtag spam, link
  placement, and engagement-bait phrasing against the algorithm guide — no API
  call required.

## Free tier reality check

The X API free tier allows ~500 writes/month and ~100 reads/month, and exposes
**no** home-timeline read and **no** search. So this server deliberately has no
"fetch other people's tweets" tool — for `compose_reply` and
`analyze_pasted_tweet` you paste the target tweet text. That keeps the read
budget for things only an API can do.

## Setup

1. **Get X API keys.** [developer.x.com](https://developer.x.com) → create a
   project + app → set permissions to **Read and Write** → regenerate the
   Access Token and Secret. You need all four: API Key, API Secret, Access
   Token, Access Secret (OAuth 1.0a user context).

2. **Install & build.**
   ```bash
   npm install
   npm run build
   ```

3. **Configure env.** Copy `.env.example` to `.env` (or export the vars in your
   MCP client config):
   ```
   X_API_KEY=...
   X_API_SECRET=...
   X_ACCESS_TOKEN=...
   X_ACCESS_SECRET=...
   # X_MCP_DATA_DIR=~/.x-growth-mcp   # optional
   # X_MCP_DRY_RUN=true                # optional: simulate posts
   ```

4. **Register with Claude Code:**
   ```bash
   claude mcp add x-growth \
     -e X_API_KEY=... -e X_API_SECRET=... \
     -e X_ACCESS_TOKEN=... -e X_ACCESS_SECRET=... \
     -- node /absolute/path/to/x-growth-mcp/dist/index.js
   ```

   Or in Claude Desktop's `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "x-growth": {
         "command": "node",
         "args": ["/absolute/path/to/x-growth-mcp/dist/index.js"],
         "env": {
           "X_API_KEY": "...",
           "X_API_SECRET": "...",
           "X_ACCESS_TOKEN": "...",
           "X_ACCESS_SECRET": "..."
         }
       }
     }
   }
   ```

5. **First run.** In Claude, ask: *"Interview me and fill my X style profile."*
   Claude will use `update_style_profile`. From then on every prompt is
   personalized.

## Typical flows

- **Compose a tweet.** Invoke the `compose_tweet` prompt → Claude drafts 3
  variants grounded in the algorithm guide and your style → runs
  `validate_tweet` → asks if you want to `save_draft` or `post_tweet`. Post
  tools always preview first; you approve, then Claude calls them again with
  `confirm: true`.
- **Reply to a tweet.** Paste the target tweet text into `compose_reply`. The
  prompt steers Claude toward replies the author is likely to engage with —
  the ~150× Heavy-Ranker signal.
- **Plan a week.** `content_calendar` → save each post as a draft → post on
  schedule with `post_draft`.

## Quota and safety

- The server tracks writes locally (free tier has no quota endpoint) and
  refuses to post when the month is exhausted. Quota resets the 1st of each
  month UTC.
- `X_MCP_DRY_RUN=true` simulates every post — useful for testing prompts
  without burning your write budget.
- Every post tool requires `confirm: true`, and the prompts are instructed to
  show you a preview and wait for explicit approval before flipping the flag.

## Scripts

```bash
npm run build    # tsc -> dist/, copies knowledge md
npm run dev      # tsx src/index.ts (stdio)
npm run inspect  # MCP Inspector against the dev server
npm test         # vitest
```

## Project layout

```
src/
  index.ts            # stdio entry
  server.ts           # tool/prompt/resource registration
  config.ts           # env + data-dir
  x-client.ts         # twitter-api-v2 (OAuth 1.0a) wrapper
  validate.ts         # weighted-length + heuristic checks
  knowledge/
    algorithm.md      # distilled X algorithm guide
  tools/              # post, drafts, style, quota, analyze
  prompts/            # compose_tweet, compose_reply, plan_thread, ...
  resources/          # x-growth://algorithm-guide, ://style-profile, ...
  storage/            # JSON file CRUD: drafts, style, usage, post-log
```

## Status

Greenfield v0.1. Free tier is intentionally the design center; if you upgrade
to Basic, future work can add a `fetch_target_tweet` tool and a
`monitor_niche` background prompt.
