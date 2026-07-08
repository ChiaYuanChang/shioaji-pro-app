#!/usr/bin/env python
"""Regenerate the BT-API-003 e2e fixtures and goldens (manual, diff-reviewed).

Rebuilds, deterministically from the seeds in
the sibling Alpha Workbench ``backend/tests/fixtures/e2e/builders.py``:

- ``backend/tests/fixtures/e2e/recorded/*.json``  (recorded sidecar series)
- ``backend/tests/fixtures/e2e/cache/**``         (pre-seeded parquet cache)
- ``backend/tests/fixtures/e2e/golden/*.json``    (golden RunResult payloads)

The golden runs go through the real HTTP endpoints (TestClient) over the
seeded cache with a failing-stub sidecar — any cache miss aborts loudly, so
a regenerated golden is always a zero-HTTP warm-cache product. Re-running
this script without changing seeds/requests must produce **no diff**.

Run it from the Alpha Workbench ``backend/`` uv project:

    cd backend && uv run python ../shioaji-pro-app/scripts/gen-e2e-goldens.py
    git diff --stat tests/fixtures/e2e/

Never run automatically in CI or at test time (BT-API-003 Forbidden Side
Effects): regenerating goldens is an explicit human act plus diff review.
"""

import importlib.util
import shutil
import sys
from pathlib import Path

WORKBENCH_ROOT = Path(__file__).resolve().parents[2]
BUILDERS_PATH = WORKBENCH_ROOT / "backend" / "tests" / "fixtures" / "e2e" / "builders.py"


def load_builders():
    spec = importlib.util.spec_from_file_location("bt_e2e_builders", BUILDERS_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["bt_e2e_builders"] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    bld = load_builders()

    # 1. Wipe + rebuild the seeded artifacts (deterministic from the seeds).
    for directory in (bld.CACHE_DIR, bld.RECORDED_DIR, bld.GOLDEN_DIR):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True)

    datasets = (
        ("2330", bld.gen_2330(), bld.GOLDEN_2330_DAYS),
        (bld.CONTRACT_TXF["code"], bld.gen_txf(), bld.GOLDEN_TXF_DAYS),
    )
    for code, series, days in datasets:
        bld.seed_cache(bld.CACHE_DIR, code, series, days[0], days[-1])
        bld.write_recorded(bld.RECORDED_DIR / f"{code}.json", code, series)
        print(f"seeded {code}: {len(series)} 1m bars, days {days[0]}..{days[-1]}")

    # 2. Drive the golden matrix through the real endpoints, warm-cache only.
    client, stub = bld.make_seeded_app(bld.CACHE_DIR)
    with client:
        for case in bld.GOLDEN_CASES:
            endpoint, body = bld.request_body(case)
            response = client.post(endpoint, json=body)
            if response.status_code != 200:
                print(
                    f"FATAL {case['name']}: HTTP {response.status_code} {response.text}"
                )
                return 1
            payload = response.json()
            if payload["status"] != "done":
                print(
                    f"FATAL {case['name']}: status={payload['status']} "
                    f"error={payload.get('error')} message={payload.get('message')}"
                )
                return 1
            payload.pop("run_id")  # per-request uuid4: not part of the pinned result
            if case["kind"] == "single" and not payload["markers"]:
                # A markerless golden would make its landing assertion vacuous.
                print(f"FATAL {case['name']}: produced no markers; tune seeds/params")
                return 1
            bld.golden_path(case["name"]).write_text(
                bld.canonical_json(payload), encoding="utf-8"
            )
            if case["kind"] == "single":
                detail = (
                    f"markers={len(payload['markers'])} "
                    f"trades={len(payload['trades'])} "
                    f"bars={len(payload['equity_curve'])}"
                )
            else:
                detail = (
                    f"rows={len(payload['per_instrument'])} "
                    f"curve={len(payload['merged_equity_curve'])} "
                    f"partial={payload['partial']}"
                )
            print(f"golden {case['name']}: {detail}")
    if stub.calls_issued != 0:
        print(f"FATAL: stub sidecar was contacted {stub.calls_issued} time(s)")
        return 1
    print(f"done: {len(bld.GOLDEN_CASES)} goldens under {bld.GOLDEN_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
