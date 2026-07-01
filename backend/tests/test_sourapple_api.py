"""Sour Apple VIP Laundry — Backend API tests."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://wash-and-go-9.preview.emergentagent.com").rstrip("/") + "/api"

ADMIN = {"email": "admin@sourapple.com", "password": "Admin123!"}
STUDENT = {"email": "student@sourapple.com", "password": "Student123!"}
DRIVER = {"email": "driver@sourapple.com", "password": "Driver123!"}

state = {}


def _login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session", autouse=True)
def bootstrap():
    state["admin"] = _login(ADMIN)
    state["student"] = _login(STUDENT)
    state["driver"] = _login(DRIVER)


# ---- AUTH ----
def test_login_wrong_password():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN["email"], "password": "bad"})
    assert r.status_code == 401


def test_register_admin_blocked():
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "x", "email": f"TEST_{uuid.uuid4().hex[:6]}@t.com",
        "password": "Pass123!", "role": "ADMIN"})
    assert r.status_code == 400


def test_register_student_ok():
    email = f"TEST_stu_{uuid.uuid4().hex[:6]}@t.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "New Stu", "email": email, "password": "Pass123!", "role": "STUDENT"})
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["role"] == "STUDENT"
    state["new_student_token"] = data["access_token"]


def test_register_driver_ok():
    email = f"TEST_drv_{uuid.uuid4().hex[:6]}@t.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "New Drv", "email": email, "password": "Pass123!", "role": "DRIVER"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "DRIVER"


def test_register_duplicate():
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "x", "email": STUDENT["email"], "password": "Pass123!", "role": "STUDENT"})
    assert r.status_code == 400


def test_me_and_update():
    r = requests.get(f"{BASE}/auth/me", headers=_h(state["student"]))
    assert r.status_code == 200
    assert r.json()["email"] == STUDENT["email"]
    r2 = requests.put(f"{BASE}/auth/me", headers=_h(state["student"]),
                      json={"phone": "555-9999"})
    assert r2.status_code == 200
    assert r2.json()["phone"] == "555-9999"


def test_me_no_auth():
    assert requests.get(f"{BASE}/auth/me").status_code == 401


# ---- ORDERS / ESTIMATE ----
def test_estimate():
    r = requests.post(f"{BASE}/orders/estimate",
                      json={"service_type": "Wash & Fold", "bags": 2, "rush": True, "bedding_addon": True})
    assert r.status_code == 200
    # 20*2 + 5*(1 extra) + 10 rush + 8 bedding = 63
    assert r.json()["estimate"] == 63.0


def test_create_order_and_qr():
    payload = {
        "service_type": "Wash & Fold", "pickup_date": "2026-07-01",
        "pickup_window": "9am - 12pm", "delivery_date": "2026-07-03",
        "delivery_window": "3pm - 6pm", "bags": 1, "rush": False, "bedding_addon": False,
        "preferences": ["Cold wash"], "stain_notes": "grass stain"}
    r = requests.post(f"{BASE}/orders", headers=_h(state["student"]), json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "Pending Admin Approval"
    assert d["code"].startswith("SA-")
    assert d["qr_code"] == d["code"]
    state["order_id"] = d["id"]
    state["order_code"] = d["code"]


def test_create_order_forbidden_for_driver():
    payload = {"service_type": "Wash & Fold", "pickup_date": "d", "pickup_window": "w",
               "delivery_date": "d", "delivery_window": "w", "bags": 1}
    r = requests.post(f"{BASE}/orders", headers=_h(state["driver"]), json=payload)
    assert r.status_code == 403


def test_my_orders_persist():
    r = requests.get(f"{BASE}/orders/my", headers=_h(state["student"]))
    assert r.status_code == 200
    assert any(o["id"] == state["order_id"] for o in r.json())


def test_get_order_by_other_student_denied():
    # register a second student
    email = f"TEST_other_{uuid.uuid4().hex[:6]}@t.com"
    tok = requests.post(f"{BASE}/auth/register", json={
        "name": "Other", "email": email, "password": "Pass123!", "role": "STUDENT"}).json()["access_token"]
    r = requests.get(f"{BASE}/orders/{state['order_id']}", headers=_h(tok))
    assert r.status_code == 403


# ---- ADMIN ----
def test_admin_orders_list():
    r = requests.get(f"{BASE}/admin/orders", headers=_h(state["admin"]))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_student_cannot_admin():
    assert requests.get(f"{BASE}/admin/orders", headers=_h(state["student"])).status_code == 403


def test_admin_approve():
    r = requests.post(f"{BASE}/admin/orders/{state['order_id']}/approve",
                      headers=_h(state["admin"]),
                      json={"price": 25.5, "admin_note": "ok"})
    assert r.status_code == 200
    assert r.json()["status"] == "Approved"
    assert r.json()["price"] == 25.5


def test_admin_release_job():
    r = requests.post(f"{BASE}/admin/orders/{state['order_id']}/release",
                      headers=_h(state["admin"]),
                      json={"job_type": "Pickup", "payout": 15.0, "auto_assign_first_claim": True})
    assert r.status_code == 200
    state["job_id"] = r.json()["id"]
    # verify order status changed
    o = requests.get(f"{BASE}/orders/{state['order_id']}", headers=_h(state["admin"])).json()
    assert o["status"] == "Pickup Job Released"


def test_qr_lookup():
    r = requests.get(f"{BASE}/admin/qr/{state['order_code']}", headers=_h(state["admin"]))
    assert r.status_code == 200
    assert r.json()["id"] == state["order_id"]


def test_qr_lookup_404():
    r = requests.get(f"{BASE}/admin/qr/SA-NOPE1234", headers=_h(state["admin"]))
    assert r.status_code == 404


def test_admin_analytics():
    r = requests.get(f"{BASE}/admin/analytics", headers=_h(state["admin"]))
    assert r.status_code == 200
    d = r.json()
    for k in ("total_orders", "revenue_estimate", "active_students", "active_drivers", "open_driver_jobs"):
        assert k in d


def test_admin_drivers_list():
    r = requests.get(f"{BASE}/admin/drivers", headers=_h(state["admin"]))
    assert r.status_code == 200
    assert any(d["email"] == DRIVER["email"] for d in r.json())


# ---- DRIVER ----
def test_driver_open_jobs():
    r = requests.get(f"{BASE}/driver/jobs/open", headers=_h(state["driver"]))
    assert r.status_code == 200


def test_driver_claim_auto_assign():
    r = requests.post(f"{BASE}/driver/jobs/{state['job_id']}/claim", headers=_h(state["driver"]))
    assert r.status_code == 200
    assert r.json()["driver_id"] is not None


def test_driver_double_claim_400():
    r = requests.post(f"{BASE}/driver/jobs/{state['job_id']}/claim", headers=_h(state["driver"]))
    assert r.status_code == 400


def test_driver_status_update():
    r = requests.post(f"{BASE}/driver/jobs/{state['job_id']}/status",
                      headers=_h(state["driver"]),
                      json={"status": "Picked up"})
    assert r.status_code == 200
    o = requests.get(f"{BASE}/orders/{state['order_id']}", headers=_h(state["admin"])).json()
    assert o["status"] == "Picked Up"


def test_driver_cannot_approve():
    r = requests.post(f"{BASE}/admin/orders/{state['order_id']}/approve",
                      headers=_h(state["driver"]), json={})
    assert r.status_code == 403


# ---- PAYMENTS ----
def test_payments_mock_marks_paid():
    r = requests.post(f"{BASE}/payments/checkout/{state['order_id']}", headers=_h(state["student"]))
    assert r.status_code == 200
    assert r.json()["mock"] is True
    o = requests.get(f"{BASE}/orders/{state['order_id']}", headers=_h(state["student"])).json()
    assert o["payment_status"] == "Paid"


# ---- AI ----
def test_ai_stain_tips():
    r = requests.post(f"{BASE}/ai/stain-tips", headers=_h(state["student"]),
                      json={"notes": "coffee stain on white cotton", "service_type": "Wash & Fold"},
                      timeout=60)
    assert r.status_code == 200, r.text
    assert len(r.json().get("tips", "")) > 10


def test_ai_support_admin_only():
    r = requests.post(f"{BASE}/ai/support", headers=_h(state["student"]),
                      json={"message": "help"})
    assert r.status_code == 403
    r2 = requests.post(f"{BASE}/ai/support", headers=_h(state["admin"]),
                       json={"message": "order lost"}, timeout=60)
    assert r2.status_code == 200
    assert len(r2.json().get("suggestion", "")) > 5


# ---- Rating / Reorder ----
def test_rate_and_reorder():
    r = requests.post(f"{BASE}/orders/{state['order_id']}/rate",
                      headers=_h(state["student"]), json={"stars": 5, "feedback": "great"})
    assert r.status_code == 200
    r2 = requests.post(f"{BASE}/orders/{state['order_id']}/reorder", headers=_h(state["student"]))
    assert r2.status_code == 200
    assert r2.json()["id"] != state["order_id"]
