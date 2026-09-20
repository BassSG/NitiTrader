# Balanced: main profile and forward paper trial

The main profile keeps its existing candidate rules and AI prompt. Score and net
R:R defaults remain 52 and 1.1; saved user settings are respected. New diagnostics
count the first failing stage per zone, with separate final AI/outcome details.

The revised rules are **shadow only**. They do not replace the main profile,
send Telegram trade notifications, call an additional model, or affect main stats.

## Revised rules

- If every available higher timeframe (H1/H4) opposes the side, require all three:
  a sweep and reclaim of that zone within the last three closed M15 bars;
  the last candle closes beyond the preceding candle's high/low in the intended
  direction; Stochastic K/D supports that direction. Mixed/unknown regimes are
  labeled, not silently considered aligned. With only H1 available, H1 determines
  the classification.
- Only when no opposing zone exists, try the nearest confirmed swing high/low in
  the profit direction. Confirmation requires three closed candles on each side.
  A swing breached since confirmation is excluded. All entry, stop, score and net
  R:R requirements still apply; never skip a closer opposing zone for a farther TP.
- The target is capped at the existing 2.2 gross R multiple and buffered using
  the same configured ATR allowance. `targetSource` identifies the reference;
  `targetReference` is not necessarily the final TP because of this cap.

## Comparison design

Each eligible analysis uses the same market snapshot for both rule sets. Both
trial arms select their rank-1 candidate deterministically, **without AI**; this
compares rules rather than rules plus different model decisions. Experiments only
start with fresh open-market data. One cohort per symbol can be active at a time;
the next starts only after both arms are terminal. Repeated analyses on the same
closed M15 snapshot do not create another cohort. A cohort can have only one arm
when the other rule set has no candidate. Every evaluation still stores the
candidate funnel in `NT_Runs`, including when a cohort cannot start.

Plans are stored in `NT_BalancedTrials`, with immutable prices/settings and Thai
timestamp cells. The existing five-minute monitor uses its normal paper rules,
including ambiguous intra-bar order and data-gap outcomes. Both arms share each
symbol's market fetch per monitoring run; a trial with no main active plan can
require additional FMP monitoring calls. The AI cost of trial selection is zero.
Existing `monitorPlans` triggers must be installed for automatic outcome tracking.

Counts, resolved wins/losses, net R and ambiguous outcomes are shown separately
from the main AI-selected paper stats. Show paired-resolved and one-arm cohorts;
do not interpret differing raw totals as proof of superiority. This is a forward
test beginning after deployment, not a historical backtest. Changing settings
affects later cohorts; each plan stores its settings for later segmented analysis.

## Verification

`npm run test:core` covers reversal gates, swing confirmation and invalidation,
opposing-zone priority, funnel accounting, baseline candidate equivalence on
deterministic OHLC fixtures, cohort deduplication and validation-before-persistence.
Tests use synthetic data; they do not establish profitability or signal frequency.
