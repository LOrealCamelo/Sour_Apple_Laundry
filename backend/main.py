"""
Sour Apple Wash & Fold VIP Laundry Services — Backend API
Short Name: Sour Apple Wash & Fold
FastAPI + MongoDB. JWT auth with roles: STUDENT, ADMIN, DRIVER, NEIGHBOR.
Universal Web Architecture with Static Frontend Mount.
"""

import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sourapple")

# ----------------------------- Database & Environment -----------------------------
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "sour_apple_laundry")]

JWT_SECRET = os.environ.get("JWT_SECRET", "supersecretkey1234567890123456")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))

stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
CASHAPP_HANDLE = os.environ.get("CASHAPP_HANDLE", "$SourAppleLaundry")
VENMO_HANDLE = os.environ.get("VENMO_HANDLE", "@SourAppleLaundry")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Official Branding Titles
BUSINESS_FULL_NAME = "Sour Apple Wash & Fold VIP Laundry Services"
BUSINESS_SHORT_NAME = "Sour Apple Wash & Fold"

app = FastAPI(
    title=BUSINESS_FULL_NAME,
    description="Official backend API for Sour Apple Wash & Fold",
    version="2.0.0",
)
api = APIRouter(prefix="/api")

# ----------------------------- Helpers & Constants -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

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

def estimate_price(customer_type: str, bag_size: str, bags: int = 1, rush: bool = False, bedding: bool = False, towels: bool = False) -> float:
    if customer_type == "College Student":
        base = 10.0 if bag_size == "Small" else (20.0 if bag_size == "Medium" else 30.0)
    else:
        base = 20.0 if bag_size == "Small" else (30.0 if bag_size == "Medium" else 40.0)
    total = base * max(1, bags)
    if rush:
        total += 20.0
    if bedding:
        total += 25.0
    if towels:
        total += 15.0
    return round(float(total), 2)

def tracking_number(customer_type: str, college: str, dorm: str, last_name: str, date_str: str) -> str:
    ln = "".join(c for c in (last_name or "CUSTOMER") if c.isalnum()).upper() or "CUSTOMER"
    d = "".join(c for c in (date_str or "") if c.isdigit()) or datetime.now(timezone.utc).strftime("%m%d%Y")
    if customer_type == "College Student":
        prefix = "MV" if college == "MVCC" else "UC"
        dm = "".join(c for c in (dorm or "DORM") if c.isalnum()).upper() or "DORM"
        return f"{prefix}-{dm}-{ln}-{d}"
    return f"{ln}-{d}"

# ----------------------------- Pydantic Models -----------------------------
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "STUDENT"
    phone: Optional[str] = ""
    campus: Optional[str] = ""
    building: Optional[str] = ""
    room: Optional[str] = ""

class UserLogin(BaseModel):
    email: str
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
    bag_size: str = "Small"
    is_mvcc: bool = True
    customer_type: str = "College Student"
    college: str = "MVCC"
    dorm: str = ""
    directions: str = ""
    bags: int = 1
    add_ons: List[str] = []
    rush: bool = False
    bedding_addon: bool = False
    preferences: List[str] = []
    stain_notes: str = ""
    bag_photo_url: Optional[str] = None
    photos: List[str] = []
    digital_contract_accepted: bool = True
    e_signature: str = ""
    pickup_date: str = ""
    pickup_window: str = ""
    delivery_date: str = ""
    delivery_window: str = ""

class PriceEstimate(BaseModel):
    customer_type: str = "College Student"
    bag_size: str = "Small"
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    towels_addon: bool = False

class ApproveBody(BaseModel):
    price: Optional[float] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    admin_note: Optional[str] = ""

class RejectBody(BaseModel):
    reason: str = ""

class StatusUpdate(BaseModel):
    status: str

class MethodBody(BaseModel):
    method: str

class MessageBody(BaseModel):
    text: str

# ----------------------------- Auth Helpers -----------------------------
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

# ----------------------------- Notifications -----------------------------
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
        {"$push": {"status_history": {"status": status_val, "at": now_iso()}}},
    )

# =============================== AUTH ROUTES ===============================
@api.post("/auth/register")
async def register(body: UserCreate):
    if body.role not in ("STUDENT", "DRIVER", "NEIGHBOR"):
        raise HTTPException(400, "Self-registration allowed for STUDENT, NEIGHBOR or DRIVER only")
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

# ============================== ORDERS & CONTRACT ==============================
@api.post("/orders/estimate")
async def price_estimate(body: PriceEstimate):
    return {"estimate": estimate_price(body.customer_type, body.bag_size, body.bags, body.rush, body.bedding_addon, body.towels_addon)}

@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    if not body.digital_contract_accepted:
        raise HTTPException(400, "You must accept the Sour Apple Service Agreement to book.")

    price = estimate_price(
        body.customer_type,
        body.bag_size,
        body.bags,
        body.rush,
        body.bedding_addon,
        ("Towels" in body.add_ons),
    )
    oid = new_id()
    last_name = (user["name"].split() or ["Customer"])[-1]
    code = tracking_number(body.customer_type, body.college, body.dorm, last_name, body.pickup_date)

    order = {
        "id": oid,
        "code": code,
        "qr_code": code,
        "user_id": user["id"],
        "student_id": user["id"],
        "student_name": user["name"],
        "customer_type": body.customer_type,
        "is_mvcc": body.is_mvcc,
        "college": body.college,
        "campus": body.college or user.get("campus", ""),
        "building": body.dorm or user.get("building", ""),
        "dorm": body.dorm,
        "directions": body.directions,
        "room": user.get("room", ""),
        "phone": user.get("phone", ""),
        "bag_size": body.bag_size,
        "bags": body.bags,
        "add_ons": body.add_ons,
        "rush": body.rush,
        "bedding_addon": body.bedding_addon,
        "preferences": body.preferences,
        "stain_notes": body.stain_notes,
        "bag_photo_url": body.bag_photo_url,
        "photos": body.photos,
        "total_price": price,
        "status": "Pending Admin Approval",
        "payment_reported": False,
        "payment_method": None,
        "admin_note": "",
        "pickup_date": body.pickup_date,
        "pickup_window": body.pickup_window,
        "delivery_date": body.delivery_date,
        "delivery_window": body.delivery_window,
        "digital_contract_accepted": True,
        "e_signature": body.e_signature or user["name"],
        "signed_at": now_iso(),
        "status_history": [
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
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if user["role"] in ("STUDENT", "NEIGHBOR") and order.get("user_id") != user["id"]:
        raise HTTPException(403, "Not your order")
    return order

# ================================ ADMIN ROUTES ================================
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
        updates["total_price"] = body.price
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

# ================================ PAYMENTS ================================
@api.get("/payments/methods")
async def payment_methods():
    return {"cashapp": CASHAPP_HANDLE, "venmo": VENMO_HANDLE, "stripe_enabled": bool(stripe.api_key)}

@api.post("/payments/manual/{order_id}")
async def manual_pay(order_id: str, body: MethodBody, user: dict = Depends(require_role("STUDENT", "NEIGHBOR"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_method": body.method, "payment_reported": True, "status": "Pending Payment Confirmation"}})
    await notify("ADMIN", "in_app", f"{user['name']} reported payment via {body.method} for {order['code']}", order_id)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

# ============================== IN-APP MESSAGING ==============================
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
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    to = "ADMIN" if user["role"] in ("STUDENT", "NEIGHBOR") else "STUDENT"
    await notify(to, "in_app", f"New message on {order_id}", order_id)
    msg.pop("_id", None)
    return msg

# Include API Router
app.include_router(api)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================== STATIC FRONTEND MOUNTING ==========================
STATIC_DIR = ROOT_DIR / "static"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse(f"<h2>{BUSINESS_FULL_NAME} API is Live. Please add index.html to backend/static/ to view storefront.</h2>")

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    file_path = STATIC_DIR / full_path
    if STATIC_DIR.exists() and file_path.is_file():
        return FileResponse(file_path)
    index_file = STATIC_DIR / "index.html"
    if STATIC_DIR.exists() and index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")

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
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin account with {admin_email}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
