#!/usr/bin/env python3
"""Fail when a vitest run skipped anything (OHLA CI gate v0.3, A8: no skips).

Reads vitest's JSON reporter output. A skipped, pending or todo test, or a run
with no tests at all, is red: a test that cannot pass is fixed or deleted with the
reason in the commit message, never skipped.

  no_skips.py <vitest.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def problems(report: dict) -> list[str]:
    out = []
    total = 0
    for suite in report.get("testResults", []):
        for test in suite.get("assertionResults", []):
            total += 1
            if test.get("status") in ("skipped", "pending", "todo", "disabled"):
                out.append(f"{suite.get('name')}: {test.get('fullName')} is {test['status']}")
    if total == 0:
        out.append("no tests ran")
    return out


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: no_skips.py <vitest.json>", file=sys.stderr)
        return 2
    try:
        report = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"no-skips: cannot read the vitest report: {error}", file=sys.stderr)
        return 1
    found = problems(report)
    for line in found:
        print(f"no-skips: {line}", file=sys.stderr)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
