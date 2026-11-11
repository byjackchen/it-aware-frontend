#!/usr/bin/env python3
"""The UI's SYNTHETIC data set for ci/e2e.sh, created through the backend's public
API as gate.admin, on top of the backend's own synthetic world
(it-aware-backend ci/db/seed.py and ci/e2e/seed.py). Every row is invented here.

  world.py <backend base URL> <username> <password>

What the specs need that the backend's world does not have (it is sized for the
backend's dashboard golden snapshots, which this must not disturb):
- 60 requests and 60 incidents with ServiceNow timestamps (May to August
  2026), so the lists have more than one page, sort by `source_created_at`, and show callers of every
  kind: named workers, and the `grafana_integration` system actor;
  their creation order differs from their ServiceNow order, so `order_by=created_at`
  returns a different first row;
- two more systems, so the systems list has three;
- one more worker, gate.erin, with an email and no account, for the
  account-to-worker link dialog (which lists unlinked workers by email).

Deterministic: fixed timestamps and IDs, no randomness. It runs once per stack.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

WORKERS = ("gate.alice", "gate.bob", "gate.carol", "gate.dave")  # backend ci/e2e/seed.py
STATES = {
    "requests": ("Open", "Work in Progress", "Pending", "Closed Complete", "Closed Incomplete"),
    "incidents": ("New", "In Progress", "On Hold", "Resolved", "Closed", "Canceled"),
}
GROUPS = ("OIT Service Desk", "OIT Hardware", "OIT Payments Support")
START = datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc)
COUNT = 60  # more than the lists' default page size (50)


class Api:
    def __init__(self, base: str, username: str, password: str) -> None:
        self.base = base.rstrip("/")
        body = urllib.parse.urlencode(
            {"grant_type": "password", "username": username, "password": password}
        ).encode()
        with urllib.request.urlopen(
            urllib.request.Request(f"{self.base}/auth/session/token", data=body), timeout=30
        ) as resp:
            cookies = [c.split(";")[0] for c in resp.headers.get_all("Set-Cookie") or []]
        self.cookie = "; ".join(c for c in cookies if c.startswith("it_aware_"))

    def get(self, path: str) -> dict:
        req = urllib.request.Request(f"{self.base}{path}", headers={"Cookie": self.cookie})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def oids(self, path: str, key: str) -> dict[str, str]:
        return {i[key]: i["oid"] for i in self.get(f"{path}?limit=500")["items"]}

    def post(self, path: str, payload: dict) -> dict:
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Cookie": self.cookie},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as error:
            raise SystemExit(f"world: POST {path} -> {error.code} {error.read().decode()[:500]}") from None


def ticket(kind: str, n: int, workers: dict[str, str], systems: dict[str, str]) -> dict:
    """Ticket n. Its ServiceNow time runs backwards from the creation order every
    seventh ticket, so the two orders disagree."""
    order = n if n % 7 else COUNT + n
    at = START + timedelta(days=order, hours=n % 5)  # at most 120 days on: in the past
    prefix = "REQ" if kind == "requests" else "INC"
    system = n % 6 == 0
    actor = (
        {
            "actor_type": "system",
            "actor_oid": systems["grafana_integration"],
            "actor_stable_id": "grafana_integration",
            "caller_name": None,
        }
        if system
        else {
            "actor_type": "worker",
            "actor_oid": workers[WORKERS[n % len(WORKERS)]],
            "actor_stable_id": WORKERS[n % len(WORKERS)],
            "caller_name": f"Gate {WORKERS[n % len(WORKERS)].split('.')[1].title()}",
        }
    )
    return {
        "stable_id": f"{prefix}95{n:05d}",
        "title": f"Gate UI {kind[:-1]} {n}",
        "state": STATES[kind][n % len(STATES[kind])],
        "actor_role": "requester" if kind == "requests" else "caller",
        "assigned_group": GROUPS[n % len(GROUPS)],
        "source_system": "ServiceNow",
        "source_created_at": at.isoformat(),
        "source_opened_at": at.isoformat(),
        "source_updated_at": (at + timedelta(hours=4)).isoformat(),
        "effective_at": at.isoformat(),
        **actor,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: world.py <backend base URL> <username> <password>", file=sys.stderr)
        return 2
    api = Api(*argv)
    for system_id, name, platform in (
        ("servicenow-ingest", "ServiceNow Ingestion (gate)", "ingestion"),
        ("airflow-scheduler", "Airflow Scheduler (gate)", "scheduler"),
    ):
        api.post("/objects/systems", {"name": name, "system_id": system_id, "system_platform": platform})
    carol = next(w for w in api.get("/objects/workers?limit=500")["items"] if w["stable_id"] == "gate.carol")
    api.post(
        "/objects/workers",
        {
            "stable_id": "gate.erin",
            "fullname": "Gate Erin",
            "email": "gate.erin@example.com",
            "org_oid": carol["org_oid"],
        },
    )
    workers = api.oids("/objects/workers", "stable_id")
    systems = api.oids("/objects/systems", "system_id")
    for kind in ("requests", "incidents"):
        for n in range(1, COUNT + 1):
            api.post(f"/objects/activities/{kind}", ticket(kind, n, workers, systems))
    print(f"ui world: 2 systems, 1 worker, {COUNT} requests, {COUNT} incidents")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
