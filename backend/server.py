"""
Sour Apple VIP Laundry Services — Backend API
FastAPI + MongoDB. JWT auth with roles: STUDENT, ADMIN, DRIVER, NEIGHBOR.
Universal Web & Mobile Architecture.
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
from pydantic import BaseModel, EmailStr, BeforeValidator
from passlib.context import CryptContext
from jose import jwt, JWTError
import stripe
import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sourapple")

# Database & Environment
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ.get("DB_NAME", "sour_apple_laundry")]

JWT_SECRET = os.environ.get("JWT_SECRET", "sourapplesecretkey1234567890")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://sourapplelaundry.com")
CASHAPP_HANDLE = os.environ.get("CASHAPP_HANDLE", "$SourAppleLaundry")
VENMO_HANDLE = os.environ.get("VENMO_HANDLE", "@SourAppleLaundry")

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
    "Request Submitted",
    "Pending Admin Approval",
    "Approved",
    "Rejected",
    "Needs Customer Follow-Up",
    "Pickup Job Released",
    "Driver Assigned",
    "Pickup Scheduled",
    "Picked Up",
    "Checked In",
    "Washing",
    "Drying",
    "Folding",
    "Quality Check",
    "Ready for Pickup",
    "Delivery Job Released",
    "Out for Delivery",
    "Delivered",
    "Pickup Confirmed",
    "Cancelled",
]

SERVICE_PRICES = {
    "Wash & Fold": 20,
    "Bedding": 25,
    "Towels": 15,
    "Rush Laundry": 40,
    "Subscription Laundry Plan": 60,
}
RUSH_FEE = 20
BEDDING_ADDON = 25
EXTRA_BAG_FEE = 5
BRANDED_BAG_PRICES = {"small": 8, "medium": 10, "large": 12}

# ------------------------------ Pydantic models ------------------------------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "STUDENT"
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
    service_type: Optional[str] = None
    services: List[str] = []
    customer_type: str = "Neighborhood Resident"
    college: str = ""
    dorm: str = ""
    directions: str = ""
    order_type: str = "Pickup & Delivery"
    branded_bags: dict = {}
    pickup_date: str = ""
    pickup_window: str = ""
    delivery_date: str = ""
    delivery_window: str = ""
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    preferences: List[str] = []
    stain_notes: str = ""
    photos: List[str] = []
    referral_code: str = ""
    contract_agreed: bool = True
    signature_name: str = ""
    signed_at: Optional[str] = None

    # Verification Photo & Pricing Fields
    bag_image_base64: Optional[str] = None
    image_review_requested: bool = False
    image_review_email: Optional[str] = "natture1st@gmail.com"
    bag_price_each: Optional[float] = None

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
    job_type: str
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

class MethodBody(BaseModel):
    method: str

class MessageBody(BaseModel):
    text: str

class ChangeBody(BaseModel):
    note: str = ""

class ScheduleBody(BaseModel):
    pickup_window: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_window: Optional[str] = None

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
    cred_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials", {"WWW-Authenticate": "Bearer"})
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
    return {k: u.get(k, "") for k in ["id", "name", "email", "role", "phone", "campus", "building", "room"]}

async def notify(to_role: str, channel: str, message: str, order_id: str = ""):
    await db.notifications.insert_one({
        "id": new_id(),
        "to_role": to_role,
        "channel": channel,
        "message": message,
        "order_id": order_id,
        "read": False,
        "created_at": now_iso(),
    })

async def push_history(order_id: str, status_val: str):
    await db.orders.update_one(
        {"id": order_id},
        {"$push": {"history": {"status": status_val, "at": now_iso()}}},
    )

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

def tracking_number(customer_type: str, college: str, dorm: str, last_name: str, date_str: str) -> str:
    ln = "".join(c for c in (last_name or "CUSTOMER") if c.isalnum()).upper() or "CUSTOMER"
    d = "".join(c for c in (date_str or "") if c.isdigit()) or datetime.now(timezone.utc).strftime("%m%d%Y")
    if customer_type in ("College Student", "MVCC Student Curbside"):
        prefix = "MV" if college == "MVCC" else "UC"
        dm = "".join(c for c in (dorm or "DORM") if c.isalnum()).upper() or "DORM"
        return f"{prefix}-{dm}-{ln}-{d}"
    return f"{ln}-{d}"

# =============================== AUTH ROUTES ===============================
@api.post("/auth/register")
async def register(body: UserCreate):
    if body.role not in ("STUDENT", "DRIVER", "NEIGHBOR"):
        raise HTTPException(400, "Registration allowed for STUDENT, NEIGHBOR or DRIVER only")
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": new_id(),
        "name": body.name,
        "email": body.email.lower(),
        "password": hash_pw(body.password),
        "role": body.role,
        "phone": body.phone or "",
        "campus": body.campus or "",
        "building": body.building or "",
        "room": body.room or "",
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

# ============================== ORDERS & BOOKINGS ============================
@api.post("/orders/estimate")
async def price_estimate(body: PriceEstimate):
    services = body.services or ([body.service_type] if body.service_type else [])
    return {"estimate": estimate_price(services, body.bags, body.rush, body.bedding_addon, body.branded_bags)}

@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    if not body.contract_agreed:
        raise HTTPException(400, "You must accept the Sour Apple Service Agreement to place an order.")

    services = body.services or ([body.service_type] if body.service_type else ["Wash & Fold"])
    price = body.bag_price_each * body.bags if body.bag_price_each else estimate_price(services, body.bags, body.rush, body.bedding_addon, body.branded_bags)
    if body.rush:
        price += RUSH_FEE
    if body.bedding_addon:
        price += BEDDING_ADDON

    oid = new_id()
    last_name = (user["name"].split() or ["Customer"])[-1]
    code = tracking_number(body.customer_type, body.college, body.dorm, last_name, body.pickup_date)

    photo_list = [body.bag_image_base64] if body.bag_image_base64 else body.photos

    order = {
        "id": oid,
        "code": code,
        "qr_code": code,
        "student_id": user["id"],
        "student_name": user["name"],
        "customer_type": body.customer_type,
        "college": body.college,
        "campus": body.college or user.get("campus", ""),
        "building": body.dorm or user.get("building", ""),
        "dorm": body.dorm,
        "directions": body.directions,
        "room": user.get("room", ""),
        "phone": user.get("phone", ""),
        "service_type": ", ".join(services),
        "services": services,
        "order_type": body.order_type,
        "branded_bags": body.branded_bags,
        "bags": body.bags,
        "rush": body.rush,
        "bedding_addon": body.bedding_addon,
        "preferences": body.preferences,
        "stain_notes": body.stain_notes,
        "photos": photo_list,
        "bag_image_base64": body.bag_image_base64,
        "image_review_requested": body.image_review_requested,
        "image_review_email": body.image_review_email,
        "bag_price_each": body.bag_price_each,
        "referral_code": body.referral_code,
        "price": round(float(price), 2),
        "status": "Pending Admin Approval",
        "payment_status": "Unpaid",
        "payment_method": "",
        "admin_note": "",
        "pickup_date": body.pickup_date,
        "pickup_window": body.pickup_window,
        "delivery_date": body.delivery_date,
        "delivery_window": body.delivery_window,
        "rating": None,
        "feedback": "",
        "pickup_confirmed": False,
        "contract_agreed": True,
        "signature_name": body.signature_name or user["name"],
        "signed_at": body.signed_at or now_iso(),
        "history": [
            {"status": "Request Submitted", "at": now_iso()},
            {"status": "Pending Admin Approval", "at": now_iso()},
        ],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    await notify("ADMIN", "in_app", f"New booking request {code} from {user['name']}", oid)
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

# ================================ ADMIN ROUTES ==============================
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
    await notify("STUDENT", "in_app", f"Your request {order['code']} was approved!", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

@api.post("/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectBody, user: dict = Depends(require_role("ADMIN"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Rejected", "admin_note": body.reason}})
    await push_history(order_id, "Rejected")
    await notify("STUDENT", "in_app", f"Your request {order['code']} was rejected.", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

@api.post("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, body: StatusUpdate, user: dict = Depends(require_role("ADMIN"))):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(400, "Invalid status")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status}})
    await push_history(order_id, body.status)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await notify("STUDENT", "in_app", f"Order {order['code']}: {body.status}", order_id)
    return order

@api.post("/admin/orders/{order_id}/payment")
async def mark_payment(order_id: str, body: StatusUpdate, user: dict = Depends(require_role("ADMIN"))):
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": body.status}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

# ============================== PAYMENTS ====================================
@api.get("/payments/methods")
async def payment_methods():
    return {"cashapp": CASHAPP_HANDLE, "venmo": VENMO_HANDLE, "stripe_enabled": bool(stripe.api_key)}

@api.post("/payments/manual/{order_id}")
async def manual_pay(order_id: str, body: MethodBody, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_method": body.method, "payment_status": "Pending Confirmation"}})
    await notify("ADMIN", "in_app", f"{user['name']} reported payment via {body.method} for {order['code']}", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

# ============================== IN-APP MESSAGES ============================
@api.get("/orders/{order_id}/messages")
async def get_messages(order_id: str, user: dict = Depends(get_current_user)):
    return await db.messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)

@api.post("/orders/{order_id}/messages")
async def post_message(order_id: str, body: MessageBody, user: dict = Depends(get_current_user)):
    msg = {
        "id": new_id(),
        "order_id": order_id,
        "sender_role": user["role"],
        "sender_name": user["name"],
        "text": body.text,
        "created_at": now_iso()
    }
    await db.messages.insert_one(msg)
    to = "ADMIN" if user["role"] in ("STUDENT", "NEIGHBOR") else "STUDENT"
    await notify(to, "in_app", f"New message on {order_id}", order_id)
    msg.pop("_id", None)
    return msg

# ============================== AI STUB ====================================
@api.post("/ai/stain-tips")
async def ai_stain_tips(body: AIStainBody, user: dict = Depends(get_current_user)):
    return {"tips": "Pre-treat stains with cold water and mild detergent before washing. Do not apply heat until the stain is fully lifted."}

@api.get("/")
async def root():
    return {"message": "Sour Apple VIP Laundry API Running Live"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ================================ SEED DATA ================================
@app.on_event("startup")
async def seed():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "natture1st@gmail.com").lower()
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": new_id(),
            "name": "Sour Apple Admin",
            "email": admin_email,
            "password": hash_pw(os.environ.get("ADMIN_PASSWORD", "AdminPass123!")),
            "role": "ADMIN",
            "phone": "",
            "campus": "",
            "building": "",
            "room": "",
            "created_at": now_iso()
        })
        logger.info("Seeded admin account")

@app.on_event("shutdown")
async def shutdown():
    client.close()
