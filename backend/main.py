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
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Google App Password
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://sourapplelaundry.com")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ==============================================================================
# Initialize FastAPI App
# ==============================================================================
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
client = AsyncIOMotorClient(MONGODB_URL)
db = client.sour_apple_laundry

# ==============================================================================
# Pydantic Schemas
# ==============================================================================
class OrderCreate(BaseModel):
    bag_size: str  # 'Small', 'Medium', 'Large'
    is_mvcc: bool = False
    add_ons: List[str] = []
    digital_contract_accepted: bool = False
    e_signature: str
    bag_photo_url: Optional[str] = None

class Order(OrderCreate):
    id: str
    user_id: Optional[str] = None
    total_price: float
    status: str = "Pending"
    status_history: List[Dict[str, Any]] = []
    created_at: datetime
    payment_reported: bool = False
    payment_method: Optional[str] = None

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
    return prices.get(bag_size, 0.0)

def send_order_alert(order: dict):
    subject = f"New Laundry Order: {order.get('e_signature')}"
    html = f"""
    <html><body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #166534;">New Order Received - Sour Apple Laundry</h2>
    <p><b>Customer Signature:</b> {order.get('e_signature')}</p>
    <p><b>Bag Size:</b> {order.get('bag_size')}</p>
    <p><b>Total Price:</b> ${order.get('total_price')}</p>
    <p><b>MVCC Student/Staff:</b> {'Yes' if order.get('is_mvcc') else 'No'}</p>
    <p><b>Order Status:</b> {order.get('status', 'Awaiting Pickup')}</p>
    </body></html>
    """

    if RESEND_API_KEY:
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
        try:
            with urllib.request.urlopen(req) as response:
                return response.read()
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
    return {"status": f"Test email sent to {ADMIN_EMAIL}"}

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
                created_str = created.strftime("%Y-%m-%d %I:%M %p")
            else:
                created_str = str(created)
            formatted.append({
                "id": order_id,
                "e_signature": o.get("e_signature", "N/A"),
                "bag_size": o.get("bag_size", "Small"),
                "total_price": o.get("total_price", 0.0),
                "is_mvcc": o.get("is_mvcc", False),
                "status": o.get("status", "Pending"),
                "payment_reported": o.get("payment_reported", False),
                "payment_method": o.get("payment_method", "None"),
                "created_at": created_str,
            })
        return formatted
    except Exception as e:
        return []

@app.post("/orders", response_model=Order)
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
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"$or": [{"_id": order_id}, {"id": order_id}]})
    if order:
        order["id"] = str(order.get("_id", order.get("id", "")))
        order.pop("_id", None)
        return order
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

@app.post("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusUpdate):
    await db.orders.update_one(
        {"$or": [{"_id": order_id}, {"id": order_id}]},
        {"$set": {"status": body.status}}
    )
    return {"status": "success", "new_status": body.status}

@app.post("/orders/{order_id}/report-payment")
async def report_payment(order_id: str, method: str):
    await db.orders.update_one(
        {"$or": [{"_id": order_id}, {"id": order_id}]},
        {"$set": {"payment_reported": True, "payment_method": method}},
    )
    return {"status": "success"}

@app.post("/api/payments/create-checkout-session/{order_id}")
async def create_checkout_session(order_id: str):
    order = await db.orders.find_one({"$or": [{"_id": order_id}, {"id": order_id}]})
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
# HTML Admin Dashboard (Served at /admin)
# ==============================================================================
@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_portal():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sour Apple Laundry — Admin Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-800 min-h-screen">
      <header class="bg-green-700 text-white shadow py-4 px-6 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-black tracking-wide">🍏 Sour Apple Laundry</h1>
          <p class="text-xs text-green-100">VIP Operations & Order Management Dashboard</p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="sendTestAlert()" class="bg-yellow-400 hover:bg-yellow-500 text-green-900 font-bold px-4 py-2 rounded-xl text-xs transition">
            🔔 Test Email Alert
          </button>
          <a href="/docs" target="_blank" class="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-xl text-xs font-semibold">
            API Docs
          </a>
        </div>
      </header>

      <main class="max-w-6xl mx-auto p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold">Active Customer Orders</h2>
          <button onclick="fetchOrders()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow">
            🔄 Refresh Orders
          </button>
        </div>

        <div id="orders-container" class="space-y-4">
          <p class="text-gray-400 text-sm">Loading orders...</p>
        </div>
      </main>

      <script>
        async function fetchOrders() {
          const container = document.getElementById('orders-container');
          try {
            const res = await fetch('/api/admin/orders');
            const data = await res.json();
            if (!data.length) {
              container.innerHTML = '<div class="p-8 bg-white rounded-2xl shadow-sm text-center text-gray-400">No orders placed yet.</div>';
              return;
            }
            container.innerHTML = data.map(o => `
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-lg text-gray-900">${o.e_signature}</span>
                    ${o.is_mvcc ? '<span class="bg-pink-100 text-pink-700 text-xs px-2.5 py-0.5 rounded-full font-bold">MVCC Discount</span>' : ''}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Date: ${o.created_at} | Size: <span class="font-semibold text-gray-700">${o.bag_size}</span> | Total: <span class="font-bold text-green-600">$${o.total_price}</span></p>
                  <p class="text-xs text-gray-400">Payment: ${o.payment_reported ? 'Paid via ' + o.payment_method : 'Pending Payment'}</p>
                </div>
                <div class="flex items-center gap-3">
                  <select onchange="updateStatus('${o.id}', this.value)" class="text-xs border-2 border-gray-200 rounded-xl px-3 py-2 font-semibold">
                    ${['Awaiting Pickup', 'Picked Up', 'Washing', 'Folding', 'Ready for Pickup', 'Delivered'].map(s => `
                      <option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
            `).join('');
          } catch(err) {
            container.innerHTML = '<p class="text-red-500 text-sm">Error connecting to database.</p>';
          }
        }

        async function updateStatus(id, newStatus) {
          await fetch('/orders/' + id + '/status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: newStatus})
          });
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
# Robust Static Files & SPA Routing Fallback
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
    if full_path.strip("/") == "admin":
        return await serve_admin_portal()

    if STATIC_DIR:
        requested_file = STATIC_DIR / full_path
        if full_path and requested_file.is_file():
            return FileResponse(str(requested_file))
        index_file = STATIC_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))

    # Built-in Customer Storefront fallback if index.html is missing
    return HTMLResponse("""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sour Apple Wash & Fold VIP Laundry Services</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-900 font-sans min-h-screen flex flex-col justify-between">
      <header class="p-6 bg-white shadow-sm flex justify-between items-center">
        <h1 class="text-xl font-black text-green-700">🍏 Sour Apple Wash & Fold</h1>
        <a href="/admin" class="text-xs bg-gray-100 hover:bg-gray-200 font-bold px-3 py-2 rounded-xl">Admin</a>
      </header>
      <main class="max-w-md mx-auto p-6 text-center space-y-6">
        <h2 class="text-3xl font-black text-green-800">Clean Clothes. Less Stress. 💚</h2>
        <p class="text-sm text-gray-600">Fresh VIP laundry delivery in Utica & MVCC Campus.</p>
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div class="text-left font-bold text-sm text-gray-700">Service Tiers:</div>
          <div class="flex justify-between items-center text-sm font-semibold"><span>Small Bag</span><span class="text-green-600 font-bold">$20 ($10 MVCC)</span></div>
          <div class="flex justify-between items-center text-sm font-semibold"><span>Medium Bag</span><span class="text-green-600 font-bold">$30 ($20 MVCC)</span></div>
          <div class="flex justify-between items-center text-sm font-semibold"><span>Large Bag</span><span class="text-green-600 font-bold">$40 ($30 MVCC)</span></div>
        </div>
      </main>
      <footer class="p-6 text-center text-xs text-gray-400">Sour Apple Wash & Fold VIP Laundry Services</footer>
    </body>
    </html>
    """)
