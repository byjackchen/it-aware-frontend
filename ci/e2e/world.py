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
  account-to-worker link dialog (which lists unlinked workers by email);
- one edge, gate.erin belongs_to Gate Carol's organization, so the relationship
  graph on a worker's page has something to draw (the seed has no edges);
- three accounts in gate-readers (every read task), for View Usages' who-used-what
  pages: gate.sync, an integration account, and gate.frank, an inactive user, so
  Unused Access labels them; and gate.gone, a user who signs in, opens a task and
  is deleted, so By Person lists its events as a deleted account's;
- gate.holder, a user who holds one data task (View IT Interactions) and no admin
  task, for the task pages' redirects: a refused task's address must land on
  /access-denied, and an ended sign-in on /login, without a client exception
  (e2e/task-redirects.spec.ts). The specs' accounts with no task at all never
  showed that crash's cause, the task frame of a held task.
- two software requests in chatbot interactions (ohla-xray TODO00000174): one
  submitted over three turns (started, form sent, submitted with its values) and
  one cancelled, so the Interactions list's form filter, badge and the detail
  page's form section have something to show (e2e/interaction-forms.spec.ts).

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
GONE_PASSWORD = "gate-fake-password-2"  # synthetic, for the accounts below


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

    def delete(self, path: str) -> None:
        req = urllib.request.Request(f"{self.base}{path}", method="DELETE", headers={"Cookie": self.cookie})
        try:
            with urllib.request.urlopen(req, timeout=30):
                pass
        except urllib.error.HTTPError as error:
            raise SystemExit(f"world: DELETE {path} -> {error.code} {error.read().decode()[:500]}") from None

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


FORM_AT = datetime(2026, 8, 20, 9, 0, tzinfo=timezone.utc)
FORM_VALUES = {
    "request_type": {"label": "Request Type", "value": "1", "display": "Request Access", "cycle_id": "gate-cycle-1"},
    "justification": {
        "label": "Business Justification",
        "value": "gate sprint work",
        "display": "gate sprint work",
        "cycle_id": "gate-cycle-1",
    },
}


def form_turn(n: int, action: str, text: str, record: dict) -> dict:
    """A chatbot turn carrying oit-chatbot's flow_states.catalog_request."""
    return {
        "stable_id": f"gate-form-cycle-{n}",
        "source_system": "chatbot",
        "actor_stable_id": "gate.alice",
        "action_type": action,
        "content_text": text,
        "content_raw": {
            "source": "chatbot_single_chats",
            "cycle_id": f"gate-cycle-{n}",
            "record": {"flow_states": {"catalog_request": {"events": [record["event"]], **record}}},
        },
        "created_at": (FORM_AT + timedelta(minutes=n)).isoformat(),
    }


def form_interactions() -> list[dict]:
    item = {"item_sys_id": "gate-item-1", "item_name": "Gate Tool"}
    return [
        form_turn(1, "query", "I need Gate Tool for sprint work", {"event": "started", "final": False, "draft_id": "gate-d1", **item, "values": {"justification": FORM_VALUES["justification"]}}),
        form_turn(2, "query", "yes, request access", {"event": "form_sent", "final": False, "draft_id": "gate-d1", **item, "values": FORM_VALUES}),
        form_turn(3, "form_submit", "[Form submit]", {"event": "submitted", "final": True, "draft_id": "gate-d1", **item, "ticket_number": "RITM9500001", "values": FORM_VALUES}),
        form_turn(4, "query", "cancel my Gate Tool request", {"event": "cancelled", "final": True, "draft_id": "gate-d2", **item, "values": {}}),
    ]


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: world.py <backend base URL> <username> <password>", file=sys.stderr)
        return 2
    api = Api(*argv)
    api_password = argv[2]  # gate.holder signs in with the specs' password (e2e/env.ts)
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
    api.post(
        "/edges",
        {"from_oid": workers["gate.erin"], "to_oid": carol["org_oid"], "edge_type": "belongs_to"},
    )
    systems = api.oids("/objects/systems", "system_id")
    for kind in ("requests", "incidents"):
        for n in range(1, COUNT + 1):
            api.post(f"/objects/activities/{kind}", ticket(kind, n, workers, systems))
    readers = next(g["oid"] for g in api.get("/auth/config/groups?limit=1000") if g["name"] == "gate-readers")
    accounts = {}
    for username, fields in (
        ("gate.sync", {"account_type": "integration", "password": GONE_PASSWORD}),
        ("gate.frank", {"is_active": False}),
        ("gate.gone", {"password": GONE_PASSWORD}),
    ):
        accounts[username] = api.post("/auth/config/accounts", {"username": username, **fields})["oid"]
        api.post("/auth/config/account_groups", {"account_oid": accounts[username], "group_oid": readers})
    perms = {p["permission_code"]: p["oid"] for p in api.get("/auth/config/permissions?limit=1000")}
    holders = api.post("/auth/config/groups", {"name": "gate-holders", "scope_type": "unconstrained"})["oid"]
    for code in ("ui:navigation:data", "objects:interactions:read"):
        api.post("/auth/config/group_permissions", {"group_oid": holders, "permission_oid": perms[code]})
    holder = api.post("/auth/config/accounts", {"username": "gate.holder", "password": api_password})["oid"]
    api.post("/auth/config/account_groups", {"account_oid": holder, "group_oid": holders})
    api.post("/objects/activities/interactions/batch-upsert", {"interactions": form_interactions()})
    gone = Api(api.base, "gate.gone", GONE_PASSWORD)  # a sign-in event
    gone.post("/tasks/recent", {"task": "workers", "view": "workers"})  # a task_open event
    api.delete(f"/auth/config/accounts/{accounts['gate.gone']}")
    print(
        f"ui world: 2 systems, 1 worker, 1 edge, {COUNT} requests, {COUNT} incidents, "
        "4 accounts (1 integration, 1 inactive, 1 deleted after use, 1 holding one data task), "
        "4 form interactions (2 requests)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
