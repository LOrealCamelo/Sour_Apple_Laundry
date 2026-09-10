"""
Sour Apple VIP Laundry Services — All-in-One Production Engine
FastAPI + MongoDB + Embedded Web App
No Cloudflare or build tools required. Runs 100% live on Render.
"""

import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
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

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ.get("DB_NAME", "sour_apple_laundry")]

JWT_SECRET = os.environ.get("JWT_SECRET", "sourapplesecretkey1234567890")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
CASHAPP_HANDLE = os.environ.get("CASHAPP_HANDLE", "$SourAppleLaundry")
VENMO_HANDLE = os.environ.get("VENMO_HANDLE", "@SourAppleLaundry")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Sour Apple VIP Laundry")
api = APIRouter(prefix="/api")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "STUDENT"
    phone: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OrderCreate(BaseModel):
    services: List[str] = []
    service_type: Optional[str] = "Standard Load"
    customer_type: str = "Neighborhood Resident"
    college: str = ""
    dorm: str = ""
    directions: str = ""
    pickup_date: str = ""
    pickup_window: str = "Morning (9am - 12pm)"
    bags: int = 1
    rush: bool = False
    bedding_addon: bool = False
    preferences: List[str] = []
    stain_notes: str = ""
    bag_image_base64: Optional[str] = None
    image_review_requested: bool = False
    image_review_email: Optional[str] = "natture1st@gmail.com"
    bag_price_each: Optional[float] = None
    contract_agreed: bool = True
    signature_name: str = ""
    signed_at: Optional[str] = None

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
    code = f"SA-{oid[:6].upper()}"

    order = {
        "id": oid,
        "code": code,
        "customer_name": body.signature_name,
        "customer_type": body.customer_type,
        "college": body.college,
        "dorm": body.dorm,
        "directions": body.directions,
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
        "pickup_date": body.pickup_date or datetime.now().strftime("%Y-%m-%d"),
        "pickup_window": body.pickup_window,
        "signature_name": body.signature_name,
        "signed_at": body.signed_at or now_iso(),
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    return order

@api.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@api.get("/admin/orders")
async def admin_orders():
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api.post("/admin/orders/{order_id}/approve")
async def approve_order(order_id: str):
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Approved"}})
    return {"ok": True}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# =============================== LIVE EMBEDDED FRONTEND ===============================
@app.get("/", response_class=HTMLResponse)
async def serve_homepage():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sour Apple VIP Laundry | South Utica & MVCC</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0A0A0F; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .apple-glow { box-shadow: 0 0 25px rgba(176, 255, 0, 0.3); }
    .accent-apple { color: #B0FF00; }
    .bg-apple { background-color: #B0FF00; }
  </style>
</head>
<body class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <!-- Brand Header -->
  <div class="flex items-center justify-between py-4 mb-4 border-b border-zinc-800">
    <div class="flex items-center gap-2">
      <span class="text-3xl">🍏</span>
      <span class="font-black text-xl tracking-wider">SOUR APPLE <span class="text-pink-500">VIP</span></span>
    </div>
    <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400">UTICA, NY</span>
  </div>

  <div id="booking-app">
    <!-- Hero / Tagline -->
    <div class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 mb-5">
      <h1 class="text-lg font-black accent-apple mb-1">FRESH CLOTHES. ZERO STRESS.</h1>
      <p class="text-xs text-zinc-300 leading-relaxed">
        Drop off your dirty laundry in South Utica, we wash, dry & fold it, and notify you as soon as it's fresh and ready for pickup!
      </p>
    </div>

    <!-- 1. Who Are You? (Customer Selector) -->
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
      📍 <strong>South Utica Drop-Off Location:</strong> Open to everyone! Bring your laundry to our South Utica location, and pick it up fresh and neatly folded. <em>(Standard turnaround is 48–72 hours).</em>
    </div>

    <!-- 2. Bag Size Chart (Visuals) -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-2">1. Select Your Bag Size</h2>
      
      <!-- No Open Baskets Policy -->
      <div class="p-3 rounded-xl bg-red-950/30 border border-red-800/60 text-red-300 text-xs mb-4">
        <strong>🚫 STRICT CLOSURE POLICY:</strong> All laundry must be in a bag with a secure closure (drawstring, Velcro, zipper, or snaps). <strong>Open plastic baskets with no lids are NOT accepted.</strong>
      </div>

      <div class="space-y-2.5" id="bag-size-options">
        <!-- Small -->
        <div onclick="selectSize('small', 20, 10)" id="size-small" class="p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-white">Small Bag (27 Inch)</p>
            <p class="text-xs text-zinc-400">Pillowcase / Grocery tote size (Up to 10 lbs)</p>
          </div>
          <span class="text-base font-black accent-apple" id="price-small">$20</span>
        </div>
        <!-- Medium -->
        <div onclick="selectSize('medium', 30, 20)" id="size-medium" class="p-3 rounded-xl border border-lime-400 bg-lime-400/10 cursor-pointer flex justify-between items-center">
          <div>
            <p class="text-sm font-bold text-white">Medium Bag (32 Inch — Most Popular)</p>
            <p class="text-xs text-zinc-400">13-Gallon tall kitchen bag (15-20 lbs / 1 week of clothes)</p>
          </div>
          <span class="text-base font-black accent-apple" id="price-medium">$30</span>
        </div>
        <!-- Large -->
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
      <input type="file" id="bag-photo" accept="image/*" onchange="previewPhoto(event)" class="w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-apple file:text-black cursor-pointer">
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

    <!-- 6. Schedule Details -->
    <div class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5 space-y-3">
      <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider mb-1">Your Details</h2>
      <input type="text" id="cust-name" placeholder="Your Full Name" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      <input type="tel" id="cust-phone" placeholder="Phone Number (315) 555-0100" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      <input type="text" id="cust-location" placeholder="Your Street Address (South Utica, New Hartford, etc.)" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      <input type="date" id="cust-date" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm" required>
      <select id="cust-window" class="w-full h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm">
        <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
        <option value="Afternoon (12pm - 3pm)">Afternoon (12pm - 3pm)</option>
        <option value="Evening (3pm - 6pm)">Evening (3pm - 6pm)</option>
      </select>
    </div>

    <!-- 7. Agreement & Signature -->
    <div class="p-4 rounded-2xl bg-zinc-900 border-2 border-lime-400 mb-6">
      <h2 class="text-sm font-black uppercase tracking-wider accent-apple mb-1">Service Agreement</h2>
      <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 mb-3 max-h-20 overflow-y-auto">
        By booking, you agree: All laundry must be delivered in closed bags (drawstring, Velcro, zipper, or snaps — no open baskets). Standard turnaround is 48–72 hours unless Same-Day Rush is selected. Liability limit is $100 per bag. Payment is collected upon drop-off confirmation.
      </div>
      <label class="flex items-start gap-2 text-xs mb-3 cursor-pointer">
        <input type="checkbox" id="check-agreed" class="w-4 h-4 mt-0.5 accent-lime-400" required>
        <span class="text-zinc-200 font-bold">I agree to the Sour Apple Service Agreement & closed-bag policy.</span>
      </label>
      <input type="text" id="sig-name" placeholder="Type Full Legal Name (Signature)" class="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs" required>
    </div>

    <!-- Submit Button -->
    <div class="sticky bottom-4">
      <button type="button" onclick="submitBooking()" id="submit-btn" class="w-full h-14 rounded-2xl bg-apple text-black font-black text-lg uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-between px-6 apple-glow">
        <span>Book Service</span>
        <span id="total-display" class="text-xl">$30.00</span>
      </button>
    </div>
  </div>

  <!-- Success Screen -->
  <div id="success-screen" class="hidden text-center py-12">
    <span class="text-6xl">🎉</span>
    <h1 class="text-2xl font-black accent-apple mt-4 mb-2">Request Submitted!</h1>
    <p class="text-sm text-zinc-300 mb-4">Your order is pending confirmation. Show this tracking code when dropping off:</p>
    <div class="p-4 rounded-2xl bg-zinc-900 border-2 border-amber-400 mb-6 max-w-xs mx-auto">
      <p class="text-xs text-zinc-400 font-bold uppercase">Order Tracking Code</p>
      <p id="success-code" class="text-3xl font-black text-amber-400 mt-1"></p>
    </div>
    <p class="text-xs text-zinc-400 mb-6">We will notify you at your phone number with drop-off confirmation!</p>
    <button onclick="location.reload()" class="px-6 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm">Book Another Order</button>
  </div>

  <script>
    let customerType = 'NON_STUDENT';
    let mvccRole = 'Student';
    let bagSize = 'medium';
    let bagQty = 1;
    let basePrice = 30;
    let bagPhotoBase64 = null;

    function setCustomerType(type) {
      customerType = type;
      const btnNon = document.getElementById('btn-non-student');
      const btnMvcc = document.getElementById('btn-mvcc');
      const mvccBox = document.getElementById('mvcc-role-box');
      const notice = document.getElementById('location-notice');
      const locInput = document.getElementById('cust-location');

      if (type === 'NON_STUDENT') {
        btnNon.className = "p-3 rounded-xl border text-center transition-all bg-apple text-black font-black text-sm";
        btnMvcc.className = "p-3 rounded-xl border border-zinc-800 text-center transition-all bg-zinc-900 text-zinc-300 font-black text-sm";
        mvccBox.classList.add('hidden');
        notice.innerHTML = "📍 <strong>South Utica Drop-Off:</strong> Open to everyone! Bring your laundry to our South Utica location, and pick it up fresh and folded. <em>(Standard turnaround 48–72 hours).</em>";
        locInput.placeholder = "Your Street Address / Town (e.g. 123 Elm St, South Utica)";
        updatePrices(20, 30, 40);
      } else {
        btnMvcc.className = "p-3 rounded-xl border text-center transition-all bg-apple text-black font-black text-sm";
        btnNon.className = "p-3 rounded-xl border border-zinc-800 text-center transition-all bg-zinc-900 text-zinc-300 font-black text-sm";
        mvccBox.classList.remove('hidden');
        notice.innerHTML = "🎓 <strong>MVCC Scheduled Curbside:</strong> We pick up and deliver curbside in designated campus parking areas twice weekly! (No building entry).";
        locInput.placeholder = "Dorm / Residence Hall & Room # (e.g. North Hall 204)";
        updatePrices(10, 20, 30);
      }
      recalcTotal();
    }

    function setMvccRole(role) {
      mvccRole = role;
      document.getElementById('btn-role-student').className = role === 'Student' ? "py-2 rounded-lg text-xs font-bold bg-apple text-black" : "py-2 rounded-lg text-xs font-bold text-zinc-400";
      document.getElementById('btn-role-faculty').className = role === 'Faculty' ? "py-2 rounded-lg text-xs font-bold bg-apple text-black" : "py-2 rounded-lg text-xs font-bold text-zinc-400";
      document.getElementById('cust-location').placeholder = role === 'Student' ? "Dorm & Room # (e.g. North Hall 204)" : "Campus Building & Office # (e.g. Payne Hall 102)";
    }

    function updatePrices(sm, md, lg) {
      document.getElementById('price-small').innerText = '$' + sm;
      document.getElementById('price-medium').innerText = '$' + md;
      document.getElementById('price-large').innerText = '$' + lg;
      if (bagSize === 'small') basePrice = sm;
      if (bagSize === 'medium') basePrice = md;
      if (bagSize === 'large') basePrice = lg;
    }

    function selectSize(size, publicP, studentP) {
      bagSize = size;
      basePrice = (customerType === 'NON_STUDENT') ? publicP : studentP;
      ['small', 'medium', 'large'].forEach(s => {
        document.getElementById('size-' + s).className = (s === size) ? "p-3 rounded-xl border border-lime-400 bg-lime-400/10 cursor-pointer flex justify-between items-center" : "p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer flex justify-between items-center";
      });
      recalcTotal();
    }

    function changeQty(delta) {
      bagQty = Math.max(1, bagQty + delta);
      document.getElementById('bag-qty').innerText = bagQty;
      recalcTotal();
    }

    function recalcTotal() {
      let total = basePrice * bagQty;
      if (document.getElementById('check-rush').checked) total += 20;
      if (document.getElementById('check-bedding').checked) total += 25;
      document.getElementById('total-display').innerText = '$' + total.toFixed(2);
      return total;
    }

    function previewPhoto(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          bagPhotoBase64 = reader.result;
          document.getElementById('photo-preview').src = reader.result;
          document.getElementById('photo-preview-box').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    }

    async function submitBooking() {
      const name = document.getElementById('cust-name').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const location = document.getElementById('cust-location').value.trim();
      const agreed = document.getElementById('check-agreed').checked;
      const sig = document.getElementById('sig-name').value.trim();

      if (!name || !phone || !location) {
        alert('Please fill out your name, phone, and address/dorm.');
        return;
      }
      if (!agreed || !sig) {
        alert('Please accept the service agreement and type your signature.');
        return;
      }

      const btn = document.getElementById('submit-btn');
      btn.innerText = 'Submitting...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type: bagSize.toUpperCase() + ' BAG',
            customer_type: customerType === 'NON_STUDENT' ? 'Neighborhood Resident' : 'College Student',
            college: customerType === 'MVCC' ? 'MVCC' : '',
            dorm: location,
            bags: bagQty,
            rush: document.getElementById('check-rush').checked,
            bedding_addon: document.getElementById('check-bedding').checked,
            bag_price_each: basePrice,
            bag_image_base64: bagPhotoBase64,
            image_review_requested: Boolean(bagPhotoBase64),
            signature_name: sig,
            contract_agreed: true
          })
        });
        const order = await res.json();
        if (res.ok) {
          document.getElementById('booking-app').classList.add('hidden');
          document.getElementById('success-code').innerText = order.code;
          document.getElementById('success-screen').classList.remove('hidden');
        } else {
          alert('Error: ' + (order.detail || 'Could not submit booking'));
          btn.innerText = 'Book Service';
          btn.disabled = false;
        }
      } catch (err) {
        alert('Network error. Please check your connection.');
        btn.innerText = 'Book Service';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>
    """

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
            "created_at": now_iso()
        })
        logger.info("Seeded admin account")

@app.on_event("shutdown")
async def shutdown():
    client.close()
