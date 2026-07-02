"""Sour Apple VIP Laundry — v2 restructure tests.
Tests: college/non-college tracking numbers, multi-service (Dry Cleaning removed),
payments (methods/manual/stripe), in-app messaging, confirm-pickup,
request-change/cancel, admin schedule/calendar/alerts, new statuses."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

ADMIN = {"email": "admin@sourapple.com", "password": "Admin123!"}
STUDENT = {"email": "student@sourapple.com", "password": "Student123!"}

state = {}


def _login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session", autouse=True)
def bootstrap():
    a = _login(ADMIN)
    s = _login(STUDENT)
    state["admin"] = a["access_token"]
    state["student"] = s["access_token"]
    state["student_name"] = s["user"]["name"]
    # Create second student for access-denial tests
    email = f"TEST_other_{uuid.uuid4().hex[:6]}@t.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "Other Student", "email": email, "password": "Pass123!", "role": "STUDENT"})
    assert r.status_code == 200
    state["other_student"] = r.json()["access_token"]


# ---------- 1. Auth ----------
def test_admin_login():
    assert _login(ADMIN)["user"]["role"] == "ADMIN"


def test_student_login():
    assert _login(STUDENT)["user"]["role"] == "STUDENT"


# ---------- 2. Order creation with tracking numbers ----------
def test_create_college_order_tracking_mvcc():
    payload = {
        "services": ["Wash & Fold", "Bedding"],
        "customer_type": "College Student", "college": "MVCC",
        "dorm": "North Hall", "directions": "Enter Lot B, gate 3.",
        "pickup_date": "07/15/2026", "pickup_window": "9am - 12pm",
        "bags": 2, "rush": False, "bedding_addon": True,
    }
    r = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    # MV-DORM-LASTNAME-MMDDYYYY
    assert d["code"].startswith("MV-NORTHHALL-"), d["code"]
    assert d["code"].endswith("-07152026"), d["code"]
    assert d["status"] == "Pending Admin Approval"
    assert "Dry Cleaning" not in d["service_type"]
    assert d["services"] == ["Wash & Fold", "Bedding"]
    # multi-service price: 20 + 25 + 5 (extra bag) + 8 (bedding addon) = 58
    assert d["price"] == 58.0
    state["college_order_id"] = d["id"]
    state["college_order_code"] = d["code"]


def test_create_college_order_tracking_utica():
    payload = {
        "services": ["Wash & Fold"],
        "customer_type": "College Student", "college": "Utica University",
        "dorm": "Boehlert", "directions": "Loop road.",
        "pickup_date": "08/01/2026", "pickup_window": "1pm - 4pm",
        "bags": 1,
    }
    r = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["code"].startswith("UC-BOEHLERT-")
    assert d["code"].endswith("-08012026")


def test_create_non_college_order_tracking():
    payload = {
        "services": ["Wash & Fold"],
        "customer_type": "Non College Student",
        "pickup_date": "09/10/2026", "pickup_window": "9am - 12pm",
        "bags": 1,
    }
    r = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload)
    assert r.status_code == 200
    d = r.json()
    # LASTNAME-MMDDYYYY (no MV/UC prefix, no dorm segment)
    parts = d["code"].split("-")
    assert len(parts) == 2, f"Expected LASTNAME-MMDDYYYY got {d['code']}"
    assert parts[1] == "09102026"


def test_dry_cleaning_not_in_service_types():
    from server import SERVICE_TYPES  # server importable
    assert "Dry Cleaning" not in SERVICE_TYPES


# ---------- 3. Payments ----------
def test_payment_methods():
    r = requests.get(f"{BASE}/payments/methods")
    assert r.status_code == 200
    d = r.json()
    assert d["cashapp"] == "$lvcenterprise"
    assert d["venmo"] == "@lvcenterprise"
    assert d["stripe_enabled"] is True


def test_manual_payment_cashapp():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/payments/manual/{oid}",
                      headers=_h(state["student"]), json={"method": "CashApp"})
    assert r.status_code == 200
    assert r.json()["payment_status"] == "Pending Confirmation"
    assert r.json()["payment_method"] == "CashApp"


def test_manual_payment_venmo():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/payments/manual/{oid}",
                      headers=_h(state["student"]), json={"method": "Venmo"})
    assert r.status_code == 200
    assert r.json()["payment_status"] == "Pending Confirmation"


def test_stripe_checkout_returns_url():
    # Live key configured - should return a checkout URL. Do NOT complete payment.
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/payments/stripe/checkout/{oid}",
                      headers=_h(state["student"]), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "url" in d
    assert d["url"].startswith("https://checkout.stripe.com/")


# ---------- 4. In-app messaging ----------
def test_student_post_message():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/orders/{oid}/messages",
                      headers=_h(state["student"]), json={"text": "Hi, please ring first"})
    assert r.status_code == 200
    assert r.json()["sender_role"] == "STUDENT"


def test_admin_post_message():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/orders/{oid}/messages",
                      headers=_h(state["admin"]), json={"text": "Got it!"})
    assert r.status_code == 200
    assert r.json()["sender_role"] == "ADMIN"


def test_get_messages_ordered():
    oid = state["college_order_id"]
    r = requests.get(f"{BASE}/orders/{oid}/messages", headers=_h(state["student"]))
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 2
    assert msgs[0]["created_at"] <= msgs[-1]["created_at"]


def test_other_student_blocked_from_messages():
    oid = state["college_order_id"]
    r = requests.get(f"{BASE}/orders/{oid}/messages", headers=_h(state["other_student"]))
    assert r.status_code in (403, 404)
    r2 = requests.post(f"{BASE}/orders/{oid}/messages",
                       headers=_h(state["other_student"]), json={"text": "sneaky"})
    assert r2.status_code in (403, 404)


# ---------- 5. Confirm pickup ----------
def test_confirm_pickup():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/orders/{oid}/confirm-pickup", headers=_h(state["student"]))
    assert r.status_code == 200
    # Verify a system message was posted
    msgs = requests.get(f"{BASE}/orders/{oid}/messages", headers=_h(state["student"])).json()
    assert any("Confirmed pickup" in m["text"] for m in msgs)
    # Verify persistence
    order = requests.get(f"{BASE}/orders/{oid}", headers=_h(state["student"])).json()
    assert order["pickup_confirmed"] is True


# ---------- 6. Request change / cancel ----------
def test_request_change():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/orders/{oid}/request-change",
                      headers=_h(state["student"]), json={"note": "Please change to 3pm"})
    assert r.status_code == 200
    order = requests.get(f"{BASE}/orders/{oid}", headers=_h(state["student"])).json()
    assert order.get("change_request") is not None
    assert order["change_request"]["note"] == "Please change to 3pm"


def test_cancel_when_pending_ok():
    # Create a fresh order to cancel
    payload = {"services": ["Wash & Fold"], "customer_type": "Non College Student",
               "pickup_date": "10/10/2026", "pickup_window": "9am - 12pm", "bags": 1}
    r = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload)
    assert r.status_code == 200
    oid = r.json()["id"]
    r2 = requests.post(f"{BASE}/orders/{oid}/cancel", headers=_h(state["student"]))
    assert r2.status_code == 200
    order = requests.get(f"{BASE}/orders/{oid}", headers=_h(state["student"])).json()
    assert order["status"] == "Cancelled"


def test_cancel_after_started_400():
    # Create + admin sets status past cancelable window
    payload = {"services": ["Wash & Fold"], "customer_type": "Non College Student",
               "pickup_date": "10/11/2026", "pickup_window": "9am", "bags": 1}
    oid = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload).json()["id"]
    # Move to "Picked Up" (post cancelable)
    r = requests.post(f"{BASE}/admin/orders/{oid}/status",
                      headers=_h(state["admin"]), json={"status": "Picked Up"})
    assert r.status_code == 200
    r2 = requests.post(f"{BASE}/orders/{oid}/cancel", headers=_h(state["student"]))
    assert r2.status_code == 400


# ---------- 7. Admin schedule / calendar / alerts ----------
def test_admin_approve_college_order():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/admin/orders/{oid}/approve",
                      headers=_h(state["admin"]), json={"price": 58.0, "admin_note": "ok"})
    assert r.status_code == 200
    assert r.json()["status"] == "Approved"


def test_admin_set_schedule_clears_change_request():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/admin/orders/{oid}/schedule",
                      headers=_h(state["admin"]),
                      json={"pickup_window": "2pm - 5pm",
                            "delivery_date": "07/17/2026",
                            "delivery_window": "6pm - 8pm"})
    assert r.status_code == 200
    order = r.json()
    assert order["pickup_window"] == "2pm - 5pm"
    assert order["delivery_date"] == "07/17/2026"
    assert order["delivery_window"] == "6pm - 8pm"
    assert order.get("change_request") is None


def test_admin_calendar_excludes_pending_and_cancelled():
    r = requests.get(f"{BASE}/admin/calendar", headers=_h(state["admin"]))
    assert r.status_code == 200
    orders = r.json()
    for o in orders:
        assert o["status"] not in ("Pending Admin Approval", "Rejected", "Cancelled")


def test_admin_alerts():
    r = requests.get(f"{BASE}/admin/alerts", headers=_h(state["admin"]))
    assert r.status_code == 200
    d = r.json()
    assert "pending" in d and "changes" in d and "total" in d
    assert d["total"] == d["pending"] + d["changes"]


def test_admin_set_status_ready_for_pickup():
    oid = state["college_order_id"]
    r = requests.post(f"{BASE}/admin/orders/{oid}/status",
                      headers=_h(state["admin"]), json={"status": "Ready for Pickup"})
    assert r.status_code == 200
    assert r.json()["status"] == "Ready for Pickup"


def test_admin_set_status_cancelled():
    # Create a new order, admin sets Cancelled directly
    payload = {"services": ["Wash & Fold"], "customer_type": "Non College Student",
               "pickup_date": "11/01/2026", "pickup_window": "9am", "bags": 1}
    oid = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload).json()["id"]
    r = requests.post(f"{BASE}/admin/orders/{oid}/status",
                      headers=_h(state["admin"]), json={"status": "Cancelled"})
    assert r.status_code == 200
    assert r.json()["status"] == "Cancelled"


# ---------- 8. Access-denial safeguards ----------
def test_other_student_cannot_confirm_pickup():
    r = requests.post(f"{BASE}/orders/{state['college_order_id']}/confirm-pickup",
                      headers=_h(state["other_student"]))
    assert r.status_code in (403, 404)


def test_other_student_cannot_cancel():
    r = requests.post(f"{BASE}/orders/{state['college_order_id']}/cancel",
                      headers=_h(state["other_student"]))
    assert r.status_code in (403, 404)


def test_student_cannot_hit_admin_endpoints():
    for path in ("/admin/calendar", "/admin/alerts"):
        r = requests.get(f"{BASE}{path}", headers=_h(state["student"]))
        assert r.status_code == 403
