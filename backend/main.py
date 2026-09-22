import os
import json
import urllib.request
import smtplib
from datetime import datetime, timedelta
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import stripe

# Configuration & Flexible MongoDB detection
SECRET_KEY = os.getenv("JWT_SECRET", "sour-apple-super-secret-key")
ALGORITHM = "HS256"
MONGO_URI = os.getenv("MONGO_URL") or os.getenv("MONGODB_URL") or os.getenv("DATABASE_URL")
DB_NAME = os.getenv("DB_NAME", "sour_apple_laundry")
SMTP_USER = os.getenv("SMTP_USER", "your-gmail@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
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

# Connect to MongoDB safely with in-memory fallback
db = None
if MONGO_URI:
    try:
        client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=2500)
        db = client[DB_NAME]
    except Exception as e:
        print("MongoDB init error:", e)

# In-memory backup so the server NEVER crashes with 500
MEMORY_ORDERS = []

# 2. Pricing Calculator
def calculate_price(bag_size: str, is_mvcc: bool) -> float:
    size = (bag_size or "Small").capitalize()
    prices = {
        "Small": 10.0 if is_mvcc else 20.0,
        "Medium": 20.0 if is_mvcc else 30.0,
        "Large": 30.0 if is_mvcc else 40.0
    }
    return prices.get(size, 20.0)

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

# 3. Customer Price Estimate Endpoints (Fixes the "Unexpected token 'I'" error)
@app.post("/orders/estimate")
@app.post("/api/orders/estimate")
@app.get("/orders/estimate")
@app.get("/api/orders/estimate")
async def price_estimate(request: Request):
    data = {}
    if request.method == "POST":
        try:
            data = await request.json()
        except Exception:
            data = {}
    else:
        data = dict(request.query_params)
        
    bag_size = data.get("bag_size") or data.get("size") or "Small"
    is_mvcc = str(data.get("is_mvcc", "")).lower() in ("true", "1", "yes")
    price = calculate_price(bag_size, is_mvcc)
    
    return {
        "estimate": price,
        "price": price,
        "total_price": price,
        "bag_size": bag_size,
        "is_mvcc": is_mvcc
    }

# 4. Customer Order Submission Endpoints (Fixes submit button)
@app.post("/orders")
@app.post("/api/orders")
async def create_order(request: Request, background_tasks: BackgroundTasks):
    try:
        data = await request.json()
    except Exception:
        data = {}
        
    bag_size = data.get("bag_size") or data.get("size") or "Small"
    is_mvcc = str(data.get("is_mvcc", "")).lower() in ("true", "1", "yes")
    price = data.get("total_price") or data.get("price") or calculate_price(bag_size, is_mvcc)
    oid = f"ord_{int(datetime.now().timestamp() * 1000)}"
    
    new_order = {
        "id": oid,
        "bag_size": bag_size,
        "is_mvcc": is_mvcc,
        "total_price": float(price),
        "price": float(price),
        "status": "Pending Admin Approval",
        "status_history": [{"status": "Pending Admin Approval", "timestamp": datetime.now().isoformat()}],
        "e_signature": data.get("e_signature") or data.get("signature") or data.get("name") or "Customer Signature",
        "bag_photo_url": data.get("bag_photo_url") or (data.get("photos") and data.get("photos")[0]),
        "created_at": datetime.now().isoformat(),
        "payment_reported": False,
    }
    
    # Save to MongoDB if online
    if db is not None:
        try:
            mongo_doc = dict(new_order)
            mongo_doc["_id"] = oid
            await db.orders.insert_one(mongo_doc)
        except Exception as e:
            print("Mongo insert fallback:", e)
            
    # Keep in memory so it's always immediately retrievable
    MEMORY_ORDERS.insert(0, new_order)
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.get("/orders/{order_id}")
@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    if db is not None:
        try:
            order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
            if order:
                order["id"] = str(order.get("id") or order.get("_id"))
                order.pop("_id", None)
                return order
        except Exception:
            pass
    for o in MEMORY_ORDERS:
        if o.get("id") == order_id:
            return o
    raise HTTPException(status_code=404, detail="Order not found")

@app.post("/orders/{order_id}/report-payment")
@app.post("/api/orders/{order_id}/report-payment")
async def report_payment(order_id: str, request: Request):
    try:
        body = await request.json()
        method = body.get("method", "Cash App")
    except Exception:
        method = "Cash App"
        
    if db is not None:
        try:
            await db.orders.update_one(
                {"$or": [{"id": order_id}, {"_id": order_id}]},
                {"$set": {"payment_reported": True, "payment_method": method}}
            )
        except Exception:
            pass
    for o in MEMORY_ORDERS:
        if o.get("id") == order_id:
            o["payment_reported"] = True
            o["payment_method"] = method
    return {"status": "success"}

# 5. Admin Endpoints (Always returns valid JSON, never hangs)
@app.get("/api/admin/orders")
@app.get("/admin/orders")
async def get_admin_orders(status_filter: Optional[str] = None):
    orders = []
    if db is not None:
        try:
            query = {}
            if status_filter and status_filter != "All":
                query["status"] = status_filter
            cursor = db.orders.find(query).sort("created_at", -1)
            async for doc in cursor:
                doc["id"] = str(doc.get("id") or doc.get("_id"))
                doc.pop("_id", None)
                orders.append(doc)
        except Exception as e:
            print("Mongo fetch fallback:", e)
            
    if not orders:
        orders = MEMORY_ORDERS
        if status_filter and status_filter != "All":
            orders = [o for o in orders if o.get("status") == status_filter]
    return orders

@app.post("/api/admin/orders/{order_id}/approve")
@app.post("/admin/orders/{order_id}/approve")
async def approve_order(order_id: str):
    if db is not None:
        try:
            await db.orders.update_one(
                {"$or": [{"id": order_id}, {"_id": order_id}]},
                {"$set": {"status": "Approved"}}
            )
        except Exception:
            pass
    for o in MEMORY_ORDERS:
        if o.get("id") == order_id:
            o["status"] = "Approved"
    return {"status": "success", "message": f"Order {order_id} approved"}

@app.post("/api/admin/orders/{order_id}/reject")
@app.post("/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, request: Request):
    reason = "Rejected"
    try:
        b = await request.json()
        reason = b.get("reason", "Rejected")
    except Exception:
        pass
        
    if db is not None:
        try:
            await db.orders.update_one(
                {"$or": [{"id": order_id}, {"_id": order_id}]},
                {"$set": {"status": "Rejected", "admin_note": reason}}
            )
        except Exception:
            pass
    for o in MEMORY_ORDERS:
        if o.get("id") == order_id:
            o["status"] = "Rejected"
            o["admin_note"] = reason
    return {"status": "success", "message": f"Order {order_id} rejected"}

# 6. Admin Portal (Dark Theme from your Screenshot)
DARK_ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOUR APPLE ADMIN — Order Approvals, Verification & Payments</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #0b0f17; }</style>
</head>
<body class="min-h-screen text-gray-200 font-sans p-4 sm:p-6 flex flex-col items-center">

    <header class="w-full max-w-4xl text-center pt-8 pb-6 border-b border-gray-800/80 mb-8">
        <h1 class="text-2xl font-black tracking-wider text-white">
            SOUR APPLE <span class="text-[#ff2d8d]">ADMIN</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">Order Approvals, Verification &amp; Payments</p>
    </header>

    <div id="signin-section" class="w-full max-w-md bg-[#131b26] border border-gray-800/90 rounded-2xl p-8 shadow-2xl">
        <h2 class="text-lg font-bold text-[#a3e635] mb-6">Admin Sign In</h2>
        <form onsubmit="handleSignIn(event)" class="space-y-5">
            <div>
                <label class="block text-xs font-semibold text-gray-400 mb-2">Admin Email</label>
                <input type="email" id="admin-email" value="natture1st@gmail.com" required 
                    class="w-full bg-[#0a0f18] border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#a3e635]">
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-400 mb-2">Password</label>
                <input type="password" id="admin-pass" placeholder="••••••••••••••••" required 
                    class="w-full bg-white text-gray-900 font-medium rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#a3e635]">
            </div>
            <button type="submit" class="w-full bg-[#a3e635] hover:bg-[#bef264] text-black font-black py-3.5 rounded-xl transition uppercase tracking-wide text-xs shadow-lg shadow-[#a3e635]/20 mt-4 cursor-pointer">
                SIGN IN TO DASHBOARD
            </button>
        </form>
    </div>

    <div id="dashboard-section" class="w-full max-w-5xl hidden space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131b26] border border-gray-800 p-5 rounded-2xl">
            <div>
                <h2 class="text-lg font-bold text-white">Incoming Orders &amp; Bag Photos</h2>
                <p class="text-xs text-gray-400">Verify customer bag photo for closure and correct size before approving.</p>
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
            list.innerHTML = `<div class="text-center py-12 text-gray-500 text-sm">Loading orders...</div>`;
            try {
                const res = await fetch('/api/admin/orders');
                if (!res.ok) {
                    list.innerHTML = `<div class="bg-[#131b26] border border-gray-800 p-8 rounded-2xl text-center text-gray-400">Unable to load orders (Status ${res.status}).</div>`;
                    return;
                }
                const data = await res.json();
                const orders = Array.isArray(data) ? data : [];

                if (!orders || orders.length === 0) {
                    list.innerHTML = `<div class="bg-[#131b26] border border-gray-800 p-8 rounded-2xl text-center text-gray-400">No pending orders found.</div>`;
                    return;
                }

                list.innerHTML = orders.map(order => {
                    const photo = order.bag_photo_url || (order.photos && order.photos[0]) || '';
                    const status = order.status || 'Pending Admin Approval';
                    const isApproved = status === 'Approved';
                    const isRejected = status === 'Rejected';

                    return `
                        <div class="bg-[#131b26] border border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                            <div class="flex gap-4 items-center">
                                ${photo ? `
                                    <div class="relative group cursor-pointer" onclick="zoomImage('${photo}')" title="Click to enlarge bag photo">
                                        <img src="${photo}" class="w-24 h-24 rounded-xl object-cover border border-[#a3e635]/40 group-hover:opacity-90">
                                        <span class="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white opacity-0 group-hover:opacity-100 rounded-xl transition font-bold">Zoom</span>
                                    </div>
                                ` : `
                                    <div class="w-24 h-24 rounded-xl bg-[#0a0f18] border border-dashed border-gray-700 flex items-center justify-center text-[10px] text-gray-500 text-center p-2">
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
                                    <p class="text-[10px] text-gray-500 mt-1">ID: ${order.id}</p>
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
                                    <span class="text-xs text-gray-500 font-semibold px-3 py-1 bg-[#0a0f18] rounded-lg border border-gray-800">Done</span>
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

# 7. Serving Frontend and Admin
@app.get("/admin")
async def serve_admin():
    return HTMLResponse(content=DARK_ADMIN_HTML)

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
