# ⚽ WK Pool Predictor

A personal web app that gives **match-by-match advice with clear reasoning** to help you fill in
your Scorito World Cup pool. The explanation matters more than the looks: for every match you get a
recommended exact score, safe and aggressive alternatives, win/draw/loss probabilities, expected
goals, confidence and risk levels, and a written explanation of *why*.

> **Personal use only.** This app does **not** connect to, scrape, log in to, or submit anything to
> Scorito. It helps you decide what to type into Scorito yourself.

---

## Features

- **Dashboard** — upcoming matches, prediction completeness, high-risk matches, incomplete-data flags.
- **Teams** — editable table of all teams with the inputs the model uses; per-team detail page with
  source URLs and last-updated dates.
- **Matches** — list with prediction status; add/edit matches; a prediction is generated on save.
- **Match advice** — recommended / safe / aggressive scores, 1X2 probability bar, expected goals,
  confidence & risk, a full written explanation, an input-factor breakdown table, a data-quality
  warning, and a **manual override** for every prediction.
- **Settings** — prediction mode, all seven model weights, and configurable Scorito scoring rules.
- **Export** — download every prediction as CSV.

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Prisma** + **SQLite** for a lightweight local database (file: `prisma/dev.db`)
- **Vitest** for the prediction-model unit tests

The prediction model lives in `src/lib/model.ts` as a set of pure, documented functions so it can be
tested and reasoned about independently of the database and UI.

---

## Setup

Requires Node.js 20+.

```bash
# 1. Install dependencies
npm install

# 2. Generate the Prisma client, create the SQLite DB, and load seed data
npm run setup        # = prisma generate && prisma db push && tsx prisma/seed.ts

# 3. Start the app
npm run dev          # http://localhost:3000
```

Other useful scripts:

```bash
npm run build        # production build (also runs prisma generate)
npm start            # run the production build
npm test             # run the model unit tests
npm run db:seed      # re-load seed data
npm run db:reset     # wipe + recreate + reseed the database
```

The SQLite file (`prisma/dev.db`) is git-ignored. Run `npm run setup` once after cloning.

---

## How the prediction model works

The model is **transparent and rule-based — not a black box**. Every step is a simple, documented
transformation, which is what makes the written explanation trustworthy. The full implementation is
in [`src/lib/model.ts`](src/lib/model.ts).

### 1. Normalise inputs to a 0–100 scale
- **FIFA**: points are mapped from a typical 1000–1900 range onto 0–100 (rank is used as a fallback).
- **Recent form, attack, defence, World Cup experience** are already entered on a 0–100 scale.

### 2. Combine into a base team rating
A **weighted average** of the five core metrics, using the configurable weights. If a metric is
missing it is simply left out of the average (it doesn't drag the team to zero — it lowers
confidence instead). Defaults:

| Factor | Weight |
| --- | --- |
| FIFA ranking | 25% |
| Recent form | 25% |
| Attack strength | 20% |
| Defence strength | 15% |
| World Cup history | 10% |
| Home advantage | 3% |
| Manual adjustment | 2% |

### 3. Apply context adjustments
- **Home advantage**: a rating bonus added to the home team when the match is flagged as a home game.
- **Manual adjustment** (−2…+2 per team): a small additive nudge for things the data misses
  (injuries, motivation, etc.).

### 4. Convert to expected goals
- The **rating difference** becomes a goal *supremacy* (how many more goals the favourite is expected
  to score): `supremacy = ratingDiff × 0.028`.
- The **combined attack and defence levels** set the *total* expected goals: more attack ⇒ more goals,
  more defence ⇒ fewer, around a 2.6-goal baseline.
- These give `xG_home` and `xG_away` (clamped to realistic bounds).

### 5. Build a Poisson score matrix
Goals for each team are modelled as **independent Poisson** distributions. The probability of every
scoreline from 0–0 up to 6–6 is computed, then summed into **home-win / draw / away-win**
probabilities.

### 6. Pick the scorelines
Recommendations are restricted to **realistic football scores**
(0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1, 1-2, 3-1, 1-3, 2-2); bigger scorelines are only allowed when the
strength gap is large. Three picks are produced:

- **Safe** — back the single most likely outcome with its most probable scoreline.
- **Balanced** — the scoreline with the highest **expected Scorito points**, using your configured
  scoring rules (exact-score points + correct-outcome/toto points). This balances a likely outcome
  with exact-score upside.
- **Aggressive** — chase the exact-score "jackpot" from a wider pool of scorelines for maximum pool
  upside; less likely but higher-reward, useful when you're behind in the pool.

The active **prediction mode** (Settings) decides which of these becomes the headline recommendation.

### Confidence, risk and data quality
- **Confidence** comes from how dominant the leading outcome is (>55% High, >42% Medium, else Low).
- **Risk** combines confidence with data completeness.
- **Data quality** counts how many required inputs are present for both teams and surfaces explicit
  warnings; the explanation never pretends to be certain.

---

## Data & sourcing

Per the brief, the seed data is **researched from public information rather than entered by hand**:

- **FIFA rank & points**: a snapshot of the FIFA/Coca-Cola Men's World Ranking (April 2026 edition),
  anchored on the published top of the table (France 1877.32, Spain 1876.40, Argentina 1874.81, …).
  Source URL and date are stored per team and shown on the team detail page.
- **Recent form, attack/defence and World Cup-history scores**: analyst-style estimates derived from
  public results and reputation as of the snapshot date.

Most public ranking sites block automated fetching, so values are a point-in-time snapshot baked into
the seed. **Everything is fully editable in the app** — update any number, change the source URL, or
add new teams/matches, and predictions regenerate automatically. The team table and dashboard flag
any missing inputs so you can see at a glance where the data is thin.

---

## Limitations

- **It's a model, not a crystal ball.** Football is high-variance; a single match has huge
  randomness that no rating system removes. Treat every exact score as a guess with the odds nudged
  in your favour, not a certainty.
- **Inputs drive everything.** Garbage in, garbage out — if FIFA points or form scores are stale or
  wrong, the advice will be too. Keep the data current and watch the data-quality warnings.
- **Independent-Poisson assumption.** Goals are modelled as independent; in reality scorelines are
  correlated (game state, red cards, parking the bus). Low-scoring draws can be slightly
  under-weighted.
- **Subjective strength scores.** Attack/defence/form/WC-experience numbers are judgement calls, not
  measured xG feeds. They're a reasonable starting point, not ground truth.
- **No live data.** The app deliberately does not scrape or call live feeds; you refresh the numbers
  manually (by design — it keeps the tool transparent and self-contained).
- **Generic example fixtures.** Seed matches are illustrative, not the official 2026 schedule. Add or
  edit matches to match the real draw.
- **Scoring rules are an approximation.** Set the exact-score / toto / goal-difference points in
  Settings to mirror your specific pool before trusting the "balanced" expected-points pick.

---

## Project structure

```
prisma/
  schema.prisma      # Team, Match, Prediction, Settings models (SQLite)
  seed.ts            # researched seed data + pre-generated predictions
src/
  lib/
    model.ts         # the transparent prediction engine (pure functions)
    model.test.ts    # Vitest unit tests for the model
    types.ts         # shared model types
    data.ts          # prediction generation + settings helpers (server)
    defaults.ts      # default weights / scoring / mode
    csv.ts           # CSV serialisation
    prisma.ts        # Prisma client singleton
  components/        # UI building blocks, team/match forms, explanation renderer
  app/
    page.tsx         # Dashboard
    teams/           # list, new, [id] edit/detail
    matches/         # list, new, [id] advice + [id]/edit
    settings/        # mode, weights, scoring rules
    export/          # CSV download page
    api/export/      # CSV endpoint
    actions.ts       # server actions (all mutations)
```
