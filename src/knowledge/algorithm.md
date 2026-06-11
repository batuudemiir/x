# X (Twitter) Algorithm Guide

Distilled from the open-sourced `twitter/the-algorithm` repository (2023 release and
subsequent public updates). Exact weights shift over time — treat numbers as
directional, the relative ordering as the durable signal.

## pipeline

The "For You" timeline is built in three stages:

1. **Candidate sourcing** — ~1,500 candidates pulled from ~500M daily posts.
   Roughly half come from accounts you follow (in-network, via "Earlybird"
   search index), half from out-of-network sources (SimClusters community
   embeddings, GraphJet user-user similarity, follow-graph expansion).
2. **Heavy Ranker** — a neural network scores each candidate by predicting the
   probability of each engagement type, then combines them with fixed weights
   (see below).
3. **Heuristics & filtering** — author diversity, content balance, feedback
   fatigue, deduplication, visibility filtering (blocked/muted), Twitter
   Blue/Premium boost.

## engagement-weights

Heavy Ranker weighted engagement probabilities, normalized to a like = 1×:

| Signal | Approx. weight |
|---|---|
| Reply, **then the author engages with that reply** | **~150×** (single biggest positive) |
| User replies to the tweet | ~27× |
| Profile click followed by like/reply | ~24× |
| Retweet/repost | ~2× |
| "Good click" — dwell ≥2 min after opening conversation | ~22× |
| Video watched ≥50% | ~0.16× |
| Like | 1× |
| **Report** | **~−738×** |
| "Show less often" / block / mute author | ~−148× |

Practical translation:

- **Conversation is king.** A tweet that earns replies you then respond to
  out-earns hundreds of likes. Ask answerable questions; reply to every reply
  in the first hour.
- **Negative feedback is catastrophic.** One report cancels hundreds of likes.
  Never bait, never spam, never mislead — rage-bait that earns mutes/reports
  is net negative even when it "goes viral".
- Bookmarks and dwell time signal depth: content people save and read slowly
  (threads, dense insight) compounds.

## replies

- Replying to large accounts in your niche is the cheapest distribution: your
  reply is shown to *their* audience, and an author-like or author-reply on
  your reply is one of the strongest signals that exists.
- High-value replies add information (data point, counterexample, experience,
  resource) — not "Great post!" Generic congratulation replies earn mutes.
- Speed matters: replies in the first 10–30 minutes of a big tweet's life ride
  its distribution wave.

## out-of-network

- ~50% of the For You feed is from accounts the viewer does not follow.
- SimClusters places every account in ~145k interest communities. Engagement
  from accounts *similar to your followers* spreads your tweet through their
  communities — niche consistency beats topic-hopping, because a coherent
  cluster identity makes you recommendable.
- Engagement by people the viewer follows ("X liked this") is a strong
  out-of-network carrier.

## tweepcred

- A PageRank-style author reputation score over the follow graph.
- Low TweepCred (< ~65) caps how many of your tweets even enter candidate
  sourcing.
- Follower/following ratio matters: following far more people than follow you
  back hurts. Getting followed by reputable accounts helps most.
- Account age, device diversity, and consistent activity feed into it.

## penalties

- **Links:** tweets that are "just a link" with low predicted engagement are
  downranked. Put the insight in the tweet; the link in a reply or the last
  tweet of a thread.
- **Hashtags:** more than 1–2 reads as spam signal. Modern X barely needs them.
- **Author diversity:** consecutive tweets from the same author get
  progressively downranked in a viewer's feed — space posts hours apart
  instead of bursting.
- **Feedback fatigue:** past "show less often" from a viewer suppresses you to
  that viewer for a long time.
- **Engagement bait** ("like if", "RT this", "follow me") is explicitly
  detected and penalized.

## recency

- In-network candidates decay fast — roughly a 6-hour half-life. The first
  30–60 minutes decide whether the Heavy Ranker sees enough engagement
  probability to push the tweet out-of-network.
- Post when your audience is online; be available to answer replies for the
  first hour.

## media-and-format

- Native images/video get a modest boost; video completion (≥50% watched) is
  its own ranking signal.
- Threads: thread completion rate is a ranking signal; 3–5 tweet threads with
  one idea per tweet outperform both walls of text and 20-tweet threads.
- Premium/verified authors get a ranking boost (roughly 2–4× visibility
  constant in the open-source heuristics).

## practical-checklist

1. **Hook in the first 8 words** — the first line is all most people see.
2. One idea per tweet. Concrete beats abstract; numbers beat adjectives.
3. End with something answerable (a question, a hot take, a fill-in-the-blank)
   when the goal is replies.
4. No links in the main tweet — link in reply or last thread tweet.
5. ≤1 hashtag, usually 0.
6. Reply to every reply in the first 60 minutes (author-engagement multiplier).
7. Space posts ≥3–4 hours apart (author diversity heuristic).
8. Stay in your niche cluster — consistency makes you recommendable
   out-of-network.
9. Never engagement-bait, never post anything that invites reports/mutes.
10. Optimize for bookmarks and dwell on "value" posts, for replies on
    "conversation" posts — know which one each post is.
