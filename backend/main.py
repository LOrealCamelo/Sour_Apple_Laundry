import os
import json
import smtplib
import urllib.request
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import stripe

# ==============================================================================
# Configuration & Environment
# ==============================================================================
# Supports both MONGO_URL and MONGODB_URL from Render dashboard
MONGODB_URL = (
    os.getenv("MONGO_URL")
    or os.getenv("MONGODB_URL")
    or os.getenv("DATABASE_URL")
    or "mongodb://localhost:27017"
)
DB_NAME = os.getenv("DB_NAME", "sour_apple_laundry")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Google App Password
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://sourapplelaundry.com")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ==============================================================================
# FastAPI & Database Setup
# ==============================================================================
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to MongoDB with a 5-second timeout to prevent requests from hanging
client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

# ==============================================================================
# Schemas
# ==============================================================================
class OrderCreate(BaseModel):
    bag_size: str  # 'Small', 'Medium', 'Large'
    is_mvcc: bool = False
    add_ons: List[str] = []
    digital_contract_accepted: bool = True
    e_signature: str
    bag_photo_url: Optional[str] = None
    phone: Optional[str] = ""
    dorm: Optional[str] = ""

class StatusUpdate(BaseModel):
    status: str

# ==============================================================================
# Helper Functions
# ==============================================================================
def calculate_price(bag_size: str, is_mvcc: bool) -> float:
    prices = {
        "Small": 10.0 if is_mvcc else 20.0,
        "Medium": 20.0 if is_mvcc else 30.0,
        "Large": 30.0 if is_mvcc else 40.0,
    }
    return prices.get(bag_size, 20.0 if not is_mvcc else 10.0)

def send_order_alert(order: dict):
    subject = f"New Laundry Order: {order.get('e_signature')}"
    html = f"""
    <html><body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #166534;">New VIP Order Received — Sour Apple Laundry</h2>
    <p><b>Customer Signature:</b> {order.get('e_signature')}</p>
    <p><b>Bag Size:</b> {order.get('bag_size')}</p>
    <p><b>Total Price:</b> ${order.get('total_price')}</p>
    <p><b>MVCC Discount Applied:</b> {'Yes' if order.get('is_mvcc') else 'No'}</p>
    <p><b>Contact Phone:</b> {order.get('phone', 'N/A')}</p>
    <p><b>Dorm / Location:</b> {order.get('dorm', 'South Utica Drop-off')}</p>
    <p><b>Status:</b> {order.get('status', 'Awaiting Pickup')}</p>
    </body></html>
    """

    if RESEND_API_KEY:
        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            }
            data = json.dumps({
                "from": "onboarding@resend.dev",
                "to": ADMIN_EMAIL,
                "subject": subject,
                "html": html,
            }).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except Exception as e:
            print(f"Resend error: {e}")

    elif SMTP_PASSWORD and SMTP_USER:
        try:
            msg = MIMEMultipart()
            msg["From"] = SMTP_USER
            msg["To"] = ADMIN_EMAIL
            msg["Subject"] = subject
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        except Exception as e:
            print(f"SMTP error: {e}")

# ==============================================================================
# API Endpoints
# ==============================================================================
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Sour Apple Laundry API"}

@app.get("/api/admin/test-email")
async def test_email():
    test_order = {
        "e_signature": "LOreal Test",
        "bag_size": "Small",
        "total_price": 10.0,
        "is_mvcc": True,
        "status": "Test Order",
    }
    send_order_alert(test_order)
    return {"status": f"Test email alert sent to {ADMIN_EMAIL}"}

@app.get("/api/admin/orders")
async def get_admin_orders():
    try:
        cursor = db.orders.find().sort("created_at", -1)
        orders = await cursor.to_list(length=200)
        formatted = []
        for o in orders:
            order_id = str(o.get("_id", o.get("id", "")))
            created = o.get("created_at")
            if isinstance(created, datetime):
                created_str = created.strftime("%b %d, %Y %I:%M %p")
            else:
                created_str = str(created)
            formatted.append({
                "id": order_id,
                "e_signature": o.get("e_signature", "N/A"),
                "bag_size": o.get("bag_size", "Small"),
                "total_price": o.get("total_price", 0.0),
                "is_mvcc": o.get("is_mvcc", False),
                "status": o.get("status", "Awaiting Pickup"),
                "payment_reported": o.get("payment_reported", False),
                "payment_method": o.get("payment_method", "Pending"),
                "phone": o.get("phone", ""),
                "dorm": o.get("dorm", ""),
                "created_at": created_str,
            })
        return {"status": "success", "orders": formatted, "count": len(formatted)}
    except Exception as e:
        return {"status": "error", "orders": [], "error": str(e)}

@app.post("/api/admin/create-sample-order")
async def create_sample_order():
    now = datetime.now()
    sample = {
        "bag_size": "Medium",
        "is_mvcc": True,
        "add_ons": ["Bedding & Comforter"],
        "digital_contract_accepted": True,
        "e_signature": "Sample Student (MVCC)",
        "phone": "315-555-0199",
        "dorm": "Bellamy Hall #204",
        "total_price": 20.0,
        "status": "Awaiting Pickup",
        "status_history": [{"status": "Awaiting Pickup", "timestamp": now.isoformat()}],
        "created_at": now,
        "payment_reported": True,
        "payment_method": "Cash App ($SourAppleLaundry)",
    }
    result = await db.orders.insert_one(sample)
    return {"status": "success", "order_id": str(result.inserted_id)}

@app.post("/orders")
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks):
    price = calculate_price(order_data.bag_size, order_data.is_mvcc)
    now = datetime.now()
    new_order = {
        **order_data.model_dump(),
        "total_price": price,
        "status": "Awaiting Pickup",
        "status_history": [{"status": "Awaiting Pickup", "timestamp": now.isoformat()}],
        "created_at": now,
        "payment_reported": False,
    }
    result = await db.orders.insert_one(new_order)
    new_order["id"] = str(result.inserted_id)
    new_order.pop("_id", None)
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.post("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusUpdate):
    try:
        from bson import ObjectId
        query = {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]}
    except Exception:
        query = {"id": order_id}

    await db.orders.update_one(query, {"$set": {"status": body.status}})
    return {"status": "success", "new_status": body.status}

# ==============================================================================
# Admin Dashboard (/admin)
# ==============================================================================
@app.get("/admin", response_class=HTMLResponse)
async def serve_admin():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sour Apple Laundry — VIP Admin Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen text-gray-800">
      <header class="bg-emerald-800 text-white shadow-md py-4 px-6 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <span class="text-3xl">🍏</span>
          <div>
            <h1 class="text-xl font-black tracking-wide">Sour Apple VIP Laundry</h1>
            <p class="text-xs text-emerald-200">Order Management & Operations Dashboard</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="createSampleOrder()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow transition">
            + Sample Order
          </button>
          <button onclick="sendTestAlert()" class="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold px-3 py-2 rounded-xl text-xs shadow transition">
            🔔 Test Email Alert
          </button>
          <a href="/" target="_blank" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-2 rounded-xl text-xs">
            Open Storefront ↗
          </a>
        </div>
      </header>

      <main class="max-w-5xl mx-auto p-6 space-y-6">
        <div id="db-alert" class="hidden p-4 rounded-2xl text-xs font-semibold"></div>

        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold flex items-center gap-2">
            Active Orders <span id="orders-badge" class="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-black">0</span>
          </h2>
          <button onclick="fetchOrders()" class="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition">
            <span>🔄</span> Refresh Orders
          </button>
        </div>

        <div id="orders-list" class="space-y-3">
          <div class="p-8 text-center text-gray-400">Loading orders...</div>
        </div>
      </main>

      <script>
        async function fetchOrders() {
          const container = document.getElementById('orders-list');
          const badge = document.getElementById('orders-badge');
          const alertBox = document.getElementById('db-alert');

          try {
            const res = await fetch('/api/admin/orders');
            const data = await res.json();

            if (data.status === 'error') {
              alertBox.className = "p-4 bg-red-100 text-red-800 border border-red-200 rounded-2xl text-xs font-semibold block";
              alertBox.innerHTML = `⚠️ <b>Database Connection Warning:</b> ${data.error}<br>Ensure <code>MONGO_URL</code> is added in Render Dashboard.`;
            } else {
              alertBox.className = "hidden";
            }

            const orders = data.orders || [];
            badge.innerText = orders.length;

            if (orders.length === 0) {
              container.innerHTML = `
                <div class="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm space-y-3">
                  <p class="text-gray-400 font-medium">No customer orders placed yet.</p>
                  <button onclick="createSampleOrder()" class="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-4 py-2 rounded-xl transition">
                    Click here to add a Test Order
                  </button>
                </div>`;
              return;
            }

            container.innerHTML = orders.map(o => `
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="font-extrabold text-base text-gray-900">${o.e_signature}</span>
                    ${o.is_mvcc ? '<span class="bg-pink-100 text-pink-700 text-xs px-2.5 py-0.5 rounded-full font-bold">🎓 MVCC Student (-$10)</span>' : '<span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">Standard</span>'}
                  </div>
                  <p class="text-xs text-gray-500">
                    <b>Size:</b> ${o.bag_size} Bag | <b>Total:</b> <span class="text-emerald-700 font-black">$${o.total_price}</span> | <b>Date:</b> ${o.created_at}
                  </p>
                  ${o.dorm ? `<p class="text-xs text-gray-400"><b>Pickup:</b> ${o.dorm} \vert{}${o.phone}</p>` : ''}
                </div>
                <div class="flex items-center gap-2">
                  <select onchange="changeStatus('${o.id}', this.value)" class="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-emerald-600">
                    ${['Awaiting Pickup', 'Picked Up', 'Washing', 'Folding', 'Ready for Pickup', 'Delivered'].map(s => `
                      <option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
            `).join('');
          } catch(err) {
            container.innerHTML = '<p class="text-red-500 text-center py-6 text-xs">Failed to fetch orders from server.</p>';
          }
        }

        async function changeStatus(id, newStatus) {
          await fetch('/orders/' + id + '/status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: newStatus})
          });
          fetchOrders();
        }

        async function createSampleOrder() {
          const res = await fetch('/api/admin/create-sample-order', {method: 'POST'});
          const data = await res.json();
          fetchOrders();
        }

        async function sendTestAlert() {
          const res = await fetch('/api/admin/test-email');
          const data = await res.json();
          alert(data.status || 'Email dispatched!');
        }

        fetchOrders();
      </script>
    </body>
    </html>
    """

# ==============================================================================
# Complete Storefront with Animated MVCC University Box & Self-Healing Bag SVGs
# ==============================================================================
def render_storefront():
    # Illustrated Pink Laundry Bag SVG fallback if local jpg files are not present
    def pink_bag_svg(label, loads):
        return f"""data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' width='160' height='160'>
          <rect width='160' height='160' rx='24' fill='%23fdf2f8'/>
          <path d='M45 55 C45 35 115 35 115 55 L125 130 C125 142 35 142 35 130 Z' fill='%23ec4899' opacity='0.9'/>
          <path d='M45 55 Q80 70 115 55' stroke='%23be185d' stroke-width='4' fill='none'/>
          <circle cx='80' cy='38' r='10' fill='%23be185d'/>
          <text x='80' y='95' fill='white' font-family='Arial' font-size='16' font-weight='bold' text-anchor='middle'>{label}</text>
          <text x='80' y='115' fill='%23fbcfe8' font-family='Arial' font-size='11' font-weight='bold' text-anchor='middle'>{loads}</text>
        </svg>"""

    svg_small = pink_bag_svg('Small', '1 Load')
    svg_med = pink_bag_svg('Medium', '1.5 Loads')
    svg_large = pink_bag_svg('Large', '2.5 Loads')

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sour Apple Wash & Fold VIP Laundry Services</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @keyframes pulseSlow {{
          0%, 100% {{ transform: scale(1); }}
          50% {{ transform: scale(1.03); }}
        }}
        .animate-pulse-slow {{
          animation: pulseSlow 2.5s infinite ease-in-out;
        }}
      </style>
    </head>
    <body class="bg-gray-50 text-gray-900 font-sans min-h-screen pb-20">

      <!-- Header -->
      <header class="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div class="flex items-center gap-2">
          <span class="text-3xl">🍏</span>
          <div>
            <h1 class="font-black text-lg text-emerald-800 tracking-tight leading-tight">Sour Apple VIP</h1>
            <p class="text-[10px] text-emerald-600 font-bold tracking-wider uppercase">Wash & Fold Laundry</p>
          </div>
        </div>
        <a href="/admin" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-full transition">
          Admin Portal
        </a>
      </header>

      <!-- Hero Banner -->
      <section class="p-6">
        <div class="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-800 text-white rounded-3xl p-8 shadow-xl overflow-hidden text-center">
          <div class="relative z-10 space-y-3">
            <span class="inline-block bg-white/20 backdrop-blur-md text-emerald-100 text-xs px-3 py-1 rounded-full font-bold">
              ✨ Freshness Delivered to Your Door
            </span>
            <h2 class="text-3xl sm:text-4xl font-black leading-tight">Clean Clothes.<br/>Less Stress. 💚</h2>
            <p class="text-xs sm:text-sm text-emerald-100 max-w-sm mx-auto">
              Utica's premier wash, dry, and fold laundry service with campus curbside pickup.
            </p>
            <div class="pt-2">
              <button onclick="openBooking()" class="animate-pulse-slow bg-[#ff66c4] hover:bg-pink-500 text-white font-black text-sm px-8 py-3.5 rounded-full shadow-lg hover:shadow-xl transition transform active:scale-95">
                VIP LAUNDRY SERVICE &gt;
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Animated MVCC Student Pricing Pink Element Box -->
      <section class="px-6 mb-6">
        <div onclick="toggleMVCC()" class="w-full bg-gradient-to-r from-pink-50 via-pink-100/70 to-pink-50 border-2 border-[#ff66c4] p-5 rounded-3xl flex items-center justify-between cursor-pointer active:scale-95 transition-all shadow-md hover:shadow-lg">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-[#ff66c4] text-white flex items-center justify-center text-2xl shadow-md">
              🎓
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-base text-[#ff66c4]">MVCC Student & Staff</span>
                <span class="bg-[#ff66c4] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                  SAVE $10
                </span>
              </div>
              <p class="text-xs text-pink-900/80 font-semibold mt-0.5">
                Tap to toggle special campus pricing on every bag size
              </p>
            </div>
          </div>
          <div class="relative">
            <input type="checkbox" id="mvcc-check" class="w-7 h-7 accent-[#ff66c4] cursor-pointer rounded-lg">
          </div>
        </div>
      </section>

      <!-- 3 Bags Sizing & Pricing -->
      <section class="px-6 space-y-4 max-w-lg mx-auto">
        <h3 class="text-lg font-black text-gray-800">Choose Your Bag Size</h3>

        <!-- Small Bag -->
        <div onclick="openBooking('Small')" class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition">
          <img src="/static/sm_pink_Sour%20Apple.jpg" onerror="this.onerror=null; this.src='{svg_small}';" class="w-20 h-20 rounded-2xl object-cover bg-pink-50">
          <div class="flex-1">
            <h4 class="font-black text-base">Small VIP Bag</h4>
            <p class="text-xs text-gray-500">~1 Standard Load. Great for singles.</p>
            <span class="text-[11px] text-pink-600 font-bold hidden mvcc-tag">🎓 MVCC Campus Discount Applied</span>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-emerald-700 bag-price" data-base="20" data-mvcc="10">$20</div>
            <span class="text-[10px] text-gray-400 font-bold">wash & fold</span>
          </div>
        </div>

        <!-- Medium Bag -->
        <div onclick="openBooking('Medium')" class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition">
          <img src="/static/med_pink_Sour%20Apple.jpg" onerror="this.onerror=null; this.src='{svg_med}';" class="w-20 h-20 rounded-2xl object-cover bg-pink-50">
          <div class="flex-1">
            <h4 class="font-black text-base">Medium VIP Bag</h4>
            <p class="text-xs text-gray-500">~1.5 - 2 Loads. Perfect for weekly loads.</p>
            <span class="text-[11px] text-pink-600 font-bold hidden mvcc-tag">🎓 MVCC Campus Discount Applied</span>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-emerald-700 bag-price" data-base="30" data-mvcc="20">$30</div>
            <span class="text-[10px] text-gray-400 font-bold">wash & fold</span>
          </div>
        </div>

        <!-- Large Bag -->
        <div onclick="openBooking('Large')" class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition">
          <img src="/static/lg_pink_Sour%20Apple.jpg" onerror="this.onerror=null; this.src='{svg_large}';" class="w-20 h-20 rounded-2xl object-cover bg-pink-50">
          <div class="flex-1">
            <h4 class="font-black text-base">Large VIP Bag</h4>
            <p class="text-xs text-gray-500">~2.5 - 3 Loads. Families & heavy linens.</p>
            <span class="text-[11px] text-pink-600 font-bold hidden mvcc-tag">🎓 MVCC Campus Discount Applied</span>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-emerald-700 bag-price" data-base="40" data-mvcc="30">$40</div>
            <span class="text-[10px] text-gray-400 font-bold">wash & fold</span>
          </div>
        </div>
      </section>

      <!-- Booking Modal with Digital Contract -->
      <div id="booking-modal" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div class="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto space-y-5">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="font-black text-lg text-emerald-900">Schedule VIP Pickup</h3>
            <button onclick="closeBooking()" class="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Select Bag Size</label>
              <select id="modal-bag" onchange="updateModalPrice()" class="w-full p-3 rounded-xl border border-gray-200 text-sm font-semibold">
                <option value="Small">Small Bag (1 Load)</option>
                <option value="Medium" selected>Medium Bag (1.5 - 2 Loads)</option>
                <option value="Large">Large Bag (2.5 - 3 Loads)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Dorm / Address (South Utica / MVCC)</label>
              <input type="text" id="modal-dorm" placeholder="e.g. Bellamy Hall #204 or Utica Address" class="w-full p-3 rounded-xl border border-gray-200 text-sm">
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Phone Number for Pickup Text</label>
              <input type="tel" id="modal-phone" placeholder="315-xxx-xxxx" class="w-full p-3 rounded-xl border border-gray-200 text-sm">
            </div>

            <!-- Digital Contract Box -->
            <div class="bg-yellow-50 border border-yellow-200 p-3.5 rounded-2xl text-[11px] text-yellow-900 leading-relaxed max-h-28 overflow-y-auto">
              <b>VIP Service Agreement:</b> Sour Apple Wash & Fold provides professional wash, dry, and fold care. Items must be closed with drawstring/zipper. Standard laundry liability is limited to $100 per bag. Items unclaimed after 30 days are donated.
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Type Full Name to Sign Digitally</label>
              <input type="text" id="modal-signature" placeholder="Your Full Legal Name" class="w-full p-3 rounded-xl border-2 border-emerald-500 text-sm font-bold">
            </div>

            <div class="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
              <span class="text-xs font-bold text-gray-600">Total Price:</span>
              <span id="modal-price-display" class="text-2xl font-black text-emerald-700">$30</span>
            </div>

            <button onclick="submitOrder()" id="submit-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg transition">
              Confirm & Book Pickup
            </button>
          </div>
        </div>
      </div>

      <script>
        let isMVCC = false;

        function toggleMVCC() {
          const chk = document.getElementById('mvcc-check');
          chk.checked = !chk.checked;
          isMVCC = chk.checked;
          updatePricing();
        }

        document.getElementById('mvcc-check').addEventListener('click', (e) => {
          e.stopPropagation();
          isMVCC = e.target.checked;
          updatePricing();
        });

        function updatePricing() {
          document.querySelectorAll('.bag-price').forEach(el => {
            const price = isMVCC ? el.dataset.mvcc : el.dataset.base;
            el.innerText = '$' + price;
          });
          document.querySelectorAll('.mvcc-tag').forEach(el => {
            if (isMVCC) el.classList.remove('hidden');
            else el.classList.add('hidden');
          });
          updateModalPrice();
        }

        function openBooking(bag) {
          if (bag) document.getElementById('modal-bag').value = bag;
          document.getElementById('booking-modal').classList.remove('hidden');
          updateModalPrice();
        }

        function closeBooking() {
          document.getElementById('booking-modal').classList.add('hidden');
        }

        function updateModalPrice() {
          const bag = document.getElementById('modal-bag').value;
          const prices = {
            'Small': isMVCC ? 10 : 20,
            'Medium': isMVCC ? 20 : 30,
            'Large': isMVCC ? 30 : 40
          };
          document.getElementById('modal-price-display').innerText = '$' + (prices[bag] || 30);
        }

        async function submitOrder() {
          const signature = document.getElementById('modal-signature').value.trim();
          if (!signature) {
            alert('Please type your full name in the signature box to agree to the digital contract.');
            return;
          }

          const btn = document.getElementById('submit-btn');
          btn.disabled = true;
          btn.innerText = 'Submitting Order...';

          const payload = {
            bag_size: document.getElementById('modal-bag').value,
            is_mvcc: isMVCC,
            e_signature: signature,
            phone: document.getElementById('modal-phone').value,
            dorm: document.getElementById('modal-dorm').value,
            digital_contract_accepted: true
          };

          try {
            const res = await fetch('/orders', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            alert('🎉 Order Received! We will contact you for pickup.\\n\\nSend payment via Cash App ($SourAppleLaundry) or Venmo (@SourAppleLaundry).');
            closeBooking();
          } catch(err) {
            alert('Error booking order. Please try again.');
          } finally {
            btn.disabled = false;
            btn.innerText = 'Confirm & Book Pickup';
          }
        }
      </script>
    </body>
    </html>
    """

# ==============================================================================
# Robust Static Files & SPA Fallback
# ==============================================================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_CANDIDATES = [
    BASE_DIR / "static",
    BASE_DIR.parent / "static",
    BASE_DIR.parent / "backend" / "static",
    Path("backend/static"),
    Path("static"),
]

STATIC_DIR = next((d for d in STATIC_CANDIDATES if d.exists() and d.is_dir()), None)

if STATIC_DIR:
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/{full_path:path}")
async def serve_spa_or_index(full_path: str = ""):
    clean_path = full_path.strip("/")
    if clean_path == "admin":
        return await serve_admin()

    if STATIC_DIR:
        requested_file = STATIC_DIR / full_path
        if full_path and requested_file.is_file():
            return FileResponse(str(requested_file))
        index_file = STATIC_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))

    # Serves the complete storefront with pink MVCC button & self-healing SVGs
    return HTMLResponse(render_storefront())
