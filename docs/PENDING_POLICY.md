# Pending policy v1 / runtime 1.6.6

Only newly created primary plans carry a frozen pendingPolicy. Existing and
shadow-trial plans retain their prior rules. Closed historical rows are not rewritten.

The existing five-minute GAS monitor replays closed 5m bars chronologically.
Before cancelling, it checks data continuity, activation and expiry, then possible
Entry touches. A bar touching Entry never becomes CANCELLED by the new policy:
the existing fill / SL / TP / ambiguity rules take precedence.

For untouched Pending plans:
- Cancel when TP was reached before Entry.
- Cancel when the close is away from Entry in the profitable direction by more
  than max(3.5 * M15 ATR at creation, initial quote distance + that ATR), on two
  consecutive closed 5m bars. Threshold is frozen and does not move with prices.

Cancellation records closedAt and cancelReason, produces an NT_Events row and
Telegram Paper notification, and is excluded from win/loss statistics. The
next scheduled/manual analysis can seek a new plan; cancellation does not
immediately issue a paid AI request.

There is no separate automatic trend-flip cancellation. A zone/SL breach on a
bar that also touched Entry must be evaluated as a possible fill, not erased as
a cancellation. No broker order is placed, changed or cancelled.

Expiry-crossing bars are EXPIRED only when the entire bar cannot have touched
Entry; an Entry touch remains AMBIGUOUS. Gaps remain AMBIGUOUS.

AI request output budget is 8192 tokens with supported low reasoning effort and
short visible JSON instructions. This mitigates budget exhaustion, not a
guarantee of provider success. No paid automatic retry; existing daily spend
guard and actual-cost ledger remain. Higher maximum output can increase per-call
cost; the existing daily budget is checked before calls and can overshoot by one.
