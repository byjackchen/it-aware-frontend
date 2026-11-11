#!/usr/bin/env python3
"""Write a gate report in schema ohla-gate-report/1 (OHLA CI gate v0.3 §5b).

Called by ci/gate.sh (kind static, written to .gate/static-report.json) and by
ci/e2e.sh (kind converged: the e2e results with the static report embedded under
`static`). It records results, never environment values: the inputs are the stage
table, the coverage summary and the tool versions collected, plus git facts passed
as arguments. On a green converged run the same JSON is the body of the single
converged/<UTC timestamp> tag that the dev pipelines check (ci/check-tags.sh).

A converged report also carries `convergence`: how long this round took
(`duration_s`, split into `static_duration_s` and `e2e_duration_s`) and `rounds`,
how many convergence rounds (ci/e2e.sh runs, green or red) it took since the
current feature branch began, this one included. Every converged run is appended
to a local log (.gate/convergence-log.jsonl); a round counts if it ran on a commit
in `<base>..<commit>`, where base is the merge-base with origin/development. So a
rebase (new SHAs) or a different machine starts the count again.

`report.py --check-static <file> --commit <sha>` exits 0 only if the file is a
green static report for that commit; ci/e2e.sh runs it before anything else.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def read_tsv(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    return [
        line.split("\t")
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def static_problem(report: dict | None, commit: str) -> str | None:
    """Why `report` is not a green static report for `commit`, or None if it is."""
    if not isinstance(report, dict):
        return "no static report (run ci/gate.sh first)"
    if report.get("schema") != "ohla-gate-report/1" or report.get("kind") != "static":
        return "not a static gate report"
    if report.get("commit") != commit:
        return (
            f"static report is for {str(report.get('commit'))[:12]}, not {commit[:12]}"
        )
    if report.get("tree_clean") is not True:
        return "static report is from a dirty tree"
    if report.get("verdict") != "green":
        return "static report is not green"
    return None


def rounds_before(log: Path | None, repo_dir: Path, base: str, commit: str) -> int:
    """Logged convergence rounds that ran on a commit in base..commit (or on commit)."""
    if not log or not log.exists():
        return 0
    got = subprocess.run(
        ["git", "-C", str(repo_dir), "rev-list", f"{base}..{commit}"],
        capture_output=True,
        text=True,
    )
    in_range = set(got.stdout.split()) | {commit}
    count = 0
    for line in log.read_text(encoding="utf-8").splitlines():
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if isinstance(entry, dict) and entry.get("commit") in in_range:
            count += 1
    return count


def build(args) -> dict:
    stages = [
        {"name": name, "status": status, "duration_s": float(seconds)}
        for name, status, seconds in read_tsv(args.stages)
    ]
    tools = {name: version for name, version in read_tsv(args.tools)}
    coverage = None
    if args.coverage and args.coverage.exists():
        coverage = json.loads(args.coverage.read_text(encoding="utf-8"))
    tree_clean = args.tree_clean == "1"
    e2e = None
    static = None
    if args.kind == "converged":
        static = (
            json.loads(args.static.read_text(encoding="utf-8"))
            if args.static and args.static.exists()
            else None
        )
    if args.kind in ("e2e", "converged"):
        e2e = (
            json.loads(args.e2e.read_text(encoding="utf-8"))
            if args.e2e and args.e2e.exists()
            else None
        )
    green = tree_clean and all(s["status"] != "fail" for s in stages)
    if args.kind in ("e2e", "converged"):
        green = green and bool(e2e) and e2e.get("converged") is True
    if args.kind == "converged":
        green = green and static_problem(static, args.commit) is None
    convergence = None
    if args.kind == "converged":
        static_s = float((static or {}).get("duration_s") or 0)
        e2e_s = float(args.duration)
        convergence = {
            "duration_s": round(static_s + e2e_s, 1),
            "static_duration_s": round(static_s, 1),
            "e2e_duration_s": round(e2e_s, 1),
            "rounds": rounds_before(
                args.rounds_log, args.repo_dir, args.base, args.commit
            )
            + 1,
            "since": args.base,
        }
    return {
        "schema": "ohla-gate-report/1",
        "repo": args.repo,
        "commit": args.commit,
        "branch": args.branch,
        "base": args.base,
        "tree_clean": tree_clean,
        "runner": {"user": args.user, "where": "local", "tools": tools},
        "kind": args.kind,
        "started": args.started,
        "finished": args.finished,
        "duration_s": float(args.duration),
        "stages": stages,
        "coverage": coverage,
        "e2e": e2e,
        "static": static,
        "convergence": convergence,
        "verdict": "green" if green else "red",
        "tag": args.tag if green else None,
    }


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:1] == ["--check-static"]:
        chk = argparse.ArgumentParser()
        chk.add_argument("--check-static", type=Path, required=True)
        chk.add_argument("--commit", required=True)
        got = chk.parse_args(argv)
        try:
            found = json.loads(got.check_static.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            found = None
        problem = static_problem(found, got.commit)
        if problem:
            print(f"static gate: {problem}", file=sys.stderr)
        return 0 if problem is None else 1
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    for name in (
        "repo",
        "commit",
        "branch",
        "base",
        "user",
        "started",
        "finished",
        "duration",
        "tag",
    ):
        ap.add_argument(f"--{name}", required=True)
    ap.add_argument("--tree-clean", required=True, choices=("0", "1"))
    ap.add_argument("--kind", choices=("static", "e2e", "converged"), default="static")
    ap.add_argument(
        "--e2e", type=Path, help="e2e results: run_id, unexpected, flaky, converged"
    )
    ap.add_argument(
        "--static", type=Path, help="the green static report to embed (kind converged)"
    )
    ap.add_argument(
        "--rounds-log",
        type=Path,
        help="local log of convergence runs (kind converged): read for the round count, appended to",
    )
    ap.add_argument("--repo-dir", type=Path, default=Path("."))
    ap.add_argument("--stages", required=True, type=Path)
    ap.add_argument("--tools", required=True, type=Path)
    ap.add_argument("--coverage", type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args(argv)
    report = build(args)
    if args.kind == "converged" and args.rounds_log:
        entry = {
            "started": args.started,
            "commit": args.commit,
            "branch": args.branch,
            "verdict": report["verdict"],
            "duration_s": report["convergence"]["duration_s"],
        }
        args.rounds_log.parent.mkdir(parents=True, exist_ok=True)
        with args.rounds_log.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0 if report["verdict"] == "green" else 1


if __name__ == "__main__":
    raise SystemExit(main())
