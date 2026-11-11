"""The gate's own tests (ci/gate.sh `gate-tests`): the coverage verifier, the
no-skips check, the report, and the deploy-time tag check end to end in a
throwaway repository with a bare `origin`, the way the dev pipeline runs it.
Standard library only: python3 -m unittest discover -s ci -t .
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from ci import no_skips, report
from ci.coverage import verify_coverage as vc

CI = Path(__file__).resolve().parent
GIT_ENV = {
    "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
    "GIT_AUTHOR_NAME": "t",
    "GIT_AUTHOR_EMAIL": "t@example.invalid",
    "GIT_COMMITTER_NAME": "t",
    "GIT_COMMITTER_EMAIL": "t@example.invalid",
    "HOME": "/nonexistent",
}


def git(cwd: Path, *args: str) -> str:
    out = subprocess.run(
        ["git", *args], cwd=cwd, env=GIT_ENV, capture_output=True, text=True
    )
    if out.returncode:
        raise AssertionError(out.stderr)
    return out.stdout.strip()


def entry(path: str, s: dict, f: dict | None = None, b: dict | None = None) -> dict:
    """An istanbul file entry: one statement per key, on the line named by the key."""
    return {
        "path": path,
        "statementMap": {
            k: {"start": {"line": int(k)}, "end": {"line": int(k)}} for k in s
        },
        "s": s,
        "fnMap": {
            k: {"name": f"fn{k}", "decl": {"start": {"line": int(k)}}, "loc": {}}
            for k in (f or {})
        },
        "f": f or {},
        "branchMap": {
            k: {"type": "if", "loc": {"start": {"line": int(k)}}} for k in (b or {})
        },
        "b": b or {},
    }


class CoverageFiles(unittest.TestCase):
    def counts(self, **kw):
        return vc.file_counts(entry("/app/x.ts", **kw))

    def test_counts(self):
        c = self.counts(s={"1": 1, "2": 0}, f={"1": 1}, b={"2": [1, 0]})
        self.assertEqual(c["statements"], vc.Count(1, 2))
        self.assertEqual(c["lines"], vc.Count(1, 2))
        self.assertEqual(c["functions"], vc.Count(1, 1))
        self.assertEqual(c["branches"], vc.Count(1, 2))

    def test_new_file_must_be_full(self):
        out = vc.check_files({"a.ts": entry("a.ts", s={"1": 0})}, {}, [])
        self.assertIn("not in baseline.json", out[0])

    def test_full_file_passes_and_its_baseline_entry_must_go(self):
        prof = {"a.ts": entry("a.ts", s={"1": 1})}
        self.assertEqual(vc.check_files(prof, {}, []), [])
        base = {"a.ts": {m: vc.Count(0, 1) for m in vc.METRICS}}
        self.assertIn("delete its entry", vc.check_files(prof, base, [])[0])

    def test_baselined_file_may_not_gain_a_miss(self):
        prof = {"a.ts": entry("a.ts", s={"1": 0, "2": 0})}
        base = {"a.ts": {m: vc.Count(0, 1) for m in vc.METRICS}}
        out = vc.check_files(prof, base, [])
        self.assertTrue(any("missed rose" in v for v in out), out)
        base = {"a.ts": {m: vc.Count(0, 2) for m in vc.METRICS}}
        base["a.ts"]["functions"] = vc.Count(0, 0)
        base["a.ts"]["branches"] = vc.Count(0, 0)
        self.assertEqual(vc.check_files(prof, base, []), [])

    def test_stale_baseline_entry_and_exclusions(self):
        base = {"gone.ts": {m: vc.Count(0, 1) for m in vc.METRICS}}
        self.assertIn("not measured", vc.check_files({}, base, [])[0])
        prof = {"gen/a.ts": entry("gen/a.ts", s={"1": 0})}
        rows = [{"pattern": "gen/*.ts", "reason": "generated"}]
        self.assertEqual(vc.check_files(prof, {}, rows), [])

    def test_exclusion_needs_a_reason(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.json"
            p.write_text(json.dumps({"files": [{"pattern": "a", "reason": " "}]}))
            with self.assertRaises(ValueError):
                vc.load_exclusions(p)

    def test_profile_paths_are_made_relative(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "c.json"
            p.write_text(json.dumps({"/app/lib/a.ts": entry("/app/lib/a.ts", s={})}))
            self.assertEqual(list(vc.read_profile(p, "/app")), ["lib/a.ts"])

    def test_ignore_comments_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "a.ts").write_text("const x = 1\n/* v8 ignore next */\n")
            out = vc.find_markers({"a.ts": {}}, [], root)
            self.assertEqual(len(out), 1)
            self.assertIn("a.ts:2", out[0])

    def test_record_writes_only_files_below_full(self):
        prof = {
            "a.ts": entry("a.ts", s={"1": 1}),
            "b.ts": entry("b.ts", s={"1": 0}),
        }
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "baseline.json"
            self.assertEqual(vc.record(prof, [], p, "abc"), 1)
            self.assertEqual(list(vc.load_baseline(p)), ["b.ts"])


class CoverageChanges(unittest.TestCase):
    def test_changed_lines_must_execute(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            git(repo, "init", "-q")
            (repo / "a.ts").write_text("one\ntwo\n")
            git(repo, "add", ".")
            git(repo, "commit", "-qm", "base")
            base = git(repo, "rev-parse", "HEAD")
            (repo / "a.ts").write_text("one\ntwo\nthree\nfour\n")
            git(repo, "commit", "-qam", "change")
            self.assertEqual(vc.changed_lines(repo, base, "a.ts"), {3, 4})
            prof = {
                "a.ts": entry(
                    "a.ts", s={"1": 0, "3": 1, "4": 0}, f={"3": 0}, b={"3": [1, 0]}
                )
            }
            out = vc.check_changes(prof, [], repo, base)
            self.assertEqual(len(out), 3, out)
            self.assertTrue(any("a.ts:4: changed statement" in v for v in out))
            self.assertTrue(any("never ran" in v for v in out))
            self.assertTrue(any("1/2 arms" in v for v in out))

    def test_main_checks_and_records(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "a.ts").write_text("x\n")
            prof = root / "c.json"
            prof.write_text(json.dumps({"/app/a.ts": entry("/app/a.ts", s={"1": 0})}))
            base = root / "baseline.json"
            args = ["--profile", str(prof), "--root", str(root), "--profile-root", "/app"]
            summary = root / "s.json"
            self.assertEqual(vc.main(args + ["--baseline", str(base), "--summary", str(summary)]), 1)
            self.assertEqual(vc.main(args + ["--baseline", str(base), "--record"]), 0)
            self.assertEqual(vc.main(args + ["--baseline", str(base)]), 0)
            self.assertEqual(json.loads(summary.read_text())["files"], 1)


class NoSkips(unittest.TestCase):
    def report(self, *statuses):
        return {
            "testResults": [
                {
                    "name": "a.test.ts",
                    "assertionResults": [
                        {"status": s, "fullName": f"t{i}"} for i, s in enumerate(statuses)
                    ],
                }
            ]
        }

    def test_passed_is_clean(self):
        self.assertEqual(no_skips.problems(self.report("passed", "passed")), [])

    def test_skips_and_todos_and_empty_runs_are_red(self):
        self.assertEqual(len(no_skips.problems(self.report("passed", "skipped", "todo"))), 2)
        self.assertEqual(no_skips.problems({"testResults": []}), ["no tests ran"])

    def test_main(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "r.json"
            p.write_text(json.dumps(self.report("passed")))
            self.assertEqual(no_skips.main([str(p)]), 0)
            self.assertEqual(no_skips.main([str(Path(d) / "missing.json")]), 1)
            self.assertEqual(no_skips.main([]), 2)


def static_report(sha: str, **over) -> dict:
    doc = {
        "schema": "ohla-gate-report/1",
        "kind": "static",
        "commit": sha,
        "tree_clean": True,
        "verdict": "green",
        "duration_s": 1.0,
    }
    doc.update(over)
    return doc


class TagCheck(unittest.TestCase):
    """ci/check-tags.sh against a bare origin, as the dev pipeline runs it."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.origin, self.work = root / "origin.git", root / "work"
        git(root, "init", "-q", "--bare", str(self.origin))
        git(root, "clone", "-q", str(self.origin), str(self.work))
        (self.work / "ci").mkdir()
        (self.work / "ci" / "check-tags.sh").write_text((CI / "check-tags.sh").read_text())
        git(self.work, "add", ".")
        git(self.work, "commit", "-qm", "one")
        self.sha = git(self.work, "rev-parse", "HEAD")

    def tearDown(self):
        self.tmp.cleanup()

    def tag(self, name: str, body: dict) -> None:
        msg = Path(self.tmp.name) / "msg.json"
        msg.write_text(json.dumps(body))
        git(self.work, "tag", "-a", name, "--cleanup=verbatim", "-F", str(msg), self.sha)
        git(self.work, "push", "-q", "origin", "HEAD", name)

    def run_check(self) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", "ci/check-tags.sh"], cwd=self.work, env=GIT_ENV, capture_output=True, text=True
        )

    def converged(self, **over) -> dict:
        doc = {
            "schema": "ohla-gate-report/1",
            "kind": "converged",
            "commit": self.sha,
            "tree_clean": True,
            "verdict": "green",
            "e2e": {"converged": True},
            "static": static_report(self.sha),
        }
        doc.update(over)
        return doc

    def test_untagged_commit_is_refused(self):
        out = self.run_check()
        self.assertEqual(out.returncode, 1)
        self.assertIn("DEPLOY REFUSED", out.stderr)

    def test_green_converged_tag_is_accepted(self):
        self.tag("converged/20260101T000000Z", self.converged())
        out = self.run_check()
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)

    def test_red_or_foreign_reports_are_refused(self):
        self.tag("converged/20260101T000000Z", self.converged(verdict="red"))
        self.tag("converged/20260101T000001Z", self.converged(e2e={"converged": False}))
        self.tag("converged/20260101T000002Z", self.converged(static=static_report("0" * 40)))
        self.assertEqual(self.run_check().returncode, 1)

    def test_lightweight_tag_is_refused(self):
        git(self.work, "tag", "converged/20260101T000000Z", self.sha)
        git(self.work, "push", "-q", "origin", "converged/20260101T000000Z")
        self.assertEqual(self.run_check().returncode, 1)

    def test_arguments_are_refused(self):
        out = subprocess.run(["bash", "ci/check-tags.sh", "x"], cwd=self.work, env=GIT_ENV, capture_output=True)
        self.assertEqual(out.returncode, 2)


class Report(unittest.TestCase):
    def test_static_check(self):
        self.assertIsNone(report.static_problem(static_report("a"), "a"))
        self.assertIn("not b", report.static_problem(static_report("a"), "b"))
        self.assertIn("dirty", report.static_problem(static_report("a", tree_clean=False), "a"))
        self.assertIn("not green", report.static_problem(static_report("a", verdict="red"), "a"))
        self.assertIn("run ci/gate.sh", report.static_problem(None, "a"))
        self.assertIn("not a static", report.static_problem({"kind": "e2e"}, "a"))

    def test_converged_report_embeds_static_and_counts_rounds(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            git(root, "init", "-q")
            (root / "f").write_text("x")
            git(root, "add", ".")
            git(root, "commit", "-qm", "c")
            sha = git(root, "rev-parse", "HEAD")
            (root / "stages.tsv").write_text("journeys\tpass\t1.0\n")
            (root / "tools.tsv").write_text("node\tv20\n")
            (root / "static.json").write_text(json.dumps(static_report(sha)))
            (root / "e2e.json").write_text(json.dumps({"converged": True}))
            log = root / "log.jsonl"
            common = [
                "--repo", "r", "--commit", sha, "--branch", "b", "--base", sha, "--user", "u",
                "--started", "s", "--finished", "f", "--duration", "2", "--tag", "converged/x",
                "--tree-clean", "1", "--kind", "converged", "--static", str(root / "static.json"),
                "--e2e", str(root / "e2e.json"), "--rounds-log", str(log), "--repo-dir", str(root),
                "--stages", str(root / "stages.tsv"), "--tools", str(root / "tools.tsv"),
                "--out", str(root / "out.json"),
            ]
            self.assertEqual(report.main(common), 0)
            self.assertEqual(report.main(common), 0)
            got = json.loads((root / "out.json").read_text())
            self.assertEqual(got["verdict"], "green")
            self.assertEqual(got["convergence"]["rounds"], 2)
            self.assertEqual(got["static"]["commit"], sha)
            (root / "s2.json").write_text(json.dumps(static_report(sha)))
            self.assertEqual(report.main(["--check-static", str(root / "s2.json"), "--commit", sha]), 0)
            self.assertEqual(report.main(["--check-static", str(root / "nope"), "--commit", sha]), 1)


if __name__ == "__main__":
    unittest.main()
