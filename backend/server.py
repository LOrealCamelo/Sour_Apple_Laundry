import os
import json
import urllib.request
import smtplib
from datetime import datetime, timedelta
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import stripe

# --- Environment & Configuration ---
SECRET_KEY = os.getenv("JWT_SECRET", "sour-apple-super-secret-key")
ALGORITHM = "HS256"
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
SMTP_USER = os.getenv("SMTP_USER", "your-gmail@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "AdminPass123!")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
stripe.api_key = STRIPE_SECRET_KEY

# 1. Initialize FastAPI Application
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGODB_URL)
db = client.sour_apple_laundry

# 2. Data Models
class OrderCreate(BaseModel):
    bag_size: str
    is_mvcc: bool = False
    add_ons: List[str] = []
    digital_contract_accepted: bool = True
    e_signature: str
    bag_photo_url: Optional[str] = None
    photos: List[str] = []

class Order(OrderCreate):
    id: str
    total_price: float
    status: str = "Pending Admin Approval"
    status_history: List[dict] = []
    created_at: datetime
    payment_reported: bool = False
    payment_method: Optional[str] = None

class ApproveBody(BaseModel):
    price: Optional[float] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    admin_note: Optional[str] = ""

class RejectBody(BaseModel):
    reason: str = ""

class StatusUpdate(BaseModel):
    status: str

# 3. Pricing & Async Email Alerts
def calculate_price(bag_size: str, is_mvcc: bool) -> float:
    prices = {
        "Small": 10.0 if is_mvcc else 20.0,
        "Medium": 20.0 if is_mvcc else 30.0,
        "Large": 30.0 if is_mvcc else 40.0
    }
    return prices.get(bag_size, 0.0)

def send_order_alert(order: dict):
    subject = f"New Laundry Order: {order.get('e_signature')}"
    photo = order.get("bag_photo_url") or (order.get("photos") and order.get("photos")[0])
    photo_html = f"<p><b>Bag Photo:</b><br><img src='{photo}' style='max-width:300px;border-radius:12px;'></p>" if photo else ""
        
    html = f"""
    <html><body style="font-family:sans-serif;background:#09090b;color:#f4f4f5;padding:20px;">
    <h2 style="color:#a3e635;">New Laundry Order Received</h2>
    <p><b>Customer:</b> {order.get('e_signature')}</p>
    <p><b>Bag Size:</b> {order.get('bag_size')}</p>
    <p><b>Total Price:</b> ${order.get('total_price')}</p>
    <p><b>MVCC Student:</b> {order.get('is_mvcc')}</p>
    {photo_html}
    <p><a href="https://sourapplelaundry.com/admin" style="background:#a3e635;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">Open Admin Dashboard</a></p>
    </body></html>"""
    
    if RESEND_API_KEY:
        try:
            url = "https://api.resend.com/emails"
            headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
            data = json.dumps({"from": "onboarding@resend.dev", "to": ADMIN_EMAIL, "subject": subject, "html": html}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except Exception as e:
            print("Resend error:", e)
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
            print("SMTP error:", e)

# 4. Customer Endpoints
@app.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks):
    price = calculate_price(order_data.bag_size, order_data.is_mvcc)
    new_order = {
        **order_data.dict(),
        "total_price": price,
        "status": "Pending Admin Approval",
        "status_history": [{"status": "Pending Admin Approval", "timestamp": datetime.now()}],
        "created_at": datetime.now(),
        "payment_reported": False
    }
    result = await db.orders.insert_one(new_order)
    new_order["id"] = str(result.inserted_id)
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if order:
        order["id"] = str(order.get("id") or order.get("_id"))
        order.pop("_id", None)
        return order
    raise HTTPException(status_code=404, detail="Order not found")

@app.post("/orders/{order_id}/report-payment")
async def report_payment(order_id: str, method: str):
    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {"$set": {"payment_reported": True, "payment_method": method}}
    )
    return {"status": "success"}

# 5. Admin API Endpoints
@app.get("/api/admin/orders")
async def get_admin_orders(status_filter: Optional[str] = None):
    try:
        query = {}
        if status_filter and status_filter != "All":
            query["status"] = status_filter
        cursor = db.orders.find(query).sort("created_at", -1)
        orders = []
        async for doc in cursor:
            doc["id"] = str(doc.get("id") or doc.get("_id"))
            doc.pop("_id", None)
            orders.append(doc)
        return orders
    except Exception as e:
        print("Error fetching orders:", e)
        return []

@app.post("/api/admin/orders/{order_id}/approve")
async def approve_order(order_id: str, body: ApproveBody = ApproveBody()):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updates = {"status": "Approved"}
    if body.price is not None:
        updates["total_price"] = body.price
    if body.pickup_window:
        updates["pickup_window"] = body.pickup_window
    if body.delivery_window:
        updates["delivery_window"] = body.delivery_window
    if body.admin_note:
        updates["admin_note"] = body.admin_note

    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": updates,
            "$push": {"status_history": {"status": "Approved", "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "message": f"Order {order_id} approved"}

@app.post("/api/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectBody = RejectBody()):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": {"status": "Rejected", "admin_note": body.reason},
            "$push": {"status_history": {"status": "Rejected", "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "message": f"Order {order_id} rejected"}

@app.post("/api/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, body: StatusUpdate):
    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": {"status": body.status},
            "$push": {"status_history": {"status": body.status, "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "status": body.status}

# 6. Admin Portal HTML (Screenshot Design with Live Approvals & Bag Photos)
ADMIN_PORTAL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOUR APPLE ADMIN — Order Approvals, Verification & Payments</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0d1117; }
    </style>
</head>
<body class="min-h-screen text-gray-200 font-sans p-4 sm:p-6 flex flex-col items-center">

    <!-- Top Header Matching Screenshot -->
    <header class="w-full max-w-4xl text-center pt-8 pb-6 border-b border-gray-800/80 mb-8">
        <h1 class="text-2xl font-black tracking-wider text-white">
            SOUR APPLE <span class="text-[#ff2d8d]">ADMIN</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">Order Approvals, Verification &amp; Payments</p>
    </header>

    <!-- Sign In Card (Pixel-Perfect from Screenshot) -->
    <div id="signin-section" class="w-full max-w-md bg-[#161f2e] border border-gray-800/90 rounded-2xl p-8 shadow-2xl">
        <h2 class="text-lg font-bold text-[#a3e635] mb-6">Admin Sign In</h2>
        
        <form onsubmit="handleSignIn(event)" class="space-y-5">
            <div>
                <label class="block text-xs font-semibold text-gray-400 mb-2">Admin Email</label>
                <input 
                    type="email" 
                    id="admin-email" 
                    value="natture1st@gmail.com" 
                    required 
                    class="w-full bg-[#0d131d] border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#a3e635]"
                >
            </div>

            <div>
                <label class="block text-xs font-semibold text-gray-400 mb-2">Password</label>
                <input 
                    type="password" 
                    id="admin-pass" 
                    placeholder="••••••••••••••••"
                    required 
                    class="w-full bg-white text-gray-900 font-medium rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]"
                >
            </div>

            <button 
                type="submit" 
                class="w-full bg-[#a3e635] hover:bg-[#bef264] text-black font-black py-3.5 rounded-xl transition duration-150 uppercase tracking-wide text-xs shadow-lg shadow-[#a3e635]/20 mt-4 cursor-pointer"
            >
                SIGN IN TO DASHBOARD
            </button>
        </form>
    </div>

    <!-- Active Orders Dashboard (Opens Upon Sign In) -->
    <div id="dashboard-section" class="w-full max-w-5xl hidden space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161f2e] border border-gray-800 p-5 rounded-2xl">
            <div>
                <h2 class="text-lg font-bold text-white">Incoming Orders &amp; Bag Photos</h2>
                <p class="text-xs text-gray-400">Inspect the customer's bag photo for size and proper closure before approving.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="loadOrders()" class="bg-[#a3e635] hover:bg-[#bef264] text-black font-bold px-4 py-2 rounded-xl text-xs transition">
                    Refresh Orders
                </button>
                <button onclick="handleSignOut()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-xl text-xs transition">
                    Sign Out
                </button>
            </div>
        </div>

        <div id="orders-list" class="space-y-4">
            <div class="text-center py-12 text-gray-500 text-sm">Loading orders...</div>
        </div>
    </div>

    <!-- Click-to-Zoom Bag Photo Modal -->
    <div id="zoom-modal" class="fixed inset-0 bg-black/90 z-50 hidden flex items-center justify-center p-4 cursor-pointer" onclick="this.classList.add('hidden')">
        <img id="zoom-img" src="" class="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-gray-700">
    </div>

    <script>
        if (sessionStorage.getItem('sour_admin_auth') === 'true') {
            showDashboard();
        }

        function handleSignIn(e) {
            e.preventDefault();
            sessionStorage.setItem('sour_admin_auth', 'true');
            showDashboard();
        }

        function handleSignOut() {
            sessionStorage.removeItem('sour_admin_auth');
            document.getElementById('dashboard-section').classList.add('hidden');
            document.getElementById('signin-section').classList.remove('hidden');
        }

        function showDashboard() {
            document.getElementById('signin-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            loadOrders();
        }

        async function loadOrders() {
            const list = document.getElementById('orders-list');
            try {
                const res = await fetch('/api/admin/orders');
                const orders = await res.json();

                if (!orders || orders.length === 0) {
                    list.innerHTML = `<div class="bg-[#161f2e] border border-gray-800 p-8 rounded-2xl text-center text-gray-400">No orders found.</div>`;
                    return;
                }

                list.innerHTML = orders.map(order => {
                    const photo = order.bag_photo_url || (order.photos && order.photos[0]) || '';
                    const status = order.status || 'Pending Admin Approval';
                    const isApproved = status === 'Approved';
                    const isRejected = status === 'Rejected';

                    return `
                        <div class="bg-[#161f2e] border border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                            <div class="flex gap-4 items-center">
                                ${photo ? `
                                    <div class="relative group cursor-pointer" onclick="zoomImage('${photo}')" title="Click to enlarge bag photo">
                                        <img src="${photo}" class="w-24 h-24 rounded-xl object-cover border border-[#a3e635]/40 group-hover:opacity-90">
                                        <span class="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white opacity-0 group-hover:opacity-100 rounded-xl transition font-bold">Zoom</span>
                                    </div>
                                ` : `
                                    <div class="w-24 h-24 rounded-xl bg-[#0d131d] border border-dashed border-gray-700 flex items-center justify-center text-[10px] text-gray-500 text-center p-2">
                                        No Photo Uploaded
                                    </div>
                                `}

                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="font-bold text-white text-base">${order.e_signature || 'Customer Order'}</h3>
                                        <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${isApproved ? 'bg-green-900/60 text-green-300 border border-green-700' : isRejected ? 'bg-red-900/60 text-red-300 border border-red-700' : 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'}">
                                            ${status}
                                        </span>
                                    </div>
                                    <p class="text-xs text-gray-400"><b>Bag Size:</b> <span class="text-white font-medium">${order.bag_size || 'Standard'}</span> ${order.is_mvcc ? '<span class="text-xs text-[#ff2d8d] font-bold ml-1">(MVCC Student)</span>' : ''}</p>
                                    <p class="text-xs text-gray-400"><b>Total Price:</b> <span class="text-[#a3e635] font-bold text-sm">$${order.total_price || 0}</span></p>
                                    <p class="text-[10px] text-gray-500 mt-1">Order ID: ${order.id}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 w-full md:w-auto">
                                ${(!isApproved && !isRejected) ? `
                                    <button onclick="approveOrder('${order.id}')" class="flex-1 md:flex-none bg-[#a3e635] hover:bg-[#bef264] text-black font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wide transition shadow-lg shadow-[#a3e635]/10">
                                        Approve Bag
                                    </button>
                                    <button onclick="rejectOrder('${order.id}')" class="flex-1 md:flex-none bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wide transition">
                                        Reject
                                    </button>
                                ` : `
                                    <span class="text-xs text-gray-500 font-semibold px-3 py-1 bg-[#0d131d] rounded-lg border border-gray-800">Done</span>
                                `}
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                list.innerHTML = `<div class="bg-red-900/40 border border-red-700 p-4 rounded-xl text-red-300 text-xs">Error loading orders: ${err.message}</div>`;
            }
        }

        function zoomImage(url) {
            document.getElementById('zoom-img').src = url;
            document.getElementById('zoom-modal').classList.remove('hidden');
        }

        async function approveOrder(id) {
            const res = await fetch(`/api/admin/orders/${id}/approve`, { method: 'POST' });
            if (res.ok) loadOrders();
            else alert('Failed to approve order');
        }

        async function rejectOrder(id) {
            const reason = prompt('Reason for rejection (e.g. Open basket, wrong bag size):') || '';
            const res = await fetch(`/api/admin/orders/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            if (res.ok) loadOrders();
            else alert('Failed to reject order');
        }
    </script>
</body>
</html>
"""

# 7. Serving Routes
@app.get("/admin")
async def serve_admin():
    return HTMLResponse(content=ADMIN_PORTAL_HTML)

@app.get("/")
async def serve_frontend():
    for p in ["backend/static/index.html", "static/index.html", "index.html"]:
        if os.path.exists(p):
            return FileResponse(p)
    return HTMLResponse("<h1>Sour Apple VIP Laundry API Running</h1><p><a href='/admin'>Go to Admin Portal</a></p>")

if os.path.exists("backend/static"):
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
elif os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
