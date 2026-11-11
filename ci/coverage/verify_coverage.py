#!/usr/bin/env python3
"""Check per-file unit coverage of the logic tier against vitest's istanbul JSON.

The TypeScript adapter of sia's `scripts/coverage-gate/verify_unit_coverage.py`
(OHLA CI gate v0.3 §3 G4), for the same scope sia's workbench uses: lib/, i18n/,
the route handlers, the server actions and proxy.ts (vitest.config.mts,
`coverage.include`). Pages, layouts and components are not line-measured; the
hermetic Playwright e2e (ci/e2e.sh) drives them through a real browser.

The unit is the file, on four metrics: statements, lines, functions, branches.

- A file outside `exclusions.json` must be at 100% on every metric. Every
  exclusion carries a written reason.
- `baseline.json` records the files below 100% when the floor was recorded. A
  listed file may not gain a missed unit on any metric, and its entry is deleted
  once it reaches 100% (the check fails until it is). A file not listed, new or
  renamed, is held at 100%.
- Every changed line (since the base commit) that starts a statement must
  execute, every function declared on one must run, and every branch starting on
  one must take each of its arms. Deleting old misses cannot pay for new
  untested code.
- The coverage providers' ignore comments (`v8 ignore`, `c8 ignore`, `istanbul
  ignore`) are rejected anywhere in the measured code.

Usage:
  verify_coverage.py --profile coverage-final.json --root <tree> [--profile-root /app]
      --base <sha> --repo <git dir> [--summary out.json]
  verify_coverage.py --profile coverage-final.json --root <tree> --record
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
METRICS = ("statements", "lines", "functions", "branches")
IGNORE_MARKER = re.compile(r"(v8|c8|istanbul)\s+ignore")


@dataclass(frozen=True)
class Count:
    covered: int
    total: int

    @property
    def missed(self) -> int:
        return self.total - self.covered


def file_counts(entry: dict) -> dict[str, Count]:
    s, f, b = entry.get("s", {}), entry.get("f", {}), entry.get("b", {})
    lines: dict[int, bool] = {}
    for key, loc in entry.get("statementMap", {}).items():
        line = loc["start"]["line"]
        lines[line] = lines.get(line, False) or s.get(key, 0) > 0
    arms = [n for counts in b.values() for n in counts]
    return {
        "statements": Count(sum(1 for n in s.values() if n > 0), len(s)),
        "lines": Count(sum(1 for hit in lines.values() if hit), len(lines)),
        "functions": Count(sum(1 for n in f.values() if n > 0), len(f)),
        "branches": Count(sum(1 for n in arms if n > 0), len(arms)),
    }


def read_profile(path: Path, root: str) -> dict[str, dict]:
    """The profile keyed by path relative to `root`, the directory vitest ran in
    (inside the gate's container, so not necessarily a path on this machine)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    prefix = root.rstrip("/") + "/"
    out = {}
    for name, entry in raw.items():
        p = str(entry.get("path") or name)
        out[p[len(prefix) :] if p.startswith(prefix) else p] = entry
    return out


def load_exclusions(path: Path = HERE / "exclusions.json") -> list[dict]:
    if not path.exists():
        return []
    rows = json.loads(path.read_text(encoding="utf-8")).get("files", [])
    for row in rows:
        if not str(row.get("reason", "")).strip():
            raise ValueError(f"exclusion {row.get('pattern')!r} has no reason")
    return rows


def excluded(rel: str, exclusions: list[dict]) -> bool:
    return any(fnmatch.fnmatchcase(rel, row["pattern"]) for row in exclusions)


def load_baseline(path: Path) -> dict[str, dict[str, Count]]:
    if not path.exists():
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    return {
        f: {m: Count(int(v["covered"]), int(v["total"])) for m, v in metrics.items()}
        for f, metrics in doc.get("files", {}).items()
    }


def check_files(profile, baseline, exclusions) -> list[str]:
    out: list[str] = []
    seen = set()
    for rel in sorted(profile):
        if excluded(rel, exclusions):
            continue
        seen.add(rel)
        counts = file_counts(profile[rel])
        full = all(counts[m].missed == 0 for m in METRICS)
        entry = baseline.get(rel)
        if full:
            if entry is not None:
                out.append(f"{rel}: at 100%; delete its entry from baseline.json")
            continue
        short = ", ".join(
            f"{m} {counts[m].covered}/{counts[m].total}"
            for m in METRICS
            if counts[m].missed
        )
        if entry is None:
            out.append(
                f"{rel}: below 100% ({short}) and not in baseline.json; a new or renamed file lands fully covered"
            )
            continue
        for m in METRICS:
            now, was = counts[m], entry.get(m)
            if was is None:
                out.append(f"{rel}: {m} has no baseline entry")
            elif now.missed > was.missed:
                out.append(
                    f"{rel}: {m} missed rose {was.missed} -> {now.missed} (total {was.total} -> {now.total})"
                )
    for rel in sorted(set(baseline) - seen):
        out.append(f"{rel}: in baseline.json but not measured; delete its entry")
    return out


HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def changed_lines(repo: Path, base: str, rel: str) -> set[int]:
    diff = subprocess.run(
        ["git", "-C", str(repo), "diff", "-U0", "--no-renames", base, "HEAD", "--", rel],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    lines: set[int] = set()
    for line in diff.splitlines():
        m = HUNK.match(line)
        if m:
            start, count = int(m.group(1)), int(m.group(2) or "1")
            lines.update(range(start, start + count))
    return lines


def check_changes(profile, exclusions, repo: Path, base: str) -> list[str]:
    out: list[str] = []
    for rel in sorted(profile):
        if excluded(rel, exclusions):
            continue
        changed = changed_lines(repo, base, rel)
        if not changed:
            continue
        e = profile[rel]
        for key, loc in e.get("statementMap", {}).items():
            line = loc["start"]["line"]
            if line in changed and e["s"].get(key, 0) == 0:
                out.append(f"{rel}:{line}: changed statement never executed")
        for key, fn in e.get("fnMap", {}).items():
            line = (fn.get("decl") or fn["loc"])["start"]["line"]
            if line in changed and e["f"].get(key, 0) == 0:
                out.append(f"{rel}:{line}: changed function `{fn.get('name')}` never ran")
        for key, br in e.get("branchMap", {}).items():
            line = br["loc"]["start"]["line"]
            arms = e["b"].get(key, [])
            if line in changed and any(n == 0 for n in arms):
                out.append(
                    f"{rel}:{line}: changed {br.get('type', 'branch')} takes {sum(1 for n in arms if n)}/{len(arms)} arms"
                )
    return out


def find_markers(profile, exclusions, root: Path) -> list[str]:
    out = []
    for rel in sorted(profile):
        if excluded(rel, exclusions):
            continue
        text = (root / rel).read_text(encoding="utf-8", errors="replace")
        for i, line in enumerate(text.splitlines(), 1):
            if IGNORE_MARKER.search(line):
                out.append(
                    f"{rel}:{i}: coverage ignore comment; delete the unreachable code, or name the file in exclusions.json with a reason"
                )
    return out


def record(profile, exclusions, path: Path, commit: str | None) -> int:
    files = {}
    for rel in sorted(profile):
        if excluded(rel, exclusions):
            continue
        counts = file_counts(profile[rel])
        if all(counts[m].missed == 0 for m in METRICS):
            continue
        files[rel] = {
            m: {"covered": counts[m].covered, "total": counts[m].total}
            for m in METRICS
        }
    doc = {
        "_why": [
            "Files below 100% when the floor was recorded, with covered and total counts per metric.",
            "Not an exemption: an entry may not gain a missed unit, and is deleted when its file",
            "reaches 100%. A file not listed here is held at 100% from its first commit.",
        ],
        "_recorded_at": {"commit": commit},
        "files": files,
    }
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return len(files)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--profile", required=True, type=Path)
    ap.add_argument("--root", required=True, type=Path, help="the tree on this machine")
    ap.add_argument(
        "--profile-root", help="the tree's path where vitest ran (default: --root)"
    )
    ap.add_argument("--base", help="the base commit for the changed-line check")
    ap.add_argument("--repo", type=Path, help="the git checkout (for the diff)")
    ap.add_argument("--baseline", type=Path, default=HERE / "baseline.json")
    ap.add_argument("--summary", type=Path)
    ap.add_argument("--record", action="store_true")
    ap.add_argument("--commit", help="with --record: the commit measured")
    args = ap.parse_args(argv)

    exclusions = load_exclusions()
    profile = read_profile(args.profile, args.profile_root or str(args.root))
    if args.record:
        n = record(profile, exclusions, args.baseline, args.commit)
        print(f"coverage: recorded {n} file(s) below 100% into {args.baseline.name}")
        return 0

    baseline = load_baseline(args.baseline)
    violations = find_markers(profile, exclusions, args.root)
    violations += check_files(profile, baseline, exclusions)
    if args.base:
        violations += check_changes(profile, exclusions, args.repo or args.root, args.base)
    measured = [f for f in profile if not excluded(f, exclusions)]
    full = [
        f
        for f in measured
        if all(c.missed == 0 for c in file_counts(profile[f]).values())
    ]
    if args.summary:
        args.summary.write_text(
            json.dumps(
                {
                    "files": len(measured),
                    "at_100": len(full),
                    "baselined": len(baseline),
                    "violations": len(violations),
                }
            )
            + "\n",
            encoding="utf-8",
        )
    print(
        f"coverage: {len(measured)} file(s), {len(full)} at 100%, {len(baseline)} baselined"
    )
    if not violations:
        print("coverage: ok")
        return 0
    print(f"coverage: {len(violations)} violation(s)", file=sys.stderr)
    for v in violations:
        print(f"  {v}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
