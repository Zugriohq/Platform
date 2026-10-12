# TTI exit study (research, `UNVALIDATED_RESEARCH`)

**Owner report (2026-10-12) on TTI 4.2:** the signals are mostly right, but trades often go to +0.9–1R and then come back to the stop. This folder holds the measurement that tests the report and finds the exit that keeps the profit. It measures only. It changes no signal, level or outcome in TTI.

## What the TTI 4.2 code does at the exit

These findings come from reading the code.

1. **Target 1 sits on a liquidity level.**
   - **Where it comes from:** `computeTargets` takes the nearest previous-day, weekly or monthly high (low for sells) that is at least 1R away, else 1.5R. Price often stalls at these levels, where resting orders sit. With a 1R floor, the level is often just past 1R. That matches a trade turning at 0.9–1R.
   - **Only Target 1 is traded:** `lvls.target` is t1, and targets 2 and 3 are never used.
2. **Nothing protects open profit.** The trade ends only at the target, the stop or the 2-hour timeout. There is no break-even, partial exit or trail.
   - The EA's protection starts later than the turn: break-even at 1.0R, trailing from 1.5R. A trade that turns at 0.9R gets no protection there either.
3. **The app's own record checks the price every 30 seconds** (`scheduleOutcome`). A target touched and left between two checks is not counted as a win, so the app's win/loss record cannot be used to judge exits.
4. **R in the plan is measured from the zone's ideal entry.** The stop distance is taken from the price at the signal, but the targets are set from the zone's ideal entry. The R shown on the signal is therefore not the R of a trade entered at the signal.

## The measurement (`study.js`)

For each fired signal, the study does the following:

- It copies the levels the first time it sees the signal, because TTI keeps only its last 100 signals.
- After 2 hours, it fetches Deriv's ticks for that window over its own connection.
- It enters at the market price at the signal time.
- It replays six exit plans tick by tick on the same entry, stop and target:

| Plan | Exit rule |
|---|---|
| A | As now: the app's target 1 and stop |
| B | Fixed target at 0.8R |
| C | Target 15% in front of the level |
| D | Break-even (+0.05R) once at 0.7R, then the app's target |
| E | Half off at 0.8R, the rest at break-even, then the app's target |
| F | From 0.8R, trail 0.5R behind the best price, with the app's target |

**Fill rules:**
- A stop fills at the first tick at or beyond it, so gaps cost more than 1R.
- A target fills at the target.

**Summary output:**
- the share of signals that reach 0.5R, 0.8R, 1.0R and the target before the stop;
- how many losers had been at +0.5R or +0.8R first;
- the app's record against the tick replay;
- each plan's win rate, average R and t;
- each plan's paired difference against A.

**Backfilled rows:** a signal seen more than 3 minutes after it fired may carry levels refreshed by a later repeat signal (TTI updates a pending signal in place). If its stored price is more than 0.3R from the signal-time price, it is left out.

**Costs:** every plan pays the spread once per trade, so the paired comparison does not depend on it. The R figures are before spread.

**Checks:**
- `node test.mjs`: the replay arithmetic on known paths.
- A headless Chromium run on a fake Deriv feed: no page errors.

**Build:** `python3 build.py <tti.html> <out.html>`. The TTI build itself is not in the repository.

## Decision rule (registered before any result)

- **Design set:** signals from before the study was installed (backfill). The best plan is chosen here, and only one.
- **Test set:** signals after installation. The chosen plan is confirmed here.
- **Adoption:** the plan replaces A in TTI and is proposed for the EA's open-profit settings only if, on at least 100 test signals:
  - its paired improvement over A has t ≥ 2; and
  - its own average R is above zero.
- **Otherwise A stays.** The remedy is then the entry, not the exit.
