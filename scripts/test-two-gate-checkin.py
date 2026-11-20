import getpass
import json
import re
import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.cookiejar import CookieJar
from pathlib import Path
from threading import Barrier
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
API = "http://localhost:3001"
EVENT_SLUG = "nairobi-developer-meetup"
EVENT_NAME = "Nairobi Developer Meetup"
GUEST_NAME = "Two Gate Test"
STAFF_EMAIL = "door.staff@example.test"
CHECK_IN_PATH = f"/staff/events/{EVENT_SLUG}/check-ins"


class TestFailure(Exception):
    pass


def require(condition, message):
    if not condition:
        raise TestFailure(message)


def new_client():
    # Each gate gets its own cookie jar and staff session.
    return build_opener(HTTPCookieProcessor(CookieJar()))


def api_request(client, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        API + path,
        data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
        method="POST" if data is not None else "GET",
    )

    try:
        response = client.open(request, timeout=20)
    except HTTPError as error:
        response = error

    with response:
        status = response.getcode()
        raw = response.read()

    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise TestFailure(f"{path} returned HTTP {status} without valid JSON.")

    return status, body


def expect_status(result, expected, label):
    status, body = result
    if status != expected:
        message = body.get("message", "") if isinstance(body, dict) else ""
        raise TestFailure(
            f"{label}: expected HTTP {expected}, received HTTP {status}. {message}"
        )
    return body


def issue_fresh_pass():
    email = f"two-gate-{uuid.uuid4().hex}@example.test"
    issued = subprocess.run(
        [
            "npm", "run", "pass:issue", "--workspace=apps/api", "--",
            EVENT_SLUG, GUEST_NAME, email,
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
    )

    require(
        issued.returncode == 0,
        f"Pass issuance failed. Check that PostgreSQL is running and "
        f"the pass:issue command can reach the project database.",
    )

    match = re.search(
        r"^Pass token \(shown once\): ([A-Za-z0-9_-]{43})$",
        issued.stdout,
        re.MULTILINE,
    )
    require(match is not None, "Issuance succeeded, but its token line was missing.")
    print(f"PASS: issued fresh invitation for {email}")
    return match.group(1)


def main():
    password = getpass.getpass("Door staff password: ")
    gates = [new_client(), new_client()]

    # Authenticate before creating test data, so a mistyped password creates no pass.
    for number, gate in enumerate(gates, start=1):
        expect_status(
            api_request(gate, "/staff/login", {
                "email": STAFF_EMAIL,
                "password": password,
            }),
            200,
            f"Gate {number} sign-in",
        )

        events = expect_status(
            api_request(gate, "/staff/events"), 200, f"Gate {number} assignments"
        )
        require(
            any(event["slug"] == EVENT_SLUG for event in events),
            f"Gate {number}: {STAFF_EMAIL} has no assignment for {EVENT_SLUG}.",
        )

    print("PASS: both staff sessions signed in and can see the meetup")

    token = issue_fresh_pass()
    guest_pass = {"token": token}

    invitation = expect_status(
        api_request(new_client(), "/invitations/lookup", guest_pass),
        200,
        "Fresh pass lookup on the running API",
    )
    require(
        invitation.get("guestName") == GUEST_NAME
        and invitation.get("event", {}).get("name") == EVENT_NAME,
        "The fresh pass resolved to an unexpected guest or event.",
    )
    print("PASS: guest lookup recognizes this exact pass and meetup")

    expect_status(
        api_request(new_client(), CHECK_IN_PATH, guest_pass),
        401,
        "Anonymous scan",
    )
    expect_status(
        api_request(gates[0], "/staff/events/unassigned-test-event/check-ins", guest_pass),
        403,
        "Scan for an unassigned event slug",
    )
    expect_status(
        api_request(gates[0], CHECK_IN_PATH, {"token": "invalid"}),
        404,
        "Malformed pass",
    )
    print("PASS: anonymous, unassigned-event, and malformed-pass requests rejected")

    barrier = Barrier(2)

    def scan(gate):
        barrier.wait(timeout=10)
        return api_request(gate, CHECK_IN_PATH, guest_pass)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(scan, gates))

    admissions = []
    for number, result in enumerate(results, start=1):
        admission = expect_status(result, 200, f"Gate {number} concurrent scan")
        admissions.append(admission)
        print(
            f"Gate {number}: {admission.get('status')} | "
            f"{admission.get('guestName')} | {admission.get('checkedInAt')}"
        )

    outcomes = sorted(row["status"] for row in admissions)
    require(
        outcomes == ["already_checked_in", "checked_in"],
        f"Expected one new admission and one repeat. Received {outcomes}.",
    )
    require(
        all(row.get("guestName") == GUEST_NAME for row in admissions),
        "A scan returned a different guest.",
    )

    first, second = admissions
    for field in ("checkedInAt", "checkedInBy"):
        require(
            bool(first.get(field)) and first[field] == second.get(field),
            f"The two scans disagree on {field}, or the field is empty.",
        )

    print("PASS: two sessions, one admission, one original timestamp")


if __name__ == "__main__":
    try:
        main()
    except TestFailure as error:
        sys.exit(f"FAIL: {error}")
    except (URLError, TimeoutError, subprocess.TimeoutExpired) as error:
        sys.exit(f"FAIL: request or command could not complete: {error}")
