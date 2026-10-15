"""Full-size #118 controls. Writes evidence JSON; takes several minutes.

    python scripts/run_controls.py evidence/controls.json
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from synthnull import controls  # noqa: E402
from synthnull.harness import _commit  # noqa: E402

N_TICKS = 5000


def main(out: str) -> None:
    t0 = time.time()
    record = {
        "code_commit": _commit(),
        "negative_control": controls.negative_control(runs=200, n_ticks=N_TICKS, n_null=199, seed=2026),
        "positive_control": controls.positive_control(
            phis=(0.0, 0.1, 0.2, 0.3, 0.5, 0.65, 0.8), runs=100, n_ticks=N_TICKS, n_null=99, seed=2026
        ),
        "spike_structure_control": controls.spike_structure_control(n_ticks=50_000, n_null=499, seed=2026),
    }
    record["elapsed_s"] = round(time.time() - t0, 1)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(record, indent=2, default=str))
    print(json.dumps(record, indent=2, default=str))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "evidence/controls.json")
