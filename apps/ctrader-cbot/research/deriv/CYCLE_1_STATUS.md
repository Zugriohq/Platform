# Cycle 1: status against the owner's protocol (2026-10-14)

`CYCLE_1_PROTOCOL.md` is the owner's research plan (v2.0, after an outside review). This file records, experiment by experiment:
- what has already been run;
- what is registered;
- where the plan needed a correction before it could run.

## Experiment by experiment

| Plan item | Status | Evidence | Next |
|---|---|---|---|
| **A. Range Break boundary events** | **Registered at tick level** (`cycle1_rangebreak_prereg.json`). The design day is running | The pre-registered M1 fades and breaks failed even gross (`FAMILIES.md`): ranges seen on one-minute bars are not the generator's ranges. Ticks show the real structure. Ticks move exactly ±1 point once a second, between **exact reflecting walls** (RB100 floor 51506 turned up 104 times out of 104). A break is a single jump to a new range | Holdout: fresh feed days, plus Market Lab `RB` on the owner's bid/ask ticks |
| **B. Drift Switch regime observability** | Strategy-level result exists. Diagnostics B1 are partial | The causal momentum detector (lookback a quarter or half of the declared regime, threshold 1σ√L) gains +0.5 to +1.3R gross on 90 days. It holds in an independent 69-day window and tick by tick with 0–5 s delays (`FAMILIES.md`, `dsi*_tick_check.txt`). Net depends on the account's spread: it passes at Deriv's min spread and fails at its target spread | Market Lab `DSI` on the owner's ticks decides it. Regime-duration and false-switch diagnostics are useful but do not decide it |
| **C. Trek** | **Registered** (`cycle1_trek_volswitch_prereg.json`). Not run | Not on Deriv's public feed. Deriv's specs list Trek Up (spread 1.05) and Trek Down (0.72). The plan says Trek is demo-only; that is not verified here | Market Lab `TREK` |
| **D. Volatility Switch** | **Registered**. Not run | Not on the feed. Deriv lists VolSwitch Low / Medium / High | Market Lab `VSW` |
| **E. M15/H1 large-move reversal** | H1 done; M15 not done | Event-study amendment 1 (`research/tti/events_results_h1.txt`): fade +0.22R / +0.17R gross on n 62 / 45. The sample is too small to call | Low priority, as in the plan |

## Corrections to the plan before running it

1. **Drift Switch thresholds θ = 0.1–0.5% per minute are mis-scaled.**
   - A typical one-minute move on DSI 10 is about 0.6 points on a price near 3,100, i.e. **0.02%**. θ = 0.1% is about 5σ and would rarely fire.
   - Detector thresholds should be in units of the index's own one-minute σ, as the registered detector does.
2. **A 30-day tick logger is not needed.**
   - Deriv's public feed (`api.derivws.com`) serves 90+ days of M1 bars and about 24 hours of ticks for Range Break, Drift Switch, DEX, Step, Jump, Boom/Crash and Volatility.
   - cTrader serves days of bid/ask tick history to a cBot. Market Lab loaded 600,000 Crash 150 ticks for 7 days.
   - Fresh feed days serve as forward holdouts.
3. **The Range Break boundary definition should follow the generator.**
   - The plan's rolling N-tick max/min with δ/ε tolerances is weaker than the structure the ticks show: exact walls, ±1-point steps, single-jump breaks.
   - The registration uses the exact-wall definition (causal: the segment's extreme once visited 3 times). That also removes the δ/ε grid from the multiple-testing count.
4. **Holdouts must be forward.**
   - The 90 days already downloaded have been inspected, so new Cycle 1 hypotheses use them as design only.
   - The holdout is data from later days and the owner's own ticks.
5. **Synthetic spreads.** Deriv publishes a "min spread" and a "target spread %" that differ by about 11× on Drift Switch. Results are reported at both, and the account's own bid/ask decides.

## What needs the owner

One Market Lab run on demo, with default settings. It places no orders. It runs in turn:
- `DSI` on Drift Switch 10 / 20 / 30;
- `RB` on Range Break 100 / 200;
- `TREK` on Trek Up / Down;
- `VSW` on VolSwitch Low / Medium / High;
- the bar study on Trek, Skew Step, Multi Step and Volatility Switch.

Send the `LAB DSI`, `LAB RB`, `LAB TREK`, `LAB VSW` and `LAB STUDY` lines.
