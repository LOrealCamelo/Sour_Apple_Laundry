"""
Sour Apple VIP Laundry Services — Backend API
FastAPI + MongoDB. JWT auth with roles: STUDENT, ADMIN, DRIVER.
AI features powered by Emergent LLM key (emergentintegrations).

PLACEHOLDERS (see TODO markers):
  - Stripe payments  -> create_payment() : add STRIPE_API_KEY + real intent
  - SMS / Email / Push -> notify()       : swap NotificationLog for Twilio/SendGrid/Expo
  - Driver document verification          -> DriverDocument.* fields
  - QR scanning hardware                  -> qr_code holds the order code
"""
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sourapple")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
JWT_EXPIRE_MINUTES = int(os.environ['JWT_EXPIRE_MINUTES'])
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Sour Apple VIP Laundry API")
api = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(str)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ----------------------------- Order status flow -----------------------------
ORDER_STATUSES = [
    "Request Submitted", "Pending Admin Approval", "Approved", "Rejected",
    "Needs Customer Follow-Up", "Pickup Job Released", "Driver Assigned",
    "Pickup Scheduled", "Picked Up", "Checked In", "Washing", "Drying",
    "Folding", "Quality Check", "Delivery Job Released", "Out for Delivery",
    "Delivered",
]

SERVICE_TYPES = ["Wash & Fold", "Dry Cleaning", "Bedding", "Towels",
                 "Rush Laundry", "Subscription Laundry Plan"]

# base price per service (USD) — TODO: manage via PricingRule collection in admin
SERVICE_PRICES = {
    "Wash & Fold": 20, "Dry Cleaning": 35, "Bedding": 25, "Towels": 15,
    "Rush Laundry": 40, "Subscription Laundry Plan": 60,
}
RUSH_FEE = 10
BEDDING_ADDON = 8
EXTRA_BAG_FEE = 5
# branded reusable bags available for purchase (set prices)
BRANDED_BAG_PRICES = {"small": 5, "medium": 8, "large": 12}


# ------------------------------ Pydantic models ------------------------------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "STUDENT"          # STUDENT | ADMIN | DRIVER
    phone: Optional[str] = ""
    campus: Optional[str] = ""
    building: Optional[str] = ""
    room: Optional[str] = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: str = ""
    campus: str = ""
    building: str = ""
    room: str = ""


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    campus: Optional[str] = None
    building: Optional[str] = None
    room: Optional[str] = None


class OrderCreate(BaseModel):
    service_type: Optional[str] = None       # legacy single value (kept for compat)
    services: List[str] = []                 # multiple services allowed
    order_type: str = "Pickup & Delivery"    # or "Neighborhood Drop-off"
    branded_bags: dict = {}                   # {"small": n, "medium": n, "large": n}
    pickup_date: str
    pickup_window: str
    delivery_date: str
    delivery_window: str
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    preferences: List[str] = []      # detergent, softener, cold wash, hang dry...
    stain_notes: str = ""
    photos: List[str] = []           # base64 strings (optional)
    referral_code: str = ""


class PriceEstimate(BaseModel):
    service_type: Optional[str] = None
    services: List[str] = []
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    branded_bags: dict = {}


class ApproveBody(BaseModel):
    price: Optional[float] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    admin_note: Optional[str] = ""


class RejectBody(BaseModel):
    reason: str = ""


class ReleaseBody(BaseModel):
    job_type: str                    # Pickup | Delivery | Pickup + Delivery
    payout: float = 12.0
    auto_assign_first_claim: bool = False


class StatusUpdate(BaseModel):
    status: str


class RatingBody(BaseModel):
    stars: int
    feedback: str = ""


class AIStainBody(BaseModel):
    notes: str
    service_type: str = ""


class AISupportBody(BaseModel):
    message: str


# -------------------------------- Auth helpers -------------------------------
def hash_pw(p: str) -> str:
    return pwd_context.hash(p)


def verify_pw(p: str, h: str) -> bool:
    return pwd_context.verify(p, h)


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    cred_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials",
                            {"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise cred_exc
    except JWTError:
        raise cred_exc
    user = await db.users.find_one({"id": uid})
    if not user:
        raise cred_exc
    return user


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker


def user_public(u: dict) -> dict:
    return {k: u.get(k, "") for k in
            ["id", "name", "email", "role", "phone", "campus", "building", "room"]}


# ----------------------------- Notification stub -----------------------------
async def notify(to_role: str, channel: str, message: str, order_id: str = ""):
    """PLACEHOLDER notification. TODO: connect Twilio (SMS), SendGrid (email),
    Expo push. For now we log to NotificationLog collection."""
    await db.notifications.insert_one({
        "id": new_id(), "to_role": to_role, "channel": channel,
        "message": message, "order_id": order_id, "created_at": now_iso(),
    })


async def push_history(order_id: str, status_val: str):
    await db.orders.update_one(
        {"id": order_id},
        {"$push": {"history": {"status": status_val, "at": now_iso()}}},
    )


# ---------------------------------- Pricing ----------------------------------
def estimate_price(services, bags: int, rush: bool, bedding: bool, branded_bags=None) -> float:
    if isinstance(services, str):
        services = [services]
    total = sum(SERVICE_PRICES.get(s, 20) for s in services)
    total += EXTRA_BAG_FEE * max(0, bags - 1)
    if rush:
        total += RUSH_FEE
    if bedding:
        total += BEDDING_ADDON
    if branded_bags:
        for size, qty in branded_bags.items():
            total += BRANDED_BAG_PRICES.get(size, 0) * int(qty or 0)
    return round(float(total), 2)


# =============================== AUTH ROUTES ===============================
@api.post("/auth/register")
async def register(body: UserCreate):
    if body.role not in ("STUDENT", "DRIVER", "NEIGHBOR"):
        raise HTTPException(400, "Self-registration allowed for STUDENT, NEIGHBOR or DRIVER only")
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": new_id(), "name": body.name, "email": body.email.lower(),
        "password": hash_pw(body.password), "role": body.role,
        "phone": body.phone or "", "campus": body.campus or "",
        "building": body.building or "", "room": body.room or "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return {"access_token": make_token(user), "token_type": "bearer", "user": user_public(user)}


@api.post("/auth/login")
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": make_token(user), "token_type": "bearer", "user": user_public(user)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api.put("/auth/me", response_model=UserOut)
async def update_me(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return user_public(fresh)


# ============================== STUDENT ORDERS ==============================
@api.post("/orders/estimate")
async def price_estimate(body: PriceEstimate):
    services = body.services or ([body.service_type] if body.service_type else [])
    return {"estimate": estimate_price(services, body.bags, body.rush, body.bedding_addon, body.branded_bags)}


@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    services = body.services or ([body.service_type] if body.service_type else ["Wash & Fold"])
    price = estimate_price(services, body.bags, body.rush, body.bedding_addon, body.branded_bags)
    oid = new_id()
    code = "SA-" + oid[:8].upper()
    order = {
        "id": oid, "code": code, "qr_code": code,
        "student_id": user["id"], "student_name": user["name"],
        "campus": user.get("campus", ""), "building": user.get("building", ""),
        "room": user.get("room", ""), "phone": user.get("phone", ""),
        "service_type": ", ".join(services), "services": services,
        "order_type": body.order_type, "branded_bags": body.branded_bags,
        "bags": body.bags,
        "rush": body.rush, "bedding_addon": body.bedding_addon,
        "preferences": body.preferences, "stain_notes": body.stain_notes,
        "photos": body.photos, "referral_code": body.referral_code,
        "price": price, "status": "Pending Admin Approval",
        "payment_status": "Unpaid", "admin_note": "",
        "pickup_date": body.pickup_date, "pickup_window": body.pickup_window,
        "delivery_date": body.delivery_date, "delivery_window": body.delivery_window,
        "rating": None, "feedback": "",
        "history": [
            {"status": "Request Submitted", "at": now_iso()},
            {"status": "Pending Admin Approval", "at": now_iso()},
        ],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    await notify("ADMIN", "push", f"New booking request {code} from {user['name']}", oid)
    order.pop("_id", None)
    return order


@api.get("/orders/my")
async def my_orders(user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    docs = await db.orders.find({"student_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if user["role"] in ("STUDENT", "NEIGHBOR") and order["student_id"] != user["id"]:
        raise HTTPException(403, "Not your order")
    return order


@api.post("/orders/{order_id}/rate")
async def rate_order(order_id: str, body: RatingBody, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    order = await db.orders.find_one({"id": order_id})
    if not order or order["student_id"] != user["id"]:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id},
                               {"$set": {"rating": body.stars, "feedback": body.feedback}})
    await db.ratings.insert_one({"id": new_id(), "order_id": order_id, "student_id": user["id"],
                                 "stars": body.stars, "feedback": body.feedback, "created_at": now_iso()})
    return {"ok": True}


@api.post("/orders/{order_id}/reorder")
async def reorder(order_id: str, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    prev = await db.orders.find_one({"id": order_id})
    if not prev or prev["student_id"] != user["id"]:
        raise HTTPException(404, "Order not found")
    body = OrderCreate(
        services=prev.get("services") or [prev["service_type"]],
        order_type=prev.get("order_type", "Pickup & Delivery"),
        branded_bags=prev.get("branded_bags", {}),
        pickup_date=prev["pickup_date"],
        pickup_window=prev["pickup_window"], delivery_date=prev["delivery_date"],
        delivery_window=prev["delivery_window"], bags=prev["bags"], rush=prev["rush"],
        bedding_addon=prev["bedding_addon"], preferences=prev["preferences"],
        stain_notes=prev["stain_notes"],
    )
    return await create_order(body, user)


# ================================ ADMIN ================================
@api.get("/admin/orders")
async def admin_orders(status_filter: Optional[str] = None, user: dict = Depends(require_role("ADMIN"))):
    q = {}
    if status_filter and status_filter != "All":
        q["status"] = status_filter
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.post("/admin/orders/{order_id}/approve")
async def approve_order(order_id: str, body: ApproveBody, user: dict = Depends(require_role("ADMIN"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    updates = {"status": "Approved"}
    if body.price is not None:
        updates["price"] = body.price
    if body.pickup_window:
        updates["pickup_window"] = body.pickup_window
    if body.delivery_window:
        updates["delivery_window"] = body.delivery_window
    if body.admin_note:
        updates["admin_note"] = body.admin_note
    await db.orders.update_one({"id": order_id}, {"$set": updates})
    await push_history(order_id, "Approved")
    await notify("STUDENT", "push", f"Your request {order['code']} was approved!", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api.post("/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectBody, user: dict = Depends(require_role("ADMIN"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id},
                               {"$set": {"status": "Rejected", "admin_note": body.reason}})
    await push_history(order_id, "Rejected")
    await notify("STUDENT", "push", f"Your request {order['code']} was rejected.", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api.post("/admin/orders/{order_id}/release")
async def release_job(order_id: str, body: ReleaseBody, user: dict = Depends(require_role("ADMIN"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] not in ("Approved", "Quality Check", "Delivery Job Released",
                               "Pickup Job Released", "Driver Assigned"):
        # allow releasing after approval or after processing for delivery
        pass
    job = {
        "id": new_id(), "order_id": order_id, "order_code": order["code"],
        "job_type": body.job_type, "campus": order["campus"], "building": order["building"],
        "service_type": order["service_type"], "payout": body.payout,
        "pickup_window": order["pickup_window"], "delivery_window": order["delivery_window"],
        "special_instructions": order.get("stain_notes", ""),
        "auto_assign_first_claim": body.auto_assign_first_claim,
        "status": "Open", "driver_id": None, "driver_name": None,
        "requests": [], "created_at": now_iso(),
    }
    await db.jobs.insert_one(job)
    new_status = "Delivery Job Released" if body.job_type == "Delivery" else "Pickup Job Released"
    await db.orders.update_one({"id": order_id}, {"$set": {"status": new_status}})
    await push_history(order_id, new_status)
    await notify("DRIVER", "push", f"New {body.job_type} job available at {order['campus']}", order_id)
    job.pop("_id", None)
    return job


@api.post("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, body: StatusUpdate, user: dict = Depends(require_role("ADMIN"))):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(400, "Invalid status")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status}})
    await push_history(order_id, body.status)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await notify("STUDENT", "push", f"Order {order['code']}: {body.status}", order_id)
    return order


@api.post("/admin/orders/{order_id}/payment")
async def mark_payment(order_id: str, body: StatusUpdate, user: dict = Depends(require_role("ADMIN"))):
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": body.status}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api.get("/admin/qr/{code}")
async def qr_lookup(code: str, user: dict = Depends(require_role("ADMIN", "DRIVER"))):
    order = await db.orders.find_one({"code": code.upper()}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@api.get("/admin/jobs")
async def admin_jobs(user: dict = Depends(require_role("ADMIN"))):
    return await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/jobs/{job_id}/assign")
async def assign_driver(job_id: str, body: StatusUpdate, user: dict = Depends(require_role("ADMIN"))):
    """body.status carries the driver_id to assign."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    driver = await db.users.find_one({"id": body.status})
    if not driver:
        raise HTTPException(404, "Driver not found")
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "status": "Assigned", "driver_id": driver["id"], "driver_name": driver["name"]}})
    await db.orders.update_one({"id": job["order_id"]}, {"$set": {"status": "Driver Assigned"}})
    await push_history(job["order_id"], "Driver Assigned")
    await notify("STUDENT", "push", f"Driver {driver['name']} assigned to your order", job["order_id"])
    return await db.jobs.find_one({"id": job_id}, {"_id": 0})


@api.get("/admin/analytics")
async def analytics(user: dict = Depends(require_role("ADMIN"))):
    orders = await db.orders.find({}, {"_id": 0}).to_list(2000)
    revenue = sum(o.get("price", 0) for o in orders if o.get("payment_status") == "Paid")
    by_campus = {}
    by_service = {}
    for o in orders:
        by_campus[o.get("campus", "?")] = by_campus.get(o.get("campus", "?"), 0) + 1
        by_service[o["service_type"]] = by_service.get(o["service_type"], 0) + 1
    top_service = max(by_service, key=by_service.get) if by_service else "-"
    students = await db.users.count_documents({"role": "STUDENT"})
    drivers = await db.users.count_documents({"role": "DRIVER"})
    open_jobs = await db.jobs.count_documents({"status": "Open"})
    return {
        "total_orders": len(orders),
        "revenue_estimate": round(revenue, 2),
        "active_students": students,
        "active_drivers": drivers,
        "orders_by_campus": by_campus,
        "most_requested_service": top_service,
        "pending_requests": sum(1 for o in orders if o["status"] == "Pending Admin Approval"),
        "open_driver_jobs": open_jobs,
        "completed_pickups": sum(1 for o in orders if any(h["status"] == "Picked Up" for h in o.get("history", []))),
        "completed_deliveries": sum(1 for o in orders if o["status"] == "Delivered"),
    }


@api.get("/admin/drivers")
async def list_drivers(user: dict = Depends(require_role("ADMIN"))):
    docs = await db.users.find({"role": "DRIVER"}, {"_id": 0, "password": 0}).to_list(200)
    return docs


# ================================ DRIVER ================================
@api.get("/driver/jobs/open")
async def open_jobs(user: dict = Depends(require_role("DRIVER"))):
    return await db.jobs.find({"status": "Open"}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/driver/jobs/mine")
async def my_jobs(user: dict = Depends(require_role("DRIVER"))):
    return await db.jobs.find({"driver_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/driver/jobs/{job_id}/claim")
async def claim_job(job_id: str, user: dict = Depends(require_role("DRIVER"))):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "Open":
        raise HTTPException(400, "Job no longer available")
    if job.get("auto_assign_first_claim"):
        await db.jobs.update_one({"id": job_id}, {"$set": {
            "status": "Assigned", "driver_id": user["id"], "driver_name": user["name"]}})
        await db.orders.update_one({"id": job["order_id"]}, {"$set": {"status": "Driver Assigned"}})
        await push_history(job["order_id"], "Driver Assigned")
        await notify("STUDENT", "push", f"Driver {user['name']} assigned", job["order_id"])
    else:
        await db.jobs.update_one({"id": job_id}, {
            "$set": {"status": "Requested"},
            "$addToSet": {"requests": {"driver_id": user["id"], "driver_name": user["name"]}}})
        await notify("ADMIN", "push", f"{user['name']} requested job {job['order_code']}", job["order_id"])
    return await db.jobs.find_one({"id": job_id}, {"_id": 0})


@api.post("/driver/jobs/{job_id}/status")
async def driver_job_status(job_id: str, body: StatusUpdate, user: dict = Depends(require_role("DRIVER"))):
    job = await db.jobs.find_one({"id": job_id})
    if not job or job.get("driver_id") != user["id"]:
        raise HTTPException(403, "Not your job")
    # map driver actions -> order status
    mapping = {
        "On the way": "Pickup Scheduled", "Arrived": "Pickup Scheduled",
        "Picked up": "Picked Up", "Dropped off": "Checked In",
        "Out for delivery": "Out for Delivery", "Delivered": "Delivered",
    }
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "In Progress"}})
    if body.status in mapping:
        await db.orders.update_one({"id": job["order_id"]}, {"$set": {"status": mapping[body.status]}})
        await push_history(job["order_id"], mapping[body.status])
        await notify("STUDENT", "push", f"Update: {mapping[body.status]}", job["order_id"])
    if body.status == "Delivered":
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "Completed"}})
    return await db.jobs.find_one({"id": job_id}, {"_id": 0})


# ============================== PAYMENTS (Stripe) ==============================
@api.post("/payments/checkout/{order_id}")
async def checkout(order_id: str, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    """PLACEHOLDER Stripe checkout. TODO: with STRIPE_API_KEY create a real
    PaymentIntent / Checkout Session and return the client_secret / url."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.payments.insert_one({
        "id": new_id(), "order_id": order_id, "amount": order["price"],
        "status": "succeeded_mock", "provider": "stripe_placeholder", "created_at": now_iso()})
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "Paid"}})
    return {"ok": True, "mock": True, "amount": order["price"],
            "message": "Payment simulated. Add STRIPE_API_KEY to enable live payments."}


# ============================== CAMPUSES ==============================
@api.get("/campuses")
async def campuses():
    docs = await db.campuses.find({}, {"_id": 0}).to_list(100)
    return docs


# ================================ AI FEATURES ================================
async def _ai(system: str, prompt: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=new_id(),
                   system_message=system).with_model("openai", "gpt-4o")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


@api.post("/ai/stain-tips")
async def ai_stain_tips(body: AIStainBody, user: dict = Depends(get_current_user)):
    tips = await _ai(
        "You are a professional laundry care expert. Give concise, practical stain "
        "and fabric handling tips in 3-4 short bullet points.",
        f"Service: {body.service_type}. Customer notes: {body.notes}")
    return {"tips": tips}


@api.post("/ai/support")
async def ai_support(body: AISupportBody, user: dict = Depends(require_role("ADMIN"))):
    suggestion = await _ai(
        "You are a friendly customer support agent for a college laundry service "
        "called Sour Apple VIP. Draft a warm, helpful reply in 2-3 sentences.",
        body.message)
    return {"suggestion": suggestion}


@api.get("/")
async def root():
    return {"message": "Sour Apple VIP Laundry API"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ================================ SEED DATA ================================
@app.on_event("startup")
async def seed():
    await db.users.create_index("email", unique=True)
    # Admin
    if not await db.users.find_one({"email": os.environ["ADMIN_EMAIL"].lower()}):
        await db.users.insert_one({
            "id": new_id(), "name": "Sour Apple Admin",
            "email": os.environ["ADMIN_EMAIL"].lower(),
            "password": hash_pw(os.environ["ADMIN_PASSWORD"]), "role": "ADMIN",
            "phone": "", "campus": "", "building": "", "room": "", "created_at": now_iso()})
        logger.info("Seeded admin account")
    # Campus
    if await db.campuses.count_documents({}) == 0:
        await db.campuses.insert_one({"id": new_id(), "name": "State University",
                                      "service_area": "Main Campus", "active": True})
    # Subscription plan
    if await db.plans.count_documents({}) == 0:
        await db.plans.insert_many([
            {"id": new_id(), "name": "Weekly Plan", "price": 45, "interval": "week"},
            {"id": new_id(), "name": "Monthly Plan", "price": 150, "interval": "month"},
        ])
    # Sample student
    student = await db.users.find_one({"email": "student@sourapple.com"})
    if not student:
        student = {"id": new_id(), "name": "Jamie Student", "email": "student@sourapple.com",
                   "password": hash_pw("Student123!"), "role": "STUDENT", "phone": "555-0100",
                   "campus": "State University", "building": "West Hall", "room": "204",
                   "created_at": now_iso()}
        await db.users.insert_one(student)
    # Sample approved driver
    if not await db.users.find_one({"email": "driver@sourapple.com"}):
        await db.users.insert_one({
            "id": new_id(), "name": "Riley Driver", "email": "driver@sourapple.com",
            "password": hash_pw("Driver123!"), "role": "DRIVER", "phone": "555-0200",
            "campus": "State University", "building": "", "room": "",
            "driver_status": "Approved", "created_at": now_iso()})
    # Sample pending order + open pickup job
    if await db.orders.count_documents({}) == 0:
        oid = new_id()
        code = "SA-" + oid[:8].upper()
        await db.orders.insert_one({
            "id": oid, "code": code, "qr_code": code, "student_id": student["id"],
            "student_name": student["name"], "campus": "State University",
            "building": "West Hall", "room": "204", "phone": "555-0100",
            "service_type": "Wash & Fold", "bags": 2, "rush": False, "bedding_addon": False,
            "preferences": ["Cold wash only", "Separate whites/colors"],
            "stain_notes": "Coffee stain on white shirt", "photos": [], "referral_code": "",
            "price": estimate_price("Wash & Fold", 2, False, False),
            "status": "Pending Admin Approval", "payment_status": "Unpaid", "admin_note": "",
            "pickup_date": "2026-06-20", "pickup_window": "9am - 12pm",
            "delivery_date": "2026-06-22", "delivery_window": "3pm - 6pm",
            "rating": None, "feedback": "",
            "history": [{"status": "Request Submitted", "at": now_iso()},
                        {"status": "Pending Admin Approval", "at": now_iso()}],
            "created_at": now_iso()})
        logger.info("Seeded sample pending order")


@app.on_event("shutdown")
async def shutdown():
    client.close()
