"""Run the predeclared protocol on one instrument export.

    python scripts/run_family.py predeclaration.json data/BOOM1000.csv "Boom 1000 Index" boom \
        evidence/BOOM1000.json [--documented event_prob=0.001]

The first run that reaches the test window locks the predeclaration (see synthnull/predeclare.py).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from synthnull.data import load_any  # noqa: E402
from synthnull.harness import run_family  # noqa: E402
from synthnull.nulls import FAMILIES  # noqa: E402
from synthnull.predeclare import Predeclaration  # noqa: E402


def main(argv: list[str]) -> None:
    documented = {}
    if "--documented" in argv:
        i = argv.index("--documented")
        for kv in argv[i + 1 :]:
            k, v = kv.split("=", 1)
            documented[k] = float(v)
        argv = argv[:i]
    if len(argv) != 5:
        sys.exit(__doc__)
    pre_path, data_path, symbol, family, out = argv
    if family not in FAMILIES:
        sys.exit(f"family must be one of {FAMILIES}")
    record = run_family(load_any(data_path, symbol), family, Predeclaration.load(pre_path), documented or None)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(record, indent=2, default=str))
    print(f"{symbol}: {record['outcome']}  confirmed={record['confirmed_edges']}")


if __name__ == "__main__":
    main(sys.argv[1:])
