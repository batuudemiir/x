# X (Twitter) Algorithm Guide — 2026 (Grok / Phoenix era)

Distilled from xAI's open-source release at `github.com/xai-org/x-algorithm`
(first full Grok-powered release **Jan 20 2026**, complete end-to-end pipeline
**May 15 2026**, Apache-2.0, ~57% Rust / ~43% Python, updated every 4 weeks).
The production action weights live in an unreleased `crate::params` module and
the trained Phoenix coefficients are not public — so treat all numbers as
**directional**; the relative ordering and the mechanics are the durable part.

> What changed vs the 2023 `twitter/the-algorithm` release (read this first):
> 1. **External-link penalty is GONE.** No hard-coded link penalty exists in the
>    code; `CLICK_WEIGHT` is positive. Link posts saw ~8× more reach after the
>    change. Old "never put a link in the tweet" advice is obsolete — links just
>    still have to earn engagement like any post.
> 2. **Grok runs the ranker and judges tone.** The hand-engineered "Heavy Ranker"
>    is replaced by **Phoenix**, a Grok-architecture transformer. **Grox**
>    classifiers score sentiment: constructive/positive tone gets wider
>    distribution; combative/aggressive tone is suppressed *even if engagement is
>    high*. Rage-bait no longer wins.
> 3. **Conversation quality > raw counts.** A post with 50 thoughtful replies
>    out-ranks one with 500 passive likes. Grok scores reply *quality* 0–3.

## pipeline

The "For You" feed is assembled by **Home Mixer** (Rust gRPC orchestrator) in a
seven-stage flow:

1. **Query Hydration** — load the viewer's context/embeddings from cache.
2. **Parallel Sourcing** — two sources run at once:
   - **Thunder** — in-memory store of fresh posts from accounts you follow
     (sub-millisecond, Kafka-fed) → in-network candidates.
   - **Phoenix Retrieval** — two-tower model (User Tower vs Candidate Tower),
     cosine similarity over billions of pairs → out-of-network discovery.
3. **Candidate Hydration** — six hydrators enrich each post (CoreData,
   Gizmoduck, InNetwork, Subscription, VF/visibility, VideoDuration).
4. **Filtering** — age, social-graph, NSFW, policy filters (via **Grox**
   classifiers: spam, NSFW, policy, topical categorization). Every post is
   Grox-filtered before ranking.
5. **Scoring** — the **Phoenix Ranker** (Grok transformer) predicts ~19
   multi-task action probabilities per post, combined by the weighted formula
   below, plus diversity/OON scorers. Candidate-to-candidate features are zeroed
   (a post's score doesn't depend on its neighbors → deterministic).
6. **Selection** — top-N ordering.
7. **Blending** — ad injection with brand-safety filters.

~1,500 candidates are drawn from ~500M daily posts; the feed mixes roughly
**50% in-network / 50% out-of-network**.

## engagement-weights

`Final Score = Σ (weight_i × P(action_i)) + NEGATIVE_SCORES_OFFSET`

Phoenix predicts the probability of each action; the score is the weighted sum.
Directional weights (legacy code values; relative order still holds under
Phoenix's learned model):

| Signal | Approx. weight |
|---|---|
| **Follow author from this post** | strongest positive (rarest action) |
| **Reply, then the author engages with that reply** | **~+75 (≈150× a like)** |
| Reply (plain) | ~+13.5 |
| Profile click that leads to engagement | ~+12 |
| Conversation/"good" click + dwell ≥2 min | ~+11 |
| Bookmark | ~+10 |
| Dwell ≥2 min on long-form | ~+10 |
| Repost / retweet | ~+1.0 |
| Like | ~+0.5 (lowest positive) |
| DM share / copy-link share | high (counts as strong intent) |
| **"Not interested" predicted** | subtracts |
| **Block / mute / "show less often"** | strong negative |
| **Report** | largest negative (`NEGATIVE_SCORES_OFFSET`) |

(You'll also see a "counts" folklore table — reply 27×, repost 20×, quote 25×.
Those are engagement-*count* heuristics, not the code weights. Use the table
above; the takeaway is identical: **likes are nearly worthless for reach;
author-engaged replies and follows are everything.**)

Practical translation:
- **Conversation is king.** Earn replies you then answer → the +75 loop fires.
- **Likes barely move reach.** Optimize for replies, bookmarks, profile clicks,
  follows, and shares instead.
- **Negative feedback is catastrophic** and now easier to trigger (see tone).

## tone

New in 2026 and unique to the Grok era — bake this into every draft:
- **Grok scores sentiment/tone.** Constructive, curious, generous, specific →
  broader distribution. Combative, dunking, contemptuous, doom → throttled
  *even when it gets high engagement*.
- **Reply quality is scored 0–3 by Grok.** Low-effort replies ("this", "💯",
  emoji-only) score ~0 regardless of how many likes they get.
- **"Banger" quality screen:** posts get a quality_score 0–1 with a ~0.4 pass
  threshold; below it, a post becomes "screen-fodder" with little distribution.
- Implication: a strong, clear, *useful* or *generous* take beats a hot,
  angry one. Write like you want the author/community to want to reply.

## replies

- Replying to larger accounts in your niche is still the cheapest distribution:
  your reply rides *their* audience, and an author-engagement on it is the
  single strongest signal you can manufacture.
- Replies must clear Grok's 0–3 quality bar — add a data point, counterexample,
  lived experience, or resource. "Great post!" scores zero.
- **Speed:** reply in the first 10–30 min of a big post's life to ride its wave.
- **Reply to your own replies** within the first hour — that qualifies them for
  separate Grok scoring and lifts the whole thread.
- **Small-account caveat:** accounts under ~1,000 followers get extra spam
  screening on replies (code logs "Reply Spam Found for lower than 1000 follower
  bucket"). Don't mass-reply; make each reply count.

## out-of-network

- ~50% of the For You feed is accounts the viewer doesn't follow, sourced by
  **Phoenix Retrieval's** two-tower embedding similarity.
- Niche consistency wins: a coherent topical embedding makes you retrievable for
  the right audiences. Topic-hopping blurs your vector and hurts discovery.
- **TweepCred threshold:** accounts below **~0.65** (normalized 0–1 author
  reputation) are ineligible for out-of-network distribution regardless of post
  quality — so reputation gating still exists.
- Engagement from accounts *similar to your followers* carries you into their
  clusters ("X replied/liked this" is a strong carrier).

## tweepcred

- PageRank-style author reputation over the follow graph; gates OON eligibility
  at ~0.65.
- Healthy follower/following ratio, follows from reputable accounts, account age,
  and consistent genuine activity feed into it. Following thousands to farm
  follow-backs hurts.

## penalties

- **Links: no longer penalized** (2026 change). A link post just has to earn
  engagement on its own merits; you can put the link directly in the post.
- **Combative/negative tone:** throttled by Grok sentiment even if it engages.
- **Low-effort / "screen-fodder":** below the ~0.4 quality screen → buried.
- **Hashtag overuse:** 3+ hashtags reads as spam; modern X barely uses them.
- **Burst posting:** the author-diversity scorer attenuates repeat-author posts —
  the 2nd post in a viewer's session is halved, the 3rd is crushed. Space posts
  across sessions/hours.
- **Mass-reply spam**, especially from sub-1,000-follower accounts → flagged.
- **Negative feedback** (report/block/mute/"not interested") → strongest penalties.
- **Engagement bait** ("like if", "RT this", "follow me") is detected.

## recency

- Posts lose ~half their potential visibility every ~6 hours; algorithmic push
  is minimal after ~24h.
- Lifecycle: shown first to ~5–15% of followers, scored over a **30–60 min**
  window, then expanded or suppressed against a threshold, and continuously
  re-scored. The first hour decides whether you go out-of-network — be present
  to answer replies.
- Threads get a slightly longer active window because new replies bump the score.

## media-and-format

- **Native video** is heavily rewarded; clear one >`MIN_VIDEO_DURATION_MS`
  (~60s) to unlock the **VQV (Video Quality View)** signal. Video watch time is
  weighted more heavily than in the 2023 system.
- Native images/GIFs get a moderate boost; text-only is neutral (no penalty).
- **Threads:** the first post is scored normally; later posts benefit from the
  thread structure and the longer active window. 3–5 tight tweets, one idea
  each, beat both walls of text and 20-tweet threads.
- **Dwell time** (≥2 min) is a first-class positive — dense, save-worthy content
  that rewards a slow read compounds.
- Premium/verified gets a visibility constant; subscription status is a hydrator.

## practical-checklist

1. **Hook in the first line** — it competes alone in the feed and against the
   ~0.4 quality screen.
2. One idea per post. Concrete beats abstract; numbers beat adjectives.
3. **Constructive/specific tone** — Grok rewards it; skip the dunk.
4. End with something genuinely answerable when the goal is replies, then
   **answer every reply in the first hour** (fires the +75 loop).
5. Links are fine now — but the post still has to be worth engaging with.
6. ≤1 hashtag, usually 0.
7. Space posts ≥3–4h apart / across sessions (author-diversity decay).
8. Stay in your niche cluster — consistency makes you retrievable out-of-network.
9. Ship one native video >60s per week for the VQV signal.
10. Optimize for bookmarks + dwell on "value" posts, replies on "conversation"
    posts, and a follow-worthy payoff to convert profile clicks. Likes are a
    vanity signal — don't design for them.
11. Never engagement-bait, never invite reports/mutes; under 1k followers, don't
    mass-reply.
