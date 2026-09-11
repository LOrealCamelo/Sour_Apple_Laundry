"""
Sour Apple VIP Laundry Services — All-in-One Production Engine
FastAPI + MongoDB + Web App + Admin Portal + Customer Order Tracker + Stripe + Cash App / Venmo Verification
"""

import os
import uuid
import smtplib
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, APIRouter, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sourapple")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ.get("DB_NAME", "sour_apple_laundry")]

JWT_SECRET = os.environ.get("JWT_SECRET", "sourapplesecretkey1234567890")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "natture1st@gmail.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "AdminPass123!")

# Stripe Settings
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# Email Alert Settings (Google App Password)
SMTP_USER = os.environ.get("SMTP_USER", "natture1st@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

# Public GitHub Asset URLs for 100% Reliable CDN Loading
GITHUB_ASSET_BASE = "https://raw.githubusercontent.com/LOrealCamelo/Sour_Apple_Laundry/main/frontend/assets/images"
ICON_URL = f"{GITHUB_ASSET_BASE}/icon.png"
CROWN_URL = f"{GITHUB_ASSET_BASE}/crown.png"
BAG_SIZES_URL = f"{GITHUB_ASSET_BASE}/bag-sizes.jpg"
FAVICON_URL = f"{GITHUB_ASSET_BASE}/favicon.png"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Sour Apple VIP Laundry")
api = APIRouter(prefix="/api")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

# Send booking email alert to Admin (LOreal)
def send_booking_email_alert(order: dict):
    if not SMTP_PASSWORD:
        logger.info("SMTP_PASSWORD not configured. Skipping admin alert email.")
        return
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = f"🍏 New Laundry Order: {order['code']} (${order['price']:.2f})"
        
        body_text = f"""Hello LOreal,

A new laundry order was just submitted on your website!

• Order Code: {order['code']}
• Customer: {order['customer_name']}
• Email: {order['email']}
• Phone: {order['phone']}
• Drop-Off Date: {order['pickup_date']} ({order['pickup_window']})
• Location: {order['location']}
• Total Price: ${order['price']:.2f}

Click below to review the bag photo and approve the order in your Admin Portal:
https://sourapplelaundry.com/admin

— Sour Apple VIP Laundry System
"""
        msg.attach(MIMEText(body_text, "plain"))
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [ADMIN_EMAIL], msg.as_string())
        logger.info(f"Email alert sent to {ADMIN_EMAIL} for order {order['code']}")
    except Exception as e:
        logger.error(f"Failed to send admin email alert: {e}")

# Send automatic approval email to the Customer
def send_customer_approval_email(order: dict):
    if not SMTP_PASSWORD or not order.get("email"):
        return
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = order["email"]
        msg["Subject"] = f"🍏 Sour Apple VIP Laundry: Order {order['code']} APPROVED!"
        
        body_text = f"""Hi {order.get('customer_name', 'Valued Customer')},

Great news! Your laundry order ({order['code']}) has been reviewed and APPROVED by LOreal!

• Total Due: ${order.get('price', 30.0):.2f}
• Scheduled Drop-Off Window: {order.get('pickup_date', '')} ({order.get('pickup_window', '')})

Click the link below to select your contactless payment (Credit Card / Cash App / Venmo) and view your South Utica hallway drop-off instructions:
https://sourapplelaundry.com/orders/{order['code']}

Thank you for choosing Sour Apple VIP Laundry Services!
Call/Text: (315) 791-7389 | Email: natture1st@gmail.com
"""
        msg.attach(MIMEText(body_text, "plain"))
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [order["email"]], msg.as_string())
        logger.info(f"Customer approval email sent to {order['email']}")
    except Exception as e:
        logger.error(f"Failed to send customer approval email: {e}")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    location: str
    pickup_date: str
    pickup_window: str = "Morning (9am - 12pm)"
    customer_type: str = "Neighborhood Resident"
    college: str = ""
    dorm: str = ""
    service_type: Optional[str] = "Standard Load"
    services: List[str] = []
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    preferences: List[str] = []
    stain_notes: str = ""
    bag_image_base64: Optional[str] = None
    bag_price_each: Optional[float] = None
    contract_agreed: bool = True
    signature_name: str = ""
    signed_at: Optional[str] = None

class ApproveBody(BaseModel):
    price: Optional[float] = None
    admin_note: Optional[str] = ""

class RejectBody(BaseModel):
    reason: Optional[str] = ""

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

# =============================== API ROUTES ===============================
@api.post("/auth/login")
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": make_token(user), "token_type": "bearer", "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}}

@api.post("/orders")
async def create_order(body: OrderCreate):
    if not body.contract_agreed:
        raise HTTPException(400, "Must agree to Service Agreement")
    
    price = (body.bag_price_each or 20.0) * body.bags
    if body.rush:
        price += 20.0
    if body.bedding_addon:
        price += 25.0

    oid = new_id()

    # Custom Sequential Ticket: 1stInitial_LastName_MMDDYY
    first_init = (body.first_name.strip()[:1] or "C").upper()
    last_clean = "".join(c for c in body.last_name.strip() if c.isalnum()).upper() or "CUSTOMER"
    date_part = datetime.now().strftime("%m%d%y")
    base_code = f"{first_init}_{last_clean}_{date_part}"
    code = base_code

    existing = await db.orders.find_one({"code": code})
    if existing:
        suffix_char = 65  # 'A'
        while existing and suffix_char <= 90:
            code = f"{base_code}{chr(suffix_char)}"
            existing = await db.orders.find_one({"code": code})
            suffix_char += 1

    full_name = f"{body.first_name.strip()} {body.last_name.strip()}"

    order = {
        "id": oid,
        "code": code,
        "customer_name": full_name,
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "email": body.email.strip().lower(),
        "phone": body.phone.strip(),
        "customer_type": body.customer_type,
        "college": body.college,
        "dorm": body.dorm or body.location,
        "location": body.location.strip(),
        "service_type": body.service_type,
        "services": body.services,
        "bags": body.bags,
        "rush": body.rush,
        "bedding_addon": body.bedding_addon,
        "preferences": body.preferences,
        "stain_notes": body.stain_notes,
        "bag_image_base64": body.bag_image_base64,
        "photos": [body.bag_image_base64] if body.bag_image_base64 else [],
        "price": round(float(price), 2),
        "status": "Pending Admin Approval",
        "payment_status": "Unpaid",
        "pickup_date": body.pickup_date,
        "pickup_window": body.pickup_window,
        "signature_name": body.signature_name or full_name,
        "signed_at": body.signed_at or now_iso(),
        "admin_note": "",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)

    # Automatically notify LOreal by email
    asyncio.create_task(asyncio.to_thread(send_booking_email_alert, order))

    return order

@api.get("/orders/{order_id}")
async def get_order_by_id(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@api.get("/orders/lookup/{code}")
async def get_order_by_code(code: str):
    order = await db.orders.find_one({"code": code}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@api.get("/admin/orders")
async def admin_orders():
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api.post("/admin/orders/{order_id}/approve")
async def approve_order(order_id: str, body: Optional[ApproveBody] = None):
    updates = {"status": "Approved"}
    if body and body.price is not None:
        updates["price"] = body.price
    if body and body.admin_note:
        updates["admin_note"] = body.admin_note
    await db.orders.update_one({"id": order_id}, {"$set": updates})

    order = await db.orders.find_one({"id": order_id})
    if order:
        asyncio.create_task(asyncio.to_thread(send_customer_approval_email, order))

    return {"ok": True}

@api.post("/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, body: Optional[RejectBody] = None):
    reason = body.reason if body else "Declined"
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Rejected", "admin_note": reason}})
    return {"ok": True}

# =============================== MARK PAID ROUTE (CASH APP / VENMO) ===============================
@api.post("/admin/orders/{order_id}/mark_paid")
async def mark_order_paid(order_id: str):
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "Paid"}})
    return {"ok": True}

@api.post("/orders/{code}/claim_paid")
async def claim_payment_sent(code: str):
    await db.orders.update_one({"code": code}, {"$set": {"payment_status": "Verifying Payment"}})
    return {"ok": True}

# =============================== STRIPE CHECKOUT ROUTE ===============================
@app.get("/payments/stripe/checkout/{code}")
async def stripe_checkout(code: str):
    order = await db.orders.find_one({"code": code})
    if not order:
        raise HTTPException(404, "Order not found")
    
    stripe_key = os.environ.get("STRIPE_API_KEY", "")
    if not stripe_key:
        raise HTTPException(400, "Stripe API Key not configured in Render environment.")

    import stripe
    stripe.api_key = stripe_key

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            customer_email=order.get("email"),
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Sour Apple VIP Laundry - Order {order['code']}",
                        "description": f"{order.get('service_type', 'Laundry Service')} ({order.get('bags', 1)} Bag)"
                    },
                    "unit_amount": int(round(float(order["price"]) * 100))
                },
                "quantity": 1,
            }],
            success_url=f"https://sourapplelaundry.com/orders/{order['code']}?paid=1",
            cancel_url=f"https://sourapplelaundry.com/orders/{order['code']}",
            metadata={"order_code": order["code"], "order_id": order["id"]},
        )
        return RedirectResponse(url=session.url, status_code=303)
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(500, f"Stripe Checkout error: {str(e)}")

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# =============================== PWA MANIFEST ===============================
@app.get("/manifest.json")
async def get_manifest():
    return {
        "name": "Sour Apple VIP Laundry",
        "short_name": "Sour Apple",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0A0A0F",
        "theme_color": "#0A0A0F",
        "icons": [
            {
                "src": ICON_URL,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": ICON_URL,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any maskable"
            }
        ]
    }

# =============================== CUSTOMER ORDER TRACKING & PAYMENT PAGE ===============================
@app.get("/orders/{code}", response_class=HTMLResponse)
async def serve_order_status(code: str, paid: Optional[str] = None):
    order = await db.orders.find_one({"code": code})
    if not order:
        return HTMLResponse(f"""
        <!DOCTYPE html>
        <html>
        <head><title>Order Not Found</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-zinc-950 text-white min-h-screen flex items-center justify-center p-4">
          <div class="text-center max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <h1 class="text-xl font-black text-amber-400 mb-2">Order Not Found</h1>
            <p class="text-xs text-zinc-400 mb-4">We could not find an order with code: <span class="text-white font-mono">{code}</span></p>
            <a href="/" class="px-4 py-2 rounded-xl bg-lime-400 text-black font-black text-xs uppercase">Back to Home</a>
          </div>
        </body>
        </html>
        """, status_code=404)

    # Handle returning from successful Stripe payment
    if paid == "1" or order.get("payment_status") == "Paid":
        if order.get("payment_status") != "Paid":
            await db.orders.update_one({"code": code}, {"$set": {"payment_status": "Paid"}})
            order["payment_status"] = "Paid"

    is_paid = order.get("payment_status") == "Paid"
    is_verifying = order.get("payment_status") == "Verifying Payment"
    is_approved = order.get("status") == "Approved"
    price = float(order.get("price", 30.0))
    customer_name = order.get("customer_name", "Valued Customer")
    pickup_date = order.get("pickup_date", "Scheduled")
    pickup_window = order.get("pickup_window", "")

    if is_paid:
        payment_section = """
        <div class="p-5 rounded-2xl bg-lime-950/40 border-2 border-lime-400 text-center mb-5">
          <span class="text-3xl">🎉</span>
          <h2 class="text-base font-black text-lime-300 uppercase tracking-wide mt-1">PAYMENT COMPLETE!</h2>
          <p class="text-xs text-zinc-300 mt-1">Thank you! Your payment was received. See drop-off instructions below.</p>
        </div>
        """
    elif is_verifying:
        payment_section = """
        <div class="p-5 rounded-2xl bg-amber-950/40 border-2 border-amber-400 text-center mb-5">
          <span class="text-3xl">⏳</span>
          <h2 class="text-sm font-black text-amber-300 uppercase tracking-wide mt-1">VERIFYING PAYMENT...</h2>
          <p class="text-xs text-zinc-300 mt-1">We are verifying your Cash App / Venmo payment. This page will update automatically!</p>
        </div>
        """
    else:
        payment_section = f"""
        <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 mb-5">
          <h2 class="text-xs font-black uppercase text-amber-400 tracking-wider">Select Contactless Payment</h2>
          
          <!-- Stripe Credit / Debit Card -->
          <a href="/payments/stripe/checkout/{code}" class="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center justify-between shadow-lg">
            <span class="flex items-center gap-2">💳 Pay with Credit / Debit Card (Stripe)</span>
            <span>${price:.2f} →</span>
          </a>

          <!-- Cash App -->
          <a href="https://cash.app/$SourAppleLaundry/{int(price)}" target="_blank" class="w-full py-3.5 px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm flex items-center justify-between shadow-lg">
            <span>🍏 Pay with Cash App ($SourAppleLaundry)</span>
            <span>${price:.2f} →</span>
          </a>

          <!-- Venmo -->
          <a href="https://venmo.com/SourAppleLaundry" target="_blank" class="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-sm flex items-center justify-between shadow-lg">
            <span>📱 Pay with Venmo (@SourAppleLaundry)</span>
            <span>${price:.2f} →</span>
          </a>
          <p class="text-[11px] text-zinc-400 text-center">If using Cash App or Venmo, enter your Order Code <strong>{code}</strong> in the note!</p>

          <button onclick="claimPayment()" id="btn-claim-paid" class="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all">
            ✓ I Already Sent Payment via Cash App / Venmo
          </button>
        </div>
        """

    if is_approved:
        approval_html = f"""
        {payment_section}
        <div class="p-5 rounded-2xl bg-zinc-900 border-2 border-lime-400 space-y-2">
          <h2 class="text-xs font-black uppercase text-lime-400 tracking-wider">📍 Drop-Off Address & Instructions</h2>
          <p class="text-sm font-bold text-white">South Utica Location: 6 Meeker Ave, Utica, NY</p>
          <p class="text-xs text-zinc-300 leading-relaxed">
            Drop off your closed bag during your window (<strong>{pickup_window}</strong>). Place the bag in the front hallway. Zero contact required!
          </p>
        </div>
        """
    else:
        approval_html = f"""
        <div class="p-5 rounded-2xl bg-zinc-900 border border-amber-400/50 text-center space-y-3">
          <span class="text-3xl">⏳</span>
          <h2 class="text-sm font-black uppercase text-amber-400 tracking-wider">Reviewing Your Bag Photo</h2>
          <p class="text-xs text-zinc-300 leading-relaxed">
            Your booking has been received! As soon as your bag size is approved by LOreal, your contactless payment buttons and hallway drop-off address will unlock right here.
          </p>
          <p class="text-[11px] text-zinc-500">This page will automatically refresh every 5 seconds.</p>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order {code} | Sour Apple VIP Laundry</title>
  {"" if is_paid else '<meta http-equiv="refresh" content="6">'}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {{ background-color: #0A0A0F; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
    .accent-apple {{ color: #B0FF00; }}
  </style>
</head>
<body class="min-h-screen p-4 pb-20 max-w-md mx-auto">
  <div class="py-6 text-center border-b border-zinc-800 mb-6">
    <h1 class="text-2xl font-black accent-apple">SOUR APPLE VIP LAUNDRY</h1>
    <p class="text-xs text-zinc-400 mt-1">Live Order Status & Drop-Off Portal</p>
  </div>

  <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 mb-5">
    <div class="flex justify-between items-center">
      <span class="text-xs font-bold uppercase text-zinc-400">Order Code</span>
      <span class="text-lg font-black text-amber-400">{code}</span>
    </div>
    
    <div class="flex justify-between items-center">
      <span class="text-xs font-bold uppercase text-zinc-400">Status</span>
      <span class="text-xs font-black px-2.5 py-1 rounded-full {'bg-lime-400/20 text-lime-300' if is_approved else 'bg-amber-400/20 text-amber-300'}">
        {'✓ APPROVED - Ready for Drop-Off' if is_approved else '⏳ Pending Admin Review'}
      </span>
    </div>

    <div class="flex justify-between items-center">
      <span class="text-xs font-bold uppercase text-zinc-400">Payment</span>
      <span class="text-xs font-black px-2.5 py-1 rounded-full {'bg-lime-400 text-black' if is_paid else ('bg-amber-400/20 text-amber-300' if is_verifying else 'bg-zinc-800 text-zinc-400')}">
        {'PAID ✓' if is_paid else ('VERIFYING ⏳' if is_verifying else 'UNPAID')}
      </span>
    </div>

    <div class="flex justify-between items-center pt-2 border-t border-zinc-800">
      <span class="text-xs font-bold text-zinc-400">Customer</span>
      <span class="text-xs font-bold text-white">{customer_name}</span>
    </div>

    <div class="flex justify-between items-center">
      <span class="text-xs font-bold text-zinc-400">Drop-Off Window</span>
      <span class="text-xs font-bold text-white">{pickup_date} ({pickup_window})</span>
    </div>

    <div class="flex justify-between items-center pt-2 border-t border-zinc-800">
      <span class="text-sm font-bold text-white">Total Amount</span>
      <span class="text-2xl font-black accent-apple">${price:.2f}</span>
    </div>
  </div>

  {approval_html}

  <div class="text-center mt-8">
    <a href="/" class="text-xs text-zinc-500 hover:text-zinc-300 underline">← Return to Homepage</a>
  </div>

  <script>
    async function claimPayment() {{
      const btn = document.getElementById('btn-claim-paid');
      if (btn) {{ btn.innerText = 'Submitting...'; btn.disabled = true; }}
      try {{
        await fetch('/api/orders/{code}/claim_paid', {{ method: 'POST' }});
        location.reload();
      }} catch (e) {{
        alert('Could not update status');
      }}
    }}
  </script>
</body>
</html>
    """

# =============================== CUSTOMER BOOKING PORTAL ===============================
@app.get("/", response_class=HTMLResponse)
async def serve_homepage():
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sour Apple VIP Laundry | South Utica & MVCC</title>

  <!-- PWA & Mobile Home Screen Icons -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Sour Apple VIP">
  <meta name="theme-color" content="#0A0A0F">
  <link rel="icon" type="image/png" href="{FAVICON_URL}">
  <link rel="apple-touch-icon" href="{ICON_URL}">
  <link rel="apple-touch-icon" sizes="180x180" href="{ICON_URL}">
  <link rel="manifest" href="/manifest.json">

  <!-- Shlop Font -->
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/shlop">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
    body {{ background-color: #0A0A0F; color: #FFFFFF; }}
    .font-shlop {{ font-family: 'Shlop', cursive !important; }}
    .apple-glow {{ box-shadow: 0 0 25px rgba(176, 255, 0, 0.35); }}
    .accent-apple {{ color: #B0FF00; }}
    .bg-apple {{ background-color: #B0FF00; }}
  </style>
</head>
<body class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  
  <!-- Tilted Brand Header with Crown matching Flyer -->
  <div class="py-4 mb-4 border-b border-zinc-800 text-center flex flex-col items-center justify-center">
    <div class="relative inline-flex items-center justify-center mb-1" style="transform: rotate(-3deg);">
      <img src="{CROWN_URL}" alt="Crown" style="position: absolute; top: -18px; left: -22px; width: 34px; height: 34px; object-fit: contain; transform: rotate(-18deg); filter: drop-shadow(0 0 8px #FF2A85);">
      <h1 class="font-shlop text-4xl sm:text-5xl text-white tracking-widest leading-none m-0" style="text-shadow: -4px 4px 18px #B0FF00, 0 0 10px rgba(176, 255, 0, 0.4);">
        SOUR APPLE
      </h1>
    </div>
    <div class="mt-2 tracking-widest uppercase font-black text-xs">
      <span style="color: #FF2A85; font-style: italic; text-shadow: 0 0 10px rgba(255, 42, 133, 0.5);">WASH & FOLD</span>
      <span style="color: #B0FF00; margin: 0 4px;">•</span>
      <span class="text-white">VIP LAUNDRY</span>
    </div>
    <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 mt-2 font-sans">SOUTH UTICA, NY</span>
  </div>

  <div id="booking-app">
    <!-- 1. Customer Selector -->
    <div class="mb-5">
      <label class="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Who are you?</label>
      <div class="grid grid-cols-2 gap-2">
        <button id="btn-non-student" type="button" onclick="setCustomerType('NON_STUDENT')" class="p-3 rounded-xl border text-center transition-all bg-apple text-black font-black text-sm">
          🏠 Non Student
          <span class="block text-[10px] font-medium opacity-80">South Utica Drop-Off</span>
        </button>
        <button id="btn-mvcc" type="button" onclick="setCustomerType('MVCC')" class="p-3 rounded-xl border border-zinc-800 text-center transition-all bg-zinc-900 text-zinc-300 font-black text-sm">
          🎓 MVCC Campus
          <span class="block text-[10px] font-medium opacity-80">Curbside Pickup</span>
        </button>
      </div>
    </div>

    <!-- MVCC Sub-Selector -->
    <div id="mvcc-role-box" class="hidden mb-5 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
      <div class="grid grid-cols-2 gap-2">
        <button id="btn-role-student" type="button" onclick="setMvccRole('Student')" class="py-2 rounded-lg text-xs font-bold bg-apple text-black">Student (Dorms)</button>
        <button id="btn-role-faculty" type="button" onclick="setMvccRole('Faculty')" class="py-2 rounded-lg text-xs font-bold text-zinc-400">Faculty / Staff</button>
      </div>
    </div>

    <!-- Location Notice -->
    <div id="location-notice" class="p-3.5 rounded-xl border border-blue-900/40 bg-blue-950/20 text-xs text-blue-200 mb-5 leading-relaxed">
      📍 <strong>South Utica Drop-Off Location:</strong> Open to everyone! Bring your laundry bags to our South Utica location, and pick them up fresh and folded. <em>(Standard turnaround 48–72 hours).</em>
    </div>

    <!-- 2. Bag Size Chart (Visuals 50% Centered) -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-2">1. Select Your Bag Size</h2>
      
      <!-- Size Chart Image Forced 50% Centered via GitHub CDN -->
      <div style="text-align: center; margin: 0 auto 1rem auto;">
        <img 
          src="{BAG_SIZES_URL}" 
          alt="Sour Apple Bag Size Chart" 
          style="width: 190px !important; max-width: 50% !important; height: auto !important; display: block !important; margin: 0 auto !important; border-radius: 12px; border: 1px solid #27272a; box-shadow: 0 4px 15px rgba(0,0,0,0.5);" 
        >
      </div>

      <!-- No Open Baskets Policy -->
      <div class="p-3 rounded-xl bg-red-950/30 border border-red-800/60 text-red-300 text-xs mb-4">
        <strong>🚫 STRICT CLOSURE POLICY:</strong> All laundry must be in a bag with a secure closure (drawstring, Velcro, zipper, or snaps). <strong>Open plastic baskets with no lids are NOT accepted.</strong>
      </div>

      <div class="space-y-2.5" id="bag-size-options">
        <div onclick="selectSize('small', 20, 10)" id="size-small" class="p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-white">Small Bag (27 Inch)</p>
            <p class="text-xs text-zinc-400">Pillowcase / Grocery tote size (Up to 10 lbs)</p>
          </div>
          <span class="text-base font-black accent-apple" id="price-small">$20</span>
        </div>
        <div onclick="selectSize('medium', 30, 20)" id="size-medium" class="p-3 rounded-xl border border-lime-400 bg-lime-400/10 cursor-pointer flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-white">Medium Bag (32 Inch — Most Popular)</p>
            <p class="text-xs text-zinc-400">13-Gallon tall kitchen bag (15-20 lbs / 1 week of clothes)</p>
          </div>
          <span class="text-base font-black accent-apple" id="price-medium">$30</span>
        </div>
        <div onclick="selectSize('large', 40, 30)" id="size-large" class="p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-white">Large Bag (40 Inch)</p>
            <p class="text-xs text-zinc-400">30-Gallon black heavy bag (25-30+ lbs / family load)</p>
          </div>
          <span class="text-base font-black accent-apple" id="price-large">$40</span>
        </div>
      </div>

      <!-- Quantity Counter -->
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
        <span class="text-xs font-bold text-white">Number of Bags:</span>
        <div class="flex items-center gap-3">
          <button type="button" onclick="changeQty(-1)" class="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-800 font-bold text-lg">-</button>
          <span id="bag-qty" class="font-black text-lg accent-apple">1</span>
          <button type="button" onclick="changeQty(1)" class="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-800 font-bold text-lg">+</button>
        </div>
      </div>
    </div>

    <!-- 3. Photo Verification Upload -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-1">📸 Bag Verification Photo</h2>
      <p class="text-xs text-zinc-400 mb-3">Snap a photo of your closed bag so we can verify size before approval:</p>
      <input type="file" id="bag-photo" accept="image/*" capture="environment" onchange="previewPhoto(event)" class="w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-apple file:text-black cursor-pointer">
      <div id="photo-preview-box" class="hidden mt-3 w-20 h-20 rounded-xl overflow-hidden border-2 border-lime-400">
        <img id="photo-preview" class="w-full h-full object-cover">
      </div>
    </div>

    <!-- 4. Upgrades -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-2">Optional Upgrades</h2>
      <label class="flex justify-between items-center p-3 rounded-xl border border-zinc-800 bg-zinc-950 mb-2 cursor-pointer">
        <div>
          <p class="text-sm font-bold text-white">⚡ Same-Day Rush Turnaround</p>
          <p class="text-xs text-zinc-400">Drop off before 10am -> ready after 5pm today</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black accent-apple">+$20</span>
          <input type="checkbox" id="check-rush" onchange="recalcTotal()" class="w-5 h-5 accent-lime-400">
        </div>
      </label>
      <label class="flex justify-between items-center p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer">
        <div>
          <p class="text-sm font-bold text-white">🛏️ Bedding / Comforter</p>
          <p class="text-xs text-zinc-400">Washed & fluffed separately</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black accent-apple">+$25</span>
          <input type="checkbox" id="check-bedding" onchange="recalcTotal()" class="w-5 h-5 accent-lime-400">
        </div>
      </label>
    </div>

    <!-- 5. Wash Preferences -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5 text-xs">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-2">Wash Formula</h2>
      <div class="p-3 rounded-xl bg-lime-950/20 border border-lime-900/40 text-zinc-300 mb-3">
        🧺 <strong>Our Standard Wash:</strong> Scented detergent, OxiClean, scent boosters, and softener. 
        <br><span class="text-zinc-400 mt-1 block">Prefer hypoallergenic? Check below and include your own bottle!</span>
      </div>
      <label class="flex items-center gap-2 mb-2 cursor-pointer">
        <input type="checkbox" id="pref-own-detergent" class="w-4 h-4 accent-lime-400">
        <span>I will provide my own detergent (Fragrance-Free)</span>
      </label>
      <label class="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" id="pref-cold-wash" class="w-4 h-4 accent-lime-400">
        <span>Cold wash only</span>
      </label>
      <input type="text" id="stain-notes" placeholder="Stain notes or fragile instructions..." class="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs">
    </div>

    <!-- 6. ALL REQUIRED CUSTOMER DETAILS -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5 space-y-3">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-1">Your Details (All Required)</h2>
      
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[11px] font-bold text-zinc-400 mb-1">First Name *</label>
          <input type="text" id="cust-first-name" placeholder="First Name" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-zinc-400 mb-1">Last Name *</label>
          <input type="text" id="cust-last-name" placeholder="Last Name" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-bold text-zinc-400 mb-1">Email Address * (For order approval & receipt)</label>
        <input type="email" id="cust-email" placeholder="name@example.com" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      </div>

      <div>
        <label class="block text-[11px] font-bold text-zinc-400 mb-1">Phone Number * (315-555-0100)</label>
        <input type="tel" id="cust-phone" placeholder="Phone Number" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      </div>

      <div>
        <label class="block text-[11px] font-bold text-zinc-400 mb-1">Your Street Address / Town *</label>
        <input type="text" id="cust-location" placeholder="e.g. 123 Elm St, South Utica" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[11px] font-bold text-zinc-400 mb-1">Drop-Off Date *</label>
          <input type="date" id="cust-date" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-zinc-400 mb-1">Time Window *</label>
          <select id="cust-window" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
            <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
            <option value="Afternoon (12pm - 3pm)">Afternoon (12pm - 3pm)</option>
            <option value="Evening (3pm - 6pm)">Evening (3pm - 6pm)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 7. OFFICIAL LIABILITY WAIVER & HUGE PSA -->
    <div class="p-4 rounded-2xl bg-zinc-900 border-2 border-lime-400 mb-6">
      
      <!-- HUGE PSA CALLOUT -->
      <div class="p-3.5 rounded-xl bg-red-950/60 border-2 border-red-500 text-red-200 text-xs mb-3 font-semibold leading-relaxed">
        <p class="text-red-400 font-black text-sm uppercase tracking-wide mb-1">⚠️ HUGE PSA - ZERO TOLERANCE PEST POLICY:</p>
        Customers MUST ensure that there are NO bed bugs, roaches, fleas, lice, ticks, or ANY other insects, larvae, or infestations in their clothes, bedding, or bags. Sour Apple VIP does NOT take or treat anything with insects or pests. If discovered, the order will be <strong>CANCELED IMMEDIATELY AND IS STRICTLY NON-REFUNDABLE</strong>.
      </div>

      <!-- Full Scrollable 12-Section Legal Waiver -->
      <h2 class="text-sm font-black uppercase tracking-wider accent-apple mb-1">
        Laundry Service Liability Waiver & Customer Acknowledgment
      </h2>
      <p class="text-[10px] text-zinc-400 mb-2">PLEASE READ CAREFULLY BEFORE SUBMITTING YOUR ORDER</p>
      
      <div class="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 mb-4 max-h-48 overflow-y-auto space-y-2 leading-relaxed">
        <p><strong>Laundry Service Agreement, Assumption of Risk, Release of Liability & Customer Acknowledgment</strong></p>
        <p>By checking the acknowledgment box and submitting this booking, I certify that I have read, understand, and voluntarily agree to the following terms and conditions provided by L'Oreal Venturini Camelo, DBA Sour Apple VIP Laundry Services ("Sour Apple VIP Laundry Services").</p>
        
        <p><strong>1. Acceptance of Terms:</strong> By placing an order through the Sour Apple VIP Laundry Services app, I acknowledge that I have carefully read this agreement and voluntarily accept all terms, conditions, policies, and limitations described below.</p>
        
        <p><strong>2. Customer Responsibilities:</strong> I understand that I am responsible for checking all clothing pockets before submitting my laundry and removing all valuables, including but not limited to cash, cards, jewelry, electronics, keys, pens, cosmetics, medications, and any other personal belongings. I am responsible for providing accurate special washing instructions through the app and identifying delicate items before service. Sour Apple VIP Laundry Services is not responsible for damage or loss resulting from items left inside clothing or laundry bags.</p>
        
        <p><strong>3. Commercial Laundry Equipment:</strong> I understand that my laundry will be cleaned using commercial-grade washing machines and dryers. While Sour Apple VIP Laundry Services will use reasonable care when handling my laundry, commercial laundering may contribute to pre-existing issues including weak fabric, loose stitching, color bleeding, shrinkage, fabric wear, manufacturer defects, or existing damage beyond the control of L'Oreal Venturini Camelo, DBA Sour Apple VIP Laundry Services.</p>
        
        <p><strong>4. Care Labels and Garment Condition:</strong> I understand that I am responsible for ensuring that all garments submitted are suitable for machine washing. Sour Apple VIP Laundry Services is not responsible for damage resulting from missing, inaccurate, faded, or unreadable care labels, manufacturer defects, weak seams, loose buttons, decorative embellishments, fabric deterioration, or normal wear and tear.</p>
        
        <p><strong>5. No Guarantee of Stain or Odor Removal:</strong> I understand that Sour Apple VIP Laundry Services will make every reasonable effort to clean my laundry; however, stain removal, odor removal, whitening, brightening, sanitization, and fabric restoration are not guaranteed.</p>
        
        <p><strong>6. Limitation of Liability:</strong> I agree that L'Oreal Venturini Camelo, DBA Sour Apple VIP Laundry Services shall not be held liable for lost, missing, damaged, faded, shrunk, stretched, stained, torn, or otherwise altered items, including missing socks, color bleeding, fabric shrinkage, pre-existing garment damage, items left in pockets, or normal wear and tear.</p>
        
        <p><strong>7. Health and Safety Policy - Zero Tolerance for Pests:</strong> Sour Apple VIP Laundry Services maintains a strict Zero-Tolerance Pest Policy. By submitting this order, I certify that my laundry, bedding, linens, and bags are free from bed bugs, cockroaches, fleas, lice, mites, ants, rodents, pest eggs, larvae, maggots, or biohazard contamination. If discovered, my order will be canceled immediately and any payment made is NON-REFUNDABLE.</p>
        
        <p><strong>8. High-Value Items:</strong> I understand that I should not submit designer clothing, luxury handbags, wedding gowns, antique textiles, heirlooms, or sentimental items unless I voluntarily accept all risks.</p>
        
        <p><strong>9. Right to Refuse Service:</strong> L'Oreal Venturini Camelo reserves the right to decline or cancel service for any order that presents a health, safety, sanitation, or legal concern.</p>
        
        <p><strong>10. Pickup Policy:</strong> Customers are responsible for picking up completed laundry promptly after being notified that their order is ready.</p>
        
        <p><strong>11. Release of Liability:</strong> To the fullest extent permitted by applicable law, I voluntarily release, waive, and hold harmless L'Oreal Venturini Camelo, DBA Sour Apple VIP Laundry Services, its owner, and agents from any claims, damages, losses, or liabilities arising out of or relating to the handling, washing, drying, folding, storage, pickup, or delivery of my laundry.</p>
        
        <p><strong>12. Customer Certification:</strong> By checking the box below, I certify that I have read and understand this entire agreement; I certify that my laundry is free of bed bugs, insects, and pests; I understand that pest-contaminated orders are canceled immediately and are NON-REFUNDABLE; and I voluntarily release L'Oreal Venturini Camelo, DBA Sour Apple VIP Laundry Services from liability as described above.</p>
      </div>

      <label class="flex items-start gap-2.5 text-xs mb-3 cursor-pointer">
        <input type="checkbox" id="check-agreed" class="w-4 h-4 mt-0.5 accent-lime-400" required>
        <span class="text-zinc-200 font-bold">
          I have read, understand, and voluntarily agree to the Laundry Service Agreement, Assumption of Risk, Release of Liability, and Customer Acknowledgment for this booking. *
        </span>
      </label>

      <input type="text" id="sig-name" placeholder="Type Full Legal Name (Digital Signature) *" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs" required>
    </div>

    <!-- Submit Button -->
    <div class="sticky bottom-4">
      <button type="button" onclick="submitBooking()" id="submit-btn" class="w-full h-14 rounded-2xl bg-apple text-black font-black text-lg uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-between px-6 apple-glow">
        <span>Submit Booking</span>
        <span id="total-display" class="text-xl">$30.00</span>
      </button>
    </div>
  </div>

  <!-- Footer with Direct Admin Link -->
  <div class="text-center mt-12 pt-6 border-t border-zinc-900 text-xs text-zinc-600">
    <p>© 2026 Sour Apple VIP Laundry Services · South Utica, NY</p>
    <a href="/admin" class="mt-2 inline-block text-zinc-500 hover:text-zinc-300 underline text-[11px]">Admin Portal Login →</a>
  </div>

  <script>
    let customerType = 'NON_STUDENT';
    let mvccRole = 'Student';
    let bagSize = 'medium';
    let bagQty = 1;
    let basePrice = 30;
    let bagPhotoBase64 = null;

    // Set today as default date
    document.getElementById('cust-date').value = new Date().toISOString().split('T')[0];

    function setCustomerType(type) {{
      customerType = type;
      const btnNon = document.getElementById('btn-non-student');
      const btnMvcc = document.getElementById('btn-mvcc');
      const mvccBox = document.getElementById('mvcc-role-box');
      const notice = document.getElementById('location-notice');
      const locInput = document.getElementById('cust-location');

      if (type === 'NON_STUDENT') {{
        btnNon.className = "p-3 rounded-xl border text-center transition-all bg-apple text-black font-black text-sm";
        btnMvcc.className = "p-3 rounded-xl border border-zinc-800 text-center transition-all bg-zinc-900 text-zinc-300 font-black text-sm";
        mvccBox.classList.add('hidden');
        notice.innerHTML = "📍 <strong>South Utica Drop-Off:</strong> Open to everyone! Bring your laundry to our South Utica location, and pick it up fresh and folded. <em>(Standard turnaround 48–72 hours).</em>";
        locInput.placeholder = "Your Street Address / Area (e.g. 123 Elm St, South Utica)";
        updatePrices(20, 30, 40);
      }} else {{
        btnMvcc.className = "p-3 rounded-xl border text-center transition-all bg-apple text-black font-black text-sm";
        btnNon.className = "p-3 rounded-xl border border-zinc-800 text-center transition-all bg-zinc-900 text-zinc-300 font-black text-sm";
        mvccBox.classList.remove('hidden');
        notice.innerHTML = "🎓 <strong>MVCC Scheduled Curbside:</strong> We pick up and deliver curbside in designated campus parking areas twice weekly! (No building entry).";
        locInput.placeholder = "Dorm & Room # (e.g. North Hall 204)";
        updatePrices(10, 20, 30);
      }}
      recalcTotal();
    }}

    function setMvccRole(role) {{
      mvccRole = role;
      document.getElementById('btn-role-student').className = role === 'Student' ? "py-2 rounded-lg text-xs font-bold bg-apple text-black" : "py-2 rounded-lg text-xs font-bold text-zinc-400";
      document.getElementById('btn-role-faculty').className = role === 'Faculty' ? "py-2 rounded-lg text-xs font-bold bg-apple text-black" : "py-2 rounded-lg text-xs font-bold text-zinc-400";
      document.getElementById('cust-location').placeholder = role === 'Student' ? "Dorm & Room # (e.g. North Hall 204)" : "Campus Building & Office # (e.g. Payne Hall 102)";
    }}

    function updatePrices(sm, md, lg) {{
      document.getElementById('price-small').innerText = '$' + sm;
      document.getElementById('price-medium').innerText = '$' + md;
      document.getElementById('price-large').innerText = '$' + lg;
      if (bagSize === 'small') basePrice = sm;
      if (bagSize === 'medium') basePrice = md;
      if (bagSize === 'large') basePrice = lg;
    }}

    function selectSize(size, publicP, studentP) {{
      bagSize = size;
      basePrice = (customerType === 'NON_STUDENT') ? publicP : studentP;
      ['small', 'medium', 'large'].forEach(s => {{
        document.getElementById('size-' + s).className = (s === size) ? "p-3 rounded-xl border border-lime-400 bg-lime-400/10 cursor-pointer flex justify-between items-center" : "p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer flex justify-between items-center";
      }});
      recalcTotal();
    }}

    function changeQty(delta) {{
      bagQty = Math.max(1, bagQty + delta);
      document.getElementById('bag-qty').innerText = bagQty;
      recalcTotal();
    }}

    function recalcTotal() {{
      let total = basePrice * bagQty;
      if (document.getElementById('check-rush').checked) total += 20;
      if (document.getElementById('check-bedding').checked) total += 25;
      document.getElementById('total-display').innerText = '$' + total.toFixed(2);
      return total;
    }}

    function previewPhoto(event) {{
      const file = event.target.files[0];
      if (file) {{
        const reader = new FileReader();
        reader.onloadend = () => {{
          bagPhotoBase64 = reader.result;
          document.getElementById('photo-preview').src = reader.result;
          document.getElementById('photo-preview-box').classList.remove('hidden');
        }};
        reader.readAsDataURL(file);
      }}
    }}

    async function submitBooking() {{
      const firstName = document.getElementById('cust-first-name').value.trim();
      const lastName = document.getElementById('cust-last-name').value.trim();
      const email = document.getElementById('cust-email').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const location = document.getElementById('cust-location').value.trim();
      const date = document.getElementById('cust-date').value.trim();
      const windowVal = document.getElementById('cust-window').value;
      const agreed = document.getElementById('check-agreed').checked;
      const sig = document.getElementById('sig-name').value.trim();

      if (!firstName || !lastName || !email || !phone || !location || !date) {{
        alert('Please fill out all required fields (First Name, Last Name, Email, Phone, Address, Date).');
        return;
      }}
      if (!agreed || !sig) {{
        alert('Please check the acknowledgment box and type your signature.');
        return;
      }}

      const btn = document.getElementById('submit-btn');
      btn.innerText = 'Submitting...';
      btn.disabled = true;

      try {{
        const res = await fetch('/api/orders', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            location: location,
            pickup_date: date,
            pickup_window: windowVal,
            service_type: bagSize.toUpperCase() + ' BAG',
            customer_type: customerType === 'NON_STUDENT' ? 'Neighborhood Resident' : 'College Student',
            college: customerType === 'MVCC' ? 'MVCC' : '',
            dorm: location,
            bags: bagQty,
            rush: document.getElementById('check-rush').checked,
            bedding_addon: document.getElementById('check-bedding').checked,
            bag_price_each: basePrice,
            bag_image_base64: bagPhotoBase64,
            signature_name: sig,
            contract_agreed: true
          }})
        }});
        const order = await res.json();
        if (res.ok && order.code) {{
          // Immediately redirect to their live order tracker & payment page!
          window.location.href = '/orders/' + order.code;
        }} else {{
          alert('Error: ' + (order.detail || 'Could not submit booking'));
          btn.innerText = 'Submit Booking';
          btn.disabled = false;
        }}
      }} catch (err) {{
        alert('Network error. Please check your connection.');
        btn.innerText = 'Submit Booking';
        btn.disabled = false;
      }}
    }}
  </script>
</body>
</html>
    """

# =============================== ADMIN PORTAL (DESKTOP & MOBILE) ===============================
@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_portal():
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sour Apple VIP Admin Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {{ background-color: #0A0A0F; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
    .accent-apple {{ color: #B0FF00; }}
    .bg-apple {{ background-color: #B0FF00; }}
  </style>
</head>
<body class="min-h-screen p-4 max-w-xl mx-auto">
  
  <div class="flex items-center justify-between py-4 mb-6 border-b border-zinc-800">
    <div>
      <h1 class="font-black text-xl tracking-wider">SOUR APPLE <span class="text-pink-500">ADMIN</span></h1>
      <p class="text-xs text-zinc-400">Order Approvals & Payment Confirmation</p>
    </div>
    <button onclick="logoutAdmin()" id="btn-logout" class="hidden text-xs font-bold text-red-400 underline">Log Out</button>
  </div>

  <!-- Admin Login Screen -->
  <div id="admin-login-box" class="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl my-8">
    <h2 class="text-lg font-black accent-apple mb-4">Admin Sign In</h2>
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-zinc-400 mb-1">Admin Email</label>
        <input type="email" id="admin-email" value="natture1st@gmail.com" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      </div>
      <div>
        <label class="block text-xs font-bold text-zinc-400 mb-1">Password</label>
        <input type="password" id="admin-password" placeholder="Enter your Admin password" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      </div>
      <button onclick="loginAdmin()" id="btn-login" class="w-full h-12 rounded-xl bg-apple text-black font-black text-sm uppercase tracking-wider active:scale-95 transition-all">
        Sign In to Dashboard
      </button>
      <p id="login-err" class="text-xs text-red-400 font-bold text-center hidden"></p>
    </div>
  </div>

  <!-- Admin Dashboard -->
  <div id="admin-dashboard" class="hidden space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-black uppercase tracking-wider text-amber-400">Incoming Orders</h2>
      <button onclick="loadOrders()" class="text-xs font-bold text-lime-400 underline">↻ Refresh Orders</button>
    </div>

    <div id="orders-list" class="space-y-4">
      <p class="text-sm text-zinc-500 text-center py-8">Loading orders...</p>
    </div>
  </div>

  <script>
    let token = localStorage.getItem('sa_admin_token');

    if (token) {{
      showDashboard();
    }}

    async function loginAdmin() {{
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value.trim();
      const err = document.getElementById('login-err');
      err.classList.add('hidden');

      try {{
        const res = await fetch('/api/auth/login', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ email, password }})
        }});
        const data = await res.json();
        if (res.ok && data.user.role === 'ADMIN') {{
          token = data.access_token;
          localStorage.setItem('sa_admin_token', token);
          showDashboard();
        }} else {{
          err.innerText = data.detail || 'Access denied. Must be an Admin.';
          err.classList.remove('hidden');
        }}
      }} catch (e) {{
        err.innerText = 'Could not connect to server.';
        err.classList.remove('hidden');
      }}
    }}

    function showDashboard() {{
      document.getElementById('admin-login-box').classList.add('hidden');
      document.getElementById('admin-dashboard').classList.remove('hidden');
      document.getElementById('btn-logout').classList.remove('hidden');
      loadOrders();
      setInterval(loadOrders, 15000);
    }}

    function logoutAdmin() {{
      localStorage.removeItem('sa_admin_token');
      location.reload();
    }}

    async function loadOrders() {{
      const container = document.getElementById('orders-list');
      try {{
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        
        if (!orders || orders.length === 0) {{
          container.innerHTML = '<p class="text-sm text-zinc-500 text-center py-8">No orders in database yet.</p>';
          return;
        }}

        container.innerHTML = orders.map(o => `
          <div class="p-4 rounded-2xl bg-zinc-900 border ${{o.status === 'Pending Admin Approval' ? 'border-amber-400' : 'border-zinc-800'}} space-y-3">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-xs font-black px-2 py-0.5 rounded ${{o.status === 'Pending Admin Approval' ? 'bg-amber-400/20 text-amber-300' : 'bg-lime-400/20 text-lime-300'}}">${{o.status}}</span>
                <span class="text-xs font-black px-2 py-0.5 rounded ml-1.5 ${{o.payment_status === 'Paid' ? 'bg-lime-400 text-black' : (o.payment_status === 'Verifying Payment' ? 'bg-amber-400/30 text-amber-300' : 'bg-zinc-800 text-zinc-400')}}">
                  ${{o.payment_status === 'Paid' ? 'PAID ✓' : (o.payment_status === 'Verifying Payment' ? 'VERIFYING ⏳' : 'UNPAID')}}
                </span>
                <h3 class="font-black text-lg text-white mt-1">${{o.code}}</h3>               </div>               <span class="text-xl font-black accent-apple">$${{Number(o.price || 0).toFixed(2)}}</span>
            </div>

            <!-- Customer Details -->
            <div class="text-xs text-zinc-300 space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p><strong>Customer:</strong> ${{o.customer_name || 'Anonymous'}}</p>
              <p><strong>Email:</strong> <a href="mailto:${{o.email}}" class="text-sky-400 underline">${{o.email || 'None provided'}}</a></p>
              <p><strong>Phone:</strong> <a href="tel:${{o.phone}}" class="text-lime-400 underline font-bold">${{o.phone || 'None provided'}}</a></p>
              <p><strong>Type:</strong> ${{o.customer_type}}${{o.college ? '(' + o.college + ')' : ''}}</p>
              <p><strong>Location:</strong> ${{o.location || o.dorm || 'South Utica'}}</p>
              <p><strong>Drop-Off Date:</strong> ${{o.pickup_date}} (${{o.pickup_window}})</p>${{o.stain_notes ? `<p class="text-amber-300 italic">Notes: ${{o.stain_notes}}</p>` : ''}}
            </div>

            <!-- Customer Bag Photo -->
            ${{o.bag_image_base64 ? `
              <div>
                <p class="text-xs font-bold text-zinc-400 mb-1">📸 Customer Bag Photo:</p>
                <div class="rounded-xl overflow-hidden border border-zinc-700 max-h-64">
                  <img src="${{o.bag_image_base64}}" alt="Customer Bag" class="w-full object-cover">
                </div>
              </div>
            ` : '<p class="text-xs text-zinc-500 italic">No bag photo uploaded.</p>'}}

            <!-- Admin Actions -->
            <div class="pt-2 border-t border-zinc-800 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${{o.email || ''}}&su=${{encodeURIComponent('Sour Apple VIP Laundry - Order ' + o.code + ' Approved!')}}&body=${{encodeURIComponent('Hi ' + (o.customer_name || 'Customer') + ',\\n\\nGreat news! Your laundry order (' + o.code + ') has been APPROVED.\\n\\nTotal Due: $' + Number(o.price).toFixed(2) + '\\n\\nPlease view your order, complete payment, and get your South Utica hallway drop-off instructions here:\\nhttps://sourapplelaundry.com/orders/' + o.code + '\\n\\nThank you,\\nSour Apple VIP Laundry Services')}}" 
                   target="_blank"
                   class="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 text-center">
                  📧 Open in Gmail
                </a>

                <button onclick="copyLink('${{o.code}}')" 
                        class="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs uppercase tracking-wider">
                  📋 Copy Link
                </button>
              </div>

              <!-- Payment Action Button -->
              ${{o.payment_status !== 'Paid' ? `
                <button onclick="markPaid('${{o.id}}')" class="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 shadow-lg">
                  💵 Mark Paid (Cash App / Venmo Received)
                </button>
              ` : `
                <div class="p-2 rounded-lg bg-lime-950/40 border border-lime-500 text-center">
                  <span class="text-xs font-black text-lime-400">✓ PAYMENT CONFIRMED (PAID)</span>
                </div>
              `}}

              <!-- Approval Buttons -->
              ${{o.status === 'Pending Admin Approval' ? `
                <div class="flex items-center gap-2 pt-1">
                  <label class="text-xs text-zinc-400">Adjust Price ($):</label>
                  <input type="number" id="price-${{o.id}}" value="${{o.price}}" class="w-24 h-9 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs">
                </div>
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <button onclick="approveOrder('${{o.id}}')" class="py-2.5 rounded-xl bg-apple text-black font-black text-xs uppercase tracking-wider active:scale-95">
                    ✓ Approve Order
                  </button>
                  <button onclick="rejectOrder('${{o.id}}')" class="py-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 font-black text-xs uppercase tracking-wider active:scale-95">
                    ✕ Reject
                  </button>
                </div>
              ` : `
                <div class="flex items-center justify-between pt-1">
                  <p class="text-xs text-lime-400 font-bold">✓ Approved & Ready for Drop-Off</p>
                  <a href="/orders/${{o.code}}" target="_blank" class="text-xs text-zinc-400 underline">View Live Order Page →</a>
                </div>
              `}}
            </div>
          </div>
        `).join('');
      }} catch (e) {{
        container.innerHTML = '<p class="text-sm text-red-400 text-center py-8">Failed to load orders.</p>';
      }}
    }}

    function copyLink(code) {{
      const link = 'https://sourapplelaundry.com/orders/' + code;
      navigator.clipboard.writeText(link);
      alert('Copied link: ' + link);
    }}

    async function markPaid(id) {{
      try {{
        await fetch('/api/admin/orders/' + id + '/mark_paid', {{ method: 'POST' }});
        loadOrders();
      }} catch (e) {{
        alert('Could not update payment status');
      }}
    }}

    async function approveOrder(id) {{
      const priceInput = document.getElementById('price-' + id);
      const newPrice = priceInput ? parseFloat(priceInput.value) : null;

      try {{
        await fetch('/api/admin/orders/' + id + '/approve', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ price: newPrice, admin_note: "Approved by admin" }})
        }});
        loadOrders();
      }} catch (e) {{
        alert('Could not approve order');
      }}
    }}

    async function rejectOrder(id) {{
      const reason = prompt("Enter rejection reason:", "Bag closure policy discrepancy.");
      if (reason === null) return;

      try {{
        await fetch('/api/admin/orders/' + id + '/reject', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ reason }})
        }});
        loadOrders();
      }} catch (e) {{
        alert('Could not reject order');
      }}
    }}
  </script>
</body>
</html>
    """

@app.on_event("startup")
async def seed():
    await db.users.create_index("email", unique=True)
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "id": new_id(),
            "name": "Sour Apple Admin",
            "email": ADMIN_EMAIL,
            "password": hash_pw(ADMIN_PASSWORD),
            "role": "ADMIN",
            "created_at": now_iso()
        })
        logger.info(f"Seeded admin account for {ADMIN_EMAIL}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
