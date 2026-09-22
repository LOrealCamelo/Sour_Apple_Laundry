import os
import json
import smtplib
import urllib.request
import urllib.parse
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
# FastAPI Initialization
# ==============================================================================
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

# ==============================================================================
# Dynamic Directory Detection & Static/Assets Mounting
# ==============================================================================
BASE_DIR = Path(__file__).resolve().parent

STATIC_CANDIDATES = [
    BASE_DIR / "static",
    BASE_DIR.parent / "backend" / "static",
    BASE_DIR.parent / "static",
    Path("backend/static"),
    Path("static"),
]
STATIC_DIR = next((d for d in STATIC_CANDIDATES if d.exists() and d.is_dir()), None)

ASSETS_DIR = None
if STATIC_DIR and (STATIC_DIR / "assets").exists():
    ASSETS_DIR = STATIC_DIR / "assets"
elif (BASE_DIR.parent / "assets").exists():
    ASSETS_DIR = BASE_DIR.parent / "assets"
elif Path("assets").exists():
    ASSETS_DIR = Path("assets")

# Mount both /assets and /static with Starlette StaticFiles (enables MP4 video streaming)
if ASSETS_DIR and ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

if STATIC_DIR and STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

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
    <p><b>MVCC Student/Staff:</b> {'Yes' if order.get('is_mvcc') else 'No'}</p>
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

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    try:
        from bson import ObjectId
        query = {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]}
    except Exception:
        query = {"id": order_id}

    order = await db.orders.find_one(query)
    if order:
        order["id"] = str(order.get("_id", order.get("id", "")))
        order.pop("_id", None)
        return order
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

@app.post("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusUpdate):
    try:
        from bson import ObjectId
        query = {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]}
    except Exception:
        query = {"id": order_id}

    await db.orders.update_one(query, {"$set": {"status": body.status}})
    return {"status": "success", "new_status": body.status}

@app.post("/orders/{order_id}/report-payment")
async def report_payment(order_id: str, method: str):
    try:
        from bson import ObjectId
        query = {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]}
    except Exception:
        query = {"id": order_id}

    await db.orders.update_one(
        query,
        {"$set": {"payment_reported": True, "payment_method": method}},
    )
    return {"status": "success"}

@app.post("/api/payments/create-checkout-session/{order_id}")
async def create_checkout_session(order_id: str):
    try:
        from bson import ObjectId
        query = {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]}
    except Exception:
        query = {"id": order_id}

    order = await db.orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{order.get('bag_size')} Laundry Bag Service"},
                    "unit_amount": int(order.get("total_price", 0) * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/success",
            cancel_url=f"{FRONTEND_URL}/cancel",
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ==============================================================================
# Admin Dashboard (/admin)
# ==============================================================================
ADMIN_HTML = """<!DOCTYPE html>
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
      <button onclick="sendTestAlert()" class="bg-yellow-400 hover:bg-yellow
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
          alertBox.innerHTML = "⚠️ <b>Database Connection Warning:</b> " + data.error + "<br>Check that <code>MONGO_URL</code> is set correctly in Render Dashboard.";
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
      await res.json();
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
# Serving Your Custom index.html and Assets
# ==============================================================================
@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_route():
    return HTMLResponse(ADMIN_HTML)

@app.get("/{full_path:path}")
async def serve_spa_or_index(full_path: str = ""):
    # URL-decode to properly handle spaces and special characters
    decoded_path = urllib.parse.unquote(full_path).strip("/")

    if decoded_path == "admin":
        return HTMLResponse(ADMIN_HTML)

    if STATIC_DIR:
        # Check direct static path
        target_file = STATIC_DIR / decoded_path
        if decoded_path and target_file.is_file():
            return FileResponse(str(target_file))

        # Check in assets subdirectory
        if ASSETS_DIR:
            if decoded_path.startswith("assets/"):
                sub_target = ASSETS_DIR / decoded_path[len("assets/"):]
                if sub_target.is_file():
                    return FileResponse(str(sub_target))
            asset_direct = ASSETS_DIR / decoded_path
            if asset_direct.is_file():
                return FileResponse(str(asset_direct))

        # Serve your actual 1,324-line custom index.html
        custom_index = STATIC_DIR / "index.html"
        if custom_index.is_file():
            return FileResponse(str(custom_index))

    return HTMLResponse("<h1>Storefront is loading...</h1>")
